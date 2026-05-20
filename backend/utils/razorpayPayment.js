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
  return id.length > 0 && secret.length > 0;
}

module.exports = { verifyRazorpaySignature, getAmountPaise, isRazorpayConfigured };
