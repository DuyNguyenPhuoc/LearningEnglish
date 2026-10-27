/**
 * Builds the offline English -> Vietnamese dictionary used by api/dictionary.js
 * from a Vietnamese Wiktionary dump (https://dumps.wikimedia.org/viwiktionary/).
 *
 * Usage:
 *   node scripts/build_vi_dictionary.js [dump.xml.bz2 | dump.xml] [output.json.gz]
 *
 * Defaults: data/wiktionary/viwiktionary-latest-pages-articles.xml.bz2 -> api/_data/en_vi.json.gz
 * A .bz2 dump is decompressed on the fly with the `bzip2` command (bundled with Git for Windows).
 *
 * Output (gzipped JSON): { "record": [["noun", ["Bản ghi", ...]], ...], "records": "record" }
 * An array is the word's meanings grouped by part of speech; a string points to the base word.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import readline from 'readline';
import { spawn } from 'child_process';
import { parseWiktionaryEnglish } from '../api/_lib/wiktionary.js';

const input = process.argv[2] || 'data/wiktionary/viwiktionary-latest-pages-articles.xml.bz2';
const output = process.argv[3] || 'api/_data/en_vi.json.gz';
// Hand-written entries for common words Wiktionary lacks; they override Wiktionary
const EXTRA_FILE = 'data/en_vi_extra.json';

// Single words only: the analyzer splits text into [a-z'] tokens
const SINGLE_WORD = /^[A-Za-z][A-Za-z']*$/;
// Page has an English section: {{-eng-}}, {{-eng-2-}}, =={{langname|en}}==, ==Tiếng Anh==
const HAS_ENGLISH = /\{\{-eng(-\d+)?-\}\}|\{\{langname\|en\}\}|^==\s*Tiếng Anh/m;

const decodeXml = (s) => s
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#039;/g, "'")
  .replace(/&amp;/g, '&');

function openDump(file) {
  if (!file.endsWith('.bz2')) return fs.createReadStream(file);
  const bzip2 = spawn('bzip2', ['-dc', file], { stdio: ['ignore', 'pipe', 'inherit'] });
  bzip2.on('error', (err) => {
    console.error('Cannot run bzip2 — decompress the dump first and pass the .xml path.', err.message);
    process.exit(1);
  });
  return bzip2.stdout;
}

async function build() {
  const dictionary = {};
  const stats = { pages: 0, english: 0, withMeanings: 0, formsOnly: 0 };

  let title = '';
  let ns = '';
  let textLines = null;

  const addPage = (pageTitle, wikitext) => {
    stats.pages++;
    if (ns !== '0' || !SINGLE_WORD.test(pageTitle) || !HAS_ENGLISH.test(wikitext)) return;
    // Acronyms (WHO, EAT) would shadow the ordinary word once lowercased
    if (pageTitle.length > 1 && pageTitle === pageTitle.toUpperCase()) return;
    stats.english++;

    const { vnEntries, lemma } = parseWiktionaryEnglish(wikitext);
    const key = pageTitle.toLowerCase();
    // "march" (verb) wins over "March" (month) when both exist
    const isExactCase = pageTitle === key;
    if (dictionary[key] && !isExactCase) return;

    if (vnEntries.length > 0) {
      stats.withMeanings++;
      dictionary[key] = vnEntries.map(e => [e.pos, e.meanings]);
    } else if (lemma && lemma.toLowerCase() !== key) {
      stats.formsOnly++;
      dictionary[key] = lemma.toLowerCase();
    }
  };

  const lines = readline.createInterface({ input: openDump(input), crlfDelay: Infinity });
  for await (const line of lines) {
    if (textLines) {
      const end = line.indexOf('</text>');
      if (end === -1) {
        textLines.push(line);
        continue;
      }
      textLines.push(line.slice(0, end));
      addPage(title, decodeXml(textLines.join('\n')));
      textLines = null;
      continue;
    }

    const titleMatch = line.match(/<title>(.*)<\/title>/);
    if (titleMatch) { title = decodeXml(titleMatch[1]); continue; }

    const nsMatch = line.match(/<ns>(\d+)<\/ns>/);
    if (nsMatch) { ns = nsMatch[1]; continue; }

    const textStart = line.match(/<text[^>]*>(.*)$/);
    if (textStart && !/<text[^>]*\/>/.test(line)) {
      const first = textStart[1];
      const end = first.indexOf('</text>');
      if (end !== -1) addPage(title, decodeXml(first.slice(0, end)));
      else textLines = [first];
    }
  }

  const extra = JSON.parse(fs.readFileSync(EXTRA_FILE, 'utf8'));
  delete extra._comment;
  Object.assign(dictionary, extra);
  stats.extra = Object.keys(extra).length;

  // Drop pointers to base words that have no meanings of their own
  for (const [word, value] of Object.entries(dictionary)) {
    if (typeof value === 'string' && !Array.isArray(dictionary[value])) delete dictionary[word];
  }

  const sortedKeys = Object.keys(dictionary).sort();
  const sorted = Object.fromEntries(sortedKeys.map(k => [k, dictionary[k]]));
  const json = JSON.stringify(sorted);

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, zlib.gzipSync(json, { level: 9 }));

  console.log(`Pages read: ${stats.pages}`);
  console.log(`English single-word pages: ${stats.english}`);
  console.log(`  with Vietnamese meanings: ${stats.withMeanings}`);
  console.log(`  inflected forms (point to base word): ${stats.formsOnly}`);
  console.log(`Hand-written entries from ${EXTRA_FILE}: ${stats.extra}`);
  console.log(`Words written: ${sortedKeys.length}`);
  console.log(`JSON: ${(json.length / 1048576).toFixed(1)} MB, gzipped ${output}: ${(fs.statSync(output).size / 1048576).toFixed(1)} MB`);
}

build();
