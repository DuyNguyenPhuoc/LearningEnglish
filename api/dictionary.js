import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  // Extract word from query parameter (Vercel routes /api/dictionary?word=diet)
  // or from the URL path if we use a rewrite
  const { word } = req.query;

  if (!word) {
    return res.status(400).json({ error: 'Word parameter is required' });
  }

  try {
    const url = `https://dictionary.cambridge.org/dictionary/english/${word}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(404).json({ word, found: false, error: 'Word not found in Cambridge' });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const extractData = (regionClass) => {
      const regionEl = $(`.${regionClass}.dpron-i`);
      const ipa = regionEl.find('.ipa').first().text();
      let audio = regionEl.find('source[type="audio/mpeg"]').first().attr('src');
      
      if (audio && !audio.startsWith('http')) {
        audio = `https://dictionary.cambridge.org${audio}`;
      }
      return { text: ipa ? `/${ipa}/` : '', audio };
    };

    // Scrape all phonetics to find any with a dot if the regional ones are missing it
    const allPhoneticTexts = [];
    $('.ipa').each((i, el) => {
      const text = $(el).text();
      if (text) allPhoneticTexts.push(text);
    });

    const bestPhonetic = allPhoneticTexts.find(t => t.includes('.')) || allPhoneticTexts[0];

    const result = {
      word,
      phonetics: {
        uk: extractData('uk'),
        us: extractData('us')
      },
      definitions: $('.def.ddef_d').first().text().trim() || 'No definition found.',
      found: true
    };

    // If regional text is missing but we have a "best" text with a dot, use it
    if (bestPhonetic) {
      if (!result.phonetics.uk.text) result.phonetics.uk.text = `/${bestPhonetic}/`;
      if (!result.phonetics.us.text) result.phonetics.us.text = `/${bestPhonetic}/`;
      
      // If the current text doesn't have a dot but bestPhonetic does, upgrade it
      if (bestPhonetic.includes('.')) {
        if (!result.phonetics.uk.text.includes('.')) result.phonetics.uk.text = `/${bestPhonetic}/`;
        if (!result.phonetics.us.text.includes('.')) result.phonetics.us.text = `/${bestPhonetic}/`;
      }
    }

    // CORS headers just in case
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(result));

  } catch (error) {
    console.error(`Scraping error for ${word}:`, error.message);
    res.status(500).json({ word, found: false, error: 'Internal Server Error during scraping' });
  }
}
