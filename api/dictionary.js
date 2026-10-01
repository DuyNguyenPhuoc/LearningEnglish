import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

/**
 * Scrapes Oxford Learner's Dictionaries for accurate IPA, human audio recordings,
 * definitions, and example sentences.
 */
async function fetchOxford(word) {
  const tryUrls = [
    `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(word)}`,
    `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(word)}_1`
  ];

  for (const url of tryUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 5000
      });

      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);

        const ukPhon = $('.phons_br .phon').first().text().replace(/\//g, '').trim();
        const ukAudio = $('.phons_br .audio_play_button').first().attr('data-src-mp3') || '';

        const usPhon = $('.phons_n_am .phon').first().text().replace(/\//g, '').trim();
        const usAudio = $('.phons_n_am .audio_play_button').first().attr('data-src-mp3') || '';

        const entries = [];
        $('.entry').each((i, el) => {
          const $el = $(el);
          const pos = $el.find('.pos').first().text().trim();
          const defs = [];
          $el.find('.def').each((j, defEl) => {
            const d = $(defEl).text().trim();
            if (d && defs.length < 4) defs.push(d);
          });
          if (pos || defs.length > 0) entries.push({ pos, definitions: defs });
        });

        if (entries.length === 0) {
          const pos = $('.pos').first().text().trim();
          const defs = [];
          $('.def').slice(0, 4).each((j, defEl) => {
            const d = $(defEl).text().trim();
            if (d) defs.push(d);
          });
          if (pos || defs.length > 0) entries.push({ pos, definitions: defs });
        }

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
            uk: { text: ukPhon ? `/${ukPhon}/` : '', audio: ukAudio },
            us: { text: usPhon ? `/${usPhon}/` : '', audio: usAudio }
          },
          definitions: entries[0]?.definitions[0] || $('.def').first().text().trim() || '',
          entries,
          examples,
          collocations,
          idioms
        };
      }
    } catch (e) {
      // Continue to next Oxford URL attempt
    }
  }

  return null;
}

/**
 * Fetches Vietnamese meanings and parts of speech from Google Translate API.
 */
async function fetchGoogleTranslate(word) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&dt=bd&q=${encodeURIComponent(word)}`;
    const res = await fetch(url, { timeout: 4000 });
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

export default async function handler(req, res) {
  const { word } = req.query;

  if (!word) {
    return res.status(400).json({ error: 'Word parameter is required' });
  }

  const normalized = word.toLowerCase().trim();

  try {
    const [oxfordData, gtData] = await Promise.all([
      fetchOxford(normalized),
      fetchGoogleTranslate(normalized)
    ]);

    // Google Translate TTS audio fallback URLs (direct MP3 streams)
    const googleUkAudio = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-GB&q=${encodeURIComponent(normalized)}`;
    const googleUsAudio = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-US&q=${encodeURIComponent(normalized)}`;

    const ukAudio = oxfordData?.phonetics?.uk?.audio || (gtData?.vnEntries?.length > 0 ? googleUkAudio : '');
    const usAudio = oxfordData?.phonetics?.us?.audio || (gtData?.vnEntries?.length > 0 ? googleUsAudio : '');
    const ukText = oxfordData?.phonetics?.uk?.text || '';
    const usText = oxfordData?.phonetics?.us?.text || '';

    const entries = oxfordData?.entries || [];
    const vnEntries = gtData?.vnEntries || [];
    const definitions = oxfordData?.definitions || gtData?.translation || 'No definition found.';
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
      definitions,
      entries,
      vnEntries,
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
