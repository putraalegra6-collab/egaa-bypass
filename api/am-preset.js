// Alight Motion Preset (proxy TikTok) + Premium Activator (am-premiumms.ai.studio)
// Creator: IzzXd — diadaptasi untuk EgaaBypass
// Satu file biar gak kena limit 12 function Hobby.
module.exports = async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method tidak diizinkan' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const action = String((req.query || {}).action || '').toLowerCase();

  // ===== MODE AUTO ACTIVATE =====
  if (action === 'activate') {
    try {
      const { autoActivate } = require('../lib/am-premium');
      const result = await autoActivate();
      if (!result || !result.status) {
        return res.status(502).json({ ok: false, error: (result && result.error) || 'gagal aktivasi premium' });
      }
      return res.status(200).json({ ok: true, data: result });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'internal error' });
    }
  }

  // ===== MODE STATS =====
  if (action === 'stats') {
    try {
      const { getStats } = require('../lib/am-premium');
      const result = await getStats();
      if (!result || !result.status) {
        return res.status(502).json({ ok: false, error: (result && result.error) || 'gagal ambil stats' });
      }
      return res.status(200).json({ ok: true, data: result });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'internal error' });
    }
  }

  // ===== MODE PRESET TIKTOK (default) =====
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method tidak diizinkan' });
  }

  try {
    const { url } = body;

    let host = '';
    try { host = new URL(url).hostname; } catch {}
    if (!/^https?:\/\//i.test(url || '') || !/(^|\.)tiktok\.com$/i.test(host)) {
      return res.status(400).json({ ok: false, error: 'link harus dari TikTok' });
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
    return res.status(502).json({ ok: false, error: 'proxy gagal: ' + e.message });
  }
};
