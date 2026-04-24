// --- START OF FILE routes/paymentRoutes.js ---
import express  from 'express';
import Razorpay from 'razorpay';
import crypto   from 'crypto';
import { protect } from '../middleware/authMiddleware.js';
import User from '../models/User.js';

const router = express.Router();

// ── Razorpay instance ─────────────────────────────────────────────────────────
const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error(
    '❌ [paymentRoutes] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing from .env! ' +
    'Payment routes will not work until these are set.'
  );
}

const razorpay = new Razorpay({
  key_id:     RAZORPAY_KEY_ID     || 'missing',
  key_secret: RAZORPAY_KEY_SECRET || 'missing',
});

// ── Plan config ───────────────────────────────────────────────────────────────
export const PLANS = {
  Basic: {
    name:         'Basic',
    label:        'Free Trial',
    price:        0,
    durationDays: 7,
    features:     ['dashboard', 'candidates', 'recruiters', 'requirements', 'schedules', 'settings'],
  },
  Pro: {
    name:          'Pro',
    label:         'Flexi Plan',
    priceMonthly:  199900,   // ₹1,999 in paise
    priceYearly:   1999900,  // ₹19,999 in paise
    durationDays:  30,
    features:      ['dashboard', 'candidates', 'recruiters', 'clients', 'requirements', 'schedules', 'reports', 'settings'],
  },
  Enterprise: {
    name:          'Enterprise',
    label:         'Premium',
    priceMonthly:  499900,   // ₹4,999 in paise
    priceYearly:   4999900,  // ₹49,999 in paise
    durationDays:  30,
    features:      ['all'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/create-order-guest   ← ✅ PUBLIC (no auth)
//
// Called during REGISTRATION for paid plans.
// The user exists in Firebase + MongoDB but has no valid session token yet.
// Body: { plan, billing, email, name, phone }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create-order-guest', async (req, res) => {
  try {
    const { plan, billing = 'monthly', email = '', name = '', phone = '' } = req.body;

    if (!PLANS[plan]) {
      return res.status(400).json({
        message: `Invalid plan: "${plan}". Valid options: Basic, Pro, Enterprise.`,
      });
    }
    if (plan === 'Basic') {
      return res.status(400).json({ message: 'Basic plan is free — no payment needed.' });
    }
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        message:
          'Payment gateway not configured on server. ' +
          'Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your backend .env file.',
      });
    }

    const planConfig = PLANS[plan];
    const amount     = billing === 'yearly' ? planConfig.priceYearly : planConfig.priceMonthly;

    console.log(`[payments] create-order-guest → plan=${plan} billing=${billing} amount=₹${amount / 100} email=${email}`);

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt:  `reg_${Date.now()}`,
      notes:    { plan, billing, email },
    });

    res.json({
      orderId:   order.id,
      amount:    order.amount,
      currency:  order.currency,
      keyId:     RAZORPAY_KEY_ID,
      plan,
      billing,
      userName:  name,
      userEmail: email,
      userPhone: phone,
    });
  } catch (error) {
    console.error('[payments] create-order-guest error:', error);
    res.status(500).json({
      message: `Failed to create payment order: ${error?.error?.description || error.message || 'Unknown Razorpay error'}`,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/verify-guest   ← ✅ PUBLIC (no auth)
//
// Called during REGISTRATION after Razorpay checkout completes.
// Verifies signature and updates the user's plan by email.
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, billing, email }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify-guest', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan,
      billing = 'monthly',
      email,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing Razorpay payment fields.' });
    }

    // 1. Verify signature
    const body     = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment verification failed — invalid signature.' });
    }

    // 2. Upgrade user's plan in MongoDB by email
    if (email) {
      const days      = billing === 'yearly' ? 365 : (PLANS[plan]?.durationDays || 30);
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      await User.findOneAndUpdate(
        { email },
        {
          subscriptionPlan:      plan,
          subscriptionBilling:   billing,
          subscriptionExpiresAt: expiresAt,
          subscriptionPaymentId: razorpay_payment_id,
          subscriptionOrderId:   razorpay_order_id,
        }
      );
      console.log(`[payments] verify-guest → upgraded ${email} to ${plan} until ${expiresAt.toISOString()}`);
    }

    res.json({ message: 'Payment verified. Plan activated!' });
  } catch (error) {
    console.error('[payments] verify-guest error:', error);
    res.status(500).json({ message: `Payment verification error: ${error.message}` });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/create-order   ← 🔒 PROTECTED
//
// Used from UpgradePlanModal (logged-in users upgrading their plan).
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create-order', protect, async (req, res) => {
  try {
    const { plan, billing = 'monthly' } = req.body;

    if (!PLANS[plan]) {
      return res.status(400).json({ message: `Invalid plan: "${plan}".` });
    }
    if (plan === 'Basic') {
      return res.status(400).json({ message: 'Basic plan is free.' });
    }
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        message: 'Payment gateway not configured. Add RAZORPAY_KEY_ID/SECRET to .env',
      });
    }

    const planConfig = PLANS[plan];
    const amount     = billing === 'yearly' ? planConfig.priceYearly : planConfig.priceMonthly;

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt:  `rcpt_${req.user._id}_${Date.now()}`,
      notes:    { userId: req.user._id.toString(), plan, billing },
    });

    res.json({
      orderId:   order.id,
      amount:    order.amount,
      currency:  order.currency,
      keyId:     RAZORPAY_KEY_ID,
      plan,
      billing,
      userName:  req.user.firstName || req.user.username || '',
      userEmail: req.user.email,
      userPhone: req.user.phone || '',
    });
  } catch (error) {
    console.error('[payments] create-order error:', error);
    res.status(500).json({ message: `Failed to create order: ${error?.error?.description || error.message}` });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/verify   ← 🔒 PROTECTED
//
// Used from UpgradePlanModal after Razorpay checkout.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify', protect, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan,
      billing = 'monthly',
    } = req.body;

    const body     = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid payment signature.' });
    }

    const days      = billing === 'yearly' ? 365 : (PLANS[plan]?.durationDays || 30);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        subscriptionPlan:      plan,
        subscriptionBilling:   billing,
        subscriptionExpiresAt: expiresAt,
        subscriptionPaymentId: razorpay_payment_id,
        subscriptionOrderId:   razorpay_order_id,
      },
      { new: true }
    );

    res.json({
      message:   'Plan upgraded successfully!',
      plan:      user.subscriptionPlan,
      expiresAt: user.subscriptionExpiresAt,
    });
  } catch (error) {
    console.error('[payments] verify error:', error);
    res.status(500).json({ message: `Verification failed: ${error.message}` });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/subscription   ← 🔒 PROTECTED
// ─────────────────────────────────────────────────────────────────────────────
router.get('/subscription', protect, async (req, res) => {
  try {
    const user      = await User.findById(req.user._id)
      .select('subscriptionPlan subscriptionBilling subscriptionExpiresAt companyName');
    const plan      = user.subscriptionPlan || 'Basic';
    const expiresAt = user.subscriptionExpiresAt;
    const isExpired = expiresAt ? new Date() > new Date(expiresAt) : false;
    const daysLeft  = expiresAt
      ? Math.max(0, Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
      : null;

    res.json({
      plan,
      billing:    user.subscriptionBilling || 'monthly',
      expiresAt,
      isExpired,
      daysLeft,
      planConfig: PLANS[plan] || PLANS['Basic'],
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch subscription.' });
  }
});

export default router;