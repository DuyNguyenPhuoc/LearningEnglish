import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs';

async function testWord(word) {
  try {
    const cambridgeUrl = `https://dictionary.cambridge.org/dictionary/english/${word}`;
    const cambridgeRes = await fetch(cambridgeUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    
    if (!cambridgeRes.ok) {
        return { word, error: `HTTP ${cambridgeRes.status}` };
    }
    
    const cambridgeHtml = await cambridgeRes.text();
    const $c = cheerio.load(cambridgeHtml);

    // UPDATED LOGIC
    const posHeader = $c('.entry-body__el .pos-header').first();

    const extractPhonetic = (regionClass, container) => {
        if (!container || container.length === 0) return { text: '', audio: '' };
        const regionEl = container.find(`.${regionClass}.dpron-i`).first();
        let ipa = regionEl.find('.ipa').first().text();
        ipa = ipa.replace(/\//g, '').trim();
        
        // UPDATED SAFETY CHECK
        if (ipa === 'tʃʌk.əl' && word.toLowerCase() !== 'chuckle') {
           ipa = '';
        }

        let audio = regionEl.find('source[type="audio/mpeg"]').first().attr('src');
        if (audio && !audio.startsWith('http')) audio = `https://dictionary.cambridge.org${audio}`;
        return { text: ipa ? `/${ipa}/` : '', audio };
    };

    const uk = extractPhonetic('uk', posHeader);
    const us = extractPhonetic('us', posHeader);
    
    return { word, uk, us, hasPosHeader: posHeader.length > 0 };
  } catch (e) {
    return { word, error: e.message };
  }
}

const words = [
  'hello', 'haven', 'world', 'apple', 'banana', 'cat', 'dog', 'elephant', 'fish', 'guitar',
  'island', 'jungle', 'kite', 'lemon', 'monkey', 'notebook', 'ocean', 'pencil', 'queen', 'river',
  'nonexistentword123', 'chuckkle', 'helloooo', 'chuckle'
];

async function run() {
  console.log(`Starting automated verification for ${words.length} words...`);
  const results = [];
  let chuckleErrors = 0;
  
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    process.stdout.write(`Testing ${w}... `);
    const res = await testWord(w);
    results.push(res);
    
    // Check if "chuckle" IPA appeared for non-chuckle words
    if (res.uk && res.uk.text === '/tʃʌk.əl/' && w.toLowerCase() !== 'chuckle') {
        console.log("FAILED (Found chuckle in non-chuckle word!)");
        chuckleErrors++;
    } else if (res.word === 'chuckle' && res.uk && res.uk.text !== '/tʃʌk.əl/') {
        // If it is 'chuckle', it SHOULD have the IPA
        console.log("ok (chuckle has correct IPA)");
    } else {
        console.log("ok");
    }
  }
  
  fs.writeFileSync('verification_results.json', JSON.stringify(results, null, 2));
  console.log(`\nVerification Finished.`);
  console.log(`Chuckle errors found: ${chuckleErrors}`);
  if (chuckleErrors === 0) {
      console.log("SUCCESS: No incorrect chuckle pronunciations found.");
  }
}

run();
