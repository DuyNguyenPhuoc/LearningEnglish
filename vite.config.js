import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import handler from './api/dictionary.js'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'vercel-api-emulator',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          // Emulate Vercel's /api/dictionary?word=xxx
          if (req.url.startsWith('/api/dictionary')) {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const word = url.searchParams.get('word') || url.pathname.split('/').pop();
            
            // Mock the Vercel req.query
            req.query = { word: decodeURIComponent(word) };
            
            // Mock res.status and res.json for the serverless handler
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
              await handler(req, res);
            } catch (err) {
              console.error('Local API Error:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Internal Server Error' }));
            }
            return;
          }
          next();
        });
      }
    }
  ],
})
