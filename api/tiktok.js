// TikTok info: ambil metadata + link media lewat provider (default tikwm, bisa diganti via env)
// Env opsional: TIKTOK_API_URL (endpoint provider), TIKTOK_API_KEY (dikirim sebagai header X-API-Key)
const API = process.env.TIKTOK_API_URL || 'https://www.tikwm.com/api/';
const TT_RE = /^https?:\/\/(?:[\w-]+\.)*tiktok\.com\//i;

module.exports = async (req, res) => {
  const url = String((req.query || {}).url || '').trim();
  if (!TT_RE.test(url)) return res.status(400).json({ ok: false, error: 'link TikTok tidak valid' });

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded'
  };
  if (process.env.TIKTOK_API_KEY) headers['X-API-Key'] = process.env.TIKTOK_API_KEY;

  try {
    const up = await fetch(API, {
      method: 'POST',
      headers,
      body: new URLSearchParams({ url, hd: '1' }).toString()
    });
    const j = await up.json().catch(() => null);
    if (!j || j.code !== 0 || !j.data) {
      return res.status(502).json({ ok: false, error: (j && j.msg) || 'gagal ambil data dari provider' });
    }
    const d = j.data;
    const fix = u => (u ? (String(u).startsWith('/') ? 'https://www.tikwm.com' + u : String(u)) : null);
    const images = (Array.isArray(d.images) ? d.images : []).map(fix).filter(Boolean);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      ok: true,
      data: {
        id: String(d.id || ''),
        title: d.title || '',
        author: { nickname: (d.author && d.author.nickname) || '', unique_id: (d.author && d.author.unique_id) || '' },
        type: images.length ? 'slideshow' : 'video',
        cover: fix(d.cover || d.origin_cover),
        duration: d.duration || 0,
        video: fix(d.hdplay || d.play),
        video_wm: fix(d.wmplay),
        music: fix(d.music),
        music_title: (d.music_info && d.music_info.title) || '',
        images,
        stats: {
          play: d.play_count || 0,
          like: d.digg_count || 0,
          comment: d.comment_count || 0,
          share: d.share_count || 0,
          save: d.collect_count || 0
        }
      }
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'proxy gagal: ' + e.message });
  }
};
