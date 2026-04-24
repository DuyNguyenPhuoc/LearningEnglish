import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dictionaryHandler from './api/dictionary.js'
import lessonsHandler from './api/lessons.js'
import ipaProxyHandler from './api/ipa_proxy.js'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'vercel-api-emulator',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          // Emulate Vercel's API
          if (req.url.startsWith('/api/')) {
            const url = new URL(req.url, `http://${req.headers.host}`);
            
            // Mock res methods
            res.status = (code) => { res.statusCode = code; return res; };
            res.json = (data) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
              return res;
            };
            res.send = (data) => {
              res.end(data);
              return res;
            };

            try {
              if (req.url.startsWith('/api/dictionary')) {
                const word = url.searchParams.get('word') || url.pathname.split('/').pop();
                req.query = { word: decodeURIComponent(word) };
                await dictionaryHandler(req, res);
                return;
              }
              
              if (req.url.startsWith('/api/lessons')) {
                // parse query string into req.query
                req.query = Object.fromEntries(url.searchParams);
                await lessonsHandler(req, res);
                return;
              }

              if (req.url.startsWith('/api/ipa-proxy')) {
                req.query = Object.fromEntries(url.searchParams);
                await ipaProxyHandler(req, res);
                return;
              }
            } catch (err) {
              console.error('Local API Error:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Internal Server Error' }));
            }
          }
          next();
        });
      }
    }
  ],
})
