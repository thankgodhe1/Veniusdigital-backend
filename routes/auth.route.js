const router = require('express').Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sendMail, isEmailConfigured, FROM_EMAIL: EMAIL_FROM } = require('../utils/email');
const { validationResult } = require('express-validator');
const User = require('../models/user.model');
const { registerValidator } = require('../utils/validators');
const { createToken, maxAge, JWT_SECRET, requireAuth } = require('../utils/authMiddleware');
const { getPushConfig, sendPushToUser } = require('../utils/pushNotifications');

const FROM_EMAIL = process.env.FROM_EMAIL || process.env.BIRD_FROM_EMAIL || 'support@digital-grownt.com';
const BRAND_WEBSITE_URL = String(process.env.BRAND_WEBSITE_URL || process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
const BRAND_LOGO_URL = process.env.BRAND_LOGO_URL || `${String(process.env.FRONTEND_URL || '').replace(/\/$/, '')}/storage/app/public/photos/DjH2X9jdLXAgNMV4LJyhCMJ34SrNFTDSlxA6Qk7I.png`;
const ACCOUNT_TYPES = new Set(['Binary Option Trading', 'Forex Trading', 'Stock Trading', 'CryptoCurrency Investment', 'NFT Trading']);
const EMAIL_RE = /^\S+@\S+\.\S+$/;

function frontendUrl() {
  const configured = String(process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
  if (!configured) throw new Error('FRONTEND_URL must be set');
  return configured;
}

function cookieOptions(remember) {
  // Production cross-site (e.g. Netlify → Render): SameSite=None + Secure
  // Local HTTP: SameSite=lax + Secure=false so the browser actually stores the cookie
  const sameSite = process.env.COOKIE_SAMESITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax');
  const secureEnv = process.env.COOKIE_SECURE;
  const secure = secureEnv != null
    ? String(secureEnv).toLowerCase() === 'true'
    : (sameSite === 'none' || process.env.NODE_ENV === 'production');
  return {
    httpOnly: true,
    maxAge: (remember ? maxAge * 7 : maxAge) * 1000,
    sameSite,
    secure,
    path: '/',
  };
}

function clearCookieOptions() {
  const options = cookieOptions(false);
  delete options.maxAge;
  return options;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function safeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    gender: user.gender,
    country: user.country,
    currency_code: user.currency_code || 'USD',
    image: user.image || '',
    address: user.address || '',
    state: user.state || '',
    zip_code: user.zip_code || '',
    account_verify: user.account_verify || 'Not Verified',
    verificationStatus: user.verificationStatus || 'not_verified',
    isVerified: Boolean(user.isVerified),
    ref_link: user.ref_link || '',
    win_rate: Number(user.win_rate ?? 0),
    role: user.role,
    balance: Number(user.balance ?? user.account_bal ?? 0),
    account_bal: Number(user.account_bal ?? user.balance ?? 0),
    connectWallet: user.connectWallet !== undefined ? Boolean(user.connectWallet) : String(user.wallet_connect_status || 'on').toLowerCase() !== 'off',
    profit: Number(user.profit ?? user.roi ?? 0),
    roi: Number(user.roi ?? 0),
    ref_bonus: Number(user.ref_bonus ?? 0),
    bonus: Number(user.bonus ?? 0),
    signal_strength: Number(user.signal_strength_score ?? user.signal_strength ?? 0),
    signal_strength_score: Number(user.signal_strength_score ?? user.signal_strength ?? 0),
    signal_strength_enabled: Boolean(user.signal_strength_enabled),
    trade_prog: Number(user.trading_progress_score ?? user.trade_prog ?? 0),
    trading_progress_score: Number(user.trading_progress_score ?? user.trade_prog ?? 0),
    trading_progress_enabled: Boolean(user.trading_progress_enabled),
    win_rate: Number(user.win_rate ?? 0),
    trade_mode: user.trade_mode || 'on',
    wallet_connect_status: user.wallet_connect_status || 'on',
    status: user.status || 'active',
    verificationStatus: user.verificationStatus || (user.isVerified ? 'verified' : 'not_verified'),
    account_verify: user.account_verify || 'Not Verified',
    verificationBannerDismissed: Boolean(user.verificationBannerDismissed),
    dashboard_banner_message: user.dashboard_banner_message || '',
    dashboard_banner_type: user.dashboard_banner_type || 'warning',
    dashboard_banner_enabled: Boolean(user.dashboard_banner_enabled),
    account: user.account || [],
    image: user.image || '',
    isVerified: Boolean(user.isVerified || user.verificationStatus === 'verified'),
  };
}

function welcomeEmailHtml({ name }) {
  const safeName = escapeHtml(name);
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Welcome to Digital-grownt</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">Welcome to Digital-grownt!</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f5f7f9;">
    <tr>
      <td align="center" style="padding:24px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;border-radius:8px;overflow:hidden;">
          <tr>
            <td align="center" style="background-color:#059669;padding:24px 32px;">
              <a href="${escapeHtml(BRAND_WEBSITE_URL)}" style="text-decoration:none;">
                <img src="${escapeHtml(BRAND_LOGO_URL)}" alt="Digital-grownt" height="48" style="display:block;max-height:48px;width:auto;border:0;margin:0 auto;">
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:32px 40px;">
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;">Welcome, ${safeName}!</h2>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">
                We are thrilled to have you join the <strong>Digital-grownt</strong> community!
                This is just the beginning of an exciting financial journey. Our platform offers
                powerful tools to help you grow and manage your investments seamlessly.
              </p>

              <h3 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#111827;">Unlock the Full Potential of Our System:</h3>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;">
                <tr>
                  <td style="padding:8px 0;font-size:14px;line-height:1.5;color:#374151;border-bottom:1px solid #f3f4f6;">
                    <span style="color:#059669;font-weight:700;">●</span>&nbsp; <strong>Trading System</strong> — Buy, sell, and manage assets effortlessly.
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:14px;line-height:1.5;color:#374151;border-bottom:1px solid #f3f4f6;">
                    <span style="color:#059669;font-weight:700;">●</span>&nbsp; <strong>Copy Trading</strong> — Mirror expert traders' strategies for passive gains.
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:14px;line-height:1.5;color:#374151;border-bottom:1px solid #f3f4f6;">
                    <span style="color:#059669;font-weight:700;">●</span>&nbsp; <strong>NFT Marketplace</strong> — Trade exclusive digital assets securely.
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:14px;line-height:1.5;color:#374151;border-bottom:1px solid #f3f4f6;">
                    <span style="color:#059669;font-weight:700;">●</span>&nbsp; <strong>Signal Subscription</strong> — Stay ahead with premium market insights.
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:14px;line-height:1.5;color:#374151;border-bottom:1px solid #f3f4f6;">
                    <span style="color:#059669;font-weight:700;">●</span>&nbsp; <strong>Flexible Investment Management</strong> — Choose from tailored plans to suit your goals.
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:14px;line-height:1.5;color:#374151;">
                    <span style="color:#059669;font-weight:700;">●</span>&nbsp; <strong>Loan System</strong> — Access financial support when you need it.
                  </td>
                </tr>
              </table>

              <h3 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#111827;">Start Earning in 3 Simple Steps:</h3>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;">
                <tr>
                  <td style="padding:10px 16px;background-color:#f9fafb;border-radius:6px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td width="36" valign="top" style="padding-right:12px;">
                          <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background-color:#059669;color:#fff;border-radius:50%;font-size:14px;font-weight:700;">1</span>
                        </td>
                        <td style="font-size:14px;line-height:1.5;color:#374151;"><strong>Make a Deposit</strong> — Fund your account securely.</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:10px 16px;background-color:#f9fafb;border-radius:6px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td width="36" valign="top" style="padding-right:12px;">
                          <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background-color:#059669;color:#fff;border-radius:50%;font-size:14px;font-weight:700;">2</span>
                        </td>
                        <td style="font-size:14px;line-height:1.5;color:#374151;"><strong>Select an Investment Plan</strong> — Choose a strategy that fits your goals.</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:10px 16px;background-color:#f9fafb;border-radius:6px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td width="36" valign="top" style="padding-right:12px;">
                          <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background-color:#059669;color:#fff;border-radius:50%;font-size:14px;font-weight:700;">3</span>
                        </td>
                        <td style="font-size:14px;line-height:1.5;color:#374151;"><strong>Sit Back &amp; Earn</strong> — Watch your money work for you!</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">
                At <strong>Digital-grownt</strong>, we prioritize <strong>simplicity, security, and profitability</strong>.
                No hassle, no stress — just seamless financial growth.
              </p>
              <p style="margin:28px 0 0;font-size:15px;line-height:1.6;color:#374151;">
                Best regards,<br><strong>Digital-grownt Team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0f1115;padding:28px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#9ca3af;">
                <a href="${escapeHtml(BRAND_WEBSITE_URL)}" style="color:#9ca3af;text-decoration:none;">${escapeHtml(BRAND_WEBSITE_URL)}</a>
              </p>
              <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#9ca3af;">
                <a href="mailto:${escapeHtml(FROM_EMAIL)}" style="color:#059669;text-decoration:none;">${escapeHtml(FROM_EMAIL)}</a>
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">© ${year} Digital-grownt. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function resetEmailHtml({ name, resetUrl }) {
  return '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f5;padding:32px 12px;">' +
    '<table width="100%" style="max-width:480px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;"><tr><td style="background:#0b6b4f;padding:24px;text-align:center;color:#fff;font-size:20px;font-weight:700;">Digital-grownt</td></tr>' +
    '<tr><td style="padding:28px 24px;"><h1 style="font-size:18px;color:#111;">Reset your password</h1><p style="font-size:14px;color:#444;line-height:1.6;">Hi ' + escapeHtml(name || 'there') + ', we received a request to reset your password. This link expires in 1 hour.</p>' +
    '<p style="text-align:center;margin:24px 0;"><a href="' + escapeHtml(resetUrl) + '" style="display:inline-block;background:#0052FF;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;">Reset Password</a></p>' +
    '<p style="font-size:12px;color:#888;">If you did not request this, you can ignore this email.</p></td></tr></table></body></html>';
}

function validationResponse(res, errors, status) {
  return res.status(status || 400).json({ success: false, message: 'Validation failed', errors });
}

function duplicateFields(error) {
  const fields = {};
  for (const field of Object.keys(error.keyPattern || {})) {
    fields[field] = field === 'email' ? 'Email already registered' : 'Username already taken';
  }
  return fields;
}

router.get('/login', (req, res) => res.json({ success: true, message: 'Use the frontend login page', redirect: frontendUrl() + '/login.html' }));

router.post('/login', async (req, res, next) => {
  try {
    const identifier = String(req.body.email || '').toLowerCase().trim();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!identifier || !password) return res.status(400).json({ success: false, message: 'Email/username and password are required', error: 'Email/username and password are required' });

    const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] }).select('+password');
    if (!user) return res.status(401).json({ success: false, message: 'Username/email not registered', error: 'Username/email not registered' });
    if (user.status === 'blocked') {
      return res.status(403).json({ success: false, message: 'Your account has been blocked. Please contact support.', error: 'Account blocked' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Incorrect password', error: 'Incorrect password' });

    const remember = req.body.remember === true || req.body.remember === 'true' || req.body.remember === 'on';
    const token = createToken(user._id);
    res.cookie('jwt', token, cookieOptions(remember));
    // Also return token so the frontend can send Authorization: Bearer when the cookie
    // is not attached (cross-origin, SameSite, localhost vs 127.0.0.1, etc.)
    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: safeUser(user),
      redirect: user.role === 'ADMIN' ? frontendUrl() + '/admin/manageusers.html' : frontendUrl() + '/user/dashboard.html'
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/register', (req, res) => res.json({ success: true, message: 'Use the frontend register page', redirect: frontendUrl() + '/register.html' }));

router.post('/register', registerValidator, async (req, res, next) => {
  try {
    const result = validationResult(req);
    if (!result.isEmpty()) return validationResponse(res, Object.fromEntries(result.array().map((item) => [item.path, item.msg])));

    const { name, username, email, phone, gender, country, currency_code, password, password_confirmation, captcha, captcha_confirmation } = req.body;
    const accounts = Array.isArray(req.body.account) ? req.body.account : req.body.account ? [req.body.account] : [];
    const errors = {};
    const normalizedName = String(name || '').trim();
    const normalizedUsername = String(username || '').toLowerCase().trim();
    const normalizedEmail = String(email || '').toLowerCase().trim();
    const normalizedPhone = String(phone || '').trim();
    const normalizedCountry = String(country || '').trim();
    const normalizedCurrency = String(currency_code || '').toUpperCase().trim();

    if (!normalizedName) errors.name = 'Full name is required';
    if (!/^[a-z0-9_.-]{3,40}$/.test(normalizedUsername)) errors.username = 'Username must be 3-40 characters and use letters, numbers, dot, dash, or underscore';
    if (!EMAIL_RE.test(normalizedEmail)) errors.email = 'Valid email is required';
    if (!normalizedPhone) errors.phone = 'Phone is required';
    else if (normalizedPhone.length > 13) errors.phone = 'Phone must be at most 13 characters';
    if (!['Female', 'Male', 'Others'].includes(gender)) errors.gender = 'Select a valid gender';
    if (!normalizedCountry) errors.country = 'Country is required';
    if (!normalizedCurrency) errors.currency_code = 'Preferred currency is required';
    if (typeof password !== 'string' || password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (password !== password_confirmation) errors.password_confirmation = 'Passwords do not match';
    if (String(captcha || '') !== String(captcha_confirmation || '')) errors.captcha = 'Security check failed';
    if (!accounts.length || accounts.some((item) => !ACCOUNT_TYPES.has(item))) errors.account = 'Select at least one valid account type';
    if (Object.keys(errors).length) return validationResponse(res, errors);

    const existing = await User.findOne({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] }).select('email username');
    if (existing) {
      if (existing.email === normalizedEmail) errors.email = 'Email already registered';
      if (existing.username === normalizedUsername) errors.username = 'Username already taken';
      return validationResponse(res, errors, 409);
    }

    const user = await User.create({
      name: normalizedName, username: normalizedUsername, email: normalizedEmail, phone: normalizedPhone,
      gender, country: normalizedCountry, currency_code: normalizedCurrency, password, account: accounts,
      balance: 0, account_bal: 0, status: 'active', verificationStatus: 'not_verified', account_verify: 'Not Verified'
    });
    try {
      await sendMail(user.email, 'Welcome to Digital-grownt', welcomeEmailHtml({ name: user.name }));
    } catch (mailError) {
      console.error('Welcome email error:', mailError.message);
    }
    return res.status(201).json({ success: true, message: 'Registered successfully. Please login.', redirect: frontendUrl() + '/login.html' });
  } catch (error) {
    if (error && error.code === 11000) return validationResponse(res, duplicateFields(error), 409);
    return next(error);
  }
});

router.get('/logout', (req, res) => {
  res.clearCookie('jwt', clearCookieOptions());
  return res.json({ success: true, message: 'Logged out' });
});

router.get('/me', requireAuth, (req, res) => res.json(safeUser(req.user)));

router.post('/forgot-password', async (req, res, next) => {
  try {
    const normalizedEmail = String(req.body.email || '').toLowerCase().trim();
    if (!EMAIL_RE.test(normalizedEmail)) return validationResponse(res, { email: 'Valid email is required' });
    const user = await User.findOne({ email: normalizedEmail }).select('+resetPasswordToken +resetPasswordExpires');
    if (!user) return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });

    const raw = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(raw).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    const resetUrl = `${frontendUrl()}/reset.html?token=${encodeURIComponent(raw)}&email=${encodeURIComponent(user.email)}`;
    try {
      if (!isEmailConfigured()) {
        return res.status(503).json({ success: false, message: 'Email delivery is not configured. Set BIRD_API_KEY and FROM_EMAIL.' });
      }
      await sendMail(user.email, 'Reset your Digital-grownt password', resetEmailHtml({ name: user.name, resetUrl }));
    } catch (mailError) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });
      console.error('Reset email error:', mailError.message);
      return res.status(500).json({ success: false, message: 'Could not send reset email' });
    }
    return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, email, password, password_confirmation } = req.body;
    const errors = {};
    const normalizedEmail = String(email || '').toLowerCase().trim();
    if (!token) errors.token = 'Reset token is required';
    if (!EMAIL_RE.test(normalizedEmail)) errors.email = 'Valid email is required';
    if (typeof password !== 'string' || password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (password !== password_confirmation) errors.password_confirmation = 'Passwords do not match';
    if (Object.keys(errors).length) return validationResponse(res, errors);

    const hashed = crypto.createHash('sha256').update(String(token)).digest('hex');
    const user = await User.findOne({ email: normalizedEmail, resetPasswordToken: hashed, resetPasswordExpires: { $gt: new Date() } }).select('+password +resetPasswordToken +resetPasswordExpires');
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired reset link', error: 'Invalid or expired reset link' });

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return res.json({ success: true, message: 'Password updated. Please log in.', redirect: frontendUrl() + '/login.html' });
  } catch (error) {
    return next(error);
  }
});

