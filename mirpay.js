// ─── MirPay.uz integratsiyasi ────────────────────────────────────────────────
// Hujjat: https://documenter.getpostman.com/view/37255689/2sAXjM3BTW
//
// Oqim:
//   1. getToken()      -> kassaid + api_key bilan token olinadi (token keshlanadi)
//   2. createPayment()  -> summa + info_pay bilan to'lov yaratiladi, foydalanuvchiga
//                          to'lov havolasi (link) yuboriladi
//   3. MirPay to'lov yakunlangach o'zi sizning serveringizga (PUBLIC_URL + webhook
//      yo'li) POST so'rov yuboradi — buni bot.js ichidagi /mirpay-webhook
//      endpoint qabul qiladi.
//
// MUHIM: MirPay hujjatida "Example Response" qismlari bo'sh (to'ldirilmagan).
// Shuning uchun quyidagi kod javobni KENG qamrovda o'qiydi (turli mumkin bo'lgan
// maydon nomlarini tekshiradi) va har doim to'liq xom javobni konsolga
// (Railway logiga) chiqarib turadi. Birinchi haqiqiy to'lovdan keyin Railway
// logida "MirPay create-pay javobi:" qatorini ko'rib, agar to'lov havolasi
// to'g'ri olinmasa, shu logdagi aniq maydon nomini menga yuborsangiz, bitta
// qatorni tuzataman.

const KASSA_ID = process.env.MIRPAY_KASSA_ID || '';
const API_KEY = process.env.MIRPAY_API_KEY || '';

let cachedToken = null;
let tokenFetchedAt = 0;
const TOKEN_TTL_MS = 1000 * 60 * 30; // 30 daqiqa — ehtiyot uchun vaqti-vaqti bilan yangilanadi

function isConfigured() {
  return Boolean(KASSA_ID && API_KEY);
}

// ── Token olish (keshlangan) ──
async function getToken(forceRefresh = false) {
  if (!isConfigured()) {
    throw new Error('MIRPAY_KASSA_ID yoki MIRPAY_API_KEY o\'rnatilmagan');
  }

  const isFresh = cachedToken && Date.now() - tokenFetchedAt < TOKEN_TTL_MS;
  if (isFresh && !forceRefresh) return cachedToken;

  const url = `https://mirpay.uz/api/connect?kassaid=${encodeURIComponent(KASSA_ID)}&api_key=${encodeURIComponent(API_KEY)}`;
  const res = await fetch(url, { method: 'POST' });
  const raw = await res.text();
  console.log('MirPay token javobi (status ' + res.status + '):', raw);

  if (!res.ok) {
    throw new Error(`MirPay token olishda xatolik: ${res.status} ${raw}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    // Ba'zi API'lar tokenni xom matn (plain text) sifatida qaytaradi
    data = { token: raw.trim() };
  }

  const token = data.token || data.access_token || data.data?.token || raw.trim();
  if (!token) {
    throw new Error('MirPay javobidan token topilmadi: ' + raw);
  }

  cachedToken = token;
  tokenFetchedAt = Date.now();
  return token;
}

// ── To'lov yaratish ──
// amount: so'mda butun son (masalan 5000)
// infoPay: to'lov tavsifi (masalan "Profil ko'rish #123")
// Qaytaradi: { payId, payUrl, raw } — agar payUrl topilmasa, raw orqali
// Railway logida nima kelganini ko'rib, kerakli maydonni qo'shamiz.
async function createPayment(amount, infoPay) {
  let token = await getToken();

  const doRequest = async (tok) => {
    const url = `https://mirpay.uz/api/create-pay?summa=${encodeURIComponent(amount)}&info_pay=${encodeURIComponent(infoPay)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}` },
    });
    const raw = await res.text();
    return { res, raw };
  };

  let { res, raw } = await doRequest(token);

  // Token eskirgan bo'lsa (401/403), bir marta yangilab qayta urinib ko'ramiz
  if (res.status === 401 || res.status === 403) {
    token = await getToken(true);
    ({ res, raw } = await doRequest(token));
  }

  console.log('MirPay create-pay javobi (status ' + res.status + '):', raw);

  if (!res.ok) {
    throw new Error(`MirPay to'lov yaratishda xatolik: ${res.status} ${raw}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = {};
  }

  const payId =
    data.payid || data.payId || data.id || data.data?.payid || data.data?.id || null;

  const payUrl =
    data.url ||
    data.link ||
    data.havola ||
    data.pay_url ||
    data.payUrl ||
    data.data?.url ||
    data.data?.link ||
    null;

  return { payId, payUrl, raw: data };
}

// ── To'lov holatini tekshirish (zaxira variant, agar webhook kelmasa) ──
async function checkStatus(payId) {
  const token = await getToken();
  const form = new URLSearchParams();
  form.append('payid', payId);

  const res = await fetch('https://mirpay.uz/api/pay/invoice/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  const raw = await res.text();
  console.log('MirPay status javobi (status ' + res.status + '):', raw);

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = {};
  }

  return data;
}

module.exports = { isConfigured, getToken, createPayment, checkStatus };
