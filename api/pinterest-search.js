// Pinterest search: cari pin berdasarkan keyword lewat endpoint pencarian web, balikin hasil siap preview/download
const BASE = process.env.PINTEREST_BASE_URL || 'https://id.pinterest.com';
const LIMIT = 12;
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'accept-language': 'en-US,en;q=0.9'
};

async function request(url, options = {}) {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + r.statusText);
  return r;
}

async function createSession() {
  const r = await request(BASE + '/', { headers: HEADERS, redirect: 'follow' });
  const cookies = (r.headers.getSetCookie ? r.headers.getSetCookie() : [])
    .map(c => c.split(';')[0])
    .join('; ');
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
  const video = mp4 ? mp4.url : '';

  return {
    id: String(pin.id),
    title: pin.title || pin.grid_title || pin.auto_alt_text || '',
    type: video ? 'video' : 'image',
    thumb,
    image: image || thumb,
    image_fallback: thumb,
    video
  };
}

async function searchPins(query) {
  const session = await createSession();
  const sourceUrl = '/search/pins/?q=' + encodeURIComponent(query);

  const payload = {
    options: { query, scope: 'pins', bookmarks: [], page_size: LIMIT },
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
  return pins.filter(p => p && p.id).slice(0, LIMIT).map(mapPin);
}

module.exports = async (req, res) => {
  const q = String((req.query || {}).q || '').trim();
  if (!q) return res.status(400).json({ ok: false, error: 'keyword kosong' });
  if (q.length > 100) return res.status(400).json({ ok: false, error: 'keyword terlalu panjang' });

  try {
    const results = await searchPins(q);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ ok: true, data: { query: q, total: results.length, results } });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'pencarian gagal: ' + e.message });
  }
};
