// Pinterest info: resolve link (termasuk pin.it), ambil judul, gambar, dan video dari halaman pin
const PIN_RE = /^https?:\/\/(?:[\w-]+\.)*(?:pinterest\.[a-z.]+|pin\.it)\//i;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const ENT = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
const decode = s => String(s || '').replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
  if (e[0] === '#') {
    const code = (e[1] === 'x' || e[1] === 'X') ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  }
  return ENT[e.toLowerCase()] || m;
});

function meta(html, prop) {
  const a = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + prop + '["\'][^>]*?content=["\']([^"\']*)["\']', 'i'));
  if (a) return decode(a[1]);
  const b = html.match(new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*?(?:property|name)=["\']' + prop + '["\']', 'i'));
  return b ? decode(b[1]) : '';
}

// Ganti ukuran thumbnail (236x, 736x, dll) ke versi asli
const toOriginal = u => (/pinimg\.com/.test(u) ? u.replace(/\/(?:\d+x\d*|\d+x\d+_RS)\//, '/originals/') : u);

function findVideo(html) {
  const found = new Set();
  const re = /https?:\\?\/\\?\/v\d*\.pinimg\.com\\?\/videos\\?\/[^"'\s<>\\]+?\.mp4/g;
  let m;
  while ((m = re.exec(html))) found.add(m[0].replace(/\\\//g, '/'));
  const list = [...found];
  return list.find(u => /720p|1080p/.test(u)) || list[0] || '';
}

module.exports = async (req, res) => {
  const url = String((req.query || {}).url || '').trim();
  if (!PIN_RE.test(url)) return res.status(400).json({ ok: false, error: 'link Pinterest tidak valid' });

  try {
    const page = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
      redirect: 'follow'
    });
    if (!page.ok) return res.status(502).json({ ok: false, error: 'pin gagal diambil (HTTP ' + page.status + ')' });
    const html = await page.text();

    const finalUrl = page.url || url;
    const idm = finalUrl.match(/\/pin\/(\d+)/);
    const id = idm ? idm[1] : '';

    const ogImage = meta(html, 'og:image');
    const ogVideo = meta(html, 'og:video:secure_url') || meta(html, 'og:video');
    const video = findVideo(html) || ogVideo || '';

    if (!ogImage && !video) {
      return res.status(404).json({ ok: false, error: 'pin tidak ketemu atau private' });
    }

    const title = (meta(html, 'og:title') || meta(html, 'og:description') || '')
      .replace(/\s*\|\s*Pinterest\s*$/i, '')
      .trim();

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      ok: true,
      data: {
        id,
        title,
        type: video ? 'video' : 'image',
        image: ogImage ? toOriginal(ogImage) : '',
        image_fallback: ogImage,
        video
      }
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'proxy gagal: ' + e.message });
  }
};
