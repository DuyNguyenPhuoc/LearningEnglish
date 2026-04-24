import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Missing url parameter' }));
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://americanipachart.com/'
      }
    });

    if (!response.ok) {
      console.error(`Fetch failed: ${response.status} ${response.statusText}`);
      res.statusCode = response.status;
      return res.end(JSON.stringify({ error: `Failed to fetch audio: ${response.statusText}` }));
    }

    // Proxy headers
    res.setHeader('Content-Type', response.headers.get('Content-Type') || 'audio/mpeg');
    res.setHeader('Content-Length', response.headers.get('Content-Length'));
    
    // Pipe the stream directly
    response.body.pipe(res);
  } catch (err) {
    console.error('IPA Proxy Error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
