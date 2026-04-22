import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function testWord(word) {
  const cambridgeUrl = `https://dictionary.cambridge.org/dictionary/english/${word}`;
  const cambridgeRes = await fetch(cambridgeUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
  });
  const cambridgeHtml = cambridgeRes.ok ? await cambridgeRes.text() : '';
  const $c = cheerio.load(cambridgeHtml);

  const posHeader = $c('.pos-header').first();

  const extractPhonetic = (regionClass, container) => {
    const regionEl = container.find(`.${regionClass}.dpron-i`).first();
    let ipa = regionEl.find('.ipa').first().text();
    
    // Sanitization: Remove any extra slashes or whitespace
    ipa = ipa.replace(/\//g, '').trim();
    
    let audio = regionEl.find('source[type="audio/mpeg"]').first().attr('src');
    if (audio && !audio.startsWith('http')) audio = `https://dictionary.cambridge.org${audio}`;
    
    return { text: ipa ? `/${ipa}/` : '', audio };
  };

  const uk = extractPhonetic('uk', posHeader);
  const us = extractPhonetic('us', posHeader);
  
  if (uk.text.includes('tʃʌk.əl') || us.text.includes('tʃʌk.əl')) {
    console.log(`Word: ${word} - UK: ${uk.text}, US: ${us.text} - FAILED (Found chuckle)`);
  } else {
    // console.log(`Word: ${word} - UK: ${uk.text}, US: ${us.text}`);
  }
  return { word, uk, us };
}

const words = [
  'hello', 'world', 'apple', 'banana', 'cat', 'dog', 'elephant', 'fish', 'guitar', 'house',
  'island', 'jungle', 'kite', 'lemon', 'monkey', 'notebook', 'ocean', 'pencil', 'queen', 'river',
  'sun', 'tree', 'umbrella', 'village', 'water', 'xylophone', 'yellow', 'zebra', 'airplane', 'boat',
  'car', 'desk', 'egg', 'flower', 'glass', 'hat', 'ice', 'juice', 'key', 'lamp',
  'mouse', 'nose', 'orange', 'paper', 'quilt', 'rabbit', 'shoe', 'table', 'unicorn', 'violin',
  'window', 'yarn', 'door', 'bed', 'chair', 'cup', 'plate', 'fork', 'spoon', 'knife',
  'computer', 'phone', 'book', 'pen', 'clock', 'picture', 'bag', 'shoe', 'sock', 'shirt',
  'pants', 'coat', 'hat', 'glove', 'scarf', 'ring', 'watch', 'glasses', 'wallet', 'purse'
];

async function run() {
  console.log("Starting tests...");
  let count = 0;
  for (const w of words) {
    const res = await testWord(w);
    if (res.uk.text === '/tʃʌk.əl/' || res.us.text === '/tʃʌk.əl/') {
      count++;
    }
  }
  console.log(`Finished. Found chuckle ${count} times out of ${words.length} words.`);
}

run();
