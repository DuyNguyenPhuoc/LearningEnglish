import fs from 'fs/promises';
import path from 'path';

// Helper to handle body parsing for Serverless/Node environments
const parseBody = (req) => {
  return new Promise((resolve, reject) => {
    if (req.body) return resolve(req.body);
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // In local dev, process.cwd() is the root of the project
    const dataPath = path.join(process.cwd(), 'src', 'data', 'lessons.json');
    
    // Ensure file exists
    try {
      await fs.access(dataPath);
    } catch {
      await fs.writeFile(dataPath, '[]', 'utf8');
    }

    if (req.method === 'GET') {
      const data = await fs.readFile(dataPath, 'utf8');
      return res.status(200).json(JSON.parse(data || '[]'));
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      const data = await fs.readFile(dataPath, 'utf8');
      const lessons = JSON.parse(data || '[]');
      lessons.unshift(body); // Add to beginning
      await fs.writeFile(dataPath, JSON.stringify(lessons, null, 2), 'utf8');
      return res.status(201).json(body);
    }

    if (req.method === 'PUT') {
      const body = await parseBody(req);
      const data = await fs.readFile(dataPath, 'utf8');
      let lessons = JSON.parse(data || '[]');
      lessons = lessons.map(l => l.id === body.id ? body : l);
      await fs.writeFile(dataPath, JSON.stringify(lessons, null, 2), 'utf8');
      return res.status(200).json(body);
    }

    if (req.method === 'DELETE') {
      // For DELETE, we might pass id in query, or we can use the URL path
      // Let's assume the id is passed in req.query.id
      const id = req.query.id;
      if (!id) {
        return res.status(400).json({ error: 'Missing ID' });
      }
      const data = await fs.readFile(dataPath, 'utf8');
      let lessons = JSON.parse(data || '[]');
      lessons = lessons.filter(l => l.id !== id);
      await fs.writeFile(dataPath, JSON.stringify(lessons, null, 2), 'utf8');
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
