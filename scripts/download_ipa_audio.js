import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { ipaData } from '../src/data/ipa_44.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_DIR = path.join(__dirname, '..', 'public', 'audio', 'ipa');

// Ensure directory exists
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

async function downloadFile(url, targetPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(targetPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(targetPath, () => {});
      reject(err);
    });
  });
}

async function run() {
  console.log(`Starting download of ${ipaData.length} IPA audio files...`);
  let successCount = 0;
  let errorCount = 0;

  for (const phoneme of ipaData) {
    if (!phoneme.audioUrl) continue;

    const filename = path.basename(phoneme.audioUrl);
    const targetPath = path.join(TARGET_DIR, filename);

    if (fs.existsSync(targetPath)) {
      console.log(`Skipping ${filename} (already exists)`);
      successCount++;
      continue;
    }

    try {
      process.stdout.write(`Downloading ${filename}... `);
      await downloadFile(phoneme.audioUrl, targetPath);
      console.log('Done.');
      successCount++;
    } catch (err) {
      console.log(`Error: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\nFinished!`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
}

run();
