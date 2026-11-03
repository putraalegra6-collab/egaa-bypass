// WebToZip: password dicek di server, API key dibaca dari Environment Variables (ALDO_API_KEY)
const ZIP_API = 'https://apii.aldoxd.xyz/api/tools/copyweb';
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method tidak diizinkan' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const { url, password } = body || {};
  if (!process.env.WEBTOZIP_PASSWORD) return res.status(500).json({ error: 'WEBTOZIP_PASSWORD belum diset di server' });
  if (typeof password !== 'string' || password !== process.env.WEBTOZIP_PASSWORD) return res.status(401).json({ error: 'password salah' });
  if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'url tidak valid' });
  const key = process.env.ALDO_API_KEY;
  if (!key) return res.status(500).json({ error: 'ALDO_API_KEY belum diset di server' });
  try {
    const up = await fetch(`${ZIP_API}?apikey=${encodeURIComponent(key)}&url=${encodeURIComponent(url)}&json=true`, {
      headers: { Accept: '*/*' }
    });
    const ct = up.headers.get('content-type') || 'application/json';
    const buf = Buffer.from(await up.arrayBuffer());
    res.setHeader('Content-Type', ct);
    return res.status(up.status).send(buf);
  } catch (e) {
    return res.status(502).json({ error: 'proxy gagal: ' + e.message });
  }
};
