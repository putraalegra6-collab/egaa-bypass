// Proxy file media TikTok. mode=inline untuk preview di browser, default attachment untuk download.
const { Readable } = require('stream');
const HOST_OK = /(^|\.)(tikwm\.com|tiktokcdn[\w-]*\.com|tiktokv\.com|byteoversea\.com|tiktok\.com)$/i;

module.exports = async (req, res) => {
  const q = req.query || {};
  const src = String(q.src || '');
  const name = String(q.name || 'tiktok').replace(/[^\w.-]+/g, '_').slice(0, 80) || 'tiktok';
  const inline = q.mode === 'inline';

  let host = '';
  try { host = new URL(src).hostname; } catch (e) { return res.status(400).json({ ok: false, error: 'src tidak valid' }); }
  if (!/^https?:$/.test(new URL(src).protocol) || !HOST_OK.test(host)) {
    return res.status(400).json({ ok: false, error: 'host tidak diizinkan' });
  }

  try {
    const up = await fetch(src, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.tikwm.com/',
        'Accept': '*/*'
      }
    });
    if (!up.ok || !up.body) return res.status(502).json({ ok: false, error: 'file gagal diambil (HTTP ' + up.status + ')' });

    const type = up.headers.get('content-type') || 'application/octet-stream';
    const len = up.headers.get('content-length');
    res.setHeader('Content-Type', type);
    if (len) res.setHeader('Content-Length', len);
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${name}"`);
    res.setHeader('Cache-Control', 'public, max-age=300');
    Readable.fromWeb(up.body).pipe(res);
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'proxy gagal: ' + e.message });
  }
};
