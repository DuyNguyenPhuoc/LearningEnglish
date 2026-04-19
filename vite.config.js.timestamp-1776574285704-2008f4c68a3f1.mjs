// vite.config.js
import { defineConfig } from "file:///H:/Prj/LearningEnglish/node_modules/vite/dist/node/index.js";
import react from "file:///H:/Prj/LearningEnglish/node_modules/@vitejs/plugin-react/dist/index.js";
import axios from "file:///H:/Prj/LearningEnglish/node_modules/axios/index.js";
import * as cheerio from "file:///H:/Prj/LearningEnglish/node_modules/cheerio/dist/esm/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    {
      name: "cambridge-proxy",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url.startsWith("/api/dictionary/")) {
            const word = req.url.split("/").pop();
            try {
              const url = `https://dictionary.cambridge.org/dictionary/english/${word}`;
              const response = await axios.get(url, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
              });
              const $ = cheerio.load(response.data);
              const extractData = (regionClass) => {
                const regionEl = $(`.${regionClass}.dpron-i`);
                const ipa = regionEl.find(".ipa").first().text();
                let audio = regionEl.find('source[type="audio/mpeg"]').first().attr("src");
                if (audio && !audio.startsWith("http")) {
                  audio = `https://dictionary.cambridge.org${audio}`;
                }
                return { text: ipa ? `/${ipa}/` : "", audio };
              };
              const result = {
                word,
                phonetics: {
                  uk: extractData("uk"),
                  us: extractData("us")
                },
                definitions: $(".def.ddef_d").first().text().trim() || "No definition found.",
                found: true
              };
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(result));
            } catch (error) {
              console.error(`Error scraping Cambridge for ${word}:`, error.message);
              res.statusCode = 404;
              res.end(JSON.stringify({ word, found: false, error: "Word not found or scraping failed" }));
            }
            return;
          }
          next();
        });
      }
    }
  ]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJIOlxcXFxQcmpcXFxcTGVhcm5pbmdFbmdsaXNoXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJIOlxcXFxQcmpcXFxcTGVhcm5pbmdFbmdsaXNoXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9IOi9QcmovTGVhcm5pbmdFbmdsaXNoL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCBheGlvcyBmcm9tICdheGlvcydcbmltcG9ydCAqIGFzIGNoZWVyaW8gZnJvbSAnY2hlZXJpbydcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIHtcbiAgICAgIG5hbWU6ICdjYW1icmlkZ2UtcHJveHknLFxuICAgICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGFzeW5jIChyZXEsIHJlcywgbmV4dCkgPT4ge1xuICAgICAgICAgIGlmIChyZXEudXJsLnN0YXJ0c1dpdGgoJy9hcGkvZGljdGlvbmFyeS8nKSkge1xuICAgICAgICAgICAgY29uc3Qgd29yZCA9IHJlcS51cmwuc3BsaXQoJy8nKS5wb3AoKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovL2RpY3Rpb25hcnkuY2FtYnJpZGdlLm9yZy9kaWN0aW9uYXJ5L2VuZ2xpc2gvJHt3b3JkfWA7XG4gICAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXhpb3MuZ2V0KHVybCwge1xuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICdVc2VyLUFnZW50JzogJ01vemlsbGEvNS4wIChXaW5kb3dzIE5UIDEwLjA7IFdpbjY0OyB4NjQpIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS85MS4wLjQ0NzIuMTI0IFNhZmFyaS81MzcuMzYnXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICBjb25zdCAkID0gY2hlZXJpby5sb2FkKHJlc3BvbnNlLmRhdGEpO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgLy8gSGVscGVyIHRvIGV4dHJhY3QgcGhvbmV0aWMgYW5kIGF1ZGlvXG4gICAgICAgICAgICAgIGNvbnN0IGV4dHJhY3REYXRhID0gKHJlZ2lvbkNsYXNzKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVnaW9uRWwgPSAkKGAuJHtyZWdpb25DbGFzc30uZHByb24taWApO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlwYSA9IHJlZ2lvbkVsLmZpbmQoJy5pcGEnKS5maXJzdCgpLnRleHQoKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBBdWRpbyBpcyB1c3VhbGx5IGluIDxzb3VyY2U+IHRhZ3Mgd2l0aCBkYXRhLXNyYy1tcDMgb3Igc3JjXG4gICAgICAgICAgICAgICAgbGV0IGF1ZGlvID0gcmVnaW9uRWwuZmluZCgnc291cmNlW3R5cGU9XCJhdWRpby9tcGVnXCJdJykuZmlyc3QoKS5hdHRyKCdzcmMnKTtcbiAgICAgICAgICAgICAgICBpZiAoYXVkaW8gJiYgIWF1ZGlvLnN0YXJ0c1dpdGgoJ2h0dHAnKSkge1xuICAgICAgICAgICAgICAgICAgYXVkaW8gPSBgaHR0cHM6Ly9kaWN0aW9uYXJ5LmNhbWJyaWRnZS5vcmcke2F1ZGlvfWA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHJldHVybiB7IHRleHQ6IGlwYSA/IGAvJHtpcGF9L2AgOiAnJywgYXVkaW8gfTtcbiAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICAgICAgICAgICAgd29yZCxcbiAgICAgICAgICAgICAgICBwaG9uZXRpY3M6IHtcbiAgICAgICAgICAgICAgICAgIHVrOiBleHRyYWN0RGF0YSgndWsnKSxcbiAgICAgICAgICAgICAgICAgIHVzOiBleHRyYWN0RGF0YSgndXMnKVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZGVmaW5pdGlvbnM6ICQoJy5kZWYuZGRlZl9kJykuZmlyc3QoKS50ZXh0KCkudHJpbSgpIHx8ICdObyBkZWZpbml0aW9uIGZvdW5kLicsXG4gICAgICAgICAgICAgICAgZm91bmQ6IHRydWVcbiAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHJlc3VsdCkpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgRXJyb3Igc2NyYXBpbmcgQ2FtYnJpZGdlIGZvciAke3dvcmR9OmAsIGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwNDtcbiAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHdvcmQsIGZvdW5kOiBmYWxzZSwgZXJyb3I6ICdXb3JkIG5vdCBmb3VuZCBvciBzY3JhcGluZyBmYWlsZWQnIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgbmV4dCgpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIF0sXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUEwUCxTQUFTLG9CQUFvQjtBQUN2UixPQUFPLFdBQVc7QUFDbEIsT0FBTyxXQUFXO0FBQ2xCLFlBQVksYUFBYTtBQUd6QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTjtBQUFBLE1BQ0UsTUFBTTtBQUFBLE1BQ04sZ0JBQWdCLFFBQVE7QUFDdEIsZUFBTyxZQUFZLElBQUksT0FBTyxLQUFLLEtBQUssU0FBUztBQUMvQyxjQUFJLElBQUksSUFBSSxXQUFXLGtCQUFrQixHQUFHO0FBQzFDLGtCQUFNLE9BQU8sSUFBSSxJQUFJLE1BQU0sR0FBRyxFQUFFLElBQUk7QUFDcEMsZ0JBQUk7QUFDRixvQkFBTSxNQUFNLHVEQUF1RCxJQUFJO0FBQ3ZFLG9CQUFNLFdBQVcsTUFBTSxNQUFNLElBQUksS0FBSztBQUFBLGdCQUNwQyxTQUFTO0FBQUEsa0JBQ1AsY0FBYztBQUFBLGdCQUNoQjtBQUFBLGNBQ0YsQ0FBQztBQUVELG9CQUFNLElBQVksYUFBSyxTQUFTLElBQUk7QUFHcEMsb0JBQU0sY0FBYyxDQUFDLGdCQUFnQjtBQUNuQyxzQkFBTSxXQUFXLEVBQUUsSUFBSSxXQUFXLFVBQVU7QUFDNUMsc0JBQU0sTUFBTSxTQUFTLEtBQUssTUFBTSxFQUFFLE1BQU0sRUFBRSxLQUFLO0FBRy9DLG9CQUFJLFFBQVEsU0FBUyxLQUFLLDJCQUEyQixFQUFFLE1BQU0sRUFBRSxLQUFLLEtBQUs7QUFDekUsb0JBQUksU0FBUyxDQUFDLE1BQU0sV0FBVyxNQUFNLEdBQUc7QUFDdEMsMEJBQVEsbUNBQW1DLEtBQUs7QUFBQSxnQkFDbEQ7QUFFQSx1QkFBTyxFQUFFLE1BQU0sTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLE1BQU07QUFBQSxjQUM5QztBQUVBLG9CQUFNLFNBQVM7QUFBQSxnQkFDYjtBQUFBLGdCQUNBLFdBQVc7QUFBQSxrQkFDVCxJQUFJLFlBQVksSUFBSTtBQUFBLGtCQUNwQixJQUFJLFlBQVksSUFBSTtBQUFBLGdCQUN0QjtBQUFBLGdCQUNBLGFBQWEsRUFBRSxhQUFhLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxLQUFLLEtBQUs7QUFBQSxnQkFDdkQsT0FBTztBQUFBLGNBQ1Q7QUFFQSxrQkFBSSxVQUFVLGdCQUFnQixrQkFBa0I7QUFDaEQsa0JBQUksSUFBSSxLQUFLLFVBQVUsTUFBTSxDQUFDO0FBQUEsWUFDaEMsU0FBUyxPQUFPO0FBQ2Qsc0JBQVEsTUFBTSxnQ0FBZ0MsSUFBSSxLQUFLLE1BQU0sT0FBTztBQUNwRSxrQkFBSSxhQUFhO0FBQ2pCLGtCQUFJLElBQUksS0FBSyxVQUFVLEVBQUUsTUFBTSxPQUFPLE9BQU8sT0FBTyxvQ0FBb0MsQ0FBQyxDQUFDO0FBQUEsWUFDNUY7QUFDQTtBQUFBLFVBQ0Y7QUFDQSxlQUFLO0FBQUEsUUFDUCxDQUFDO0FBQUEsTUFDSDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
