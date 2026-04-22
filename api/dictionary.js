import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  const { word } = req.query;

  if (!word) {
    return res.status(400).json({ error: 'Word parameter is required' });
  }

  try {
    const cambridgeUrl = `https://dictionary.cambridge.org/dictionary/english/${word}`;
    const labanUrl = `https://dict.laban.vn/find?type=1&query=${word}`;

    const [cambridgeRes, labanRes] = await Promise.all([
      fetch(cambridgeUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
      }),
      fetch(labanUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
      })
    ]);

    const cambridgeHtml = cambridgeRes.ok ? await cambridgeRes.text() : '';
    const labanHtml = labanRes.ok ? await labanRes.text() : '';

    const $c = cheerio.load(cambridgeHtml);
    const $l = cheerio.load(labanHtml);

    // 1. Phonetics (Restricted to main word header)
    const posHeader = $c('.entry-body__el .pos-header').first();

    const extractPhonetic = (regionClass, container) => {
      const regionEl = container.find(`.${regionClass}.dpron-i`).first();
      let ipa = regionEl.find('.ipa').first().text();
      
      // Sanitization: Remove any extra slashes or whitespace
      ipa = ipa.replace(/\//g, '').trim();
      
      // Specific Safety Check: Prevent "chuckle" (tʃʌk.əl) from leaking into other words
      // This often happens when Word of the Day is picked up by mistake.
      if (ipa === 'tʃʌk.əl' && word.toLowerCase() !== 'chuckle') {
        ipa = '';
      }
      
      let audio = regionEl.find('source[type="audio/mpeg"]').first().attr('src');
      if (audio && !audio.startsWith('http')) audio = `https://dictionary.cambridge.org${audio}`;
      
      return { text: ipa ? `/${ipa}/` : '', audio };
    };

    // 2. Multiple Entries (English)
    const entries = [];
    $c('.entry-body__el').each((i, el) => {
      const pos = $c(el).find('.pos.dpos').first().text().trim();
      const defs = [];
      $c(el).find('.def.ddef_d.db').each((j, defEl) => {
        const text = $c(defEl).text().trim();
        if (text) defs.push(text);
      });
      if (pos || defs.length > 0) {
        entries.push({ pos, definitions: defs });
      }
    });

    // 3. Vietnamese Meanings (Multiple POS)
    const vnEntries = [];
    let currentVnPos = "";
    $l('.content').find('div').each((i, el) => {
      const $el = $l(el);
      if ($el.hasClass('bg-grey') && $el.hasClass('bold')) {
        currentVnPos = $el.text().trim();
        vnEntries.push({ pos: currentVnPos, meanings: [] });
      } else if ($el.hasClass('green') && $el.hasClass('bold')) {
        const meaning = $el.text().trim();
        if (vnEntries.length === 0) vnEntries.push({ pos: "Khác", meanings: [] });
        vnEntries[vnEntries.length - 1].meanings.push(meaning);
      }
    });

    // 4. Examples, Idioms, Collocations (standard logic)
    const examples = [];
    $c('.examp.dexamp').each((i, el) => {
      const ex = $c(el).find('.eg.deg').text().trim();
      if (ex && examples.length < 5) examples.push(ex);
    });

    const idioms = [];
    $c('.idiom.didiom').each((i, el) => {
      const title = $c(el).find('.idiom-title.didiom-title').text().trim();
      const def = $c(el).find('.def.ddef_d').first().text().trim();
      if (title) idioms.push({ title, definition: def });
    });

    const collocations = [];
    $c('.smart-vocabulary .hul-u .item').each((i, el) => {
      const text = $c(el).text().trim();
      if (text && collocations.length < 8) collocations.push(text);
    });

    const result = {
      word,
      phonetics: {
        uk: extractPhonetic('uk', posHeader),
        us: extractPhonetic('us', posHeader)
      },
      definitions: $c('.def.ddef_d').first().text().trim() || 'No definition found.',
      entries,
      vnEntries,
      examples,
      idioms,
      collocations,
      found: entries.length > 0 || vnEntries.length > 0
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(result));

  } catch (error) {
    console.error(`Multi-entry error for ${word}:`, error.message);
    res.status(500).json({ word, found: false, error: 'Internal Server Error during scraping' });
  }
}