router.get('/push-config', (req, res) => {
  const config = getPushConfig();
  return res.json({ success: true, enabled: Boolean(config), publicKey: config ? config.publicKey : null });
});

router.post('/push-subscribe', requireAuth, async (req, res, next) => {
  try {
    const subscription = req.body && (req.body.subscription || req.body);
    if (!subscription || typeof subscription.endpoint !== 'string' || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
      return res.status(400).json({ success: false, message: 'Valid push subscription is required' });
    }
    const subscriptions = Array.isArray(req.user.pushSubscriptions) ? req.user.pushSubscriptions.slice() : [];
    const index = subscriptions.findIndex((item) => item && item.endpoint === subscription.endpoint);
    if (index >= 0) subscriptions[index] = subscription;
    else subscriptions.push(subscription);
    req.user.pushSubscriptions = subscriptions;
    req.user.pushSubscription = subscription;
    await req.user.save({ validateBeforeSave: false });
    return res.json({ success: true, message: 'Push subscription saved' });
  } catch (error) {
    return next(error);
  }
});

router.delete('/push-subscribe', requireAuth, async (req, res, next) => {
  try {
    const endpoint = String(req.body && req.body.endpoint || '');
    if (!endpoint) return res.status(400).json({ success: false, message: 'Subscription endpoint is required' });
    const subscriptions = (Array.isArray(req.user.pushSubscriptions) ? req.user.pushSubscriptions : []).filter((item) => item && item.endpoint !== endpoint);
    req.user.pushSubscriptions = subscriptions;
    req.user.pushSubscription = subscriptions[subscriptions.length - 1] || null;
    await req.user.save({ validateBeforeSave: false });
    return res.json({ success: true, message: 'Push subscription removed' });
  } catch (error) {
    return next(error);
  }
});

router.post('/push-test', requireAuth, async (req, res, next) => {
  try {
    const result = await sendPushToUser(req.user, { title: req.body && req.body.title, body: req.body && req.body.body, url: req.body && req.body.url, tag: 'digital-grownt-test' });
    return res.json({ success: true, message: result.sent ? 'Test notification sent' : 'No active browser subscription found', ...result });
  } catch (error) {
    if (error.code === 'PUSH_NOT_CONFIGURED') return res.status(503).json({ success: false, message: error.message });
    return next(error);
  }
});

module.exports = router;
