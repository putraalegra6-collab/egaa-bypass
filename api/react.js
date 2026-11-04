// Reaction WA: password dicek di server, lalu forward ke API reaction
const REACT_API = 'https://reactch20jiyyad.vercel.app/api/react';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ status: false, error: 'method tidak diizinkan' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const { url, reaction, password } = body || {};

  if (!process.env.REACT_PASSWORD) {
    return res.status(500).json({ status: false, error: 'REACT_PASSWORD belum diset di server' });
  }
  if (typeof password !== 'string' || password !== process.env.REACT_PASSWORD) {
    return res.status(401).json({ status: false, error: 'password salah' });
  }
  if (!url || !/^https:\/\/(www\.)?whatsapp\.com\/channel\/[A-Za-z0-9]+\/\d+\/?$/i.test(url)) {
    return res.status(400).json({ status: false, error: 'URL channel tidak valid' });
  }
  const emoji = String(reaction || '👍').trim();

  try {
    const up = await fetch(REACT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ url, reaction: emoji })
    });
    const text = await up.text();
    res.setHeader('Content-Type', up.headers.get('content-type') || 'application/json');
    return res.status(up.status).send(text);
  } catch (e) {
    return res.status(502).json({ status: false, error: 'proxy gagal: ' + e.message });
  }
};
