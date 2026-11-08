// Alight Motion Preset (proxy TikTok) + Premium Verifier (send-link / verify-link)
// Creator: IzzXd — diadaptasi untuk EgaaBypass
// Satu file biar gak kena limit 12 function Hobby.
const CREATOR = 'IzzXd';
const SALURAN = 'https://whatsapp.com/channel/0029VbDyL6d9RZAh3JjEM325';

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

  // ===== MODE 1: KIRIM MAGIC LINK =====
  if (action === 'send-link') {
    const email = String(body.email || '').trim();
    if (!email || !email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ ok: false, error: 'format email tidak valid' });
    }
    try {
      const { sendLink } = require('../lib/am-premium');
      const result = await sendLink(email);
      if (!result || !result.status) {
        return res.status(502).json({ ok: false, error: (result && result.error) || 'gagal kirim magic link' });
      }
      return res.status(200).json({ ok: true, data: result });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'internal error' });
    }
  }

  // ===== MODE 2: VERIFIKASI MAGIC LINK =====
  if (action === 'verify-link') {
    const email = String(body.email || '').trim();
    const magicLink = String(body.magicLink || '').trim();
    if (!email) return res.status(400).json({ ok: false, error: 'email wajib diisi' });
    if (!magicLink) return res.status(400).json({ ok: false, error: 'magic link wajib diisi' });
    try {
      const { verifyLink } = require('../lib/am-premium');
      const result = await verifyLink(email, magicLink);
      if (!result || !result.status) {
        return res.status(502).json({ ok: false, error: (result && result.error) || 'verifikasi gagal' });
      }
      return res.status(200).json({ ok: true, data: result });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'internal error' });
    }
  }

  // ===== MODE 3: STATS (opsional) =====
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

  // ===== MODE 4: PRESET TIKTOK (default) =====
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
