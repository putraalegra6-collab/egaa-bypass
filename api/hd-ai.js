// Proxy HD AI Enhance (upload foto). Server ke server, jadi gak kena CORS. Tanpa key.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method tidak diizinkan' });
  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    const { image, scale } = body || {};

    if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(image || '')) {
      return res.status(400).json({ error: 'file gambar tidak valid' });
    }
    const sc = String(scale || '2');
    if (sc !== '2' && sc !== '4') return res.status(400).json({ error: 'scale tidak valid' });

    const up = await fetch('https://api.zyvor.my.id/api/imagehd/ai-enhancev4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, image/*' },
      body: JSON.stringify({ image, scale: sc })
    });
    return sendUpstream(up, res);
  } catch (e) {
    return res.status(502).json({ error: 'proxy gagal: ' + e.message });
  }
};

async function sendUpstream(up, res) {
  const ct = up.headers.get('content-type') || 'application/json';
  const buf = Buffer.from(await up.arrayBuffer());
  res.setHeader('Content-Type', ct);
  return res.status(up.status).send(buf);
}
