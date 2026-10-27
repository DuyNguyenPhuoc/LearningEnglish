/**
 * Parser for Vietnamese Wiktionary (vi.wiktionary.org) wikitext: turns the English
 * section of a page into Vietnamese meanings grouped by part of speech.
 * Shared by the live API fallback (api/dictionary.js) and the offline dictionary
 * builder (scripts/build_vi_dictionary.js).
 */

export const MAX_VN_MEANINGS_PER_POS = 6;

// vi.wiktionary section names -> part of speech label. Pages use either templates
// ({{-noun-}}, {{-tr-verb-}}) or headings (==={{section|n}}===, === {{ĐM|n}} ===)
const WIKTIONARY_POS = {
  'noun': 'noun',
  'n': 'noun',
  'verb': 'verb',
  'v': 'verb',
  'tr-verb': 'transitive verb',
  'intr-verb': 'intransitive verb',
  'aux-verb': 'auxiliary verb',
  'adj': 'adjective',
  'adv': 'adverb',
  'pronoun': 'pronoun',
  'per-pronoun': 'pronoun',
  'conj': 'conjunction',
  'prep': 'preposition',
  'interj': 'interjection',
  'art': 'article',
  'def-article': 'article',
  'indef-article': 'article',
  'det': 'determiner',
  'num': 'numeral',
  'abbr': 'abbreviation',
  'prefix': 'prefix',
  'suffix': 'suffix',
  'phrase': 'phrase',
  'pr-noun': 'proper noun',
  'proper-noun': 'proper noun'
};
// Short section templates that are NOT language headers ({{-eng-}}, {{-fra-}}, {{-ang-}} are)
const WIKTIONARY_NON_LANG_SECTIONS = new Set(['adj', 'adv', 'art', 'num', 'ant', 'syn', 'ref', 'drv', 'det', 'see', 'rel', 'der', 'hyp']);
// Some pages put definitions straight under the etymology heading, without a part of speech
const WIKTIONARY_ETYM_SECTIONS = new Set(['etym', 'etymology']);
const UNKNOWN_POS = 'Nghĩa';

// {{plural of|en|child}}, {{third-person singular of|[[record]]}}, {{see-entry|be#Tiếng Anh|be}}
const FORM_OF = /\{\{(?:[^|{}]*\bof|see-entry)\|(?:lang=)?(?:en\|)?\[*([^|\]{}#]+)/;
// Old one-line style under a part of speech: ":[[ăn]]: tiêu dùng..." or ":'''new''' &ndash; [[mới]]..."
const INLINE_DEF = /^:\s*(?:'''[^']+'''\s*(?:&ndash;|–|—|-)\s*)?([^:*].*)$/;

/**
 * Turns one wikitext definition line into plain text:
 * "{{term|Thể thao}} [[kỷ lục|Kỷ lục]]." -> "(Thể thao) Kỷ lục"
 */
export function cleanWikitext(text) {
  let s = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/\{\{term\|([^|{}]+)[^{}]*\}\}/g, '($1)');
  // Drop remaining templates, innermost first so nested ones disappear too
  while (/\{\{[^{}]*\}\}/.test(s)) s = s.replace(/\{\{[^{}]*\}\}/g, '');
  return s
    .replace(/\[\[(?:Hình|File|Image|Tập tin|Thể loại):[^\]]*\]\]/gi, '')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:)])/g, '$1')
    .trim()
    .replace(/[.;,]+$/, '');
}

/**
 * Extracts the English section of a vi.wiktionary page and groups its Vietnamese
 * definitions (lines starting with "#") by part of speech. Inflected forms only point
 * to their base word ("# {{third-person singular of|[[record]]}}"), returned as `lemma`.
 */
export function parseWiktionaryEnglish(wikitext) {
  const vnEntries = [];
  let lemma = '';
  let inEnglish = false;
  let current = null;

  const startGroup = (pos) => {
    current = { pos, meanings: [] };
    vnEntries.push(current);
  };

  wikitext.split('\n').forEach((line) => {
    const template = line.match(/^\s*\{\{-([a-z0-9-]+)-\}\}\s*$/);
    const isLevel2Heading = /^==[^=]/.test(line);

    // Language header: {{-eng-}} / {{-fra-}} or =={{langname|en}}== / ==Tiếng Anh==
    if (isLevel2Heading) {
      inEnglish = /\{\{langname\|en\}\}|Tiếng Anh/.test(line);
      current = null;
      if (inEnglish) startGroup(UNKNOWN_POS);
      return;
    }
    // Language codes may carry a suffix: {{-eng-2-}}, {{-cus-ash-}}
    const isLanguageTemplate = template
      && /^[a-z]{2,3}(-[a-z0-9]{1,3})*$/.test(template[1])
      && !WIKTIONARY_POS[template[1]]
      && !WIKTIONARY_NON_LANG_SECTIONS.has(template[1]);
    if (isLanguageTemplate) {
      inEnglish = /^eng(-\d+)?$/.test(template[1]);
      current = null;
      if (inEnglish) startGroup(UNKNOWN_POS);
      return;
    }
    if (!inEnglish) return;

    // Section: {{-noun-}} or ===={{section|conj}}==== / === {{ĐM|n}} ===
    const heading = line.match(/^=+\s*\{\{(?:section|ĐM)\|([^|}]+)\}\}[^=]*=+\s*$/);
    const sectionName = template?.[1] || heading?.[1].trim();
    if (sectionName) {
      const pos = WIKTIONARY_POS[sectionName];
      if (pos) startGroup(pos);
      else if (WIKTIONARY_ETYM_SECTIONS.has(sectionName)) startGroup(UNKNOWN_POS);
      else current = null;
      return;
    }

    // "# meaning" only — skip "#:" examples, "#*" quotations
    const def = line.match(/^#+\s*([^:*].*)$/)
      || (current && current.pos !== UNKNOWN_POS && line.match(INLINE_DEF));
    if (!def) return;
    const formOf = def[1].match(FORM_OF);
    if (formOf && !lemma) lemma = formOf[1].trim();
    if (current && current.meanings.length < MAX_VN_MEANINGS_PER_POS) {
      const meaning = cleanWikitext(def[1]);
      if (meaning && !current.meanings.includes(meaning)) current.meanings.push(meaning);
    }
  });

  return { vnEntries: vnEntries.filter(e => e.meanings.length > 0), lemma };
}

