// Pinterest: info pin (?url=) dan cari pin (?q=). Ditaruh di lib/ supaya gak nambah serverless function (limit Hobby = 12)
const PIN_RE = /^https?:\/\/(?:[\w-]+\.)*(?:pinterest\.[a-z.]+|pin\.it)\//i;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const BASE = process.env.PINTEREST_BASE_URL || 'https://id.pinterest.com';
const PAGE_SIZE = 25;   // pin per halaman dari Pinterest
const MAX_PAGES = 4;    // berapa halaman diambil sekali cari
const LIMIT = 60;       // maksimal pin yang dikirim ke frontend
const HEADERS = { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' };

// ---------- helpers info pin ----------
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

const str = (...vals) => { for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim(); return ''; };

const toOriginal = u => (/pinimg\.com/.test(u) ? u.replace(/\/(?:\d+x\d*|\d+x\d+_RS)\//, '/originals/') : u);

function findVideo(html) {
  const found = new Set();
  const re = /https?:\\?\/\\?\/v\d*\.pinimg\.com\\?\/videos\\?\/[^"'\s<>\\]+?\.mp4/g;
  let m;
  while ((m = re.exec(html))) found.add(m[0].replace(/\\\//g, '/'));
  const list = [...found];
  return list.find(u => /720p|1080p/.test(u)) || list[0] || '';
}

async function handleInfo(url, res) {
  if (!PIN_RE.test(url)) return res.status(400).json({ ok: false, error: 'link Pinterest tidak valid' });
  try {
    const page = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' }, redirect: 'follow' });
    if (!page.ok) return res.status(502).json({ ok: false, error: 'pin gagal diambil (HTTP ' + page.status + ')' });
    const html = await page.text();

    const idm = (page.url || url).match(/\/pin\/(\d+)/);
    const id = idm ? idm[1] : '';
    const ogImage = meta(html, 'og:image');
    const ogVideo = meta(html, 'og:video:secure_url') || meta(html, 'og:video');
    const video = findVideo(html) || ogVideo || '';

    if (!ogImage && !video) return res.status(404).json({ ok: false, error: 'pin tidak ketemu atau private' });

    const title = (meta(html, 'og:title') || meta(html, 'og:description') || '').replace(/\s*\|\s*Pinterest\s*$/i, '').trim();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      ok: true,
      data: {
        id, title,
        type: video ? 'video' : 'image',
        image: ogImage ? toOriginal(ogImage) : '',
        image_fallback: ogImage,
        video
      }
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'proxy gagal: ' + e.message });
  }
}

// ---------- helpers search ----------
async function request(url, options = {}) {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + r.statusText);
  return r;
}

async function createSession() {
  const r = await request(BASE + '/', { headers: HEADERS, redirect: 'follow' });
  const cookies = (r.headers.getSetCookie ? r.headers.getSetCookie() : []).map(c => c.split(';')[0]).join('; ');
  const csrf = (cookies.match(/(?:^|;\s*)csrftoken=([^;]+)/) || [])[1] || '';
  return { cookies, csrf };
}

function mapPin(pin) {
  const images = pin.images || {};
  const vl = (pin.videos && pin.videos.video_list) || {};
  const pick = k => (images[k] && images[k].url) || '';
  const image = pick('orig') || pick('736x') || pick('564x') || pick('236x');
  const thumb = pick('564x') || pick('236x') || image;
  // Hanya mp4 yang bisa diputar & didownload langsung (HLS .m3u8 di-skip)
  const mp4 = [vl.V_720P, vl.V_EXP7].find(v => v && /\.mp4/i.test(v.url || ''));
  return {
    id: String(pin.id),
    title: str(pin.title, pin.grid_title, pin.auto_alt_text),
    type: mp4 ? 'video' : 'image',
    thumb,
    image: image || thumb,
    image_fallback: thumb,
    video: mp4 ? mp4.url : ''
  };
}

// Satu halaman hasil. Pinterest ngasih "bookmark" buat halaman berikutnya.
async function fetchPage(query, bm, session) {
  const sourceUrl = '/search/pins/?q=' + encodeURIComponent(query);
  const payload = {
    options: { query, scope: 'pins', bookmarks: bm ? [bm] : [], page_size: PAGE_SIZE },
    context: {}
  };

  const endpoint = new URL('/resource/BaseSearchResource/get/', BASE);
  endpoint.searchParams.set('source_url', sourceUrl);
  endpoint.searchParams.set('data', JSON.stringify(payload));
  endpoint.searchParams.set('_', Date.now().toString());

  const r = await request(endpoint, {
    headers: {
      ...HEADERS,
      'accept': 'application/json, text/javascript, */*, q=0.01',
      'referer': BASE + sourceUrl,
      'x-requested-with': 'XMLHttpRequest',
      'x-pinterest-appstate': 'active',
      'x-pinterest-pws-handler': 'www/search/[scope].js',
      'x-pinterest-source-url': sourceUrl,
      ...(session.csrf ? { 'x-csrftoken': session.csrf } : {}),
      ...(session.cookies ? { cookie: session.cookies } : {})
    }
  });

  const json = await r.json();
  const resource = json && json.resource_response;
  if (!resource) throw new Error('respons Pinterest tidak valid');
  if (resource.error) throw new Error(resource.error.message || 'Pinterest mengembalikan error');

  const data = resource.data;
  const pins = Array.isArray(data) ? data : (data && data.results) || [];
  return { pins, bookmark: str(resource.bookmark, json.bookmark) };
}

// Ambil beberapa halaman sekaligus, buang dobel, urutkan gambar dulu baru video
async function searchPins(query, bm) {
  const session = await createSession();
  const out = [];
  const ids = new Set();
  let cursor = bm || '';
  let next = '';

  for (let page = 0; page < MAX_PAGES && out.length < LIMIT; page++) {
    const { pins, bookmark } = await fetchPage(query, cursor, session);
    for (const pin of pins) {
      if (!pin || !pin.id || ids.has(String(pin.id))) continue;
      ids.add(String(pin.id));
      out.push(mapPin(pin));
    }
    next = bookmark;
    if (!bookmark || bookmark === '-end-' || bookmark === cursor) break;
    cursor = bookmark;
  }

  out.sort((x, y) => (x.type === 'video') - (y.type === 'video'));
  return { results: out.slice(0, LIMIT), bookmark: next === '-end-' ? '' : next };
}

async function handleSearch(q, bm, res) {
  if (q.length > 100) return res.status(400).json({ ok: false, error: 'keyword terlalu panjang' });
  try {
    const { results, bookmark } = await searchPins(q, bm);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, data: { query: q, total: results.length, results, bookmark } });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'pencarian gagal: ' + e.message });
  }
}

// ---------- entry (dipanggil dari api/tiktok.js?p=pinterest) ----------
function handle(req, res) {
  const q = String((req.query || {}).q || '').trim();
  const bm = String((req.query || {}).bm || '').trim();
  if (q) return handleSearch(q, bm, res);
  const url = String((req.query || {}).url || '').trim();
  return handleInfo(url, res);
}

module.exports = { handle };
