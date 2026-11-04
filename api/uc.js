// UC Drive: ambil daftar file dari share link (lib/uc.js by IzzXd)
const { extract } = require('../lib/uc.js');

module.exports = async (req, res) => {
  const q = req.query || {};
  const input = String(q.url || '').trim();
  const passcode = String(q.passcode || '').trim();
  if (!input) return res.status(400).json({ ok: false, error: 'URL atau kode UC Share kosong' });

  try {
    const data = await extract(input, { passcode });
    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(502).json({ ok: false, error: e.message || 'gagal ambil data UC' });
  }
};
