/**
 * WhatsApp Channel Reaction (VIP) — Serverless Proxy
 * Creator: IzzXd
 * Base: https://reactionwa.online/
 * Saluran: https://whatsapp.com/channel/0029VbDyL6d9RZAh3JjEM325
 *
 * Catatan: API Key TIDAK exposed ke frontend. Password dari user
 * diverifikasi dulu, baru forward ke reactionwa.online pakai key di file ini.
 */

const GEN_KEY_ENDPOINT = 'https://apiv2.reactionwa.online/api/v2/generate_key';
const API_ENDPOINT = 'https://apiv2.reactionwa.online/api/v2/react';
const FIREBASE_API_KEY = 'AIzaSyDNbAlgLycK0oRO8I9ja3mPnIccZkOz0M0';
const RTDB_URL = 'https://autoreactberry-default-rtdb.asia-southeast1.firebasedatabase.app/api_keys.json';

const LINK_REGEX = /(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]+)\/(\d+)/i;
const EMOJI_REGEX = /\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?/gu;

const VIP_CREDENTIALS = {
  'VIP-SYNOZG8C': { email: 'abovezephyrax@gmail.com', uid: 'syNOzg8C4dfMq8CwnE0inNDNdwn1' },
  'VIP-D68JICP0': { email: 'pribadiarep@gmail.com', uid: 'n6eaa7vLSWdexXeCzDnThjqxHps1' },
  'VIP-G3FA579P': { email: 'berrymodapk@gmail.com', uid: 'G3FA579Px5MLiC4zISunSqergX43' },
  'VIP-H9PQGDBA': { email: 'kenznan123@gmail.com', uid: 'h9PQgdbApBWe1E3p3ZXffnpWOdm1' },
  'VIP-VIP-D68J': { email: 'pribadiarep@gmail.com', uid: 'VIP-D68JICPO' }
};

const DEFAULT_VIP_KEYS = [
  { name: 'VIP-SYNOZG8C', apiKey: 'BERRY-RCH-XLedTFORQjE0o05upBSBjMhFLyJzA+ZgINzUpnhbQal+Vl0TdTCWhEyR1i7aCFD97C9dPvs7ZAOTkljWouUmpDplbLNpaloI7ybxoXm95mT4To14487VOag=', domain: 'https://mytestdomain.com' },
  { name: 'VIP-G3FA579P', apiKey: 'BERRY-RCH-s488dmV/Im9CYK9RksIKzHB+PKpqxaGBeDje9boybZoMiEoWLc1EmGG2TA9yTgBOCa9RT56a35exUMwqJG06QTO39LJvF7IWZCVq3FKzME50TUNgJH4=', domain: 'https://berrymodapk.com' },
  { name: 'VIP-VIP-D68J', apiKey: 'BERRY-RCH-UF0CX6Lc+ncL7W/kQldo2v+uKbXtjyqhRg6z/u/GJaoL41jILpCerrfSFQBGLSZnNqHvFrIJ5bnOnDTd2K102CgMulKWZfxGbeo/Fmf9Pi4w2mySyBf5dLAnaw==', domain: 'https://reactv2.zfile.web.id' },
  { name: 'VIP-D68JICP0', apiKey: 'BERRY-RCH-Eu3fhllDTNViiwl8dFcVKfMnJUzSt/UFLTftJ/sZJgPy/nCC3Y7JO+83gJLLhicfp+SEEhfruPHhIE3vJrr0oU5mhEfpa2GcBcC4A/GV9VaInumRoLsmSLjBskNQyVE=', domain: 'https://api.rech.v2.zfile.web.id' },
  { name: 'VIP-H9PQGDBA', apiKey: '5XJr5CoEvcwn6Akmx4TvQPV+ybnaa7VAn8OUYdociEXLS2l06kPypNMFhz5eMExSxrq+/mHz8sOu/5k44dEB016L/QJ3QZpPuYbDiSdpxlVTOR6a14P295M8lQrmMrj0YLJmmne1sQ+1YGhCKSg=', domain: 'https://anzzmodsofficial.edgeone.dev/reaction/wa' }
];

// State di memory (Vercel serverless: state per-instance, reset saat cold start)
let state = {
  keyIndex: 0,
  keys: DEFAULT_VIP_KEYS,
  lastSync: 0
};

function normalizeUrl(inputUrl) {
  const match = String(inputUrl || '').match(LINK_REGEX);
  if (!match) return null;
  return `https://whatsapp.com/channel/${match[1]}/${match[2]}`;
}

function parseEmojis(inputEmoji) {
  const str = String(inputEmoji || '');
  const matches = str.match(EMOJI_REGEX);
  if (!matches || matches.length === 0) return null;
  return matches.slice(0, 5).join(', ');
}

async function generateVipApiKey(vipKeyName, targetDomain) {
  const cred = VIP_CREDENTIALS[vipKeyName];
  if (!cred) return null;
  try {
    const res = await fetch(GEN_KEY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vipKey: vipKeyName,
        email: cred.email,
        domain: targetDomain,
        uid: cred.uid
      })
    });
    const data = await res.json();
    if (data && data.success && data.apiKey) return data.apiKey;
  } catch (e) {}
  return null;
}

