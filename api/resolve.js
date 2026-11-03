// Proxy bypass: key dibaca dari Environment Variables Vercel, TIDAK ditulis di kode
const ENGINES = {
  1: { envName: 'KYZZZ_API_KEY', build: (u, k) => `https://api.kyzzz.xyz/api/bypass/sfl?url=${encodeURIComponent(u)}&apikey=${encodeURIComponent(k)}` },
  2: { envName: 'KYZZZ_API_KEY', build: (u, k) => `https://api.kyzzz.xyz/api/bypass/safelinku?url=${encodeURIComponent(u)}&apikey=${encodeURIComponent(k)}` },
  3: { envName: 'NEXA_KEY',      build: (u, k) => `https://api.nexadev.my.id/api/bypass?key=${encodeURIComponent(k)}&url=${encodeURIComponent(u)}` }
};
module.exports = async (req, res) => {
  const eng = ENGINES[String((req.query || {}).engine || '')];
  const url = (req.query || {}).url;
  if (!eng) return res.status(400).json({ error: 'engine tidak valid' });
  if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'url tidak valid' });
  const key = process.env[eng.envName];
  if (!key) return res.status(500).json({ error: 'key belum diset di server (' + eng.envName + ')' });
  try {
    const up = await fetch(eng.build(url, key), { headers: { Accept: 'application/json' } });
    const text = await up.text();
    res.setHeader('Content-Type', 'application/json');
    return res.status(up.status).send(text);
  } catch (e) {
    return res.status(502).json({ error: 'proxy gagal: ' + e.message });
  }
};
