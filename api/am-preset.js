// Proxy Alight Motion Preset -> presetv2. Server ke server, jadi gak kena CORS. Tanpa key.
// Cuma nerima link TikTok publik.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method tidak diizinkan' });
  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    const { url } = body || {};

    let host = '';
    try { host = new URL(url).hostname; } catch {}
    if (!/^https?:\/\//i.test(url || '') || !/(^|\.)tiktok\.com$/i.test(host)) {
      return res.status(400).json({ error: 'link harus dari TikTok' });
    }

    const up = await fetch('https://api.zyvor.my.id/api/am/presetv2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ url })
    });
    const buf = Buffer.from(await up.arrayBuffer());
    res.setHeader('Content-Type', up.headers.get('content-type') || 'application/json');
    return res.status(up.status).send(buf);
  } catch (e) {
    return res.status(502).json({ error: 'proxy gagal: ' + e.message });
  }
};
