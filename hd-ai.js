// Proxy link -> api.zyvor.my.id/ai-enhancev2 (server ke server, jadi gak kena CORS)
module.exports = async (req, res) => {
  try {
    const { url, size } = req.query || {};
    if (!url) return res.status(400).json({ error: 'url kosong' });

    let q = 'url=' + encodeURIComponent(url);
    if (size && size !== 'auto') q += '&size=' + encodeURIComponent(size);

    const up = await fetch('https://api.zyvor.my.id/api/imagehd/ai-enhancev2?' + q);
    const ct = up.headers.get('content-type') || 'application/octet-stream';
    const buf = Buffer.from(await up.arrayBuffer());
    res.setHeader('Content-Type', ct);
    return res.status(up.status).send(buf);
  } catch (e) {
    return res.status(502).json({ error: 'proxy gagal: ' + e.message });
  }
};
