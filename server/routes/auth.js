const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');
const { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } = require('../utils/email');

// ── Rate limiters ────────────────────────────────────────
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many login attempts. Please try again in 15 minutes.' } });
const forgotLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { error: 'Too many reset requests. Please try again in 1 hour.' } });

// ── Helpers ──────────────────────────────────────────────
const signToken = (id, rememberMe = false) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: rememberMe ? process.env.JWT_REMEMBER_EXPIRES_IN : process.env.JWT_EXPIRES_IN
  });

const validationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
};

// ── POST /api/auth/signup ────────────────────────────────
router.post('/signup', [
  body('fullName').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('confirmPassword').custom((val, { req }) => {
    if (val !== req.body.password) throw new Error('Passwords do not match');
    return true;
  }),
  body('companyName').optional().trim().isLength({ max: 120 }).withMessage('Company name too long')
], async (req, res) => {
  const err = validationErrors(req, res);
  if (err) return;

  try {
    const { fullName, email, password, companyName } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      // Don't reveal if email exists for security; but for UX we'll be explicit here
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const user = await User.create({ fullName, email, password, companyName: companyName || '' });

    const verifyToken = user.createVerificationToken();
    await user.save({ validateBeforeSave: false });

    try {
      await sendVerificationEmail(user, verifyToken);
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
      // Still create the account, email failure is non-fatal
    }

    res.status(201).json({
      message: 'Account created. Please check your email to verify your account.',
      email: user.email
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/verify-email ──────────────────────────
router.post('/verify-email', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Verification token required.' });

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpiry: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired verification link. Please request a new one.' });

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    try { await sendWelcomeEmail(user); } catch (e) { /* non-fatal */ }

    const jwtToken = signToken(user._id);
    res.json({
      message: 'Email verified successfully!',
      token: jwtToken,
      user: { id: user._id, fullName: user.fullName, email: user.email, companyName: user.companyName }
    });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/resend-verification ──────────────────
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required.' });

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ message: 'If that email exists, a verification link has been sent.' });
    if (user.isVerified) return res.status(400).json({ error: 'Account already verified. Please log in.' });

    const token = user.createVerificationToken();
    await user.save({ validateBeforeSave: false });
    await sendVerificationEmail(user, token);

    res.json({ message: 'Verification email sent. Please check your inbox.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────
router.post('/login', loginLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required')
], async (req, res) => {
  const err = validationErrors(req, res);
  if (err) return;

  try {
    const { email, password, rememberMe } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        unverified: true,
        email: user.email
      });
    }

    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id, !!rememberMe);
    res.json({
      token,
      user: { id: user._id, fullName: user.fullName, email: user.email, companyName: user.companyName, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/forgot-password ──────────────────────
router.post('/forgot-password', forgotLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required')
], async (req, res) => {
  const err = validationErrors(req, res);
  if (err) return;

  try {
    const user = await User.findOne({ email: req.body.email });
    // Always return success to prevent email enumeration
    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const token = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });
    await sendPasswordResetEmail(user, token);

    res.json({ message: 'Password reset link sent. Please check your email.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/reset-password ───────────────────────
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('confirmPassword').custom((val, { req }) => {
    if (val !== req.body.password) throw new Error('Passwords do not match');
    return true;
  })
], async (req, res) => {
  const err = validationErrors(req, res);
  if (err) return;

  try {
    const { token, password } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpiry: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    const jwtToken = signToken(user._id);
    res.json({
      message: 'Password updated successfully.',
      token: jwtToken,
      user: { id: user._id, fullName: user.fullName, email: user.email, companyName: user.companyName }
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      fullName: req.user.fullName,
      email: req.user.email,
      companyName: req.user.companyName,
      role: req.user.role,
      createdAt: req.user.createdAt
    }
  });
});

// ── POST /api/auth/logout ────────────────────────────────
router.post('/logout', (req, res) => {
  // JWT is stateless; client deletes token
  res.json({ message: 'Logged out successfully.' });
});

module.exports = router;
