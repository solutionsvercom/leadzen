const crypto = require('crypto');

function verifyRazorpaySignature(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) return false;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  if (expected.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
  } catch {
    return false;
  }
}

function getAmountPaise() {
  const raw = process.env.RAZORPAY_AMOUNT_PAISE || process.env.PAYMENT_AMOUNT_PAISE || '100';
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n >= 100 ? n : 100;
}

function isRazorpayConfigured() {
  const id = (process.env.RAZORPAY_KEY_ID || '').trim();
  const secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  const placeholder =
    id.includes('xxxxxxxx') || secret === 'your_key_secret_here' || secret.length < 8;
  return id.length > 0 && secret.length > 0 && !placeholder;
}

/** Skip real Razorpay until keys are set (or RAZORPAY_BYPASS=true). Add keys + RAZORPAY_BYPASS=false for live payments. */
function isPaymentBypass() {
  const flag = String(process.env.RAZORPAY_BYPASS || '').trim().toLowerCase();
  if (flag === 'true' || flag === '1' || flag === 'yes') return true;
  if (flag === 'false' || flag === '0' || flag === 'no') return false;
  return !isRazorpayConfigured();
}

module.exports = {
  verifyRazorpaySignature,
  getAmountPaise,
  isRazorpayConfigured,
  isPaymentBypass,
};
