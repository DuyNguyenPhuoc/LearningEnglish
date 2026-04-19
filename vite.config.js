import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fetch from 'node-fetch'
import * as cheerio from 'cheerio'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'cambridge-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url.startsWith('/api/dictionary/')) {
            const word = req.url.split('/').pop();
            try {
              const url = `https://dictionary.cambridge.org/dictionary/english/${word}`;
              const response = await fetch(url, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
              });

              if (!response.ok) throw new Error(`Status ${response.status}`);
              const html = await response.text();
              const $ = cheerio.load(html);
              
              // Helper to extract phonetic and audio
              const extractData = (regionClass) => {
                const regionEl = $(`.${regionClass}.dpron-i`);
                // Priority: find the IPA text
                const ipa = regionEl.find('.ipa').first().text();
                
                // Audio: find the source tag
                let audio = regionEl.find('source[type="audio/mpeg"]').first().attr('src');
                if (audio && !audio.startsWith('http')) {
                  audio = `https://dictionary.cambridge.org${audio}`;
                }
                
                return { text: ipa ? `/${ipa}/` : '', audio };
              };

              const result = {
                word,
                phonetics: {
                  uk: extractData('uk'),
                  us: extractData('us')
                },
                definitions: $('.def.ddef_d').first().text().trim() || 'No definition found.',
                found: true
              };

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (error) {
              console.error(`Error scraping Cambridge for ${word}:`, error.message);
              res.statusCode = 404;
              res.end(JSON.stringify({ word, found: false, error: 'Word not found or scraping failed' }));
            }
            return;
          }
          next();
        });
      }
    }
  ],
})
