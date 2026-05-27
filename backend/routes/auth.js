const express = require('express');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const User = require('../models/User');
const Business = require('../models/Business');
const auth = require('../middleware/auth');
const {
  verifyRazorpaySignature,
  getAmountPaise,
  isRazorpayConfigured,
  isPaymentBypass,
} = require('../utils/razorpayPayment');
const { applySheetLinks } = require('../services/sheetLinks');

const router = express.Router();

router.get('/payment-config', (_req, res) => {
  const bypass = isPaymentBypass();
  const enabled = isRazorpayConfigured() && !bypass;
  const amountPaise = getAmountPaise();
  res.json({
    razorpayEnabled: enabled,
    razorpayBypass: bypass,
    keyId: enabled ? process.env.RAZORPAY_KEY_ID.trim() : null,
    amountPaise,
    amountRupees: (amountPaise / 100).toFixed(2),
    businessName: (process.env.RAZORPAY_BUSINESS_NAME || process.env.PAYMENT_MERCHANT_NAME || 'Lead Management').trim(),
  });
});

router.get('/payment-info', (_req, res) => {
  const upiId = (process.env.PAYMENT_UPI_ID || '').trim().replace(/^["']|["']$/g, '');
  const amount = String(process.env.PAYMENT_AMOUNT_INR || '1').trim().replace(/^["']|["']$/g, '');
  const merchantName = (process.env.PAYMENT_MERCHANT_NAME || 'Lead Management').trim().replace(/^["']|["']$/g, '');
  res.json({
    upiId,
    amount: amount || '1',
    currency: 'INR',
    merchantName,
  });
});

router.post('/payment-order', async (_req, res) => {
  try {
    if (!isRazorpayConfigured()) {
      return res.status(503).json({
        message:
          'Online payments are not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the server .env (Razorpay Dashboard → Settings → API Keys).',
      });
    }
    const keyId = process.env.RAZORPAY_KEY_ID.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET.trim();
    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const amountPaise = getAmountPaise();
    const order = await rzp.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `signup_${Date.now()}`.slice(0, 40),
    });
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      name: (process.env.RAZORPAY_BUSINESS_NAME || process.env.PAYMENT_MERCHANT_NAME || 'Lead Management').trim(),
      description: process.env.RAZORPAY_DESCRIPTION || 'New account signup',
    });
  } catch (err) {
    res.status(500).json({ message: err.error?.description || err.message || 'Could not start payment' });
  }
});

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function formatUser(user) {
  const base = {
    id: user._id,
    name: user.name,
    username: user.username,
    role: user.role || 'user',
    isActive: user.isActive !== false,
  };

  if (user.role === 'superadmin' || !user.business) {
    return { ...base, business: null };
  }

  return {
    ...base,
    business: {
      id: user.business._id,
      name: user.business.name,
      logo: user.business.logo,
      onboardingComplete: user.business.onboardingComplete,
      sheetLinks: user.business.sheetLinks,
    },
  };
}

router.post('/register', async (req, res) => {
  try {
    const {
      businessName,
      name,
      username,
      password,
      links,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body;

    if (!businessName?.trim() || !name?.trim() || !username?.trim() || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!Array.isArray(links) || links.length === 0) {
      return res.status(400).json({ message: 'Add at least one Google Sheet link before payment' });
    }

    const bypass = isPaymentBypass();
    const paymentBypass = req.body.paymentBypass === true;

    if (paymentBypass && !bypass) {
      return res.status(400).json({ message: 'Payment bypass is not enabled on this server.' });
    }

    if (bypass && paymentBypass) {
      // Pre-launch: same Get Started UI; no Razorpay charge until keys are configured
    } else if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        message: 'Complete the payment using the Pay button. Your account is only created after Razorpay confirms a successful payment.',
      });
    } else if (!verifyRazorpaySignature(orderId, paymentId, signature)) {
      return res.status(400).json({
        message: 'Payment could not be verified. If money was debited, wait a moment and contact support with your payment ID.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ username: username.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const business = await Business.create({
      name: businessName.trim(),
      logo: req.body.logo || '',
    });

    const user = await User.create({
      name: name.trim(),
      username: username.toLowerCase().trim(),
      password,
      business: business._id,
      signUpPaymentRef: bypass && paymentBypass ? 'bypass_pending_razorpay' : `rzp_${paymentId}`,
    });

    try {
      await applySheetLinks(business, links);
      business.onboardingComplete = true;
      await business.save();
    } catch (linkErr) {
      await User.deleteOne({ _id: user._id });
      await Business.deleteOne({ _id: business._id });
      return res.status(linkErr.status || 400).json({
        message: linkErr.message || 'Invalid Google Sheet links',
      });
    }

    await user.populate('business');
    const token = signToken(user._id);

    res.status(201).json({ token, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ username: username.toLowerCase().trim() }).populate('business');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: 'Account is disabled. Contact administrator.' });
    }

    const token = signToken(user._id);
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Login failed' });
  }
});

router.get('/me', auth, (req, res) => {
  res.json({ user: formatUser(req.user) });
});

module.exports = router;
