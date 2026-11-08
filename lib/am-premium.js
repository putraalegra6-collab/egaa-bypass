/**
 * Alight Motion Premium Verifier
 * Creator: IzzXd
 * Base: https://am-premiumms.ai.studio
 * Saluran: https://whatsapp.com/channel/0029VbDyL6d9RZAh3JjEM325
 * Note: pliss guys jangan di klaim 100% buatan lu, lu boleh kok modifikasi trs share lagi tapi tolong jangan ilangin header creator sama ch-nya
 */

const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');

const _p = ["fJMupwGtP5IrlSHzB608x3nEdfsErTvFeMd081GnP5Ap", "w3XyVqs9w32RI6cD+GrEeJYnpgT4PsEolCOiAao8xw=="];
const _k = [0x4d, 0xa1, 0x17, 0xc3, 0x62, 0x9e, 0x0b, 0xf4];

function _ld() {
    const raw = Buffer.from(_p.join(''), 'base64');
    const out = Buffer.alloc(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw[i] ^ _k[i % _k.length];
    return out.toString('utf8');
}

function _hd() {
    try {
        const src = fs.readFileSync(__filename, 'utf8');
        const m = src.match(/^\s*\/\*\*[\s\S]*?\*\//);
        if (!m) return '';
        const keys = ['Creator:', 'Saluran:', 'Note:'];
        const lines = m[0].split('\n').map(l => l.replace(/^\s*\*?\s*/, '').replace(/\s+/g, ''));
        const pick = keys.map(k => lines.find(l => l.startsWith(k)));
        if (pick.some(x => !x)) return '';
        return crypto.createHash('sha256').update(pick.join('')).digest('hex');
    } catch (_) {
        return '';
    }
}

function _ck() {
    const h = _hd();
    if (!h || h !== _ld()) throw new Error('ctx invalid');
}

const CREATOR = 'IzzXd';
const SALURAN = 'https://whatsapp.com/channel/0029VbDyL6d9RZAh3JjEM325';
const BASE_URL = 'https://am-premiumms.ai.studio';

function formatSuccess(data, startTime) {
    return {
        Creator: CREATOR,
        Saluran: SALURAN,
        time: `${Date.now() - startTime}ms`,
        status: true,
        ...data
    };
}

function formatError(err, startTime) {
    let msg = err && err.message ? err.message : String(err);
    if (err && err.response && err.response.data) {
        const d = err.response.data;
        if (typeof d === 'string') msg = d;
        else if (d.message) msg = d.message;
        else if (d.error) msg = d.error;
    }
    return {
        Creator: CREATOR,
        Saluran: SALURAN,
        time: `${Date.now() - startTime}ms`,
        status: false,
        error: msg
    };
}

async function getStats() {
    _ck();
    const startTime = Date.now();
    try {
        const res = await axios.get(`${BASE_URL}/api/stats`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 15000
        });
        if (res.data && res.data.success) {
            return formatSuccess({
                totalVerified: res.data.total || 0,
                todayVerified: res.data.today || 0
            }, startTime);
        }
        throw new Error((res.data && res.data.message) || 'Gagal mengambil data statistik.');
    } catch (err) {
        return formatError(err, startTime);
    }
}

async function sendLink(email) {
    _ck();
    const startTime = Date.now();
    try {
        const cleanEmail = String(email || '').trim();
        if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
            throw new Error('Format alamat email tidak valid.');
        }
        const res = await axios.post(`${BASE_URL}/api/send-link`, { email: cleanEmail }, {
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
            timeout: 25000
        });
        if (res.data && res.data.success) {
            return formatSuccess({
                email: cleanEmail,
                message: res.data.message || 'Link verifikasi berhasil dikirim.'
            }, startTime);
        }
        throw new Error((res.data && res.data.message) || 'Gagal mengirim magic link.');
    } catch (err) {
        return formatError(err, startTime);
    }
}

async function verifyLink(email, magicLink) {
    _ck();
    const startTime = Date.now();
    try {
        const cleanEmail = String(email || '').trim();
        const cleanLink = String(magicLink || '').trim();
        if (!cleanEmail) throw new Error('Email wajib diisi.');
        if (!cleanLink) throw new Error('Magic Link wajib diisi.');
        const res = await axios.post(`${BASE_URL}/api/verify-link`, {
            email: cleanEmail,
            magicLink: cleanLink
        }, {
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
            timeout: 30000
        });
        if (res.data && res.data.success) {
            const user = res.data.data || res.data.userData || {};
            return formatSuccess({
                message: 'Verifikasi berhasil! Akun Alight Motion VIP Pro aktif.',
                email: cleanEmail,
                uid: user.uid || null,
                orderId: user.orderId || null,
                validUntil: user.validUntil || '1 Tahun',
                userData: user
            }, startTime);
        }
        throw new Error((res.data && res.data.message) || 'Verifikasi link gagal.');
    } catch (err) {
        return formatError(err, startTime);
    }
}

module.exports = {
    sendLink,
    verifyLink,
    getStats,
    CREATOR,
    SALURAN
};