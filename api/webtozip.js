// WebToZip: ambil HTML + asset (css, js, gambar) lalu dibungkus ZIP di server
const zlib = require('zlib');

const MAX_FILES = 80;
const MAX_TOTAL = 3.5 * 1024 * 1024; // batas response Vercel sekitar 4.5MB
const MAX_ONE = 1.5 * 1024 * 1024;
const UA = 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xFF;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function buildZip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const comp = zlib.deflateRawSync(f.data);
    const crc = crc32(f.data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(8, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(f.data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, comp);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(f.data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cdSize = centrals.reduce((a, b) => a + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, ...centrals, end]);
}

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
    const buf = Buffer.from(await r.arrayBuffer());
    return { buf, type: (r.headers.get('content-type') || '').toLowerCase() };
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function buildSite(pageUrl) {
  const base = new URL(pageUrl);
  const page = await getBuf(base.href);
  if (!page) throw new Error('website tidak bisa diambil');
  let html = page.buf.toString('utf8');

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
    const r = await getBuf(ref.abs);
    if (!r || r.buf.length > MAX_ONE) continue;
    if (total + r.buf.length > MAX_TOTAL) break;
    total += r.buf.length;
    const name = safeName(ref.abs, files.length + 1);
    files.push({ name, data: r.buf });
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
    const zip = buildZip(files);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="website.zip"');
    return res.status(200).send(zip);
  } catch (e) {
    return res.status(502).json({ error: 'gagal bikin zip: ' + e.message });
  }
};
module.exports.buildZip = buildZip;
