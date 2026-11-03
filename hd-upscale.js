// Proxy upload foto -> api.zyvor.my.id (server ke server, jadi gak kena CORS)
// Taruh di folder api/ root project Vercel lu (sejajar sama api/bypass)
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method tidak diizinkan' });
  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    const { image, scale } = body || {};

    const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(image || '');
    if (!m) return res.status(400).json({ error: 'file gambar tidak valid' });

    const type = m[1];
    const buf = Buffer.from(m[2], 'base64');
    const ext = type.split('/')[1].replace('jpeg', 'jpg');

    const fd = new FormData();
    fd.append('image', new Blob([buf], { type }), 'image.' + ext);
    fd.append('scale', String(scale || '2'));

    const up = await fetch('https://api.zyvor.my.id/api/imagehd/upscalev2', { method: 'POST', body: fd });
    return sendUpstream(up, res);
  } catch (e) {
    return res.status(502).json({ error: 'proxy gagal: ' + e.message });
  }
};

async function sendUpstream(up, res) {
  const ct = up.headers.get('content-type') || 'application/octet-stream';
  const buf = Buffer.from(await up.arrayBuffer());
  res.setHeader('Content-Type', ct);
  return res.status(up.status).send(buf);
}
