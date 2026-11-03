// Cek password di server. Password asli ada di Environment Variables Vercel.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method tidak diizinkan' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const { type, password } = body || {};
  const expected = type === 'send' ? process.env.SEND_PASSWORD : process.env.OPEN_PASSWORD;
  if (!expected) return res.status(500).json({ ok: false, error: 'password belum diset di server' });
  if (typeof password !== 'string' || password !== expected) return res.status(401).json({ ok: false });
  return res.status(200).json({ ok: true });
};