async function syncVipKeys() {
  try {
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Referer': 'https://reactionwa.online/' },
      body: JSON.stringify({ returnSecureToken: true })
    });
    const authData = await authRes.json();
    const idToken = authData && authData.idToken;
    if (!idToken) return null;

    const dbRes = await fetch(`${RTDB_URL}?auth=${idToken}`);
    const dbData = await dbRes.json();
    if (!dbData || typeof dbData !== 'object') return null;

    const freshKeys = [];
    for (const [name, val] of Object.entries(dbData)) {
      if (val && val.active !== false) {
        let domain = val.domain || 'https://reactionwa.online';
        let apiKey = val.apiKey;
        if (domain === '*' || !apiKey) {
          domain = 'https://mytestdomain.com';
          const genKey = await generateVipApiKey(name, domain);
          if (genKey) apiKey = genKey;
        }
        if (apiKey) freshKeys.push({ name, apiKey, domain });
      }
    }

    if (freshKeys.length > 0) {
      state.keys = freshKeys;
      state.lastSync = Date.now();
      return freshKeys;
    }
  } catch (e) {}
  return null;
}

async function sendReactionRequest(targetUrl, reactionText, keyObj) {
  const origin = keyObj.domain === '*' ? 'https://reactionwa.online' : keyObj.domain;
  const referer = origin.endsWith('/') ? origin : origin + '/';

  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': origin,
      'Referer': referer,
      'x-api-key': keyObj.apiKey,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
    },
    body: JSON.stringify({ url: targetUrl, reaction: reactionText })
  });

  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { return { error: text.slice(0, 200) }; }
}

async function doReact(targetUrl, reactionInput) {
  const startTime = Date.now();
  const normalizedUrl = normalizeUrl(targetUrl);
  if (!normalizedUrl) {
    return { status: false, error: 'Format URL WhatsApp Channel tidak valid. Contoh: https://whatsapp.com/channel/0029VbDyL6d9RZAh3JjEM325/158', time: `${Date.now() - startTime}ms` };
  }

  const emojiString = parseEmojis(reactionInput);
  if (!emojiString) {
    return { status: false, error: 'Emoji tidak valid atau kosong. Masukkan minimal 1 emoji (contoh: "👍" atau "💦,👍").', time: `${Date.now() - startTime}ms` };
  }

  // Coba sync dari Firebase dulu (kalau lebih dari 5 menit)
  if (Date.now() - state.lastSync > 5 * 60 * 1000) {
    await syncVipKeys();
  }

  if (!state.keys || state.keys.length === 0) state.keys = DEFAULT_VIP_KEYS;

  let attempts = 0;
  const maxAttempts = state.keys.length;
  let lastError = 'Semua VIP Key telah mencapai batas kuota harian (50/50). Kuota akan direset besok hari.';

  while (attempts < maxAttempts) {
    const currentKey = state.keys[state.keyIndex % state.keys.length];
    state.keyIndex = (state.keyIndex + 1) % state.keys.length;

    try {
      const result = await sendReactionRequest(normalizedUrl, emojiString, currentKey);

      if (result && (result.success === true || result.status === 'success')) {
        const task = (result.data && result.data.task) || {};
        const vipInfo = (result.data && result.data.vip) || {};
        return {
          status: true,
          message: result.message || 'Reaction VIP API masuk antrean.',
          reaction: emojiString,
          reactions: emojiString.split(',').map(s => s.trim()),
          total_emojis: emojiString.split(',').length,
          task_status: 'queued',
          target: normalizedUrl,
          task_id: task.key_id || null,
          vip_key: currentKey.name,
          vip_package: vipInfo.packageName || 'VIP Permanent',
          usage_today: result.usage_today || null,
          limit: result.limit || 50,
          points_remaining: vipInfo.pointRemaining !== undefined ? vipInfo.pointRemaining : null,
          response_time: `${Date.now() - startTime}ms`
        };
      }

      if (result && result.error) {
        lastError = `[${currentKey.name}] ${result.error}`;
      }
    } catch (err) {
      lastError = err.message || 'Terjadi kesalahan pada server';
    }

    attempts++;
  }

  return { status: false, error: lastError, time: `${Date.now() - startTime}ms` };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ status: false, error: 'method tidak diizinkan' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const { url, reaction, password } = body || {};

  if (!process.env.REACT_PASSWORD) {
    return res.status(500).json({ status: false, error: 'REACT_PASSWORD belum diset di server' });
  }
  if (typeof password !== 'string' || password !== process.env.REACT_PASSWORD) {
    return res.status(401).json({ status: false, error: 'password salah' });
  }

  try {
    const result = await doReact(url, reaction);
    return res.status(result.status ? 200 : 400).json(result);
  } catch (e) {
    return res.status(502).json({ status: false, error: 'proxy gagal: ' + e.message });
  }
};
