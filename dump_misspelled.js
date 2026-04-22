import fetch from 'node-fetch';
import fs from 'fs';

async function dumpHtml(word) {
  const cambridgeUrl = `https://dictionary.cambridge.org/dictionary/english/${word}`;
  const cambridgeRes = await fetch(cambridgeUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
  });
  const cambridgeHtml = await cambridgeRes.text();
  fs.writeFileSync(`cambridge_${word}.html`, cambridgeHtml);
  console.log(`Dumped HTML for ${word} to cambridge_${word}.html`);
}

dumpHtml('chuckkle');
