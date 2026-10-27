import fs from 'fs';
import zlib from 'zlib';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { parseWiktionaryEnglish } from './_lib/wiktionary.js';

const OXFORD_BASE = 'https://www.oxfordlearnersdictionaries.com/definition/english/';
const OXFORD_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};
// Upper bound on extra Oxford pages fetched per word (other parts of speech / homographs)
const MAX_SIBLING_ENTRIES = 6;

async function loadOxfordPage(url) {
  try {
    const res = await fetch(url, { headers: OXFORD_HEADERS, timeout: 5000 });
    if (!res.ok) return null;
    const $ = cheerio.load(await res.text());
    return { $, slug: getSlug(res.url) };
  } catch (e) {
    return null;
  }
}

function getSlug(href = '') {
  const match = href.match(/\/definition\/english\/([^/?#]+)/);
  return match ? match[1] : '';
}

/**
 * Reads every pronunciation inside one `.phons_br` / `.phons_n_am` block, in order.
 * Oxford lays them out as: [prefix label] [audio button] <phon> [sep] ...
 * e.g. "can": /kən/, strong form /kæn/ — "either": /ˈaɪðə(r)/, /ˈiːðə(r)/
 */
function parsePhons($, $block) {
  const prons = [];
  let label = '';
  let audio = '';
  $block.children().each((i, el) => {
    const $el = $(el);
    if ($el.hasClass('prefix') || $el.hasClass('labels')) {
      label = [label, $el.text().trim()].filter(Boolean).join(' ');
    } else if ($el.hasClass('audio_play_button')) {
      audio = $el.attr('data-src-mp3') || '';
    } else if ($el.hasClass('phon')) {
      const phon = $el.text().replace(/\//g, '').trim();
      if (phon) prons.push({ text: `/${phon}/`, audio, label });
      label = '';
      audio = '';
    }
  });
  return prons;
}

/**
 * Parses the headword entry of one Oxford page: part of speech, all UK/US
 * pronunciations shown under the headword, and the first few definitions.
 */
function parseEntry($) {
  const $entry = $('.entry').first();
  const $top = $entry.find('.top-container').first();
  const $phonetics = $top.find('.phonetics').first();

  const pos = ($top.find('.pos').first().text() || $('.pos').first().text()).trim();
  const definitions = [];
  ($entry.length ? $entry : $.root()).find('.def').each((j, defEl) => {
    const d = $(defEl).text().trim();
    if (d && definitions.length < 4) definitions.push(d);
  });

  // Verb Forms table: records /rɪˈkɔːdz/, recorded, recording ... each with its own audio
  const forms = [];
  $entry.find('.verb_forms_table tr.verb_form').each((i, row) => {
    const $row = $(row);
    const $br = $row.find('.phons_br').first();
    const word = ($br.attr('wd') || '').toLowerCase();
    if (!word) return;
    forms.push({
      form: $row.attr('form') || '',
      word,
      uk: parsePhons($, $br),
      us: parsePhons($, $row.find('.phons_n_am').first())
    });
  });

  return {
    pos,
    definitions,
    uk: parsePhons($, $phonetics.find('.phons_br').first()),
    us: parsePhons($, $phonetics.find('.phons_n_am').first()),
    forms
  };
}

/**
 * Other Oxford entries for the same headword, e.g. record_1 (noun) -> record_2 (verb),
 * bow1_1 (verb /baʊ/) -> bow2_1 (noun /bəʊ/). Found in "All matches" and "Nearby words".
 */
function findSiblingSlugs($, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sameHeadword = new RegExp(`^${escaped}\\d*(_\\d+)?$`, 'i');
  const slugs = [];
  $('#relatedentries a, .nearby a').each((i, el) => {
    const slug = getSlug($(el).attr('href'));
    if (slug && sameHeadword.test(slug) && !slugs.includes(slug)) slugs.push(slug);
  });
  return slugs;
}

/**
 * Loads every Oxford page of the headword. "Nearby words" only lists entries close
 * to the current one (wind1_1 links wind2_1 but not wind2_2), so keep following
 * the newly found pages until nothing new turns up or the cap is reached.
 */
async function loadAllEntryPages(firstPage, word) {
  const pages = [firstPage];
  const seen = new Set([firstPage.slug]);
  let frontier = [firstPage];

  while (frontier.length > 0 && pages.length <= MAX_SIBLING_ENTRIES) {
    const slugs = [...new Set(frontier.flatMap(p => findSiblingSlugs(p.$, word)))]
      .filter(slug => !seen.has(slug))
      .slice(0, MAX_SIBLING_ENTRIES + 1 - pages.length);
    slugs.forEach(slug => seen.add(slug));

    frontier = (await Promise.all(slugs.map(slug => loadOxfordPage(`${OXFORD_BASE}${slug}`))))
      .filter(p => p && !pages.some(existing => existing.slug === p.slug));
    pages.push(...frontier);
  }

  // Oxford order: can1, can2_1, can2_2 / record_1, record_2
  return pages.sort((a, b) => a.slug.localeCompare(b.slug, 'en', { numeric: true }));
}

/**
 * Merges entries that share identical pronunciations so the UI shows each
 * distinct pronunciation once, tagged with every part of speech it applies to.
 * present (adjective, noun) /ˈpreznt/ — present (verb) /prɪˈzent/
 */
function groupPronunciations(entries) {
  const groups = [];
  entries.forEach(({ pos, uk, us }) => {
    if (uk.length === 0 && us.length === 0) return;
    const key = JSON.stringify([uk.map(p => p.text + p.label), us.map(p => p.text + p.label)]);
    const existing = groups.find(g => g.key === key);
    if (existing) {
      if (pos && !existing.pos.includes(pos)) existing.pos.push(pos);
    } else {
      groups.push({ key, pos: pos ? [pos] : [], uk, us });
    }
  });
  return groups.map(({ key, ...group }) => group);
}

/**
 * Scrapes Oxford Learner's Dictionaries for accurate IPA, human audio recordings,
 * definitions, and example sentences. Follows every entry of the headword so
 * words whose pronunciation changes with the part of speech are fully covered.
 */
async function fetchOxford(word) {
  const tryUrls = [
    `${OXFORD_BASE}${encodeURIComponent(word)}`,
    `${OXFORD_BASE}${encodeURIComponent(word)}_1`
  ];

  for (const url of tryUrls) {
    const page = await loadOxfordPage(url);
    if (!page) continue;
    const { $ } = page;

    const parsedEntries = (await loadAllEntryPages(page, word)).map(p => parseEntry(p.$));

    const entries = parsedEntries
      .filter(e => e.pos || e.definitions.length > 0)
      .map(({ pos, definitions }) => ({ pos, definitions }));
    const pronunciations = groupPronunciations(parsedEntries);
    const firstUk = pronunciations.find(g => g.uk.length)?.uk[0];
    const firstUs = pronunciations.find(g => g.us.length)?.us[0];

    const examples = [];
    $('.x').slice(0, 5).each((i, el) => {
      const ex = $(el).text().trim();
      if (ex) examples.push(ex);
    });

    const collocations = [];
    $('.colloc, .collocator').slice(0, 8).each((i, el) => {
      const c = $(el).text().trim();
      if (c) collocations.push(c);
    });

    const idioms = [];
    $('.idm-g').slice(0, 5).each((i, el) => {
      const title = $(el).find('.idm').text().trim();
      const def = $(el).find('.def').text().trim();
      if (title) idioms.push({ title, definition: def });
    });

    return {
      found: true,
      phonetics: {
        uk: { text: firstUk?.text || '', audio: firstUk?.audio || '' },
        us: { text: firstUs?.text || '', audio: firstUs?.audio || '' }
      },
      pronunciations,
      definitions: entries[0]?.definitions[0] || $('.def').first().text().trim() || '',
      entries,
      examples,
      collocations,
      idioms,
      parsedEntries
    };
  }

  return null;
}

const googleTtsUrl = (word, accent) =>
  `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${accent === 'uk' ? 'en-GB' : 'en-US'}&q=${encodeURIComponent(word)}`;

const FORM_LABELS = { thirdps: 'ngôi 3 số ít', prespart: 'V-ing', past: 'quá khứ', pastpart: 'quá khứ phân từ' };
const SUFFIX_LABELS = { s: 'ngôi 3 số ít', ing: 'V-ing', ed: 'quá khứ' };

/**
 * Adds an -s / -ing / -ed ending to an IPA transcription using the regular rules:
 * -s: /ɪz/ after s z ʃ ʒ tʃ dʒ, /s/ after other voiceless sounds, /z/ elsewhere
 * -ed: /ɪd/ after t d, /t/ after voiceless sounds, /d/ elsewhere
 * UK linking r is pronounced before a vowel: /ˈɒfə(r)/ + -ing -> /ˈɒfərɪŋ/, /ˈɒfəz/
 */
function addSuffixToIpa(ipa, suffix) {
  const core = ipa.replace(/\//g, '').trim();
  const hasLinkingR = /\(r\)$/.test(core);
  const base = core.replace(/\(r\)$/, '');

  let ending = 'ɪŋ';
  if (suffix === 's') {
    ending = /(s|z|ʃ|ʒ)$/.test(base) ? 'ɪz' : /(p|t|k|f|θ)$/.test(base) ? 's' : 'z';
  } else if (suffix === 'ed') {
    ending = /(t|d)$/.test(base) ? 'ɪd' : /(p|k|f|θ|s|ʃ)$/.test(base) ? 't' : 'd';
  }
  const addsSyllable = ending.startsWith('ɪ');
  const linkingR = hasLinkingR && addsSyllable ? 'r' : '';
  // One syllable becomes two: Oxford then marks the stress (/bɒks/ -> /ˈbɒksɪz/)
  const stress = addsSyllable && !/[ˈˌ]/.test(base) ? 'ˈ' : '';
  return `/${stress}${base}${linkingR}${ending}/`;
}

/**
 * Possible base words for an inflected form, most likely first:
 * records -> record, studies -> study, boxes -> box, making -> make, running -> run.
 * Only spellings known to the offline dictionary are kept, to avoid useless Oxford requests.
 */
function findBaseCandidates(word, offlineLemma) {
  const stemVariants = (stem) => [stem, `${stem}e`, /([b-df-hj-np-tv-z])\1$/.test(stem) ? stem.slice(0, -1) : ''];
  const guesses = [];
  if (word.endsWith('ies')) guesses.push(`${word.slice(0, -3)}y`);
  if (word.endsWith('s') && !word.endsWith('ss')) guesses.push(word.slice(0, -1));
  if (word.endsWith('es')) guesses.push(word.slice(0, -2));
  if (word.endsWith('ying')) guesses.push(`${word.slice(0, -4)}ie`);
  if (word.endsWith('ing')) guesses.push(...stemVariants(word.slice(0, -3)));
  if (word.endsWith('ied')) guesses.push(`${word.slice(0, -3)}y`);
  if (word.endsWith('ed')) guesses.push(...stemVariants(word.slice(0, -2)));

  const dictionary = getOfflineDictionary();
  const known = guesses.filter(g => g.length > 1 && Array.isArray(dictionary[g]));
  return [...new Set([offlineLemma, ...known].filter(Boolean))].slice(0, 3);
}

/**
 * Pronunciation of `word` (an inflected form) for one entry of its base word:
 * taken from Oxford's Verb Forms table when listed there (real IPA + audio),
 * otherwise derived from the base pronunciation (noun plurals, verbs without a table).
 */
function inflectEntry(entry, word, suffix) {
  const form = entry.forms.find(f => f.word === word);
  if (form) {
    return { pos: `${entry.pos} (${FORM_LABELS[form.form] || form.form})`, uk: form.uk, us: form.us };
  }

  const pos = entry.pos.toLowerCase();
  const isVerb = /\bverb\b/.test(pos);
  // Verb whose table lists other forms only: wrong base (hoping is not a form of hop)
  if (isVerb && entry.forms.length > 0) return null;

  let label = '';
  if (suffix === 's' && /\bnoun\b/.test(pos)) label = 'số nhiều';
  else if (isVerb) label = SUFFIX_LABELS[suffix];
  if (!label || (entry.uk.length === 0 && entry.us.length === 0)) return null;

  const derive = (prons, accent) => prons.map(p => ({
    text: addSuffixToIpa(p.text, suffix),
    audio: googleTtsUrl(word, accent),
    label: [p.label, 'suy ra'].filter(Boolean).join(', ')
  }));
  return { pos: `${entry.pos} (${label})`, uk: derive(entry.uk, 'uk'), us: derive(entry.us, 'us') };
}

/**
 * Oxford has no page for most inflected forms (records, recording, recorded).
 * Look up the base word instead and build the inflected form's pronunciations from it.
 */
async function fetchOxfordForInflectedForm(word, offlineLemma) {
  const suffix = word.endsWith('ing') ? 'ing' : word.endsWith('ed') ? 'ed' : word.endsWith('s') ? 's' : '';

  for (const base of findBaseCandidates(word, offlineLemma)) {
    const baseData = await fetchOxford(base);
    if (!baseData) continue;

    const formEntries = baseData.parsedEntries.map(e => inflectEntry(e, word, suffix)).filter(Boolean);
    if (formEntries.length === 0) continue;

    // A derived pronunciation that Oxford also lists (offers: noun plural = verb form)
    // takes Oxford's version and audio, so both parts of speech end up in one group
    ['uk', 'us'].forEach((accent) => {
      const recorded = formEntries.flatMap(e => e[accent]).filter(p => !p.label.includes('suy ra'));
      formEntries.forEach((e) => {
        e[accent] = e[accent].map(p => recorded.find(r => r.text === p.text) || p);
      });
    });

    const pronunciations = groupPronunciations(formEntries);
    const firstUk = pronunciations.find(g => g.uk.length)?.uk[0];
    const firstUs = pronunciations.find(g => g.us.length)?.us[0];
    return {
      ...baseData,
      phonetics: {
        uk: { text: firstUk?.text || '', audio: firstUk?.audio || '' },
        us: { text: firstUs?.text || '', audio: firstUs?.audio || '' }
      },
      pronunciations,
      baseWord: base
    };
  }

  return null;
}

const WIKTIONARY_API = 'https://vi.wiktionary.org/w/api.php';
// Wikimedia asks API clients to identify themselves with a descriptive User-Agent
const WIKTIONARY_USER_AGENT = 'LearningEnglishVocabTrainer/1.0 (https://github.com/DuyNguyenPhuoc/LearningEnglish)';
// Successful lookups, kept while the server instance is warm
const vnCache = new Map();
// Google answers 429 when this IP sends too many requests; stay away until it allows us back
let googleBlockedUntil = 0;

/**
 * Vietnamese meanings from Vietnamese Wiktionary (Free Vietnamese Dictionary Project data,
 * CC BY-SA) through the official MediaWiki API, grouped by part of speech.
 * An inflected form without its own meanings (records, studied) uses its base word's.
 */
async function fetchWiktionary(word, followLemma = true) {
  try {
    const url = `${WIKTIONARY_API}?action=parse&prop=wikitext&format=json&formatversion=2&redirects=1&page=${encodeURIComponent(word)}`;
    const res = await fetch(url, { headers: { 'User-Agent': WIKTIONARY_USER_AGENT }, timeout: 4000 });
    if (!res.ok) return { translation: '', vnEntries: [] };

    const data = await res.json();
    const { vnEntries, lemma } = data?.parse?.wikitext
      ? parseWiktionaryEnglish(data.parse.wikitext)
      : { vnEntries: [], lemma: '' };

    if (vnEntries.length === 0 && followLemma && lemma && lemma.toLowerCase() !== word) {
      const base = await fetchWiktionary(lemma.toLowerCase(), false);
      return base.vnEntries.length > 0 ? { ...base, lemma: lemma.toLowerCase() } : base;
    }
    return { translation: vnEntries[0]?.meanings[0] || '', vnEntries };
  } catch (e) {
    // Missing page, throttled (non-JSON body) or network error
    return { translation: '', vnEntries: [] };
  }
}

/**
 * Fetches Vietnamese meanings and parts of speech from Google Translate API.
 */
async function fetchGoogleTranslate(word) {
  if (Date.now() < googleBlockedUntil) return { translation: '', vnEntries: [] };

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&dt=bd&q=${encodeURIComponent(word)}`;
    const res = await fetch(url, { timeout: 4000 });
    if (res.status === 429) {
      const retryAfterSec = Number(res.headers.get('retry-after')) || 300;
      googleBlockedUntil = Date.now() + retryAfterSec * 1000;
    }
    if (!res.ok) return { translation: '', vnEntries: [] };

    const data = await res.json();
    const translation = data[0]?.[0]?.[0] || '';
    const dict = data[1] || [];

    const vnEntries = dict.map(item => ({
      pos: item[0],
      meanings: item[1] || []
    }));

    if (vnEntries.length === 0 && translation && translation.toLowerCase() !== word.toLowerCase()) {
      vnEntries.push({ pos: 'Nghĩa', meanings: [translation] });
    }

    return { translation, vnEntries };
  } catch (e) {
    return { translation: '', vnEntries: [] };
  }
}

/**
 * Offline English -> Vietnamese dictionary (~95k words) built from the Vietnamese Wiktionary
 * dump by scripts/build_vi_dictionary.js. Loaded once per server instance.
 */
let offlineDictionary = null;
function getOfflineDictionary() {
  if (!offlineDictionary) {
    try {
      const file = new URL('./_data/en_vi.json.gz', import.meta.url);
      offlineDictionary = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
    } catch (e) {
      console.error('Offline Vietnamese dictionary unavailable:', e.message);
      offlineDictionary = {};
    }
  }
  return offlineDictionary;
}

function lookupOffline(word) {
  const dictionary = getOfflineDictionary();
  let value = dictionary[word];
  let lemma = '';
  // Inflected forms point to their base word: "records" -> "record"
  if (typeof value === 'string') {
    lemma = value;
    value = dictionary[value];
  }
  if (!Array.isArray(value)) return { translation: '', vnEntries: [] };

  const vnEntries = value.map(([pos, meanings]) => ({ pos, meanings }));
  return { translation: vnEntries[0]?.meanings[0] || '', vnEntries, lemma };
}

/**
 * Vietnamese meanings: offline dictionary first (no network, never rate limited), then the
 * live Wiktionary API for pages newer than the dump, then Google Translate as a last resort.
 */
async function fetchVietnameseMeanings(word) {
  const offline = lookupOffline(word);
  if (offline.vnEntries.length > 0) return { ...offline, source: 'wiktionary' };

  if (vnCache.has(word)) return vnCache.get(word);

  let result = { ...(await fetchWiktionary(word)), source: 'wiktionary' };
  if (result.vnEntries.length === 0) {
    result = { ...(await fetchGoogleTranslate(word)), source: 'google' };
  }
  if (result.vnEntries.length === 0) return { translation: '', vnEntries: [], source: '' };

  if (vnCache.size >= 1000) vnCache.delete(vnCache.keys().next().value);
  vnCache.set(word, result);
  return result;
}

export default async function handler(req, res) {
  const { word } = req.query;

  if (!word) {
    return res.status(400).json({ error: 'Word parameter is required' });
  }

  const normalized = word.toLowerCase().trim();

  try {
    let [oxfordData, vnData] = await Promise.all([
      fetchOxford(normalized)
        .then(data => data || fetchOxfordForInflectedForm(normalized, lookupOffline(normalized).lemma)),
      fetchVietnameseMeanings(normalized)
    ]);

    // Inflected form unknown to the Vietnamese sources: use its base word's meanings
    if (!(vnData?.vnEntries?.length > 0) && oxfordData?.baseWord) {
      const base = lookupOffline(oxfordData.baseWord);
      if (base.vnEntries.length > 0) vnData = { ...base, lemma: oxfordData.baseWord, source: 'wiktionary' };
    }

    // Google Translate TTS audio fallback URLs (direct MP3 streams)
    const googleUkAudio = googleTtsUrl(normalized, 'uk');
    const googleUsAudio = googleTtsUrl(normalized, 'us');

    const ukAudio = oxfordData?.phonetics?.uk?.audio || (vnData?.vnEntries?.length > 0 ? googleUkAudio : '');
    const usAudio = oxfordData?.phonetics?.us?.audio || (vnData?.vnEntries?.length > 0 ? googleUsAudio : '');
    const ukText = oxfordData?.phonetics?.uk?.text || '';
    const usText = oxfordData?.phonetics?.us?.text || '';

    const pronunciations = oxfordData?.pronunciations || [];
    const entries = oxfordData?.entries || [];
    const vnEntries = vnData?.vnEntries || [];
    const definitions = oxfordData?.definitions || vnData?.translation || 'No definition found.';
    const examples = oxfordData?.examples || [];
    const collocations = oxfordData?.collocations || [];
    const idioms = oxfordData?.idioms || [];

    const found = Boolean((oxfordData && oxfordData.found) || vnEntries.length > 0);

    const result = {
      word: normalized,
      phonetics: {
        uk: { text: ukText, audio: ukAudio },
        us: { text: usText, audio: usAudio }
      },
      pronunciations,
      definitions,
      entries,
      vnEntries,
      vnSource: vnData?.source || '',
      vnLemma: vnData?.lemma || '',
      // Set when the word is an inflected form looked up through its base word (records -> record)
      baseWord: oxfordData?.baseWord || '',
      examples,
      idioms,
      collocations,
      found
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(result));
  } catch (error) {
    console.error(`Dictionary lookup error for "${word}":`, error.message);
    res.status(500).json({ word: normalized, found: false, error: 'Internal Server Error' });
  }
}
