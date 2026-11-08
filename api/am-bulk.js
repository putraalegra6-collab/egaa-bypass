// Alight Motion Bulk Auto Verify (Satriam + Generator.email)
// Creator: IzzXd — diadaptasi untuk EgaaBypass
// 1 request = 1 akun, biar aman dari maxDuration Vercel (60s).
// Frontend yang loop buat "bulk".

const BASE_SATRIAM = 'https://satriam.satriadeveloperz.workers.dev';
const BASE_GENEMAIL = 'https://generator.email';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getGeneratorEmailSession() {
  const init = await fetch(`${BASE_GENEMAIL}/`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(10000)
  });
  const setCookies = init.headers.getSetCookie ? init.headers.getSetCookie() : [init.headers.get('set-cookie') || ''];
  const hpCookie = setCookies.find(c => c && c.startsWith('__Host-ab_hp='));
  const rawCtx = setCookies.find(c => c && c.startsWith('inbox_ctx='));

  let domain = 'heyzalo.vn';
  if (rawCtx) {
    try {
      const dec = decodeURIComponent(rawCtx.split(';')[0].split('=')[1]);
      const extracted = dec.split('/')[0];
      if (extracted) domain = extracted;
    } catch {}
  }

  const hpCookieHeader = hpCookie ? hpCookie.split(';')[0] : '';
  return { domain, hpCookieHeader };
}

function generateRandomUser() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let user = 'am';
  for (let i = 0; i < 6; i++) {
    user += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  user += Math.floor(Math.random() * 89 + 10);
  return user;
}

async function sendSatriamLink(email) {
  const res = await fetch(`${BASE_SATRIAM}/api/satriam/send-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ email }),
    signal: AbortSignal.timeout(15000)
  });
  return await res.json();
}

async function verifySatriamLink(email, magicLink) {
  const res = await fetch(`${BASE_SATRIAM}/api/satriam/verify-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ email, magicLink }),
    signal: AbortSignal.timeout(15000)
  });
  return await res.json();
}

async function fetchMagicLink(domain, user, hpCookieHeader, maxAttempts = 8) {
  const ctx = encodeURIComponent(`${domain}/${user}/`);
  const cookies = `inbox_ctx=${ctx}; ${hpCookieHeader}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(attempt === 1 ? 5000 : 3000);

    try {
      const res = await fetch(`${BASE_GENEMAIL}/inbox1/`, {
        headers: { 'User-Agent': UA, 'Cookie': cookies },
        signal: AbortSignal.timeout(10000)
      });
      const html = await res.text();

      const links = html.match(/https?:\/\/[^\s"'<>]+/gi) || [];
      const magicLink = links.find(l =>
        (l.includes('alight-creative.firebaseapp.com') || l.includes('alightcreative.com')) &&
        (l.includes('signInWithEmailLink') || l.includes('auth_action') || l.includes('links?link='))
      );

      if (magicLink) return magicLink.replace(/&amp;/g, '&');
    } catch {}
  }
  throw new Error('Timeout menunggu email magic link dari Alight Motion');
}

async function createAndVerifySingleAccount() {
  const sessionData = await getGeneratorEmailSession();
  const { domain, hpCookieHeader } = sessionData;
  const user = generateRandomUser();
  const email = `${user}@${domain}`;

  const sendRes = await sendSatriamLink(email);
  if (!sendRes?.success) {
    throw new Error(sendRes?.message || sendRes?.error || 'Gagal mengirim link ke email');
  }

  const magicLink = await fetchMagicLink(domain, user, hpCookieHeader);
  const verifyRes = await verifySatriamLink(email, magicLink);

  if (!verifyRes?.success) {
    throw new Error(verifyRes?.message || verifyRes?.error || 'Gagal verifikasi magic link');
  }

  return {
    email,
    status: true,
    membershipStatus: verifyRes.membershipStatus || 'PREMIUM_ACTIVE',
    planName: verifyRes.planName || 'Alight Motion Pro / Member',
    orderId: verifyRes.orderId || null,
    validUntil: verifyRes.validUntil || null,
    features: verifyRes.features || []
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method tidak diizinkan' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  // Password gate (sama kayak pola webtozip) — env opsional
  if (process.env.AM_PASSWORD) {
    if (!body || typeof body.password !== 'string' || body.password !== process.env.AM_PASSWORD) {
      return res.status(401).json({ ok: false, error: 'password salah' });
    }
  }

  try {
    const account = await createAndVerifySingleAccount();
    return res.status(200).json({ ok: true, data: account });
  } catch (e) {
    return res.status(502).json({ ok: false, error: e.message || 'gagal bikin akun' });
  }
};
