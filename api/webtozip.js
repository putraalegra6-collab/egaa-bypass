// WebToZip: ambil HTML + asset publik, kirim daftar file (teks/base64) ke browser.
// ZIP dibikin di browser, jadi user bisa pilih file dulu sebelum download.
const MAX_FILES = 80;
const MAX_TOTAL = 2.5 * 1024 * 1024; // dibatasin biar JSON tetap di bawah batas response Vercel
const MAX_ONE = 1.5 * 1024 * 1024;
const UA = 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';
const TEXT_EXT = /\.(html?|css|m?js|json|txt|svg|xml|md|map|webmanifest)$/i;

function resolveUrl(v, base) {
  const t = String(v).trim();
  if (!t || t.startsWith('#') || /^(data|javascript|mailto|tel|blob):/i.test(t)) return null;
  try {
    const abs = new URL(t, base);
    return /^https?:$/.test(abs.protocol) ? abs.href : null;
  } catch (e) { return null; }
}

function safeName(abs, idx) {
  let last = 'file';
  try { last = decodeURIComponent(new URL(abs).pathname.split('/').filter(Boolean).pop() || 'file'); } catch (e) {}
  last = last.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 60) || 'file';
  return `assets/${idx}-${last}`;
}

async function getBuf(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, redirect: 'follow', signal: ctrl.signal });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function buildSite(pageUrl) {
  const base = new URL(pageUrl);
  const pageBuf = await getBuf(base.href);
  if (!pageBuf) throw new Error('website tidak bisa diambil');
  let html = pageBuf.toString('utf8');

  // kumpulin asset dari <script src>, <img src>, <source src>, <link href> (stylesheet/icon)
  const refs = [];
  const tagRe = /<(script|img|source|link)\b([^>]*)>/gi;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    if (tag === 'link' && !/rel\s*=\s*["']?[^"'>]*(stylesheet|icon)/i.test(attrs)) continue;
    const am = /\b(src|href)\s*=\s*(["'])([^"']+)\2/i.exec(attrs);
    if (!am) continue;
    const abs = resolveUrl(am[3], base);
    if (abs) refs.push({ raw: am[3], abs });
  }

  const files = [];
  const localOf = new Map();
  let total = html.length;
  for (const ref of refs) {
    if (files.length >= MAX_FILES) break;
    if (localOf.has(ref.abs)) continue;
    const buf = await getBuf(ref.abs);
    if (!buf || buf.length > MAX_ONE) continue;
    if (total + buf.length > MAX_TOTAL) break;
    total += buf.length;
    const name = safeName(ref.abs, files.length + 1);
    files.push({ name, data: buf });
    localOf.set(ref.abs, name);
  }

  // ganti link asset di HTML jadi path lokal
  for (const ref of refs) {
    const local = localOf.get(ref.abs);
    if (!local) continue;
    html = html.split(`"${ref.raw}"`).join(`"${local}"`);
    html = html.split(`'${ref.raw}'`).join(`'${local}'`);
  }

  files.unshift({ name: 'index.html', data: Buffer.from(html, 'utf8') });
  return files;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method tidak diizinkan' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const { url, password } = body || {};
  if (!process.env.WEBTOZIP_PASSWORD) return res.status(500).json({ error: 'WEBTOZIP_PASSWORD belum diset di server' });
  if (typeof password !== 'string' || password !== process.env.WEBTOZIP_PASSWORD) return res.status(401).json({ error: 'password salah' });
  if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'url tidak valid' });
  try {
    const files = await buildSite(url);
    const out = files.map(f => {
      const isText = TEXT_EXT.test(f.name);
      return {
        name: f.name,
        size: f.data.length,
        text: isText ? f.data.toString('utf8') : null,
        b64: isText ? null : f.data.toString('base64')
      };
    });
    return res.status(200).json({ files: out });
  } catch (e) {
    return res.status(502).json({ error: 'gagal ambil file: ' + e.message });
  }
};
