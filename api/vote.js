// Kirim vote: password dicek di server dulu, baru diteruskan ke API vote
const VOTE_API = 'https://pollchbyjiyyad-21.vercel.app/api/vote';
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ status: false, error: 'method tidak diizinkan' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const { url, pesan, password } = body || {};
  if (!process.env.SEND_PASSWORD) return res.status(500).json({ status: false, error: 'password belum diset di server' });
  if (typeof password !== 'string' || password !== process.env.SEND_PASSWORD) {
    return res.status(401).json({ status: false, error: 'password salah' });
  }
  try {
    const up = await fetch(VOTE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ url, pesan })
    });
    const text = await up.text();
    res.setHeader('Content-Type', up.headers.get('content-type') || 'application/json');
    return res.status(up.status).send(text);
  } catch (e) {
    return res.status(502).json({ status: false, error: 'proxy gagal: ' + e.message });
  }
};
