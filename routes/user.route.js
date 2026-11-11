const express = require('express');
const router = require('express').Router();

const User = require('../models/user.model');
const SupportTicket = require('../models/SupportTicket');
const Trade = require('../models/livetradingSchema');
const Widthdraw = require('../models/widthdrawSchema');
const Deposit = require('../models/depositSchema');
const AccountHistory = require('../models/AccountHistory');
const Verify = require('../models/verifySchema');
// const CopyTrade = require('../models/CopyTrade');
// const Affliate = require('../models/affiliate');
// const Wallet = require('../models/walletAddress');
const NotificationController = require('../utils/NotificationController');
const Notification = require('../models/Notification');

// ===================== FEATURE ROUTES =====================
const crypto = require('crypto');
const FeatureTradingAsset = require('../models/TradingAsset');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const CourseCategory = require('../models/CourseCategory');
const CourseEnrollment = require('../models/CourseEnrollment');

const SignalPlan = require('../models/SignalPlan');
const Signal = require('../models/Signal');
const SignalSubscription = require('../models/SignalSubscription');

const Nft = require('../models/Nft');
const NftCategory = require('../models/NftCategory');
const NftCollection = require('../models/NftCollection');
const NftBid = require('../models/NftBid');
const NftTransaction = require('../models/NftTransaction');



const FeatureWalletConnection = require('../models/WalletConnection');
const FeatureWalletSettings = require('../models/WalletSettings');
const FeaturePlans = require('../models/Plans');
const FeatureUserPlans = require('../models/User_plans');
const FeatureCard = require('../models/Card');
const FeatureCardType = require('../models/CardType');
const FeatureCardTransaction = require('../models/CardTransaction');
const FeatureExpert = require('../models/Expert');
const FeatureCopyPosition = require('../models/CopyPosition');
const FeatureTradingBot = require('../models/TradingBot');
const FeatureBotSubscription = require('../models/BotSubscription');
const FeatureMiningPlan = require('../models/MiningPlan');
const FeatureMiningSubscription = require('../models/MiningSubscription');
const { notifyUser: featureNotifyUser } = require('../services/notification.service');



const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper: URL from CloudinaryStorage file object
function cloudUrl(file) {
  if (!file) return null;
  return file.path || file.secure_url || file.url || null;
}

// Profiles (account photo, etc.)
const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'pocket/profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    public_id: (req, file) => `user_${req.params.id}_${Date.now()}`
  }
});
const upload = multer({ storage: profileStorage });

// KYC / verify — two images
const verifyStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'pocket/verifications',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    public_id: (req, file) =>
      `verify_${req.user?._id || 'user'}_${file.fieldname}_${Date.now()}`
  }
});
const uploadFields = multer({ storage: verifyStorage, limits: { fileSize: 5 * 1024 * 1024 } }).fields([
  { name: 'idcardFront', maxCount: 1 },
  { name: 'idcardBack', maxCount: 1 }
]);

// Deposit payment proof
const depositStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'pocket/deposits/proofs',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    public_id: (req, file) => `deposit_${req.params.id}_${Date.now()}`
  }
});
const depositUpload = multer({ storage: depositStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// Account upgrade proof
const upgradeStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'pocket/upgrades/proofs',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    public_id: (req, file) => `upgrade_${req.params.id}_${Date.now()}`
  }
});

// Field name MUST match FormData key: "image"
const upgradeUpload = multer({ storage: upgradeStorage }).single('image');


const frontendUrl = () => String(process.env.FRONTEND_URL || '').replace(/\/$/, '');


function modelPath(Model, names) {
  return names.find((name) => Boolean(Model?.schema?.path(name))) || null;
}

function setModelField(Model, target, names, value) {
  const key = modelPath(Model, names);
  if (key) target[key] = value;
  return key;
}

function ownerPath(Model) {
  return modelPath(Model, ['user_id', 'user', 'userId', 'owner']);
}

function ownerFilter(Model, userId) {
  const key = ownerPath(Model);
  return key ? { [key]: userId } : null;
}

function ownerValue(doc, Model) {
  const key = ownerPath(Model);
  return key ? doc?.[key] : null;
}

function amountValue(doc) {
  return Number(doc?.amount_requested ?? doc?.amount ?? doc?.amountWithCharges ?? 0);
}

function statusValue(doc) {
  return String(doc?.status || 'pending').toLowerCase();
}

function userCurrency(user) {
  return user?.currency_code || 'USD';
}

function publicDeposit(doc, user = null) {
  const owner = user || null;
  return {
    _id: doc?._id,
    amount: Number(doc?.amount ?? 0),
    type: doc?.payment_method || doc?.paymethd_method || doc?.type || 'Deposit',
    payment_method: doc?.payment_method || doc?.paymethd_method || doc?.type || 'Deposit',
    proof: doc?.proof || doc?.image || doc?.proof_image || '',
    image: doc?.image || doc?.proof || doc?.proof_image || '',
    narration: doc?.narration || 'Payment',
    status: statusValue(doc),
    createdAt: doc?.createdAt || doc?.date || doc?.updatedAt,
    user: owner ? { _id: owner._id, name: owner.name, email: owner.email, currency_code: userCurrency(owner) } : null,
  };
}

function publicWithdrawal(doc, user = null) {
  const owner = user || null;
  return {
    _id: doc?._id,
    amount_requested: Number(doc?.amount_requested ?? doc?.amount ?? 0),
    amountWithCharges: Number(doc?.amountWithCharges ?? doc?.totalDeducted ?? doc?.amount_requested ?? doc?.amount ?? 0),
    amount: Number(doc?.amount ?? doc?.amount_requested ?? 0),
    method: doc?.method || doc?.type || 'Withdrawal',
    type: doc?.type || doc?.method || 'Withdrawal',
    receiver_email: doc?.receiver_email || doc?.receiverEmail || owner?.email || '',
    walletAddress: doc?.walletAddress || doc?.wallet_address || '',
    bankName: doc?.bankName || '',
    accountName: doc?.accountName || '',
    accountNumber: doc?.accountNumber || '',
    swiftCode: doc?.swiftCode || '',
    status: statusValue(doc),
    createdAt: doc?.createdAt || doc?.date || doc?.updatedAt,
    user: owner ? { _id: owner._id, name: owner.name, email: owner.email, currency_code: userCurrency(owner) } : null,
  };
}

function verificationState(user, verifyDoc) {
  if (user.verificationStatus === 'verified' || user.isVerified || user.account_verify === 'Verified') return 'verified';
  const raw = String(user.verificationStatus || user.account_verify || verifyDoc?.status || '').toLowerCase();
  if (raw.includes('pending') || raw.includes('process') || raw.includes('submitted')) return 'pending';
  return 'not_verified';
}

function safeDashboardUser(user, verifyDoc = null) {
  const verificationStatus = verificationState(user, verifyDoc);
  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    country: user.country,
    currency_code: user.currency_code || 'USD',
    balance: Number(user.balance ?? user.account_bal ?? 0),
    account_bal: Number(user.account_bal ?? user.balance ?? 0),
    profit: Number(user.profit ?? user.roi ?? 0),
    roi: Number(user.roi ?? 0),
    bonus: Number(user.bonus ?? 0),
    ref_bonus: Number(user.ref_bonus ?? 0),
    win_rate: Number(user.win_rate ?? 0),
    signal_strength: Number(user.signal_strength_score ?? user.signal_strength ?? 0),
    signal_strength_enabled: Boolean(user.signal_strength_enabled),
    trading_progress: Number(user.trading_progress_score ?? user.trade_prog ?? 0),
    trading_progress_enabled: Boolean(user.trading_progress_enabled),
    trade_mode: user.trade_mode || 'on',
    wallet_connect_status: user.wallet_connect_status || 'on',
    status: user.status || 'active',
    verificationStatus,
    verificationBannerDismissed: Boolean(user.verificationBannerDismissed),
    dashboardBanner: {
      enabled: Boolean(user.dashboard_banner_enabled),
      message: user.dashboard_banner_message || '',
      type: user.dashboard_banner_type || 'warning',
    },
  };
}

router.get('/dashboard', async (req, res) => {
  try {
    const verifyDoc = await Verify.findOne({ $or: [{ user: req.user._id }, { user_id: req.user._id }] }).sort({ createdAt: -1 }).lean().catch(() => null);
    const data = safeDashboardUser(req.user, verifyDoc);
    const unreadCount = await Notification.countDocuments({ user_id: req.user._id, read_at: null });
    return res.json({ success: true, user: data, unreadCount });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    return res.status(500).json({ success: false, message: 'Could not load dashboard' });
  }
});

router.get('/dashboard/notifications', NotificationController.list);
router.get('/dashboard/notifications/unread', NotificationController.unread);
router.post('/dashboard/notifications/:id/read', NotificationController.markAsRead);
router.post('/dashboard/notifications/read-all', NotificationController.markAllAsRead);
router.delete('/dashboard/notifications/:id', NotificationController.destroy);
router.get('/dashboard/notification', NotificationController.list);
router.post('/dashboard/verification-banner/dismiss', async (req, res) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $set: { verificationBannerDismissed: true } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not dismiss banner' });
  }
});

// ===================== REFERENCE DASHBOARD ROUTES =====================

router.get('/dashboard/verification-status', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();
    const filter = ownerFilter(Verify, req.user._id);
    const verifyDoc = filter ? await Verify.findOne(filter).sort({ createdAt: -1 }).lean().catch(() => null) : null;
    const status = verificationState(user, verifyDoc);
    return res.json({ success: true, status, application: verifyDoc || null, user: safeDashboardUser(user, verifyDoc) });
  } catch (error) {
    console.error('verification-status error:', error);
    return res.status(500).json({ success: false, message: 'Could not load verification status' });
  }
});

router.post('/dashboard/verifyaccount', uploadFields, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const currentFilter = ownerFilter(Verify, user._id);
    const current = currentFilter ? await Verify.findOne(currentFilter).sort({ createdAt: -1 }) : null;
    const currentStatus = verificationState(user, current);
    if (currentStatus === 'verified') return res.status(409).json({ success: false, message: 'Your account is already verified.' });
    if (currentStatus === 'pending') return res.status(409).json({ success: false, message: 'Your KYC application is already under review.' });

    const front = req.files?.idcardFront?.[0];
    const back = req.files?.idcardBack?.[0];
    const frontUrl = cloudUrl(front);
    const backUrl = cloudUrl(back);
    if (!frontUrl || !backUrl) return res.status(422).json({ success: false, message: 'Both front and back document images are required.' });

    const data = {};
    setModelField(Verify, data, ['user_id', 'user', 'userId', 'owner'], user._id);
    setModelField(Verify, data, ['document_type', 'documentType', 'type'], String(req.body.document_type || '').trim());
    setModelField(Verify, data, ['frontimg', 'idcardFront', 'front_image', 'frontImage'], frontUrl);
    setModelField(Verify, data, ['backimg', 'idcardBack', 'back_image', 'backImage'], backUrl);
    setModelField(Verify, data, ['status'], 'pending');
    setModelField(Verify, data, ['submittedAt', 'submitted_at'], new Date());
    const application = await Verify.create(data);

    user.verificationStatus = 'pending';
    user.account_verify = 'Pending';
    user.isVerified = false;
    user.verificationBannerDismissed = false;
    await user.save({ validateBeforeSave: false });

    const { notifyUser } = require('../services/notification.service');
    await notifyUser(user, 'kyc', 'KYC Documents Submitted', 'Your identity verification documents have been submitted and are under review', '/user/notification.html', { icon: 'bell', tag: `kyc-submitted-${user._id}-${Date.now()}` });
    return res.json({ success: true, message: 'Action Sucessful! Please wait while we verify your application. You will receive an email regarding the status of your application.', application: { _id: application._id }, redirect: `${frontendUrl()}/user/kyc-form.html?success=1` });
  } catch (error) {
    console.error('verifyaccount error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Could not submit verification application' });
  }
});

router.get('/dashboard/verify-account', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend verify account page',
    redirect: `${frontendUrl()}/user/verify-account.html`
  });
});

router.get('/dashboard/kyc-form', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend kyc form page',
    redirect: `${frontendUrl()}/user/kyc-form.html`
  });
});

router.get('/dashboard/account-settings', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend account settings page',
    redirect: `${frontendUrl()}/user/account-settings.html`
  });
});

router.get('/dashboard/notification', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend notification page',
    redirect: `${frontendUrl()}/user/notification.html`
  });
});

router.post('/dashboard/notifications/:id/read', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.post('/dashboard/notifications/read-all', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.delete('/dashboard/notifications/:id', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/dashboard/notifications/unread', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend unread notifications',
    redirect: `${frontendUrl()}/user/notification.html`
  });
});

router.get('/dashboard/deposits', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend deposits page',
    redirect: `${frontendUrl()}/user/deposits.html`
  });
});

router.get('/dashboard/tradinghistory', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend trading history page',
    redirect: `${frontendUrl()}/user/tradinghistory.html`
  });
});

router.get('/dashboard/accounthistory', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend account history page',
    redirect: `${frontendUrl()}/user/accounthistory.html`
  });
});

router.get('/dashboard/withdrawals', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend withdrawals page',
    redirect: `${frontendUrl()}/user/withdrawals.html`
  });
});

router.get('/dashboard/subtrade', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend subtrade page',
    redirect: `${frontendUrl()}/user/subtrade.html`
  });
});

router.get('/dashboard/buy-plan', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend buy plan page',
    redirect: `${frontendUrl()}/user/buy-plan.html`
  });
});

router.get('/dashboard/myplans/:sort', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend my plans page',
    redirect: `${frontendUrl()}/user/myplans.html?sort=${req.params.sort}`
  });
});

router.get('/dashboard/plan-details/:id', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend plan details page',
    redirect: `${frontendUrl()}/user/plan-details.html?id=${req.params.id}`
  });
});

router.post('/dashboard/joinplan', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.post('/dashboard/trades', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/dashboard/trade', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend trade page',
    redirect: `${frontendUrl()}/user/trade.html`
  });
});

router.get('/dashboard/trades/history', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend trades history page',
    redirect: `${frontendUrl()}/user/trades-history.html`
  });
});

router.post('/dashboard/trades/process', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.post('/dashboard/trades/request-close', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/dashboard/trades/assets', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend trades assets page',
    redirect: `${frontendUrl()}/user/trades-assets.html`
  });
});

router.get('/dashboard/trades/positions', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend trades positions page',
    redirect: `${frontendUrl()}/user/trades-positions.html`
  });
});

router.get('/dashboard/markets', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend markets page',
    redirect: `${frontendUrl()}/user/markets.html`
  });
});

router.get('/dashboard/trades/:id', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend trade details page',
    redirect: `${frontendUrl()}/user/trade-details.html?id=${req.params.id}`
  });
});

// Stocks
router.get('/dashboard/stocks', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend stocks page',
    redirect: `${frontendUrl()}/user/stocks.html`
  });
});

router.get('/dashboard/stocks/portfolio', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend stocks portfolio page',
    redirect: `${frontendUrl()}/user/stocks-portfolio.html`
  });
});

router.get('/dashboard/stocks/history', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend stocks history page',
    redirect: `${frontendUrl()}/user/stocks-history.html`
  });
});

router.get('/dashboard/stocks/:id', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend stock details page',
    redirect: `${frontendUrl()}/user/stocks.html?id=${req.params.id}`
  });
});

router.post('/dashboard/stocks/buy', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.post('/dashboard/stocks/sell', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Pre-IPO
router.get('/dashboard/pre-ipo', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend pre-ipo page',
    redirect: `${frontendUrl()}/user/pre-ipo.html`
  });
});

router.get('/dashboard/pre-ipo/holdings', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend pre-ipo holdings page',
    redirect: `${frontendUrl()}/user/pre-ipo-holdings.html`
  });
});

router.get('/dashboard/pre-ipo/:id', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend pre-ipo details page',
    redirect: `${frontendUrl()}/user/pre-ipo.html?id=${req.params.id}`
  });
});

router.post('/dashboard/pre-ipo/:id/buy', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.post('/dashboard/pre-ipo/sell/:holding', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/dashboard/cards', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend cards page',
    redirect: `${frontendUrl()}/user/cards.html`
  });
});

router.get('/dashboard/cards/apply', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend cards apply page',
    redirect: `${frontendUrl()}/user/cards-apply.html`
  });
});

router.post('/dashboard/cards', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/dashboard/cards/:card', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend card details page',
    redirect: `${frontendUrl()}/user/cards.html?card=${req.params.card}`
  });
});

// Loans
router.get('/dashboard/loans/apply', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend loans apply page',
    redirect: `${frontendUrl()}/user/loans-apply.html`
  });
});

router.post('/dashboard/loans/store', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/dashboard/my-loans', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend my loans page',
    redirect: `${frontendUrl()}/user/my-loans.html`
  });
});

router.get('/dashboard/loans/:loan', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend loan details page',
    redirect: `${frontendUrl()}/user/loans.html?loan=${req.params.loan}`
  });
});

router.post('/dashboard/loans/:loan/repay', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.post('/dashboard/loans/:loan/repay-deposit', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.post('/dashboard/loans/calculate-preview', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Real Estate
router.get('/dashboard/real-estate', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend real estate page',
    redirect: `${frontendUrl()}/user/real-estate.html`
  });
});

router.get('/dashboard/my-real-estate', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend my real estate page',
    redirect: `${frontendUrl()}/user/my-real-estate.html`
  });
});

router.post('/dashboard/real-estate/invest', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/dashboard/real-estate/cancel/:id', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend real estate cancel page',
    redirect: `${frontendUrl()}/user/real-estate.html?cancel=${req.params.id}`
  });
});

// Mining
router.get('/dashboard/mining', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend mining page',
    redirect: `${frontendUrl()}/user/mining.html`
  });
});

router.post('/dashboard/mining/subscribe', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/dashboard/mining/subscription/:id', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend mining subscription page',
    redirect: `${frontendUrl()}/user/mining.html?subscription=${req.params.id}`
  });
});

router.post('/dashboard/mining/stop/:id', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Transfer handled via feature/transfer (+ alias below)


// Membership
router.get('/dashboard/courses', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend courses page',
    redirect: `${frontendUrl()}/user/courses.html`
  });
});

router.get('/dashboard/course-details/:course/:id', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend course details page',
    redirect: `${frontendUrl()}/user/course-details.html?course=${req.params.course}&id=${req.params.id}`
  });
});

router.post('/dashboard/buy-course', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/dashboard/my-courses', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend my courses page',
    redirect: `${frontendUrl()}/user/my-courses.html`
  });
});

router.get('/dashboard/learning/:lesson/:course?', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend learning page',
    redirect: `${frontendUrl()}/user/learning.html?lesson=${req.params.lesson}${req.params.course ? `&course=${req.params.course}` : ''}`
  });
});

// NFT
router.get('/dashboard/nft-gallery', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend nft gallery page',
    redirect: `${frontendUrl()}/user/nft-gallery.html`
  });
});

router.get('/dashboard/nfts/create', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend nft create page',
    redirect: `${frontendUrl()}/user/nfts-create.html`
  });
});

router.post('/dashboard/nfts/store', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/dashboard/nfts/:nft', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend nft details page',
    redirect: `${frontendUrl()}/user/nfts.html?nft=${req.params.nft}`
  });
});

router.get('/dashboard/my-nfts', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend my nfts page',
    redirect: `${frontendUrl()}/user/my-nfts.html`
  });
});

router.post('/dashboard/nfts/:nft/like', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.post('/dashboard/nfts/:nft/bid', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.post('/dashboard/nfts/:nft/buy', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.post('/dashboard/nfts/:nft/sell', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Signals
router.get('/dashboard/subscribe-signals', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend subscribe signals page',
    redirect: `${frontendUrl()}/user/subscribe-signals.html`
  });
});

router.post('/dashboard/subscribe', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/dashboard/my-subscriptions', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend my subscriptions page',
    redirect: `${frontendUrl()}/user/my-subscriptions.html`
  });
});

router.get('/dashboard/singalssubscriptions', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend signals subscriptions page',
    redirect: `${frontendUrl()}/user/singalssubscriptions.html`
  });
});

// Copy Trading
router.get('/dashboard/copy-trading', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend copy trading page',
    redirect: `${frontendUrl()}/user/copy-trading.html`
  });
});

router.get('/dashboard/copy-trading/expert/:expert', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend copy trading expert page',
    redirect: `${frontendUrl()}/user/copy-trading.html?expert=${req.params.expert}`
  });
});

router.post('/dashboard/copy-trading/start/:expert', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.post('/dashboard/copy-trading/stop/:position', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/dashboard/copy-trading/position/:position', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend copy trading position page',
    redirect: `${frontendUrl()}/user/copy-trading.html?position=${req.params.position}`
  });
});

// Bot Trading
router.get('/dashboard/bot-trading', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend bot trading page',
    redirect: `${frontendUrl()}/user/bot-trading.html`
  });
});

router.get('/dashboard/bot-trading/bot/:bot', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend bot trading bot page',
    redirect: `${frontendUrl()}/user/bot-trading.html?bot=${req.params.bot}`
  });
});

router.post('/dashboard/bot-trading/subscribe', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.post('/dashboard/bot-trading/stop/:subscription', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/dashboard/bot-trading/subscription/:subscription', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend bot trading subscription page',
    redirect: `${frontendUrl()}/user/bot-trading.html?subscription=${req.params.subscription}`
  });
});

// Portfolio (always)
router.get('/dashboard/portfolio', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend portfolio page',
    redirect: `${frontendUrl()}/user/portfolio.html`
  });
});

// Profile
router.put('/dashboard/updateacct', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const b = req.body || {};
    if (b.name != null) u.name = String(b.name).trim().slice(0, 120);
    if (b.username != null) {
      const un = String(b.username).trim().toLowerCase().slice(0, 40);
      if (un && un !== u.username) {
        const taken = await User.findOne({ username: un, _id: { $ne: u._id } });
        if (taken) return res.status(400).json({ success: false, message: 'Username already taken.' });
        u.username = un;
      }
    }
    if (b.phone != null) u.phone = String(b.phone).trim().slice(0, 30);
    if (b.country != null) u.country = String(b.country).trim();
    if (b.currency_code != null) {
      // Preferred currency is stored as the display symbol ($, €, ₦, etc.)
      const raw = String(b.currency_code).trim();
      u.currency_code = raw.slice(0, 12);
    }
    if (b.gender != null && ['Female','Male','Others'].includes(String(b.gender))) u.gender = b.gender;
    if (b.address != null) u.address = String(b.address).trim();
    if (b.state != null) u.state = String(b.state).trim();
    if (b.zip_code != null) u.zip_code = String(b.zip_code).trim();
    await u.save();
    return res.json({ success: true, message: 'Profile updated successfully.', user: {
      name: u.name, username: u.username, email: u.email, phone: u.phone, country: u.country,
      currency_code: u.currency_code, gender: u.gender, address: u.address, state: u.state, zip_code: u.zip_code, image: u.image
    }});
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

router.post('/dashboard/profileinfo', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.put('/dashboard/updatepass', async (req, res) => {
  try {
    const u = await User.findById(featureIdOf(req)).select('+password');
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const current = String(req.body.current_password || req.body.old_password || '');
    const next = String(req.body.new_password || req.body.password || '');
    const confirm = String(req.body.confirm_password || req.body.password_confirmation || next);
    if (!current || !next) return res.status(400).json({ success: false, message: 'Current and new password are required.' });
    if (next.length < 6) return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    if (next !== confirm) return res.status(400).json({ success: false, message: 'Password confirmation does not match.' });
    const ok = await u.comparePassword(current);
    if (!ok) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    u.password = next;
    await u.save();
    return res.json({ success: true, message: 'Password changed successfully. Please log in again.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

router.post('/dashboard/updateprofileimage', upload.single('photo'), async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const url = cloudUrl(req.file) || req.body.image_url || req.body.image;
    if (!url) return res.status(400).json({ success: false, message: 'Photo file is required.' });
    u.image = String(url);
    await u.save();
    return res.json({ success: true, message: 'Profile photo updated.', image: u.image });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

router.put('/dashboard/update-email-preference', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Deposits & Payments
router.get('/dashboard/get-method/:id', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend get method page',
    redirect: `${frontendUrl()}/user/get-method.html?id=${req.params.id}`
  });
});

router.post('/dashboard/newdeposit', async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const method = String(req.body.payment_method || req.body.paymethd_method || req.body.method || '').trim();
    if (!Number.isFinite(amount) || amount < 10 || !method) return res.status(422).json({ success: false, message: 'Select a payment method and enter a valid deposit amount of at least 10.' });
    req.session.depositDraft = { amount, method, createdAt: Date.now() };
    return res.json({ success: true, amount, method, redirect: `${frontendUrl()}/user/payment.html` });
  } catch (error) {
    console.error('newdeposit error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Could not start deposit' });
  }
});

router.get('/dashboard/deposit-data', async (req, res) => {
  try {
    const filter = ownerFilter(Deposit, req.user._id);
    const allDeposits = filter ? await Deposit.find(filter).sort({ createdAt: -1 }).lean() : [];
    // Loan repayment deposits must NOT appear on the deposits page history
    const isLoanRep = (d) => {
      if (d && (d.is_loan_repayment || d.loan_id)) return true;
      const n = String(d?.narration || '').trim().toLowerCase();
      return n.includes('loan repayment') || n.startsWith('loan repay');
    };
    const deposits = allDeposits.filter((d) => !isLoanRep(d));
    const history = await AccountHistory.find({ user_id: req.user._id }).sort({ date: -1, createdAt: -1 }).lean();
    const processedDeposits = deposits.filter((d) => statusValue(d) === 'processed').reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const pendingDeposits = deposits.filter((d) => statusValue(d) === 'pending').reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const express = history.filter((h) => statusValue(h) === 'processed' && String(h.narration || '').trim().toLowerCase() === 'express deposit').reduce((sum, h) => sum + Number(h.amount || 0), 0);
    return res.json({ success: true, approved: processedDeposits + express, pending: pendingDeposits, methodCount: 13, deposits: deposits.map((d) => {
      const match = history.find((h) => String(h.meta?.deposit_id || '') === String(d._id)) || history.find((h) => String(h.narration || '').trim().toLowerCase() === 'express deposit' && Number(h.amount || 0) === Number(d.amount || 0));
      return { ...publicDeposit(d), type: match?.type || d.payment_method || d.paymethd_method || d.type || 'Deposit', narration: d.narration || match?.narration || 'Payment' };
    }), history });
  } catch (error) {
    console.error('deposit-data error:', error);
    return res.status(500).json({ success: false, message: 'Could not load deposits' });
  }
});


router.get('/dashboard/payment-data', async (req, res) => {
  try {
    const draft = req.session.depositDraft || null;
    if (!draft) return res.status(404).json({ success: false, message: 'No deposit payment session was found.' });
    const addresses = { Bitcoin: '1FsdggFaSzkDFkCZFtGWUFpL9EYHt9pg1T', Ethereum: '0xfa20E292a608e1828939BdFee258976c270e5c73', Litecoin: 'LMx8zXebD3khyFHKkmt9NhaJ1e7HA5B22Z', USDT: '0xfa20E292a608e1828939BdFee258976c270e5c73', Solana: '6nEHk142s3gXf1sYK3auzFKwKWbD24548D541qXfk2dq', XRP: 'rsNAwgyFkDrMWW21DpinDAHhVhSdj16Ynp', Hype: '', 'Bitcoin Cash': '', Chainlink: '', XLM: '', Avalanche: '', ADA: '', Atom: '' };
    return res.json({
      success: true,
      ...draft,
      address: addresses[draft.method] || addresses[String(draft.method||'').trim()] || '',
      currency_code: (req.user && req.user.currency_code) || 'USD',
      is_loan_repayment: !!(draft.loan_id),
      loan_id: draft.loan_id || null,
      installment: draft.installment || null,
      narration: draft.narration || 'Deposit',
      return_url: draft.return_url || '/user/deposits.html'
    });
  } catch (error) {
    console.error('payment-data error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

router.get('/dashboard/payment', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend payment page',
    redirect: `${frontendUrl()}/user/payment.html`
  });
});

function currencySymbol(currencyCode) {
    const code = String(currencyCode || 'USD').toUpperCase();

    const symbols = {
        USD: '$',
        EUR: '€',
        GBP: '£',
        NGN: '₦',
        CAD: 'C$',
        AUD: 'A$',
        JPY: '¥',
        CNY: '¥',
        INR: '₹',
        ZAR: 'R',
        GHS: '₵',
        KES: 'KSh',
        AED: 'د.إ',
        SAR: '﷼'
    };

    return symbols[code] || '$';
}

router.post('/dashboard/savedeposit', depositUpload.single('proof'), async (req, res) => {
    try {
        const draft = req.session.depositDraft || {};

        const amount = Number(
            req.body.amount ?? draft.amount
        );

        const method = String(
            req.body.paymethd_method ||
            req.body.payment_method ||
            draft.method ||
            ''
        ).trim();

        const proof = cloudUrl(req.file);

        const isLoanDraft = !!(draft && draft.loan_id);
        const minAmt = isLoanDraft ? 0.01 : 10;
        if (
            !Number.isFinite(amount) ||
            amount < minAmt ||
            !method ||
            !proof
        ) {
            return res.status(422).json({
                success: false,
                message: isLoanDraft
                  ? 'Payment amount, method and proof are required.'
                  : 'Deposit amount, payment method and payment proof are required.'
            });
        }

        const data = {};

        setModelField(
            Deposit,
            data,
            ['user_id', 'user', 'userId', 'owner'],
            req.user._id
        );

        setModelField(
            Deposit,
            data,
            ['amount'],
            amount
        );

        setModelField(
            Deposit,
            data,
            ['type', 'payment_method', 'paymethd_method'],
            method
        );

        setModelField(
            Deposit,
            data,
            ['image', 'proof', 'proof_image'],
            proof
        );

        setModelField(
            Deposit,
            data,
            ['narration'],
            (draft.narration || draft.loan_id) ? (draft.narration || ('Loan repayment' + (draft.installment ? (' — Installment #' + draft.installment) : ''))) : 'Payment'
        );

        setModelField(
            Deposit,
            data,
            ['status'],
            'pending'
        );

        if (draft && draft.loan_id) {
            data.is_loan_repayment = true;
            data.loan_id = draft.loan_id;
            if (draft.schedule_id) data.schedule_id = String(draft.schedule_id);
            if (draft.installment) data.installment = String(draft.installment);
        }

        const deposit = await Deposit.create(data);

        req.session.depositDraft = null;

        const { notifyUser } = require('../services/notification.service');

        const symbol = currencySymbol(req.user.currency_code);

        await notifyUser(
            req.user,
            'deposit',
            'Deposit Submitted',
            `Your deposit of ${symbol}${amount.toFixed(2)} via ${method} has been submitted and is awaiting confirmation.`,
            '/user/notification.html',
            {
                icon: 'bell',
                push: false,
                tag: `deposit-submitted-${deposit._id}`
            }
        );

        // clear draft
        try { delete req.session.depositDraft; } catch (_) {}

        const isLoan = !!(draft && draft.loan_id);
        const returnPath = (draft && draft.return_url) || (isLoan ? `/user/loans-details.html?id=${draft.loan_id}` : '/user/deposits.html?success=deposit');
        const successMsg = isLoan
          ? 'Loan repayment deposit submitted! Your payment will be applied once verified by admin.'
          : 'Account Fund Sucessful! Please wait for system to validate this transaction.';

        return res.json({
            success: true,
            message: successMsg,
            redirect: returnPath.startsWith('http') ? returnPath : `${frontendUrl()}${returnPath.startsWith('/') ? returnPath : '/' + returnPath}`
        });

    } catch (error) {
        console.error('savedeposit error:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'Could not save deposit'
        });
    }
});


// Withdrawals
router.post('/dashboard/enter-amount', async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const method = String(req.body.method || req.body.type || '').trim();

    const fees = Number(req.body.fees || 0);

    const calculatedTotal = amount + fees;
    const submittedTotal = Number(req.body.totalDeducted);

    const totalDeducted = Number.isFinite(submittedTotal) && submittedTotal >= amount
      ? submittedTotal
      : calculatedTotal;

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !method
    ) {
      return res.status(422).json({
        success: false,
        message: 'Valid withdrawal method and amount are required.'
      });
    }

    if (!Number.isFinite(fees) || fees < 0) {
      return res.status(422).json({
        success: false,
        message: 'Invalid withdrawal fees.'
      });
    }

    if (!Number.isFinite(totalDeducted) || totalDeducted <= 0) {
      return res.status(422).json({
        success: false,
        message: 'Invalid total withdrawal amount.'
      });
    }

    if (totalDeducted < amount) {
      return res.status(422).json({
        success: false,
        message: 'The total withdrawal amount cannot be less than the requested amount.'
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const currentBalance = Number(
      user.balance ?? user.account_bal ?? 0
    );

    const verified = verificationState(user, null) === 'verified';

    if (!verified) {
      return res.status(403).json({
        success: false,
        message: 'Your account must be verified before you can make withdrawal.',
        redirect: `${frontendUrl()}/user/withdrawals.html?error=unverified`
      });
    }

    /*
     * The requested withdrawal amount must not exceed the
     * user's available balance.
     */
    if (amount > currentBalance) {
      return res.status(422).json({
        success: false,
        message: 'Sorry, your available balance is insufficient for this request.',
        redirect: `${frontendUrl()}/user/withdrawals.html?error=insufficient`
      });
    }

    /*
     * The amount actually deducted from the account includes
     * the withdrawal charges.
     */
    if (totalDeducted > currentBalance) {
      return res.status(422).json({
        success: false,
        message: 'Sorry, your available balance is insufficient to cover the withdrawal amount and charges.',
        redirect: `${frontendUrl()}/user/withdrawals.html?error=insufficient`
      });
    }

    /*
     * Build the enabled withdrawal-code list from the
     * CURRENT USER document.
     *
     * 1 -> user.code1 / user.code1_enabled
     * 2 -> user.code2 / user.code2_enabled
     * 3 -> user.code3 / user.code3_enabled
     * 4 -> user.code4 / user.code4_enabled
     * 5 -> user.code5 / user.code5_enabled
     *
     * The code itself remains server-side.
     */
    const defaultCodeLabels = {
      1: 'Broker Commission Fee Code',
      2: 'Anti-Theft Security Code',
      3: 'IMF Code',
      4: 'Cost of Transfer Code',
      5: 'Taxation Code'
    };

    const enabledCodes = [];

    for (let i = 1; i <= 5; i += 1) {
      const enabled = Boolean(user[`code${i}_enabled`]);

      if (!enabled) {
        continue;
      }

      enabledCodes.push({
        index: i,
        label:
          String(user[`code${i}_label`] || '').trim() ||
          defaultCodeLabels[i]
      });
    }

    /*
     * Store only the withdrawal information needed for the
     * verification process.
     *
     * IMPORTANT:
     * Do NOT rely on a client-supplied code.
     * The verification endpoint reads user.code1-code5
     * directly from MongoDB.
     */
    const withdrawal = {
      method,
      type: method,

      amount_requested: amount,

      /*
       * Keep the exact amount charged/deducted.
       */
      amountWithCharges: totalDeducted,

      fees,

      walletAddress: String(
        req.body.walletAddress || ''
      ).trim(),

      bankName: String(
        req.body.bankName || ''
      ).trim(),

      accountName: String(
        req.body.accountName || ''
      ).trim(),

      accountNumber: String(
        req.body.accountNumber || ''
      ).trim(),

      swiftCode: String(
        req.body.swiftCode || ''
      ).trim(),

      receiver_email: user.email,

      enabledCodes
    };

    /*
     * Save the withdrawal draft into the authenticated
     * user's session.
     */
    req.session.withdrawalDraft = withdrawal;

    /*
     * Explicitly save the session before returning.
     *
     * This prevents a race where the frontend immediately
     * navigates to withdraw-funds.html before the session
     * store has persisted withdrawalDraft.
     */
    if (typeof req.session.save === 'function') {
      await new Promise((resolve, reject) => {
        req.session.save((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    /*
     * If withdrawal verification codes are enabled,
     * continue to the verification page.
     */
    if (enabledCodes.length) {
      return res.json({
        success: true,
        requiresCodes: true,
        redirect: `${frontendUrl()}/user/withdraw-funds.html`
      });
    }

    /*
     * No verification codes are enabled.
     *
     * IMPORTANT:
     * Widthdraw.amount is REQUIRED by MongoDB/Mongoose.
     *
     * Therefore we explicitly set BOTH:
     *   amount
     *   amount_requested
     *
     * We do NOT use:
     * setModelField(Widthdraw, data, ['amount_requested', 'amount'], amount)
     *
     * because that would select amount_requested first and leave
     * the required amount field empty.
     */
    const data = {};

    setModelField(
      Widthdraw,
      data,
      ['user_id', 'user', 'userId', 'owner'],
      user._id
    );

    if (Widthdraw.schema.path('amount')) {
      data.amount = amount;
    }

    if (Widthdraw.schema.path('amount_requested')) {
      data.amount_requested = amount;
    }

    if (Widthdraw.schema.path('amountWithCharges')) {
      data.amountWithCharges = totalDeducted;
    }

    if (Widthdraw.schema.path('totalDeducted')) {
      data.totalDeducted = totalDeducted;
    }

    setModelField(
      Widthdraw,
      data,
      ['method', 'type'],
      method
    );

    setModelField(
      Widthdraw,
      data,
      ['receiver_email', 'receiverEmail'],
      user.email
    );

    setModelField(
      Widthdraw,
      data,
      ['walletAddress', 'wallet_address'],
      withdrawal.walletAddress
    );

    setModelField(
      Widthdraw,
      data,
      ['bankName'],
      withdrawal.bankName
    );

    setModelField(
      Widthdraw,
      data,
      ['accountName'],
      withdrawal.accountName
    );

    setModelField(
      Widthdraw,
      data,
      ['accountNumber'],
      withdrawal.accountNumber
    );

    setModelField(
      Widthdraw,
      data,
      ['swiftCode'],
      withdrawal.swiftCode
    );

    setModelField(
      Widthdraw,
      data,
      ['status'],
      'pending'
    );

    const saved = await Widthdraw.create(data);

    /*
     * Deduct the ACTUAL amount including charges.
     */
    user.balance = Math.max(
      0,
      currentBalance - totalDeducted
    );

    user.account_bal = user.balance;

    await user.save({
      validateBeforeSave: false
    });

    const { notifyUser } = require('../services/notification.service');

    const symbol = currencySymbol(
      user.currency_code
    );

    await notifyUser(
      user,
      'withdrawal',
      'Withdrawal Submitted',
      `Your withdrawal request for ${symbol}${amount.toFixed(2)} has been submitted and is being processed.`,
      '/user/notification.html',
      {
        icon: 'bell',
        push: false,
        tag: `withdrawal-submitted-${saved._id}`
      }
    );

    /*
     * The withdrawal has now been completed.
     * Clear the temporary session draft.
     */
    if (req.session.withdrawalDraft) {
      delete req.session.withdrawalDraft;
    }

    if (typeof req.session.save === 'function') {
      await new Promise((resolve) => {
        req.session.save(() => resolve());
      });
    }

    return res.json({
      success: true,
      message: 'Your withdrawal request has been successfully submitted! Please wait while we process your request.',
      redirect: `${frontendUrl()}/user/withdrawals.html?success=withdrawal`
    });

  } catch (error) {
    console.error('enter-amount error:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Could not submit withdrawal'
    });
  }
});


router.get('/dashboard/withdraw-funds', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend withdraw funds page',
    redirect: `${frontendUrl()}/user/withdraw-funds.html`
  });
});

router.get('/dashboard/getotp', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend get otp page',
    redirect: `${frontendUrl()}/user/getotp.html`
  });
});

router.post('/dashboard/completewithdrawal', async (req, res) => {
  try {
    const draft = req.session.withdrawalDraft;

    if (!draft) {
      return res.status(400).json({
        success: false,
        message: 'No withdrawal verification session was found.'
      });
    }

    const codes = Array.isArray(draft.enabledCodes)
      ? draft.enabledCodes
      : [];

    /*
     * These are the codes that the SERVER has actually
     * verified through /verify-withdrawal-code.
     */
    const verifiedCodes = Array.isArray(draft.verifiedCodes)
      ? draft.verifiedCodes.map(Number)
      : [];

    /*
     * Every enabled withdrawal code must have been
     * successfully verified on the server.
     */
    const allCodesVerified = codes.every(codeItem =>
      verifiedCodes.includes(Number(codeItem.index))
    );

    if (!allCodesVerified) {
      return res.status(422).json({
        success: false,
        message: 'All required verification codes must be completed.'
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const amount = Number(
      draft.amount_requested
    );

    const total = Number(
      draft.amountWithCharges
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(422).json({
        success: false,
        message: 'The withdrawal amount is invalid or missing. Please start the withdrawal again.'
      });
    }

    if (!Number.isFinite(total) || total <= 0) {
      return res.status(422).json({
        success: false,
        message: 'The total withdrawal amount is invalid or missing. Please start the withdrawal again.'
      });
    }

    if (total < amount) {
      return res.status(422).json({
        success: false,
        message: 'The withdrawal charges are invalid. Please start the withdrawal again.'
      });
    }

    const currentBalance = Number(
      user.balance ?? user.account_bal ?? 0
    );

    if (total > currentBalance) {
      return res.status(422).json({
        success: false,
        message: 'Sorry, your available balance is insufficient for this request.'
      });
    }

    /*
     * Prevent this same withdrawal verification session
     * from being submitted twice.
     */
    if (draft.completed === true) {
      return res.status(409).json({
        success: false,
        message: 'This withdrawal verification session has already been completed.'
      });
    }

    const data = {};

    setModelField(
      Widthdraw,
      data,
      ['user_id', 'user', 'userId', 'owner'],
      user._id
    );

    /*
     * IMPORTANT:
     * Widthdraw.amount is REQUIRED.
     *
     * Explicitly populate BOTH fields.
     */
    if (Widthdraw.schema.path('amount')) {
      data.amount = amount;
    }

    if (Widthdraw.schema.path('amount_requested')) {
      data.amount_requested = amount;
    }

    if (Widthdraw.schema.path('amountWithCharges')) {
      data.amountWithCharges = total;
    }

    if (Widthdraw.schema.path('totalDeducted')) {
      data.totalDeducted = total;
    }

    setModelField(
      Widthdraw,
      data,
      ['method', 'type'],
      draft.method
    );

    setModelField(
      Widthdraw,
      data,
      ['receiver_email', 'receiverEmail'],
      user.email
    );

    setModelField(
      Widthdraw,
      data,
      ['walletAddress', 'wallet_address'],
      draft.walletAddress
    );

    setModelField(
      Widthdraw,
      data,
      ['bankName'],
      draft.bankName
    );

    setModelField(
      Widthdraw,
      data,
      ['accountName'],
      draft.accountName
    );

    setModelField(
      Widthdraw,
      data,
      ['accountNumber'],
      draft.accountNumber
    );

    setModelField(
      Widthdraw,
      data,
      ['swiftCode'],
      draft.swiftCode
    );

    setModelField(
      Widthdraw,
      data,
      ['status'],
      'pending'
    );

    /*
     * Create the actual withdrawal record.
     */
    const saved = await Widthdraw.create(data);

    /*
     * Deduct the requested amount PLUS charges.
     */
    user.balance = Math.max(
      0,
      currentBalance - total
    );

    user.account_bal = user.balance;

    await user.save({
      validateBeforeSave: false
    });

    const {
      notifyUser
    } = require('../services/notification.service');

    const symbol = currencySymbol(
      user.currency_code
    );

    await notifyUser(
      user,
      'withdrawal',
      'Withdrawal Submitted',
      `Your withdrawal request for ${symbol}${amount.toFixed(2)} has been submitted and is being processed.`,
      '/user/notification.html',
      {
        icon: 'bell',
        push: false,
        tag: `withdrawal-submitted-${saved._id}`
      }
    );

    /*
     * Withdrawal is now permanently saved.
     * Destroy the temporary verification session.
     */
    delete req.session.withdrawalDraft;

    if (typeof req.session.save === 'function') {
      await new Promise((resolve, reject) => {
        req.session.save(error => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    return res.json({
      success: true,
      message: 'Your withdrawal request has been successfully submitted! Please wait while we process your request.',
      redirect: `${frontendUrl()}/user/withdrawals.html?success=withdrawal`
    });

  } catch (error) {
    console.error(
      'completewithdrawal error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message || 'Could not complete withdrawal'
    });
  }
});

router.get('/dashboard/withdrawal-data', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const draft = req.session.withdrawalDraft || null;

    return res.json({
      success: true,
      user: safeDashboardUser(user),
      balance: Number(
        user?.balance ?? user?.account_bal ?? 0
      ),
      draft
    });

  } catch (error) {
    console.error('withdrawal-data error:', error);

    return res.status(500).json({
      success: false,
      message: 'Could not load withdrawal data'
    });
  }
});

router.get('/dashboard/withdrawal-code-session', async (req, res) => {
  try {
    const draft = req.session.withdrawalDraft;

    if (!draft) {
      return res.status(404).json({
        success: false,
        message: 'No withdrawal verification session was found.'
      });
    }

    const enabledCodes = Array.isArray(draft.enabledCodes)
      ? draft.enabledCodes
      : [];

    return res.json({
      success: true,
      amount: Number(draft.amount_requested),
      amountWithCharges: Number(draft.amountWithCharges),
      method: draft.method,
      enabledCodes: enabledCodes.map(
        ({ index, label }) => ({
          index: Number(index),
          label
        })
      )
    });

  } catch (error) {
    console.error(
      'withdrawal-code-session error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Could not load withdrawal verification'
    });
  }
});

router.post('/dashboard/verify-withdrawal-code', async (req, res) => {
  try {
    const draft = req.session.withdrawalDraft;

    if (!draft) {
      return res.status(400).json({
        success: false,
        message: 'No withdrawal verification session was found.'
      });
    }

    const index = Number(req.body.index);

    const code = String(req.body.code || '')
      .replace(/\D/g, '')
      .slice(0, 4);

    if (
      !Number.isInteger(index) ||
      index < 1 ||
      index > 5
    ) {
      return res.status(422).json({
        success: false,
        message: 'Invalid withdrawal verification code.'
      });
    }

    if (!/^\d{4}$/.test(code)) {
      return res.status(422).json({
        success: false,
        message: 'Please enter a valid 4-digit withdrawal verification code.'
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const enabledField = `code${index}_enabled`;
    const codeField = `code${index}`;

    if (!user[enabledField]) {
      return res.status(404).json({
        success: false,
        message: 'This withdrawal verification code is not enabled.'
      });
    }

    const defaultCodeLabels = {
      1: 'Broker Commission Fee Code',
      2: 'Anti-Theft Security Code',
      3: 'IMF Code',
      4: 'Cost of Transfer Code',
      5: 'Taxation Code'
    };

    const sessionCodeItem = (
      Array.isArray(draft.enabledCodes)
        ? draft.enabledCodes
        : []
    ).find(
      entry => Number(entry.index) === index
    );

    const label =
      String(sessionCodeItem?.label || '').trim() ||
      defaultCodeLabels[index];

    const storedCode = String(
      user[codeField] || ''
    ).trim();

    if (!storedCode) {
      return res.status(404).json({
        success: false,
        label,
        message: `The ${label} is not configured for this account.`
      });
    }

    if (code !== storedCode) {
      return res.status(422).json({
        success: false,
        label,
        message: `Sorry, the ${label} you entered is invalid. Kindly contact support to provide you with a valid code`
      });
    }

    /*
     * Store the SERVER-VERIFIED code index.
     *
     * 1 = user.code1
     * 2 = user.code2
     * 3 = user.code3
     * 4 = user.code4
     * 5 = user.code5
     */
    if (!Array.isArray(req.session.withdrawalDraft.verifiedCodes)) {
      req.session.withdrawalDraft.verifiedCodes = [];
    }

    if (
      !req.session.withdrawalDraft.verifiedCodes.includes(index)
    ) {
      req.session.withdrawalDraft.verifiedCodes.push(index);
    }

    if (typeof req.session.save === 'function') {
      await new Promise((resolve, reject) => {
        req.session.save(error => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    return res.json({
      success: true,
      index,
      field: codeField,
      label,
      message: `${label} verified successfully`
    });

  } catch (error) {
    console.error(
      'verify-withdrawal-code error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Could not validate withdrawal code'
    });
  }
});

router.post('/dashboard/brokercode', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Crypto swap / convert
router.get('/dashboard/asset-balance', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend asset balance page',
    redirect: `${frontendUrl()}/user/asset-balance.html`
  });
});

router.get('/dashboard/swap-history', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend swap history page',
    redirect: `${frontendUrl()}/user/swap-history.html`
  });
});

router.get('/dashboard/asset-price/:base/:quote/:amount', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend asset price page',
    redirect: `${frontendUrl()}/user/asset-price.html?base=${req.params.base}&quote=${req.params.quote}&amount=${req.params.amount}`
  });
});

router.post('/dashboard/exchange', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/dashboard/balances/:coin', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend balances page',
    redirect: `${frontendUrl()}/user/balances.html?coin=${req.params.coin}`
  });
});

router.get('/dashboard/convert', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend convert page',
    redirect: `${frontendUrl()}/user/convert.html`
  });
});

router.get('/dashboard/convert/price/:from/:to/:amount', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend convert price page',
    redirect: `${frontendUrl()}/user/convert.html?from=${req.params.from}&to=${req.params.to}&amount=${req.params.amount}`
  });
});

router.post('/dashboard/convert/do', async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

const featureWalletCatalog = [
  ['MetaMask','/temp/wallet/metamask.webp'], ['Trust Wallet','/temp/wallet/trust-wallet.webp'],
  ['Coinbase Wallet','/temp/wallet/coinbase-wallet.webp'], ['Phantom','/temp/wallet/phantom.webp'],
  ['Exodus','/temp/wallet/exodus.svg'], ['Ledger','/temp/wallet/other.png'], ['OKX','/temp/wallet/okx.webp'],
  ['Binance','/temp/wallet/binance.jpg'], ['Rabby','/temp/wallet/rabby.webp'], ['Tangem','/temp/wallet/tangem.svg'],
  ['Arculus','/temp/wallet/arculus.svg'], ['Namo','/temp/wallet/namo.webp'], ['DCent','/temp/wallet/dcent.svg']
].map(([name, logo]) => ({ name, logo }));


function featureIdOf(req) { return req.session?.userId || req.user?._id || req.user?.id || null;
 }

async function featureGetUser(req) { const id = featureIdOf(req);
 return id ? User.findById(id) : null;
 }

function featureNum(v, fallback = 0) { const n = Number(v);
 return Number.isFinite(n) ? n : fallback;
 }

function featureBool(v) { return v === true || ['1','true','on','yes','active'].includes(String(v).toLowerCase());
 }

function featureDurationMs(days) { return Math.max(1, featureNum(days, 30)) * 86400000;
 }

function featureIntervalMs(v) {
  const s = String(v || 'Daily').toLowerCase();

  if (s.includes('10 minute')) return 10 * 60000;

  if (s.includes('30 minute')) return 30 * 60000;

  if (s.includes('hour')) return 3600000;

  if (s.includes('week')) return 7 * 86400000;

  if (s.includes('month')) return 30 * 86400000;

  return 86400000;

}

function featurePlanMin(p) {
  if (!p) return 0;
  return featureNum(p.min_price ?? p.min, 0);
}

function featurePlanMax(p) {
  if (!p) return 0;
  return featureNum(p.max_price ?? p.max, 0);
}

function featurePlanRate(p) {
  if (!p) return 0;
  return featureNum(p.increment_amount ?? p.return ?? p.max_return ?? p.maxr, 0);
}

function featurePlanIsFixed(p) {
  if (!p) return false;
  return String(p.increment_type || p.t_type || 'Percentage').toLowerCase().includes('fixed');
}

function featurePlanDurationMs(p) {
  if (!p) return 86400000;
  const exp = String(p.expiration || '').match(/(\d+(?:\.\d+)?)\s*(year|month|week|day|hour|minute)/i);
  if (!exp) return featureDurationMs(p.duration);
  const n = featureNum(exp[1], 30), u = exp[2].toLowerCase();
  const mult = { year:365*86400000, month:30*86400000, week:7*86400000, day:86400000, hour:3600000, minute:60000 }[u];
  return (n * (mult || 86400000)) || 86400000;
}

function featurePlanProjectedProfit(p, amount) {
  if (!p) return 0;
  const intervalMs = featureIntervalMs(p.increment_interval || p.t_interval) || 86400000;
  const count = Math.max(1, Math.floor(featurePlanDurationMs(p) / intervalMs));
  const per = featurePlanIsFixed(p) ? featurePlanRate(p) : featureNum(amount) * featurePlanRate(p) / 100;
  return Math.max(0, per * count);
}

function featureSafeUser(user) {
  return { _id:user._id, name:user.name, username:user.username, email:user.email, image:user.image || '', currency_code:user.currency_code || 'USD', balance:featureNum(user.balance ?? user.account_bal), account_bal:featureNum(user.account_bal ?? user.balance), connectWallet:user.connectWallet, wallet_connect_status:user.wallet_connect_status || 'on' };

}

function featureLocalRedirect(res, page, message, extra = {}) { return res.json({ success:true, message, redirect:page, ...extra });
 }

function featureOid(v) { return mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null;
 }


async function featureEnsureWalletSettings() {
  let s = await FeatureWalletSettings.findById(1);

  if (!s) s = await FeatureWalletSettings.create({ _id:1, min_balance:0, daily_reward:3000, wallet_status:'on' });

  return s;

}


async function featureAccrueInvestment(i) {
  const p = i.plan;

  if (!p || i.active !== 'yes') return;

  const now = new Date();

  const last = new Date(i.last_growth || i.activated_at || i.createdAt || now);

  const expire = new Date(i.expire_date);

  const end = now < expire ? now : expire;

  const step = featureIntervalMs(p.increment_interval || p.t_interval);

  const ticks = Math.floor((end - last) / step);

  if (ticks <= 0) return;

  const per = featurePlanIsFixed(p) ? featurePlanRate(p) : featureNum(i.amount) * featurePlanRate(p) / 100;

  const cap = featurePlanProjectedProfit(p, featureNum(i.amount));

  const add = Math.min(Math.max(0, cap - featureNum(i.profit_earned)), Math.max(0, ticks * per));

  i.profit_earned = featureNum(i.profit_earned) + add;

  i.payments_received = featureNum(i.payments_received) + ticks;

  i.last_growth = new Date(last.getTime() + ticks * step);

  await i.save();

}

async function featureSettleExpiredInvestments(userId) {
  const rows = await FeatureUserPlans.find({ user:userId, active:'yes', expire_date:{ $lte:new Date() } }).populate('plan');

  for (const i of rows) {
    await featureAccrueInvestment(i);

    const fresh = await FeatureUserPlans.findOne({ _id:i._id, active:'yes' }).populate('plan');

    if (!fresh || fresh.expire_date > new Date()) continue;

    const p = fresh.plan;
    if (!p) {
      // Plan was deleted — expire row without projected profit math
      await FeatureUserPlans.findOneAndUpdate(
        { _id: fresh._id, active: 'yes' },
        { $set: { active: 'expired', closed_at: new Date(), settled_at: new Date(), settlement_type: 'expired_no_plan' } }
      );
      continue;
    }
    const earned = Math.min(featurePlanProjectedProfit(p, featureNum(fresh.amount)), featureNum(fresh.profit_earned));

    const updated = await FeatureUserPlans.findOneAndUpdate({ _id:fresh._id, active:'yes' }, { $set:{ active:'expired', profit_earned:earned, closed_at:new Date(), settled_at:new Date(), settlement_type:'expired' } }, { new:true });

    if (!updated) continue;

    const user = await User.findById(userId);
    if (!user) continue;

    const payout = featureNum(updated.amount) + earned;

    user.account_bal = featureNum(user.account_bal) + payout;
    user.balance = featureNum(user.balance ?? user.account_bal);
    await user.save();

    await featureNotifyUser(user,'investment','Plan balance added',`Your investment plan balances on(${p.name || 'plan'}) are added to your account.`,'/user/notification.html',{ icon:'bell' });

  }
}


async function featureAccrueCopyPosition(p) {
  if (!p || p.status !== 'active') return;

  const now = new Date();
 const end = new Date(Math.min(now.getTime(), new Date(p.expires_at).getTime()));

  const last = new Date(p.last_growth || p.started_at || p.createdAt || now);

  const ticks = Math.max(0, Math.floor((end - last) / 86400000));

  if (!ticks) return;

  p.accumulated_profit = featureNum(p.accumulated_profit) + featureNum(p.invested_amount) * featureNum(p.daily_roi_snapshot) / 100 * ticks;

  p.last_growth = new Date(last.getTime() + ticks * 86400000);
 await p.save();

}

async function featureAccrueMining(s) {
  if (!s || s.status !== 'active') return;

  const now = new Date();
 const end = new Date(Math.min(now.getTime(), new Date(s.expires_at).getTime()));

  const last = new Date(s.last_growth || s.started_at || s.createdAt || now);

  const ticks = Math.max(0, Math.floor((end - last) / 86400000));

  if (!ticks) return;

  s.accumulated_profit = featureNum(s.accumulated_profit) + featureNum(s.invested_amount) * featureNum(s.daily_roi_snapshot) / 100 * ticks;

  s.last_growth = new Date(last.getTime() + ticks * 86400000);
 await s.save();

}

async function featureAccrueBot(s) {
  if (!s || s.status !== 'active') return;

  const now = new Date();
 const end = new Date(Math.min(now.getTime(), new Date(s.expires_at).getTime()));

  const last = new Date(s.last_growth || s.started_at || s.createdAt || now);

  const step = Math.max(60000, featureNum(s.bot?.trade_interval_minutes, 1440) * 60000);

  const ticks = Math.max(0, Math.floor((end - last) / step));

  if (!ticks) return;

  const roi = featureNum(s.daily_roi_snapshot);
 const days = step / 86400000;

  s.current_profit = featureNum(s.current_profit) + featureNum(s.invested_amount) * roi / 100 * days * ticks;

  s.last_growth = new Date(last.getTime() + ticks * step);
 await s.save();

}

/* ---------------- USER: profile/assets/wallet ---------------- */
router.get('/dashboard/feature/profile', async (req,res)=>{ const u=await featureGetUser(req);
 if(!u)return res.status(401).json({success:false,message:'Authentication required.'});
 return res.json({success:true,user:featureSafeUser(u)});
 });

router.get('/dashboard/feature/assets', async (req,res)=>{
  const c=String(req.query.asset_class||'all').toLowerCase();
 const filter={is_active:true};

  if(c!=='all') filter.asset_class={ $in:c==='stocks'?['stock','stocks']:c==='indices'?['index','indices']:c==='etfs'?['etf','etfs']:[c] };

  const assets=await FeatureTradingAsset.find(filter).sort({market_cap:-1,name:1}).lean();

  return res.json({success:true,assets});

});

router.get('/dashboard/feature/wallet-settings', async(req,res)=>{ const s=await featureEnsureWalletSettings();
 return res.json({success:true,settings:s});
 });

router.get('/dashboard/feature/wallets', async(req,res)=>{
  const u=await featureGetUser(req);
 if(!u)return res.status(401).json({success:false,message:'Authentication required.'});

  const settings=await featureEnsureWalletSettings();
 const enabled=u.connectWallet !== undefined ? !!u.connectWallet : u.wallet_connect_status!=='off';

  if(!enabled || settings.wallet_status==='off') return res.status(403).json({success:false,connectWallet:false,message:'Wallet connection is disabled.'});

  const connected=await FeatureWalletConnection.find({user_id:u._id,status:'active'}).sort({connectedAt:1}).lean();

  return res.json({success:true,connectWallet:true,connected,maxSlots:10,dailyEarningPerWallet:featureNum(settings.daily_reward,3000),minBalance:featureNum(settings.min_balance)});

});

router.post('/dashboard/feature/wallets/connect', async(req,res)=>{
  const u=await featureGetUser(req);
 if(!u)return res.status(401).json({success:false,message:'Authentication required.'});
 const settings=await featureEnsureWalletSettings();

  const enabled=u.connectWallet !== undefined ? !!u.connectWallet : u.wallet_connect_status!=='off';
 if(!enabled || settings.wallet_status==='off')return res.status(403).json({success:false,message:'Wallet connection is disabled.'});

  const name=String(req.body.walletName||'').trim();
 if(!name)return res.status(422).json({success:false,message:'Select a wallet.'});

  const count=await FeatureWalletConnection.countDocuments({user_id:u._id,status:'active'});
 if(count>=10)return res.status(409).json({success:false,message:'You have reached the maximum of 10 connected wallets.'});

  const key=name.toLowerCase();
 if(await FeatureWalletConnection.findOne({user_id:u._id,walletKey:key,status:'active'}))return res.status(409).json({success:false,message:'This wallet is already connected.'});

  const catalog=featureWalletCatalog.find(x=>x.name.toLowerCase()===key);
 const c=await FeatureWalletConnection.create({user_id:u._id,walletName:name,walletKey:key,walletLogo:catalog?.logo||'',status:'active',connectionMethod:'external-wallet'});

  return featureLocalRedirect(res,'/user/connect-wallet.html',`${name} connected successfully!`,{connection:c});

});

/* ---------------- USER: investment plans ---------------- */
router.get('/dashboard/feature/plans', async(req,res)=>{ const plans=await FeaturePlans.find({status:'active'}).sort({createdAt:1}).lean();
 return res.json({success:true,plans});
 });

router.post('/dashboard/feature/investments', async(req,res)=>{
  const u=await featureGetUser(req);
 if(!u)return res.status(401).json({success:false,message:'Authentication required.'});
 await featureSettleExpiredInvestments(u._id);

  const p=await FeaturePlans.findOne({_id:req.body.plan_id,status:'active'});
 if(!p)return res.status(404).json({success:false,message:'Investment plan not found.'});

  const amount=featureNum(req.body.amount);
 const min=featurePlanMin(p);
 const max=featurePlanMax(p);
 const bal=featureNum(u.account_bal ?? u.balance);

  if(amount<min)return res.status(422).json({success:false,message:`Minimum investment is ${min.toFixed(2)}.`});
 if(max>0&&amount>max)return res.status(422).json({success:false,message:`Maximum investment is ${max.toFixed(2)}.`});
 if(amount>bal)return res.status(422).json({success:false,message:`Insufficient balance. Your available balance is ${bal.toFixed(2)}.`});

  const now=new Date();
 const exp=new Date(now.getTime()+featurePlanDurationMs(p));
 u.account_bal=bal-amount;
 await u.save();

  const inv=await FeatureUserPlans.create({user:u._id,plan:p._id,amount,active:'yes',inv_duration:p.expiration||`${p.duration} Days`,expire_date:exp,activated_at:now,last_growth:now});

  await featureNotifyUser(u,'investment','Plan Activated',`You have successfully subscribed to the ${p.name} investment plan.`,'/user/notification.html',{icon:'bell'});
  try {
    const { sendPushToUser } = require('../utils/pushNotifications');
    await sendPushToUser(u, {
      title: 'Plan Activated',
      body: `You have successfully subscribed to the ${p.name} investment plan.`,
      url: '/user/myplans.html',
      tag: 'plan-activated',
    });
  } catch (error) {
    console.error('Push notification failed:', error.message);
  }

  return featureLocalRedirect(res,'/user/buy-plan.html','Investment successful.',{investment:inv});

});

router.get('/dashboard/feature/myplans', async(req,res)=>{ const u=await featureGetUser(req);
 if(!u)return res.status(401).json({success:false,message:'Authentication required.'});
 await featureSettleExpiredInvestments(u._id);
 const rows=await FeatureUserPlans.find({user:u._id}).populate('plan').sort({createdAt:-1}).lean();
 for(const r of rows){ if(r.active==='yes') await featureAccrueInvestment(await FeatureUserPlans.findById(r._id).populate('plan'));
 } const fresh=await FeatureUserPlans.find({user:u._id}).populate('plan').sort({createdAt:-1}).lean();
 const active=fresh.filter(x=>x.active==='yes');
 return res.json({success:true,investments:fresh,totalInvested:active.reduce((s,x)=>s+featureNum(x.amount),0),totalProfit:active.reduce((s,x)=>s+featureNum(x.profit_earned),0),activeCount:active.length,activePlans:active.length});
 });

router.get('/dashboard/feature/investments/:id', async(req,res)=>{ const u=await featureGetUser(req);
 const row=await FeatureUserPlans.findOne({_id:req.params.id,user:featureIdOf(req)}).populate('plan').lean();
 if(!row)return res.status(404).json({success:false,message:'Investment not found.'});
 if(row.active==='yes')await featureAccrueInvestment(await FeatureUserPlans.findById(row._id).populate('plan'));
 const fresh=await FeatureUserPlans.findById(row._id).populate('plan').lean();
 return res.json({success:true,investment:fresh});
 });

router.post('/dashboard/feature/investments/:id/cancel', async(req,res)=>{ const u=await featureGetUser(req);
 const row=await FeatureUserPlans.findOne({_id:req.params.id,user:u?._id,active:'yes'}).populate('plan');
 if(!row)return res.status(404).json({success:false,message:'Active investment not found.'});
 await featureAccrueInvestment(row);
 const fresh=await FeatureUserPlans.findById(row._id).populate('plan');
 const payout=featureNum(fresh.amount)+featureNum(fresh.profit_earned);
 fresh.active='cancelled';
 fresh.closed_at=new Date();
 fresh.settled_at=new Date();
 fresh.settlement_type='cancelled';
 await fresh.save();
 u.account_bal=featureNum(u.account_bal)+payout;
 await u.save();
 return featureLocalRedirect(res,'/user/myplans.html','Investment cancelled successfully.');
 });

/* ---------------- USER: cards ---------------- */
router.get('/dashboard/feature/cards', async(req,res)=>{ const u=await featureGetUser(req);
 const cards=await FeatureCard.find({user_id:u._id}).populate('cardType').sort({createdAt:-1}).lean();
 return res.json({success:true,cards});
 });

router.get('/dashboard/feature/card-types', async(req,res)=>{ const types=await FeatureCardType.find({is_active:true}).sort({createdAt:-1}).lean();
 return res.json({success:true,cardTypes:types});
 });

router.post('/dashboard/feature/cards', async(req,res)=>{ const u=await featureGetUser(req);
 const t=await FeatureCardType.findOne({_id:req.body.card_type_id,is_active:true});
 if(!t)return res.status(404).json({success:false,message:'Card type is unavailable.'});
 const existing=await FeatureCard.findOne({user_id:u._id,card_type_id:t._id,status:{$in:['pending','active','frozen']}});
 if(existing)return res.status(409).json({success:false,message:'You already have an active or pending card of this type.'});
 const c=await FeatureCard.create({user_id:u._id,card_type_id:t._id,card_holder:String(req.body.card_holder||u.name),shipping_address:req.body.shipping_address||null,status:'pending'});
 await featureNotifyUser(u,'account','Card Application Submitted',`Your application for a ${t.name} has been submitted and is pending review.`,'/user/notification.html',{icon:'bell'});
 try {
   const { sendPushToUser } = require('../utils/pushNotifications');
   await sendPushToUser(u, { title: 'Card Application Submitted', body: `Your application for a ${t.name} has been submitted and is pending review.`, url: '/user/cards.html', tag: 'card-application' });
 } catch (error) { console.error('Push notification failed:', error.message); }
 return featureLocalRedirect(res,'/user/cards.html','Card application submitted. Pending review.',{card:c});
 });

/* ---------------- USER: copy trading ---------------- */
router.get('/dashboard/feature/experts', async(req,res)=>{ const experts=await FeatureExpert.find({is_active:true}).sort({createdAt:-1}).lean();
 const u=await featureGetUser(req);
 const positions=await FeatureCopyPosition.find({user_id:u._id}).populate('expert').sort({createdAt:-1}).lean();
 for(const p of positions.filter(x=>x.status==='active')) await featureAccrueCopyPosition(p);
 const fresh=await FeatureCopyPosition.find({user_id:u._id}).populate('expert').sort({createdAt:-1}).lean();
 return res.json({success:true,experts,positions:fresh,activeCount:fresh.filter(x=>x.status==='active').length});
 });

router.get('/dashboard/feature/experts/:id', async(req,res)=>{ const u=await featureGetUser(req);
 const expert=await FeatureExpert.findById(req.params.id).lean();
 if(!expert)return res.status(404).json({success:false,message:'Expert not found.'});
 const position=await FeatureCopyPosition.findOne({user_id:u._id,expert_id:expert._id,status:'active'}).populate('expert').lean();
 return res.json({success:true,expert,activePosition:position});
 });

router.post('/dashboard/feature/copy/start/:id', async(req,res)=>{ const u=await featureGetUser(req);
 const e=await FeatureExpert.findOne({_id:req.params.id,is_active:true});
 if(!e)return res.status(404).json({success:false,message:'Expert not found.'});
 const amount=featureNum(req.body.amount);
 if(amount<featureNum(e.min_startup_capital))return res.status(422).json({success:false,message:`Minimum amount is ${featureNum(e.min_startup_capital).toFixed(2)}.`});
 if(featureNum(e.max_capital)>0&&amount>featureNum(e.max_capital))return res.status(422).json({success:false,message:`Maximum amount is ${featureNum(e.max_capital).toFixed(2)}.`});
 if(amount>featureNum(u.account_bal))return res.status(422).json({success:false,message:'Insufficient balance.'});
 if(await FeatureCopyPosition.findOne({user_id:u._id,expert_id:e._id,status:'active'}))return res.status(409).json({success:false,message:'You are already copying this expert.'});
 const now=new Date();
 u.account_bal-=amount;
 await u.save();
 const p=await FeatureCopyPosition.create({user_id:u._id,expert_id:e._id,invested_amount:amount,daily_roi_snapshot:featureNum(e.daily_roi),started_at:now,expires_at:new Date(now.getTime()+featureNum(e.duration_days,30)*86400000),status:'active'});
 await featureNotifyUser(u,'copy_trade','Started Copying Expert',`You are now copying ${e.name} with $${amount.toFixed(2)} for ${featureNum(e.duration_days,30)} days.`,'/user/notification.html',{icon:'bell'});
 return featureLocalRedirect(res,'/user/copy-trading.html',`You have started copying ${e.name}!`,{position:p});
 });

router.post('/dashboard/feature/copy/stop/:id', async(req,res)=>{ const u=await featureGetUser(req);
 const p=await FeatureCopyPosition.findOne({_id:req.params.id,user_id:u._id,status:'active'}).populate('expert');
 if(!p)return res.status(404).json({success:false,message:'Active copytrade not found.'});
 await featureAccrueCopyPosition(p);
 const payout=featureNum(p.invested_amount)+featureNum(p.accumulated_profit)+featureNum(p.admin_profit_adjustment);
 p.status='stopped';
p.stopped_at=new Date();
p.settled_at=new Date();
p.settled_by='user';
await p.save();
u.account_bal=featureNum(u.account_bal)+payout;
await u.save();
await featureNotifyUser(u,'copy_trade','coptrade stopped',`Your copytrade was stopped and $${payout.toFixed(2)} has been credited to your balance.`,'/user/notification.html',{icon:'bell'});
return featureLocalRedirect(res,'/user/copy-trading.html','copytrade stopped');
 });

router.get('/dashboard/feature/copy/position/:id', async(req,res)=>{ const u=await featureGetUser(req);
 const p=await FeatureCopyPosition.findOne({_id:req.params.id,user_id:u._id}).populate('expert').lean();
 if(!p)return res.status(404).json({success:false,message:'Position not found.'});
 if(p.status==='active')await featureAccrueCopyPosition(p);
 const fresh=await FeatureCopyPosition.findById(p._id).populate('expert').lean();
 return res.json({success:true,position:fresh});
 });

/* ---------------- USER: bots ---------------- */
router.get('/dashboard/feature/bots', async(req,res)=>{ const u=await featureGetUser(req);
 const bots=await FeatureTradingBot.find({is_active:true}).sort({createdAt:-1}).lean();
 const subs=await FeatureBotSubscription.find({user_id:u._id}).populate('bot_id').sort({createdAt:-1}).lean();
 for(const s of subs.filter(x=>x.status==='active'))await featureAccrueBot(await FeatureBotSubscription.findById(s._id).populate('bot_id'));
 const fresh=await FeatureBotSubscription.find({user_id:u._id}).populate('bot_id').sort({createdAt:-1}).lean();
 return res.json({success:true,bots,subscriptions:fresh,activeCount:fresh.filter(x=>x.status==='active').length});
 });

router.get('/dashboard/feature/bots/:id', async(req,res)=>{ const u=await featureGetUser(req);
 const bot=await FeatureTradingBot.findById(req.params.id).lean();
 if(!bot)return res.status(404).json({success:false,message:'Bot not found.'});
 const sub=await FeatureBotSubscription.findOne({user_id:u._id,bot_id:bot._id,status:'active'}).populate('bot_id').lean();
 return res.json({success:true,bot,subscription:sub});
 });

router.post('/dashboard/feature/bots/subscribe/:id', async(req,res)=>{ const u=await featureGetUser(req);
 const b=await FeatureTradingBot.findOne({_id:req.params.id,is_active:true});
 if(!b)return res.status(404).json({success:false,message:'Trading bot not found.'});
 const amount=featureNum(req.body.amount);
 if(amount<featureNum(b.min_investment))return res.status(422).json({success:false,message:`Minimum investment is ${featureNum(b.min_investment).toFixed(2)}.`});
 if(featureNum(b.max_investment)>0&&amount>featureNum(b.max_investment))return res.status(422).json({success:false,message:`Maximum investment is ${featureNum(b.max_investment).toFixed(2)}.`});
 if(amount>featureNum(u.account_bal))return res.status(422).json({success:false,message:'Insufficient balance.'});
 if(await FeatureBotSubscription.findOne({user_id:u._id,bot_id:b._id,status:'active'}))return res.status(409).json({success:false,message:'You already have an active subscription to this bot.'});
 const now=new Date();
u.account_bal-=amount;
await u.save();
const roi=featureNum(b.expected_roi||b.daily_roi);
const s=await FeatureBotSubscription.create({user_id:u._id,bot_id:b._id,invested_amount:amount,daily_roi_snapshot:roi,started_at:now,expires_at:new Date(now.getTime()+featureNum(b.max_duration_days,30)*86400000),status:'active',last_growth:now});
await featureNotifyUser(u,'trade','Bot Subscription Started',`You subscribed to ${b.name} with $${amount.toFixed(2)}.`,'/user/notification.html',{icon:'bell'});
return featureLocalRedirect(res,'/user/bot-trading.html','Bot subscription started.',{subscription:s});
 });

router.post('/dashboard/feature/bots/stop/:id', async(req,res)=>{ const u=await featureGetUser(req);
 const s=await FeatureBotSubscription.findOne({_id:req.params.id,user_id:u._id,status:'active'}).populate('bot_id');
if(!s)return res.status(404).json({success:false,message:'Active subscription not found.'});
await featureAccrueBot(s);
const payout=featureNum(s.invested_amount)+featureNum(s.current_profit)+featureNum(s.admin_profit_adjustment);
s.status='stopped';
s.stopped_at=new Date();
s.settled_at=new Date();
await s.save();
u.account_bal+=payout;
await u.save();
await featureNotifyUser(u,'trade','Bot Subscription Stopped',`You stopped your bot subscription. $${payout.toFixed(2)} has been credited to your balance.`,'/user/notification.html',{icon:'bell'});
return featureLocalRedirect(res,'/user/bot-trading.html',`Subscription stopped. $${payout.toFixed(2)} credited to your balance.`);
 });

/* ---------------- USER: mining ---------------- */
router.get('/dashboard/feature/mining', async(req,res)=>{ const u=await featureGetUser(req);
 const plans=await FeatureMiningPlan.find({is_active:true}).sort({sort_order:1,createdAt:1}).lean();
 const subs=await FeatureMiningSubscription.find({user_id:u._id}).populate('mining_plan_id').sort({createdAt:-1}).lean();
 for(const s of subs.filter(x=>x.status==='active'))await featureAccrueMining(await FeatureMiningSubscription.findById(s._id).populate('mining_plan_id'));
 const fresh=await FeatureMiningSubscription.find({user_id:u._id}).populate('mining_plan_id').sort({createdAt:-1}).lean();
 return res.json({success:true,plans,subscriptions:fresh,activeCount:fresh.filter(x=>x.status==='active').length,totalEarnings:fresh.reduce((s,x)=>s+featureNum(x.accumulated_profit),0)});
 });

router.post('/dashboard/feature/mining/start', async(req,res)=>{ const u=await featureGetUser(req);
 const p=await FeatureMiningPlan.findOne({_id:req.body.mining_plan_id,is_active:true});
if(!p)return res.status(404).json({success:false,message:'Mining plan not found.'});
const amount=featureNum(req.body.amount);
if(amount<featureNum(p.min_investment))return res.status(422).json({success:false,message:`Minimum investment is ${featureNum(p.min_investment).toFixed(2)}.`});
if(featureNum(p.max_investment)>0&&amount>featureNum(p.max_investment))return res.status(422).json({success:false,message:`Maximum investment is ${featureNum(p.max_investment).toFixed(2)}.`});
if(amount>featureNum(u.account_bal))return res.status(422).json({success:false,message:'Insufficient balance.'});
const now=new Date();
u.account_bal-=amount;
await u.save();
const s=await FeatureMiningSubscription.create({user_id:u._id,mining_plan_id:p._id,invested_amount:amount,daily_roi_snapshot:featureNum(p.daily_roi_percentage),started_at:now,expires_at:new Date(now.getTime()+featureNum(p.duration_days,30)*86400000),status:'active',last_growth:now});
await featureNotifyUser(u,'trade','Mining Subscription Started',`You subscribed to ${p.name} with $${amount.toFixed(2)} for ${featureNum(p.duration_days,30)} days.`,'/user/notification.html',{icon:'bell'});
return featureLocalRedirect(res,'/user/mining.html','Mining subscription started! Your rig is now active.',{subscription:s});
 });

router.post('/dashboard/feature/mining/stop/:id',async(req,res)=>{const u=await featureGetUser(req);
const s=await FeatureMiningSubscription.findOne({_id:req.params.id,user_id:u._id,status:'active'}).populate('mining_plan_id');
if(!s)return res.status(404).json({success:false,message:'Active mining rig not found.'});
await featureAccrueMining(s);
const payout=featureNum(s.invested_amount)+featureNum(s.accumulated_profit)+featureNum(s.admin_profit_adjustment);
s.status='stopped';
s.stopped_at=new Date();
s.settled_at=new Date();
await s.save();
u.account_bal+=payout;
await u.save();
return featureLocalRedirect(res,'/user/mining.html','mining rig stopped successfully');
});

router.get('/dashboard/feature/mining/subscription/:id',async(req,res)=>{const u=await featureGetUser(req);
const s=await FeatureMiningSubscription.findOne({_id:req.params.id,user_id:u._id}).populate('mining_plan_id').lean();
if(!s)return res.status(404).json({success:false,message:'Subscription not found.'});
if(s.status==='active')await featureAccrueMining(await FeatureMiningSubscription.findById(s._id).populate('mining_plan_id'));
return res.json({success:true,subscription:await FeatureMiningSubscription.findById(s._id).populate('mining_plan_id').lean()});
});


const FeatureLiveTrade = require('../models/livetradingSchema');

router.get('/dashboard/feature/trades', async(req,res)=>{
  try{
    const u=await featureGetUser(req);
    if(!u) return res.status(401).json({success:false,message:'Authentication required.'});
    const trades=await FeatureLiveTrade.find({user_id:u._id}).populate('trading_asset_id').sort({createdAt:-1}).lean();
    return res.json({success:true,trades,balance:featureNum(u.account_bal),demo_balance:featureNum(u.demo_balance||u.demo_bal||0)});
  }catch(e){return res.status(500).json({success:false,message:e.message});}
});

router.post('/dashboard/feature/trades', async(req,res)=>{
  try{
    const u=await featureGetUser(req);
    if(!u) return res.status(401).json({success:false,message:'Authentication required.'});
    const b=req.body||{};
    const amount=featureNum(b.amount);
    if(amount<=0) return res.status(422).json({success:false,message:'Enter a valid amount.'});
    const isDemo=Boolean(b.is_demo||b.demo||b.mode==='demo');
    const balField=isDemo?'demo_balance':'account_bal';
    // support alternate demo field names
    let bal=featureNum(u.account_bal);
    if(isDemo){
      bal=featureNum(u.demo_balance!=null?u.demo_balance:(u.demo_bal!=null?u.demo_bal:0));
    }
    if(amount>bal) return res.status(422).json({success:false,message:'Insufficient balance.'});
    const assetId=b.trading_asset_id||b.asset_id;
    const asset=assetId?await FeatureTradingAsset.findById(assetId):null;
    if(!asset) return res.status(404).json({success:false,message:'Asset not found.'});
    const entry=featureNum(asset.price||asset.current_price||b.entry_price);
    const leverage=featureNum(b.leverage,5)||5;
    const duration=featureNum(b.duration||b.duration_minutes,5);
    const action=String(b.action||'BUY').toUpperCase();
    const tradeType=String(b.trade_type||b.type||'Binary');
    // deduct
    if(isDemo){
      if(u.demo_balance!=null) u.demo_balance=featureNum(u.demo_balance)-amount;
      else if(u.demo_bal!=null) u.demo_bal=featureNum(u.demo_bal)-amount;
      else { /* no demo field - still record trade */ }
    } else {
      u.account_bal=featureNum(u.account_bal)-amount;
    }
    await u.save();
    const trade=await FeatureLiveTrade.create({
      user_id:u._id,
      trading_asset_id:asset._id,
      asset_type:String(asset.asset_class||'Crypto'),
      asset_name:`${asset.symbol} — ${asset.name}`,
      action,
      amount,
      leverage,
      duration,
      entry_price:entry,
      status:'open',
      result:'',
      profit_loss:0,
      settled_by:'',
      opened:new Date(),
      is_demo:isDemo,
      trade_type:tradeType
    });
    try{
      await featureNotifyUser(u._id,'trade','Trade Opened',`You opened a ${action} ${tradeType} trade on ${asset.symbol} for $${amount.toFixed(2)}.`,`/user/trade.html`,{icon:'bell'});
    }catch(_){}
    return res.json({success:true,message:'Trade placed successfully.',trade});
  }catch(e){
    console.error(e);
    return res.status(500).json({success:false,message:e.message});
  }
});



const FeatureRealEstateProperty = require('../models/RealEstateProperty');
const FeatureRealEstateInvestment = require('../models/RealEstateInvestment');
const FeatureLoanPlan = require('../models/LoanPlan');
const FeatureLoan = require('../models/Loan');

function reAvailableTokens(p){
  const total = featureNum(p.total_tokens);
  const sold = featureNum(p.tokens_sold);
  return Math.max(0, total - sold);
}

async function featureAccrueRealEstate(inv){
  if(!inv || inv.status!=='active') return inv;
  const now = Date.now();
  if(inv.expires_at && new Date(inv.expires_at).getTime() <= now){
    inv.status = 'expired';
    await inv.save();
    return inv;
  }
  const prop = inv.property_id && inv.property_id.roi_percentage != null ? inv.property_id : await FeatureRealEstateProperty.findById(inv.property_id);
  if(!prop) return inv;
  const last = inv.last_growth ? new Date(inv.last_growth).getTime() : new Date(inv.started_at).getTime();
  const days = Math.floor((now - last) / 86400000);
  if(days < 1) return inv;
  const dailyRate = featureNum(prop.roi_percentage) / 100 / 365;
  inv.profit_earned = featureNum(inv.profit_earned) + featureNum(inv.amount) * dailyRate * days;
  inv.last_growth = new Date();
  await inv.save();
  return inv;
}

router.get('/dashboard/feature/real-estate', async(req,res)=>{
  try{
    const u = await featureGetUser(req);
    if(!u) return res.status(401).json({success:false,message:'Authentication required.'});
    const properties = await FeatureRealEstateProperty.find({ is_active:true, status:'Active' }).sort({ createdAt:-1 }).lean();
    const list = properties.map(p=>({
      ...p,
      available_tokens: reAvailableTokens(p),
      photo_count: 1 + (Array.isArray(p.room_images)?p.room_images.filter(Boolean).length:0)
    }));
    return res.json({ success:true, properties:list, balance: featureNum(u.account_bal) });
  }catch(e){ return res.status(500).json({success:false,message:e.message}); }
});

router.get('/dashboard/feature/real-estate/:id', async(req,res)=>{
  try{
    const p = await FeatureRealEstateProperty.findById(req.params.id).lean();
    if(!p) return res.status(404).json({success:false,message:'Property not found.'});
    return res.json({ success:true, property:{ ...p, available_tokens: reAvailableTokens(p) } });
  }catch(e){ return res.status(500).json({success:false,message:e.message}); }
});

router.post('/dashboard/feature/real-estate/invest', async(req,res)=>{
  try{
    const u = await featureGetUser(req);
    if(!u) return res.status(401).json({success:false,message:'Authentication required.'});
    const b = req.body || {};
    const p = await FeatureRealEstateProperty.findOne({ _id: b.property_id, is_active:true, status:'Active' });
    if(!p) return res.status(404).json({success:false,message:'Property not found.'});
    const amount = featureNum(b.amount);
    if(amount < featureNum(p.min_investment)) return res.status(422).json({success:false,message:`Minimum investment is $${featureNum(p.min_investment).toFixed(2)}.`});
    if(featureNum(p.max_investment) > 0 && amount > featureNum(p.max_investment)) return res.status(422).json({success:false,message:`Maximum investment is $${featureNum(p.max_investment).toFixed(2)}.`});
    if(amount > featureNum(u.account_bal)) return res.status(422).json({success:false,message:'Insufficient balance.'});
    const tokenPrice = featureNum(p.token_price) || 1;
    const tokens = Math.floor(amount / tokenPrice);
    if(tokens < 1) return res.status(422).json({success:false,message:'Amount too low for one token.'});
    const available = reAvailableTokens(p);
    if(tokens > available) return res.status(422).json({success:false,message:`Only ${available} tokens available.`});
    u.account_bal = featureNum(u.account_bal) - amount;
    await u.save();
    p.tokens_sold = featureNum(p.tokens_sold) + tokens;
    await p.save();
    const now = new Date();
    const inv = await FeatureRealEstateInvestment.create({
      user_id: u._id,
      property_id: p._id,
      amount,
      tokens,
      profit_earned: 0,
      status: 'active',
      started_at: now,
      expires_at: new Date(now.getTime() + featureNum(p.duration_days, 365) * 86400000),
      last_growth: now
    });
    try{
      await featureNotifyUser(u, 'trade', 'Real Estate Investment', `You invested $${amount.toFixed(2)} in ${p.name}.`, '/user/notification.html', { icon:'bell' });
    }catch(_){}
    try{
      const { sendPushToUser } = require('../utils/pushNotifications');
      await sendPushToUser(u, { title:'Real Estate Investment', body:`You invested $${amount.toFixed(2)} in ${p.name}.`, url:'/user/my-real-estate.html', tag:'real-estate-invest' });
    }catch(_){}
    return res.json({
      success:true,
      message:`Investment successful! You now own ${tokens} tokens in ${p.name}.`,
      investment: inv,
      redirect: '/user/my-real-estate.html'
    });
  }catch(e){
    console.error(e);
    return res.status(500).json({success:false,message:e.message});
  }
});

router.get('/dashboard/feature/my-real-estate', async(req,res)=>{
  try{
    const u = await featureGetUser(req);
    if(!u) return res.status(401).json({success:false,message:'Authentication required.'});
    let invs = await FeatureRealEstateInvestment.find({ user_id: u._id }).populate('property_id').sort({ createdAt:-1 });
    for(const inv of invs.filter(x=>x.status==='active')){
      await featureAccrueRealEstate(inv);
    }
    invs = await FeatureRealEstateInvestment.find({ user_id: u._id }).populate('property_id').sort({ createdAt:-1 }).lean();
    const active = invs.filter(x=>x.status==='active');
    return res.json({
      success:true,
      investments: invs,
      stats: {
        totalInvested: active.reduce((s,x)=>s+featureNum(x.amount),0),
        totalProfit: invs.reduce((s,x)=>s+featureNum(x.profit_earned),0),
        active: active.length
      }
    });
  }catch(e){ return res.status(500).json({success:false,message:e.message}); }
});

router.post('/dashboard/feature/real-estate/cancel/:id', async(req,res)=>{
  try{
    const u = await featureGetUser(req);
    if(!u) return res.status(401).json({success:false,message:'Authentication required.'});
    const inv = await FeatureRealEstateInvestment.findOne({ _id: req.params.id, user_id: u._id, status:'active' }).populate('property_id');
    if(!inv) return res.status(404).json({success:false,message:'Investment not found.'});
    await featureAccrueRealEstate(inv);
    const refund = featureNum(inv.amount) + featureNum(inv.profit_earned);
    inv.status = 'cancelled';
    inv.cancelled_at = new Date();
    await inv.save();
    u.account_bal = featureNum(u.account_bal) + refund;
    await u.save();
    if(inv.property_id){
      const p = await FeatureRealEstateProperty.findById(inv.property_id._id || inv.property_id);
      if(p){
        p.tokens_sold = Math.max(0, featureNum(p.tokens_sold) - featureNum(inv.tokens));
        await p.save();
      }
    }
    const pname = inv.property_id?.name || 'property';
    try{
      await featureNotifyUser(u, 'trade', 'Real Estate Cancelled', `Your investment in ${pname} was cancelled. $${refund.toFixed(2)} returned to your balance.`, '/user/notification.html', { icon:'bell' });
    }catch(_){}
    return res.json({ success:true, message:'Investment cancelled. Capital returned to your account.' });
  }catch(e){
    console.error(e);
    return res.status(500).json({success:false,message:e.message});
  }
});



/* ===== LOAN FEATURE (user) ===== */
function loanBuildSchedule(amount, months, annualRate, interestType){
  const n = Math.max(1, Math.floor(months));
  const principal = featureNum(amount);
  const r = featureNum(annualRate) / 100;
  const schedule = [];
  let totalInterest = 0;
  if(String(interestType).toLowerCase() === 'compound'){
    const monthlyRate = r / 12;
    const payment = monthlyRate === 0 ? principal / n : (principal * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
    let balance = principal;
    for(let i=1;i<=n;i++){
      const interest = balance * monthlyRate;
      let prin = payment - interest;
      if(i === n) prin = balance;
      const total = prin + interest;
      totalInterest += interest;
      balance = Math.max(0, balance - prin);
      const due = new Date(); due.setMonth(due.getMonth() + i);
      schedule.push({ due_date: due, principal: Math.round(prin*100)/100, interest: Math.round(interest*100)/100, total: Math.round(total*100)/100, late_fee: 0, status: 'upcoming' });
    }
  } else {
    const totalInterestAll = principal * r * (n / 12);
    const interestPer = totalInterestAll / n;
    const prinPer = principal / n;
    totalInterest = totalInterestAll;
    for(let i=1;i<=n;i++){
      const due = new Date(); due.setMonth(due.getMonth() + i);
      schedule.push({ due_date: due, principal: Math.round(prinPer*100)/100, interest: Math.round(interestPer*100)/100, total: Math.round((prinPer+interestPer)*100)/100, late_fee: 0, status: 'upcoming' });
    }
  }
  const totalRepayable = schedule.reduce((s,x)=>s+featureNum(x.total),0);
  return { schedule, totalInterest, totalRepayable };
}

router.get('/dashboard/feature/loan-plans', async(req,res)=>{
  try{
    const u = await featureGetUser(req);
    if(!u) return res.status(401).json({success:false,message:'Authentication required.'});
    const plans = await FeatureLoanPlan.find({ is_active:true, status:'Active' }).sort({ createdAt:-1 }).lean();
    return res.json({ success:true, plans, balance: featureNum(u.account_bal) });
  }catch(e){ return res.status(500).json({success:false,message:e.message}); }
});

router.post('/dashboard/feature/loans/preview', async(req,res)=>{
  try{
    const u = await featureGetUser(req);
    if(!u) return res.status(401).json({success:false,message:'Authentication required.'});
    const plan = await FeatureLoanPlan.findById(req.body.plan_id).lean();
    if(!plan) return res.status(404).json({success:false,message:'Plan not found.'});
    const amount = featureNum(req.body.amount);
    const months = featureNum(req.body.duration_months, plan.min_duration);
    const fee = amount * (featureNum(plan.processing_fee)/100);
    const built = loanBuildSchedule(amount, months, plan.interest_rate, plan.interest_type);
    return res.json({
      success:true,
      preview:{
        amount, months, fee: Math.round(fee*100)/100,
        interest: Math.round(built.totalInterest*100)/100,
        total_repayable: Math.round((built.totalRepayable + fee)*100)/100,
        schedule: built.schedule
      },
      balance: featureNum(u.account_bal)
    });
  }catch(e){ return res.status(500).json({success:false,message:e.message}); }
});

router.post('/dashboard/feature/loans/apply', async(req,res)=>{
  try{
    const u = await featureGetUser(req);
    if(!u) return res.status(401).json({success:false,message:'Authentication required.'});
    const b = req.body || {};
    const plan = await FeatureLoanPlan.findOne({ _id: b.plan_id, is_active:true, status:'Active' });
    if(!plan) return res.status(404).json({success:false,message:'Plan not found.'});
    const amount = featureNum(b.amount);
    const months = Math.floor(featureNum(b.duration_months, plan.min_duration));
    if(amount < featureNum(plan.min_amount) || amount > featureNum(plan.max_amount))
      return res.status(422).json({success:false,message:`Amount must be between $${featureNum(plan.min_amount)} and $${featureNum(plan.max_amount)}.`});
    if(months < featureNum(plan.min_duration) || months > featureNum(plan.max_duration))
      return res.status(422).json({success:false,message:`Duration must be between ${plan.min_duration} and ${plan.max_duration} months.`});
    if(featureNum(u.account_bal) < featureNum(plan.min_account_balance))
      return res.status(422).json({success:false,message:`Minimum account balance of $${featureNum(plan.min_account_balance)} required.`});
    const activeCount = await FeatureLoan.countDocuments({ user_id: u._id, plan_id: plan._id, status: { $in: ['pending','active','repaying'] } });
    if(activeCount >= featureNum(plan.max_active_loans, 1))
      return res.status(422).json({success:false,message:'Maximum active loans of this type reached.'});
    const loan = await FeatureLoan.create({
      user_id: u._id,
      plan_id: plan._id,
      amount,
      duration_months: months,
      purpose: String(b.purpose||'').trim(),
      monthly_income: featureNum(b.monthly_income),
      interest_rate: featureNum(plan.interest_rate),
      interest_type: plan.interest_type,
      processing_fee: Math.round(amount * (featureNum(plan.processing_fee)/100)*100)/100,
      status: 'pending',
      applied_at: new Date()
    });
    try{
      await Notification.create({ user_id: u._id, title: 'Loan Application Submitted', message: `Your loan application for $${amount.toFixed(2)} is pending review.`, type: 'loan', link: '/user/my-loans.html' });
    }catch(_){}
    try{
      const { sendPushToUser } = require('../utils/pushNotifications');
      await sendPushToUser(u, { title: 'Loan Application Submitted', body: `Your loan application for $${amount.toFixed(2)} is pending review.`, url: '/user/my-loans.html', tag: 'loan-apply' });
    }catch(_){}
    return res.json({ success:true, message: 'Loan application submitted successfully.', loan, redirect: '/user/my-loans.html' });
  }catch(e){ console.error(e); return res.status(500).json({success:false,message:e.message}); }
});

router.get('/dashboard/feature/my-loans', async(req,res)=>{
  try{
    const u = await featureGetUser(req);
    if(!u) return res.status(401).json({success:false,message:'Authentication required.'});
    const loans = await FeatureLoan.find({ user_id: u._id }).populate('plan_id').sort({ createdAt:-1 }).lean();
    const active = loans.filter(x=>['active','repaying'].includes(x.status));
    const pending = loans.filter(x=>x.status==='pending');
    const totalBorrowed = loans.filter(x=>['active','repaying','completed','defaulted'].includes(x.status)).reduce((s,x)=>s+featureNum(x.approved_amount||x.amount),0);
    const totalRepaid = loans.reduce((s,x)=>s+featureNum(x.total_repaid),0);
    return res.json({
      success:true,
      loans,
      stats: { active: active.length, pending: pending.length, totalBorrowed, totalRepaid }
    });
  }catch(e){ return res.status(500).json({success:false,message:e.message}); }
});

router.get('/dashboard/feature/loans/:id', async(req,res)=>{
  try{
    const u = await featureGetUser(req);
    if(!u) return res.status(401).json({success:false,message:'Authentication required.'});
    const loan = await FeatureLoan.findOne({ _id: req.params.id, user_id: u._id }).populate('plan_id').lean();
    if(!loan) return res.status(404).json({success:false,message:'Loan not found.'});
    // mark overdue schedule items
    const now = Date.now();
    if(Array.isArray(loan.schedule)){
      loan.schedule = loan.schedule.map(item=>{
        if(item.status==='upcoming' && item.due_date && new Date(item.due_date).getTime() < now){
          return { ...item, status: 'overdue' };
        }
        return item;
      });
    }
    const total = featureNum(loan.total_repayable);
    const paid = featureNum(loan.total_repaid);
    const remaining = Math.max(0, total - paid);
    const pct = total > 0 ? Math.min(100, (paid/total)*100) : 0;
    const next = (loan.schedule||[]).find(x=>x.status==='upcoming'||x.status==='overdue');
    return res.json({
      success:true,
      loan,
      progress: { paid, remaining, total, pct },
      nextPayment: next || null,
      balance: featureNum(u.account_bal)
    });
  }catch(e){ return res.status(500).json({success:false,message:e.message}); }
});


router.post('/dashboard/feature/loans/:id/repay', async(req,res)=>{
  try{
    const u = await featureGetUser(req);
    if(!u) return res.status(401).json({success:false,message:'Authentication required.'});
    const loan = await FeatureLoan.findOne({ _id: req.params.id, user_id: u._id });
    if(!loan) return res.status(404).json({success:false,message:'Loan not found.'});
    if(!['active','repaying'].includes(loan.status))
      return res.status(422).json({success:false,message:'Loan is not repayable.'});
    const scheduleId = req.body.schedule_id;
    const amount = featureNum(req.body.amount);
    let item = null;
    let idx = -1;
    if(scheduleId != null && scheduleId !== ''){
      idx = loan.schedule.findIndex((s,i)=> String(s._id)===String(scheduleId) || String(i+1)===String(scheduleId) || String(i)===String(scheduleId));
      if(idx >= 0) item = loan.schedule[idx];
    }
    if(!item){
      idx = loan.schedule.findIndex(s=> s.status==='upcoming' || s.status==='overdue');
      if(idx >= 0) item = loan.schedule[idx];
    }
    if(!item) return res.status(422).json({success:false,message:'No payable installment found.'});
    const due = amount > 0 ? amount : featureNum(item.total) + featureNum(item.late_fee);
    if(due <= 0) return res.status(422).json({success:false,message:'Invalid amount.'});
    if(featureNum(u.account_bal) < due)
      return res.status(422).json({success:false,message:'Insufficient account balance.'});
    u.account_bal = featureNum(u.account_bal) - due;
    await u.save();
    item.status = 'paid';
    item.paid_at = new Date();
    item.paid_amount = due;
    loan.markModified('schedule');
    loan.total_repaid = featureNum(loan.total_repaid) + due;
    if(loan.status === 'active') loan.status = 'repaying';
    const allPaid = loan.schedule.every(s=> s.status==='paid');
    if(allPaid) loan.status = 'completed';
    await loan.save();
    try{
      await Notification.create({
        user_id: u._id,
        title: 'Loan Repayment Recorded',
        message: `Payment of $${due.toFixed(2)} recorded successfully.`,
        type: 'loan',
        link: '/user/loans-details.html?id='+loan._id
      });
    }catch(_){}
    try{
      const { sendPushToUser } = require('../utils/pushNotifications');
      await sendPushToUser(u, {
        title: 'Loan Repayment Recorded',
        body: `Payment of $${due.toFixed(2)} recorded successfully.`,
        url: '/user/loans-details.html?id='+loan._id,
        tag: 'loan-repay'
      });
    }catch(_){}
    return res.json({
      success:true,
      message: `Payment of $${due.toFixed(2)} recorded successfully.`,
      loan
    });
  }catch(e){ console.error(e); return res.status(500).json({success:false,message:e.message}); }
});

router.post('/dashboard/feature/loans/:id/repay-deposit', async(req,res)=>{
  try{
    const u = await featureGetUser(req);
    if(!u) return res.status(401).json({success:false,message:'Authentication required.'});
    const loan = await FeatureLoan.findOne({ _id: req.params.id, user_id: u._id });
    if(!loan) return res.status(404).json({success:false,message:'Loan not found.'});
    const amount = featureNum(req.body.amount);
    const method = String(req.body.method || req.body.payment_method || '').trim();
    const schedule_id = req.body.schedule_id != null ? String(req.body.schedule_id) : '';
    const installment = String(req.body.installment || req.body.installment_index || '').trim();
    if(amount <= 0) return res.status(422).json({success:false,message:'Invalid amount.'});
    if(!method) return res.status(422).json({success:false,message:'Select a payment method.'});
    // Same flow as normal deposit: store draft in session → user completes payment on payment.html
    req.session.depositDraft = {
      amount,
      method,
      createdAt: Date.now(),
      loan_id: String(loan._id),
      schedule_id,
      installment,
      narration: installment
        ? `Loan repayment — Installment #${installment}`
        : `Loan repayment — Loan #${String(loan._id).slice(-4)}`,
      return_url: `/user/loans-details.html?id=${loan._id}`
    };
    return res.json({
      success: true,
      amount,
      method,
      redirect: '/user/payment.html',
      message: 'Continue to payment page'
    });
  }catch(e){ console.error(e); return res.status(500).json({success:false,message:e.message}); }
});


// ===================== STOCK SHARES FEATURE =====================
const FeatureStockPosition = require('../models/StockPosition');
const FeatureStockTrade = require('../models/StockTrade');

function stockAssetFilter() {
  return { asset_class: { $in: ['stock', 'stocks'] }, is_active: { $ne: false } };
}

function stockPL(shares, avgCost, price) {
  const invested = Number(shares || 0) * Number(avgCost || 0);
  const value = Number(shares || 0) * Number(price || 0);
  const pl = value - invested;
  const pct = invested > 0 ? (pl / invested) * 100 : 0;
  return { invested, value, pl, pct };
}

router.get('/dashboard/feature/stocks', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const q = String(req.query.q || '').trim();
    const filter = stockAssetFilter();
    if (q) {
      filter.$or = [
        { symbol: new RegExp(q, 'i') },
        { name: new RegExp(q, 'i') }
      ];
    }
    const assets = await FeatureTradingAsset.find(filter).sort({ symbol: 1 }).lean();
    return res.json({ success: true, stocks: assets, balance: featureNum(u.account_bal) });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/dashboard/feature/stocks/portfolio', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const positions = await FeatureStockPosition.find({ user_id: u._id, status: 'open', shares: { $gt: 0 } }).lean();
    const symbols = [...new Set(positions.map(p => p.symbol))];
    const assets = await FeatureTradingAsset.find({ symbol: { $in: symbols } }).lean();
    const bySym = Object.fromEntries(assets.map(a => [a.symbol, a]));
    let totalInvested = 0, currentValue = 0, totalPl = 0;
    const rows = positions.map(p => {
      const a = bySym[p.symbol] || {};
      const price = featureNum(a.price || p.avg_cost);
      const m = stockPL(p.shares, p.avg_cost, price);
      totalInvested += m.invested;
      currentValue += m.value;
      totalPl += m.pl;
      return {
        ...p,
        current_price: price,
        market_value: m.value,
        pl: m.pl,
        pl_pct: m.pct,
        logo_url: p.logo_url || a.logo_url || '',
        name: p.name || a.name || p.symbol,
        asset_id: p.asset_id || a._id
      };
    });
    return res.json({
      success: true,
      stats: { totalInvested, currentValue, totalPl },
      positions: rows,
      balance: featureNum(u.account_bal)
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/dashboard/feature/stocks/history', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const type = String(req.query.type || 'all').toUpperCase();
    const filter = { user_id: u._id };
    if (type === 'BUY' || type === 'SELL') filter.type = type;
    const trades = await FeatureStockTrade.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ success: true, trades });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/dashboard/feature/stocks/:id', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const id = req.params.id;
    let asset = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) asset = await FeatureTradingAsset.findById(id).lean();
    if (!asset) asset = await FeatureTradingAsset.findOne({ symbol: String(id).toUpperCase(), asset_class: { $in: ['stock', 'stocks'] } }).lean();
    if (!asset) return res.status(404).json({ success: false, message: 'Stock not found.' });
    const position = await FeatureStockPosition.findOne({ user_id: u._id, symbol: asset.symbol, status: 'open' }).lean();
    const price = featureNum(asset.price);
    let posView = null;
    if (position && position.shares > 0) {
      const m = stockPL(position.shares, position.avg_cost, price);
      posView = { ...position, current_price: price, market_value: m.value, pl: m.pl, pl_pct: m.pct };
    }
    const recent = await FeatureStockTrade.find({ user_id: u._id, symbol: asset.symbol }).sort({ createdAt: -1 }).limit(10).lean();
    return res.json({
      success: true,
      stock: asset,
      position: posView,
      recentTrades: recent,
      balance: featureNum(u.account_bal)
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/dashboard/feature/stocks/:id/buy', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const id = req.params.id;
    let asset = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) asset = await FeatureTradingAsset.findById(id);
    if (!asset) asset = await FeatureTradingAsset.findOne({ symbol: String(id).toUpperCase() });
    if (!asset) return res.status(404).json({ success: false, message: 'Stock not found.' });
    const amount = featureNum(req.body.amount);
    const price = featureNum(asset.price);
    if (amount <= 0) return res.status(422).json({ success: false, message: 'Enter a valid amount.' });
    if (price <= 0) return res.status(422).json({ success: false, message: 'Stock price unavailable.' });
    if (featureNum(u.account_bal) < amount) return res.status(422).json({ success: false, message: 'Insufficient balance.' });
    const shares = amount / price;
    const fee = 0;
    u.account_bal = featureNum(u.account_bal) - amount - fee;
    await u.save();
    let pos = await FeatureStockPosition.findOne({ user_id: u._id, symbol: asset.symbol, status: 'open' });
    if (!pos) {
      pos = await FeatureStockPosition.create({
        user_id: u._id,
        asset_id: asset._id,
        symbol: asset.symbol,
        name: asset.name,
        logo_url: asset.logo_url || '',
        shares,
        avg_cost: price,
        total_invested: amount,
        status: 'open'
      });
    } else {
      const newShares = featureNum(pos.shares) + shares;
      const newInvested = featureNum(pos.total_invested) + amount;
      pos.avg_cost = newShares > 0 ? newInvested / newShares : price;
      pos.shares = newShares;
      pos.total_invested = newInvested;
      pos.name = asset.name;
      pos.logo_url = asset.logo_url || pos.logo_url;
      await pos.save();
    }
    await FeatureStockTrade.create({
      user_id: u._id,
      asset_id: asset._id,
      position_id: pos._id,
      symbol: asset.symbol,
      name: asset.name,
      logo_url: asset.logo_url || '',
      type: 'BUY',
      shares,
      price,
      total: amount,
      fee
    });
    try {
      await Notification.create({
        user_id: u._id,
        title: 'Stock Purchase',
        message: `Bought ${shares.toFixed(4)} ${asset.symbol} for $${amount.toFixed(2)}`,
        type: 'stock',
        link: '/user/stock-portfolio.html'
      });
    } catch (_) {}
    return res.json({ success: true, message: `Bought ${shares.toFixed(4)} shares of ${asset.symbol}`, position: pos });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/dashboard/feature/stocks/:id/sell', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const id = req.params.id;
    let asset = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) asset = await FeatureTradingAsset.findById(id);
    if (!asset) asset = await FeatureTradingAsset.findOne({ symbol: String(id).toUpperCase() });
    if (!asset) return res.status(404).json({ success: false, message: 'Stock not found.' });
    const pos = await FeatureStockPosition.findOne({ user_id: u._id, symbol: asset.symbol, status: 'open' });
    if (!pos || featureNum(pos.shares) <= 0) return res.status(422).json({ success: false, message: 'No open position to sell.' });
    const price = featureNum(asset.price);
    if (price <= 0) return res.status(422).json({ success: false, message: 'Stock price unavailable.' });
    let shares = featureNum(req.body.shares);
    const amountIn = featureNum(req.body.amount);
    if (shares <= 0 && amountIn > 0) shares = amountIn / price;
    if (shares <= 0) return res.status(422).json({ success: false, message: 'Enter shares or amount to sell.' });
    if (shares > featureNum(pos.shares) + 1e-8) return res.status(422).json({ success: false, message: 'Not enough shares.' });
    shares = Math.min(shares, featureNum(pos.shares));
    const total = shares * price;
    const fee = 0;
    const costBasis = shares * featureNum(pos.avg_cost);
    const pl = total - costBasis;
    u.account_bal = featureNum(u.account_bal) + total - fee;
    await u.save();
    pos.shares = featureNum(pos.shares) - shares;
    pos.total_invested = Math.max(0, featureNum(pos.total_invested) - costBasis);
    if (pos.shares <= 1e-8) {
      pos.shares = 0;
      pos.total_invested = 0;
      pos.status = 'closed';
      pos.closed_pl = featureNum(pos.closed_pl) + pl;
    }
    await pos.save();
    await FeatureStockTrade.create({
      user_id: u._id,
      asset_id: asset._id,
      position_id: pos._id,
      symbol: asset.symbol,
      name: asset.name,
      logo_url: asset.logo_url || '',
      type: 'SELL',
      shares,
      price,
      total,
      fee
    });
    try {
      await Notification.create({
        user_id: u._id,
        title: 'Stock Sale',
        message: `Sold ${shares.toFixed(4)} ${asset.symbol} for $${total.toFixed(2)} (P/L ${pl >= 0 ? '+' : ''}$${pl.toFixed(2)})`,
        type: 'stock',
        link: '/user/stock-history.html'
      });
    } catch (_) {}
    return res.json({ success: true, message: `Sold ${shares.toFixed(4)} shares of ${asset.symbol}`, pl });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});


// ===== COURSES FEATURE (user) =====
router.get('/dashboard/feature/courses', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const courses = await Course.find({ status: 'published' }).sort({ createdAt: -1 }).lean();
    const enrolled = await CourseEnrollment.find({ user_id: u._id }).lean();
    const enrolledSet = new Set(enrolled.map(e => String(e.course_id)));
    const ids = courses.map(c => c._id);
    const lessons = await Lesson.find({ course_id: { $in: ids } }).lean();
    const lessonCount = {};
    lessons.forEach(l => {
      const k = String(l.course_id);
      lessonCount[k] = (lessonCount[k] || 0) + 1;
    });
    const list = courses.map(c => ({
      ...c,
      lessons_count: lessonCount[String(c._id)] || c.lessons_count || 0,
      enrolled: enrolledSet.has(String(c._id)),
      cover: c.image || c.image_url || '',
    }));
    res.json({ success: true, courses: list, balance: Number(u.account_bal || 0) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/dashboard/feature/courses/my', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const enrolled = await CourseEnrollment.find({ user_id: u._id }).sort({ createdAt: -1 }).lean();
    const ids = enrolled.map(e => e.course_id);
    const courses = await Course.find({ _id: { $in: ids } }).lean();
    const byId = Object.fromEntries(courses.map(c => [String(c._id), c]));
    const lessons = await Lesson.find({ course_id: { $in: ids } }).lean();
    const lessonCount = {};
    lessons.forEach(l => {
      const k = String(l.course_id);
      lessonCount[k] = (lessonCount[k] || 0) + 1;
    });
    const list = enrolled.map(e => {
      const c = byId[String(e.course_id)] || {};
      return {
        enrollment_id: e._id,
        enrolled_at: e.createdAt,
        amount_paid: e.amount_paid,
        ...c,
        lessons_count: lessonCount[String(c._id)] || 0,
        cover: c.image || c.image_url || '',
      };
    }).filter(x => x._id);
    res.json({ success: true, courses: list });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/dashboard/feature/courses/:id', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const id = req.params.id;
    let course = null;
    if (String(id).match(/^[0-9a-fA-F]{24}$/)) course = await Course.findById(id).lean();
    if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });
    const lessons = await Lesson.find({ course_id: course._id }).sort({ order: 1, createdAt: 1 }).lean();
    const enrolledDoc = await CourseEnrollment.findOne({ user_id: u._id, course_id: course._id }).lean();
    res.json({
      success: true,
      course: { ...course, cover: course.image || course.image_url || '', lessons_count: lessons.length },
      lessons,
      enrolled: !!enrolledDoc,
      balance: Number(u.account_bal || 0),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/dashboard/feature/courses/:id/buy', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const course = await Course.findById(req.params.id);
    if (!course || course.status !== 'published') return res.status(404).json({ success: false, message: 'Course not available.' });
    const existing = await CourseEnrollment.findOne({ user_id: u._id, course_id: course._id });
    if (existing) return res.json({ success: true, message: 'Already enrolled.', enrolled: true });
    const price = Number(course.price || 0);
    if (price > 0) {
      if (Number(u.account_bal || 0) < price) {
        return res.status(422).json({ success: false, message: 'Insufficient balance.' });
      }
      u.account_bal = Number(u.account_bal || 0) - price;
      await u.save();
    }
    await CourseEnrollment.create({ user_id: u._id, course_id: course._id, amount_paid: price, status: 'active' });
    course.enrolled_count = Number(course.enrolled_count || 0) + 1;
    await course.save();
    try {
      await Notification.create({
        user_id: u._id,
        title: 'Course purchased',
        body: 'You enrolled in ' + course.title,
        type: 'course',
        url: '/user/my-courses.html',
      });
    } catch (_) {}
    res.json({ success: true, message: price > 0 ? 'Course purchased successfully.' : 'Enrolled successfully.', balance: Number(u.account_bal || 0) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/dashboard/feature/lessons/:id', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const lesson = await Lesson.findById(req.params.id).lean();
    if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found.' });
    let allowed = !!lesson.is_preview || !!lesson.standalone;
    let course = null;
    if (lesson.course_id) {
      course = await Course.findById(lesson.course_id).lean();
      const enrolledDoc = await CourseEnrollment.findOne({ user_id: u._id, course_id: lesson.course_id }).lean();
      if (enrolledDoc) allowed = true;
    }
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Purchase the course to access this lesson.', locked: true });
    }
    res.json({ success: true, lesson, course, allowed: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});



// ===== SIGNALS FEATURE (user) =====
router.get('/dashboard/feature/signal-plans', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const plans = await SignalPlan.find({ status: 'active' }).sort({ price: 1 }).lean();
    const activeSub = await SignalSubscription.findOne({
      user_id: u._id,
      status: 'active',
      ends_at: { $gt: new Date() }
    }).lean();
    res.json({
      success: true,
      plans,
      balance: Number(u.account_bal || 0),
      has_active: !!activeSub,
      active_subscription: activeSub || null,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/dashboard/feature/signal-plans/:id/subscribe', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const plan = await SignalPlan.findById(req.params.id);
    if (!plan || plan.status !== 'active') return res.status(404).json({ success: false, message: 'Plan not available.' });
    const existing = await SignalSubscription.findOne({
      user_id: u._id,
      status: 'active',
      ends_at: { $gt: new Date() }
    });
    if (existing) return res.status(422).json({ success: false, message: 'You already have an active signal subscription.' });
    const price = Number(plan.price || 0);
    if (price > 0 && Number(u.account_bal || 0) < price) {
      return res.status(422).json({ success: false, message: 'Insufficient balance.' });
    }
    if (price > 0) {
      u.account_bal = Number(u.account_bal || 0) - price;
      await u.save();
    }
    const weeks = Math.max(1, Number(plan.duration_weeks || 1));
    const starts = new Date();
    const ends = new Date(starts.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
    const sub = await SignalSubscription.create({
      user_id: u._id,
      plan_id: plan._id,
      plan_name: plan.name,
      price_paid: price,
      duration_weeks: weeks,
      features: plan.features || '',
      status: 'active',
      starts_at: starts,
      ends_at: ends,
    });
    try {
      await Notification.create({
        user_id: u._id,
        title: 'Signal plan purchased',
        message: `You subscribed to ${plan.name} for ${weeks} week(s).`,
        type: 'signal',
        link: '/user/my-signals.html',
      });
    } catch (_) {}
    try {
      const { sendPushToUser } = require('../utils/pushNotifications');
      await sendPushToUser(u, {
        title: 'Signal plan purchased',
        body: `You subscribed to ${plan.name}`,
        url: '/user/my-signals.html',
        tag: 'signal-subscribe',
      });
    } catch (_) {}
    res.json({
      success: true,
      message: 'Signal bought successfully.',
      subscription: sub,
      balance: Number(u.account_bal || 0),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/dashboard/feature/my-signals', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    // expire outdated
    await SignalSubscription.updateMany(
      { user_id: u._id, status: 'active', ends_at: { $lte: new Date() } },
      { $set: { status: 'expired' } }
    );
    const subs = await SignalSubscription.find({ user_id: u._id }).sort({ createdAt: -1 }).lean();
    res.json({
      success: true,
      subscriptions: subs,
      balance: Number(u.account_bal || 0),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/dashboard/feature/my-signals/:id/cancel', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const sub = await SignalSubscription.findOne({ _id: req.params.id, user_id: u._id });
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found.' });
    if (sub.status !== 'active') return res.status(422).json({ success: false, message: 'Subscription is not active.' });
    sub.status = 'cancelled';
    sub.cancelled_at = new Date();
    await sub.save();
    try {
      await Notification.create({
        user_id: u._id,
        title: 'Signal subscription cancelled',
        message: `Your subscription to ${sub.plan_name} was cancelled.`,
        type: 'signal',
        link: '/user/my-signals.html',
      });
    } catch (_) {}
    try {
      const { sendPushToUser } = require('../utils/pushNotifications');
      await sendPushToUser(u, {
        title: 'Signal subscription cancelled',
        body: `Your ${sub.plan_name} subscription was cancelled.`,
        url: '/user/my-signals.html',
        tag: 'signal-cancel',
      });
    } catch (_) {}
    res.json({ success: true, message: 'Signal subscription cancelled.', subscription: sub });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/dashboard/feature/live-signals', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const activeSub = await SignalSubscription.findOne({
      user_id: u._id,
      status: 'active',
      ends_at: { $gt: new Date() }
    }).lean();
    if (!activeSub) {
      return res.json({ success: true, has_active: false, signals: [], message: 'You need an active subscription to view signals.' });
    }
    const signals = await Signal.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, has_active: true, signals, subscription: activeSub });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});



// ===== NFT FEATURE (user) =====
async function getEthUsdPrice() {
  // 1) Live price from TradingAsset (ETH listed in admin assets)
  try {
    const asset = await FeatureTradingAsset.findOne({
      $or: [
        { symbol: /^ETH$/i },
        { symbol: /^WETH$/i },
        { name: /^ethereum$/i },
        { name: /ethereum/i },
        { coingecko_id: 'ethereum' },
      ],
      is_active: { $ne: false },
    }).lean();
    if (asset) {
      const p = Number(
        asset.price ||
        asset.last_price ||
        asset.current_price ||
        asset.usd_price ||
        0
      );
      if (Number.isFinite(p) && p > 0) return p;
    }
  } catch (_) {}
  // 2) Fallback CoinGecko
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
    );
    const j = await r.json();
    if (j && j.ethereum && Number(j.ethereum.usd) > 0) return Number(j.ethereum.usd);
  } catch (_) {}
  return 0;
}

/** Effective spendable balance (keeps balance + account_bal in sync). */
function nftUserBalance(user) {
  if (!user) return 0;
  const a = Number(user.account_bal);
  const b = Number(user.balance);
  const av = Number.isFinite(a) ? a : 0;
  const bv = Number.isFinite(b) ? b : 0;
  // Prefer the higher of the two so a desynced field never under-reports funds;
  // after any NFT money move we always write both to the same value.
  return Math.max(av, bv);
}

/**
 * Atomically apply a signed USD delta to BOTH balance and account_bal.
 * delta < 0 = debit, delta > 0 = credit.
 * Returns updated user doc or null if debit would go below zero.
 */
async function nftAdjustBalance(userId, delta) {
  const id = userId;
  if (!id) return null;
  const d = Number(delta);
  if (!Number.isFinite(d) || d === 0) {
    return User.findById(id);
  }
  // Load fresh, compute, save (runs pre-save sync hook)
  const user = await User.findById(id);
  if (!user) return null;
  const current = nftUserBalance(user);
  const next = Math.round((current + d) * 100) / 100;
  if (next < -0.0001) return null; // insufficient
  const safe = Math.max(0, next);
  user.account_bal = safe;
  user.balance = safe;
  await user.save();
  return user;
}



function nftUserName(u) {
  return u.fullname || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.username || u.email || 'User';
}

router.get('/dashboard/feature/nfts', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const q = req.query || {};
    const filter = { approved: true };
    if (q.category) filter.category = q.category;
    if (q.collection) filter.collection_name = q.collection;
    if (q.status) filter.status = q.status;
    if (q.search) {
      const s = String(q.search).trim();
      filter.$or = [
        { name: new RegExp(s, 'i') },
        { description: new RegExp(s, 'i') },
        { token_id: new RegExp(s, 'i') },
      ];
    }
    const nfts = await Nft.find(filter).sort({ createdAt: -1 }).lean();
    const featured = await Nft.find({ approved: true, featured: true }).sort({ createdAt: -1 }).limit(8).lean();
    const categories = await NftCategory.find({ status: 'active' }).sort({ name: 1 }).lean();
    const collections = await NftCollection.find({ status: 'active' }).sort({ name: 1 }).lean();
    const counts = {};
    for (const c of collections) {
      counts[String(c._id)] = await Nft.countDocuments({ collection_id: c._id, approved: true });
      counts[c.name] = counts[String(c._id)];
    }
    const list = collections.map((c) => ({ ...c, items_count: counts[String(c._id)] || 0 }));
    res.json({
      success: true,
      nfts,
      featured: featured.length ? featured : nfts.slice(0, 6),
      categories,
      collections: list,
      balance: Number(u.account_bal || 0),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/dashboard/feature/nfts/meta', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const categories = await NftCategory.find({ status: 'active' }).sort({ name: 1 }).lean();
    const collections = await NftCollection.find({ status: 'active' }).sort({ name: 1 }).lean();
    const ethUsd = await getEthUsdPrice();
    res.json({ success: true, categories, collections, eth_usd: ethUsd, balance: Number(u.account_bal || 0) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/dashboard/feature/nfts', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const b = req.body || {};
    const name = String(b.name || '').trim();
    if (!name) return res.status(422).json({ success: false, message: 'NFT name is required.' });
    const priceEth = Math.max(0.05, Number(b.price_eth || b.price || 0.05));
    const ethUsd = await getEthUsdPrice();
    if (!ethUsd || ethUsd <= 0) {
      return res.status(503).json({ success: false, message: 'ETH price unavailable. Try again later.' });
    }
    const costUsd = priceEth * ethUsd;
    if (Number(u.account_bal || 0) < costUsd) {
      return res.status(422).json({
        success: false,
        message: `Insufficient balance. Need $${costUsd.toFixed(2)} (${priceEth} ETH @ $${ethUsd.toFixed(2)}) but have $${Number(u.account_bal || 0).toFixed(2)}.`,
      });
    }
    const _mintBal = nftUserBalance(u);
    if (_mintBal < costUsd) {
      return res.status(422).json({ success: false, message: `Insufficient balance. Need $${costUsd.toFixed(2)}.` });
    }
    u.account_bal = Math.round((_mintBal - costUsd) * 100) / 100;
    u.balance = u.account_bal;
    await u.save();
    let props = {};
    try {
      if (b.properties) props = typeof b.properties === 'string' ? JSON.parse(b.properties) : b.properties;
    } catch (_) {
      props = {};
    }
    const tokenId = 'TXP-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
    const uname = nftUserName(u);
    const doc = await Nft.create({
      name,
      description: String(b.description || ''),
      image_url: String(b.image_url || b.image || ''),
      price_eth: priceEth,
      category: String(b.category || ''),
      category_id: b.category_id || null,
      collection_name: String(b.collection_name || b.collection || ''),
      collection_id: b.collection_id || null,
      properties: props,
      creator_id: u._id,
      owner_id: u._id,
      creator_name: uname,
      owner_name: uname,
      status: 'available',
      featured: false,
      approved: true,
      token_id: tokenId,
      royalty: Number(b.royalty || 2.5),
    });
    await NftTransaction.create({
      nft_id: doc._id,
      nft_name: doc.name,
      from_id: null,
      to_id: u._id,
      from_name: 'Minted',
      to_name: uname,
      type: 'mint',
      amount_eth: priceEth,
      amount_usd: costUsd,
    });
    try {
      await Notification.create({
        user_id: u._id,
        title: 'NFT listed successfully',
        message: `${name} was minted for ${priceEth} ETH ($${costUsd.toFixed(2)}).`,
        type: 'nft',
        link: '/user/my-nfts.html',
      });
    } catch (_) {}
    res.json({
      success: true,
      message: 'NFT listed successfully.',
      nft: doc,
      balance: Number(u.account_bal || 0),
      eth_usd: ethUsd,
      cost_usd: costUsd,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/dashboard/feature/nfts/mine', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const owned = await Nft.find({ owner_id: u._id }).sort({ createdAt: -1 }).lean();
    const created = await Nft.find({ creator_id: u._id }).sort({ createdAt: -1 }).lean();
    const favorites = await Nft.find({ creator_id: u._id, liked_by: u._id }).sort({ createdAt: -1 }).lean();
    const totalValue = owned.reduce((s, n) => s + Number(n.price_eth || 0), 0);
    res.json({
      success: true,
      owned,
      created,
      favorites,
      stats: {
        owned: owned.length,
        created: created.length,
        favorites: favorites.length,
        total_value_eth: totalValue,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/dashboard/feature/nfts/collection/:id', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    let col = null;
    const id = req.params.id;
    if (String(id).match(/^[0-9a-fA-F]{24}$/)) col = await NftCollection.findById(id).lean();
    if (!col) col = await NftCollection.findOne({ name: id }).lean();
    if (!col) return res.status(404).json({ success: false, message: 'Collection not found.' });
    const nfts = await Nft.find({
      $or: [{ collection_id: col._id }, { collection_name: col.name }],
      approved: true,
    }).sort({ createdAt: -1 }).lean();
    const floor = nfts.length ? Math.min(...nfts.map((n) => Number(n.price_eth || 0))) : 0;
    const volume = nfts.reduce((s, n) => s + Number(n.price_eth || 0), 0);
    res.json({
      success: true,
      collection: { ...col, items_count: nfts.length, floor_price: floor, volume, royalty: col.royalty || 2.5 },
      nfts,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/dashboard/feature/nfts/:id', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const nft = await Nft.findById(req.params.id);
    if (!nft) return res.status(404).json({ success: false, message: 'NFT not found.' });
    nft.views = Number(nft.views || 0) + 1;
    await nft.save();
    const bids = await NftBid.find({ nft_id: nft._id }).sort({ createdAt: -1 }).lean();
    const history = await NftTransaction.find({ nft_id: nft._id }).sort({ createdAt: -1 }).lean();
    const liked = (nft.liked_by || []).some((id) => String(id) === String(u._id));
    const isOwner = String(nft.owner_id) === String(u._id);
    res.json({
      success: true,
      nft: nft.toObject(),
      bids,
      history,
      liked,
      is_owner: isOwner,
      balance: Number(u.account_bal || 0),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/dashboard/feature/nfts/:id/like', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const nft = await Nft.findById(req.params.id);
    if (!nft) return res.status(404).json({ success: false, message: 'NFT not found.' });
    const idx = (nft.liked_by || []).findIndex((id) => String(id) === String(u._id));
    if (idx >= 0) {
      nft.liked_by.splice(idx, 1);
      nft.likes = Math.max(0, Number(nft.likes || 0) - 1);
    } else {
      nft.liked_by.push(u._id);
      nft.likes = Number(nft.likes || 0) + 1;
    }
    await nft.save();
    res.json({ success: true, likes: nft.likes, liked: idx < 0 });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/dashboard/feature/nfts/:id/bid', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const nft = await Nft.findById(req.params.id);
    if (!nft) return res.status(404).json({ success: false, message: 'NFT not found.' });
    if (String(nft.owner_id) === String(u._id)) {
      return res.status(422).json({ success: false, message: 'You already own this NFT.' });
    }
    const amount = Number((req.body && req.body.amount_eth) || (req.body && req.body.amount) || 0);
    if (amount <= 0) return res.status(422).json({ success: false, message: 'Bid amount must be greater than 0.' });
    const bid = await NftBid.create({
      nft_id: nft._id,
      user_id: u._id,
      user_name: nftUserName(u),
      amount_eth: amount,
      status: 'pending',
    });
    try {
      await Notification.create({
        user_id: nft.owner_id,
        title: 'New NFT bid',
        message: `${nftUserName(u)} bid ${amount} ETH on ${nft.name}.`,
        type: 'nft',
        link: '/user/nfts-details.html?id=' + nft._id,
      });
    } catch (_) {}
    res.json({ success: true, message: 'Bid placed successfully.', bid });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});


router.post('/dashboard/feature/nfts/:id/bids/:bidId/accept', async (req, res) => {
  try {
    const ownerId = featureIdOf(req);
    if (!ownerId) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const owner = await User.findById(ownerId);
    if (!owner) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const nft = await Nft.findById(req.params.id);
    if (!nft) return res.status(404).json({ success: false, message: 'NFT not found.' });
    if (String(nft.owner_id) !== String(owner._id)) {
      return res.status(403).json({ success: false, message: 'Only the current NFT owner can accept bids.' });
    }

    const bid = await NftBid.findOne({ _id: req.params.bidId, nft_id: nft._id });
    if (!bid) return res.status(404).json({ success: false, message: 'Bid not found.' });
    if (bid.status !== 'pending') return res.status(422).json({ success: false, message: 'Bid is not pending.' });
    if (String(bid.user_id) === String(owner._id)) {
      return res.status(422).json({ success: false, message: 'Cannot accept your own bid.' });
    }

    const amountEth = Number(bid.amount_eth || 0);
    if (!(amountEth > 0)) return res.status(422).json({ success: false, message: 'Invalid bid amount.' });

    const ethUsd = await getEthUsdPrice();
    if (!(ethUsd > 0)) {
      return res.status(503).json({ success: false, message: 'ETH price unavailable.' });
    }
    const costUsd = Number((amountEth * ethUsd).toFixed(2));

    const debit = await User.findOneAndUpdate(
      { _id: bid.user_id, account_bal: { $gte: costUsd } },
      { $inc: { account_bal: -costUsd } },
      { new: true }
    );
    if (!debit) {
      const bidder = await User.findById(bid.user_id).select('account_bal').lean();
      const bal = Number(bidder && bidder.account_bal) || 0;
      return res.status(422).json({
        success: false,
        message: `Bidder has insufficient balance. Need $${costUsd.toFixed(2)} (${amountEth} ETH @ $${ethUsd.toFixed(2)}). Bidder balance: $${bal.toFixed(2)}.`,
      });
    }

    const credit = await User.findByIdAndUpdate(owner._id, { $inc: { account_bal: costUsd } }, { new: true });

    const prevOwnerId = nft.owner_id;
    const prevOwnerName = nft.owner_name;
    const bidderName = nftUserName(debit);

    nft.owner_id = debit._id;
    nft.owner_name = bidderName;
    nft.price_eth = amountEth;
    nft.status = 'sold';
    await nft.save();

    bid.status = 'accepted';
    await bid.save();
    await NftBid.updateMany(
      { nft_id: nft._id, status: 'pending', _id: { $ne: bid._id } },
      { $set: { status: 'rejected' } }
    );

    await NftTransaction.create({
      nft_id: nft._id,
      nft_name: nft.name,
      from_id: prevOwnerId,
      to_id: debit._id,
      from_name: prevOwnerName,
      to_name: bidderName,
      type: 'bid_accept',
      amount_eth: amountEth,
      amount_usd: costUsd,
    });

    try {
      await Notification.create({
        user_id: debit._id,
        title: 'Bid accepted',
        message: `The owner accepted your bid of ${amountEth} ETH (≈ $${costUsd.toFixed(2)}) on ${nft.name}.`,
        type: 'nft',
        link: '/user/nfts-details.html?id=' + nft._id,
      });
    } catch (_) {}

    return res.json({
      success: true,
      message: `Bid accepted. ${amountEth} ETH (≈ $${costUsd.toFixed(2)}) transferred.`,
      bid,
      nft,
      balance: Number(credit && credit.account_bal) || 0,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/dashboard/feature/nfts/:id/bids/:bidId/reject', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const nft = await Nft.findById(req.params.id);
    if (!nft) return res.status(404).json({ success: false, message: 'NFT not found.' });
    if (String(nft.owner_id) !== String(u._id)) {
      return res.status(403).json({ success: false, message: 'Only the NFT owner can reject bids.' });
    }
    const bid = await NftBid.findOne({ _id: req.params.bidId, nft_id: nft._id });
    if (!bid) return res.status(404).json({ success: false, message: 'Bid not found.' });
    if (bid.status !== 'pending') {
      return res.status(422).json({ success: false, message: 'Bid is not pending.' });
    }
    bid.status = 'rejected';
    await bid.save();
    try {
      await Notification.create({
        user_id: bid.user_id,
        title: 'Bid rejected',
        message: `Your bid of ${Number(bid.amount_eth || 0)} ETH on ${nft.name} was rejected.`,
        type: 'nft',
        link: '/user/nfts-details.html?id=' + nft._id,
      });
    } catch (_) {}
    res.json({ success: true, message: 'Bid rejected.', bid });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});


router.post('/dashboard/feature/nfts/:id/buy', async (req, res) => {
  try {
    const buyerId = featureIdOf(req);
    if (!buyerId) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const buyer = await User.findById(buyerId);
    if (!buyer) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const nft = await Nft.findById(req.params.id);
    if (!nft) return res.status(404).json({ success: false, message: 'NFT not found.' });
    if (String(nft.owner_id) === String(buyer._id)) {
      return res.status(422).json({ success: false, message: 'You already own this NFT.' });
    }

    const priceEth = Number(nft.price_eth || 0);
    if (!(priceEth > 0)) {
      return res.status(422).json({ success: false, message: 'Invalid NFT price.' });
    }

    const ethUsd = await getEthUsdPrice();
    if (!(ethUsd > 0)) {
      return res.status(503).json({
        success: false,
        message: 'ETH price unavailable. Ensure Ethereum (ETH) is listed as an asset with a live price, then try again.',
      });
    }

    const costUsd = Number((priceEth * ethUsd).toFixed(2));
    const bal = nftUserBalance(buyer);
    if (bal < costUsd) {
      return res.status(422).json({
        success: false,
        message: `Insufficient balance. This NFT costs ${priceEth} ETH ≈ $${costUsd.toFixed(2)} (ETH @ $${ethUsd.toFixed(2)}). Your balance is $${bal.toFixed(2)}.`,
        required_usd: costUsd,
        eth_usd: ethUsd,
        price_eth: priceEth,
        balance: bal,
      });
    }

    const buyerAfter = await nftAdjustBalance(buyer._id, -costUsd);
    if (!buyerAfter) {
      return res.status(422).json({
        success: false,
        message: `Insufficient balance. Need $${costUsd.toFixed(2)} (${priceEth} ETH @ $${ethUsd.toFixed(2)}).`,
      });
    }

    const sellerId = nft.owner_id;
    const prevOwnerName = nft.owner_name || '';
    let sellerAfter = null;
    if (sellerId && String(sellerId) !== String(buyer._id)) {
      sellerAfter = await nftAdjustBalance(sellerId, costUsd);
      if (!sellerAfter) {
        await nftAdjustBalance(buyer._id, costUsd); // rollback
        return res.status(500).json({ success: false, message: 'Failed to credit seller. Purchase rolled back.' });
      }
    }

    nft.owner_id = buyer._id;
    nft.owner_name = nftUserName(buyer);
    nft.status = 'sold';
    await nft.save();

    await NftTransaction.create({
      nft_id: nft._id,
      nft_name: nft.name,
      from_id: sellerId || null,
      to_id: buyer._id,
      from_name: prevOwnerName,
      to_name: nftUserName(buyer),
      type: 'sale',
      amount_eth: priceEth,
      amount_usd: costUsd,
    });

    try {
      await Notification.create({
        user_id: buyer._id,
        title: 'NFT purchased',
        message: `You bought ${nft.name} for ${priceEth} ETH (≈ $${costUsd.toFixed(2)}).`,
        type: 'nft',
        link: '/user/my-nfts.html',
      });
      if (sellerId) {
        await Notification.create({
          user_id: sellerId,
          title: 'NFT sold',
          message: `${nftUserName(buyer)} bought your NFT ${nft.name} for ${priceEth} ETH (≈ $${costUsd.toFixed(2)}). $${costUsd.toFixed(2)} was credited to your balance.`,
          type: 'nft',
          link: '/user/nfts-details.html?id=' + nft._id,
        });
      }
    } catch (_) {}

    return res.json({
      success: true,
      message: `NFT purchased successfully for ${priceEth} ETH (≈ $${costUsd.toFixed(2)}).`,
      nft,
      balance: nftUserBalance(buyerAfter),
      cost_usd: costUsd,
      eth_usd: ethUsd,
    });
  } catch (e) {
    console.error('[nft buy]', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/dashboard/feature/nfts/bids/:bidId/accept', async (req, res) => {
  try {
    const ownerId = featureIdOf(req);
    if (!ownerId) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const owner = await User.findById(ownerId);
    if (!owner) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const bid = await NftBid.findById(req.params.bidId);
    if (!bid) return res.status(404).json({ success: false, message: 'Bid not found.' });
    if (bid.status !== 'pending') return res.status(422).json({ success: false, message: 'Bid is not pending.' });

    const nft = await Nft.findById(bid.nft_id);
    if (!nft) return res.status(404).json({ success: false, message: 'NFT not found.' });

    if (String(nft.owner_id) !== String(owner._id)) {
      return res.status(403).json({ success: false, message: 'Only the current NFT owner can accept bids.' });
    }
    if (String(bid.user_id) === String(owner._id)) {
      return res.status(422).json({ success: false, message: 'Cannot accept your own bid.' });
    }

    const amountEth = Number(bid.amount_eth || 0);
    if (!(amountEth > 0)) return res.status(422).json({ success: false, message: 'Invalid bid amount.' });

    const ethUsd = await getEthUsdPrice();
    if (!(ethUsd > 0)) {
      return res.status(503).json({
        success: false,
        message: 'ETH price unavailable. Ensure Ethereum (ETH) is listed as an asset with a live price.',
      });
    }
    const costUsd = Number((amountEth * ethUsd).toFixed(2));
    if (!(costUsd > 0)) {
      return res.status(422).json({ success: false, message: 'Computed transfer amount is zero.' });
    }

    // Debit bidder first (both balance + account_bal)
    const bidderAfter = await nftAdjustBalance(bid.user_id, -costUsd);
    if (!bidderAfter) {
      const bidder = await User.findById(bid.user_id);
      const bal = nftUserBalance(bidder);
      return res.status(422).json({
        success: false,
        message: `Bidder has insufficient balance. Need $${costUsd.toFixed(2)} (${amountEth} ETH @ $${ethUsd.toFixed(2)}). Bidder balance: $${bal.toFixed(2)}.`,
        required_usd: costUsd,
        eth_usd: ethUsd,
        bidder_balance: bal,
      });
    }

    // Credit current owner (both fields)
    const ownerAfter = await nftAdjustBalance(owner._id, costUsd);
    if (!ownerAfter) {
      // rollback bidder debit
      await nftAdjustBalance(bid.user_id, costUsd);
      return res.status(500).json({ success: false, message: 'Failed to credit seller. Transfer rolled back.' });
    }

    const prevOwnerId = nft.owner_id;
    const prevOwnerName = nft.owner_name;
    const bidderName = nftUserName(bidderAfter);

    nft.owner_id = bidderAfter._id;
    nft.owner_name = bidderName;
    nft.price_eth = amountEth;
    nft.status = 'sold';
    await nft.save();

    bid.status = 'accepted';
    await bid.save();
    await NftBid.updateMany(
      { nft_id: nft._id, status: 'pending', _id: { $ne: bid._id } },
      { $set: { status: 'rejected' } }
    );

    await NftTransaction.create({
      nft_id: nft._id,
      nft_name: nft.name,
      from_id: prevOwnerId,
      to_id: bidderAfter._id,
      from_name: prevOwnerName,
      to_name: bidderName,
      type: 'bid_accept',
      amount_eth: amountEth,
      amount_usd: costUsd,
    });

    try {
      await Notification.create({
        user_id: bidderAfter._id,
        title: 'Bid accepted',
        message: `The owner accepted your bid of ${amountEth} ETH (≈ $${costUsd.toFixed(2)}) on ${nft.name}. $${costUsd.toFixed(2)} was debited from your balance.`,
        type: 'nft',
        link: '/user/nfts-details.html?id=' + nft._id,
      });
      await Notification.create({
        user_id: owner._id,
        title: 'NFT sold via bid',
        message: `You accepted a bid of ${amountEth} ETH (≈ $${costUsd.toFixed(2)}) on ${nft.name}. $${costUsd.toFixed(2)} was credited to your balance.`,
        type: 'nft',
        link: '/user/nfts-details.html?id=' + nft._id,
      });
    } catch (_) {}

    return res.json({
      success: true,
      message: `Bid accepted. $${costUsd.toFixed(2)} debited from bidder and credited to you.`,
      bid,
      nft,
      cost_usd: costUsd,
      eth_usd: ethUsd,
      seller_balance: nftUserBalance(ownerAfter),
      bidder_balance: nftUserBalance(bidderAfter),
    });
  } catch (e) {
    console.error('[nft bid accept]', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/dashboard/feature/nfts/bids/:bidId/reject', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const bid = await NftBid.findById(req.params.bidId);
    if (!bid) return res.status(404).json({ success: false, message: 'Bid not found.' });
    if (bid.status !== 'pending') return res.status(422).json({ success: false, message: 'Bid is not pending.' });
    const nft = await Nft.findById(bid.nft_id);
    if (!nft) return res.status(404).json({ success: false, message: 'NFT not found.' });
    if (String(nft.owner_id) !== String(u._id)) {
      return res.status(403).json({ success: false, message: 'Only the NFT owner can reject bids.' });
    }
    bid.status = 'rejected';
    await bid.save();
    try {
      await Notification.create({
        user_id: bid.user_id,
        title: 'Bid rejected',
        message: `Your bid of ${Number(bid.amount_eth || 0)} ETH on ${nft.name} was rejected.`,
        type: 'nft',
        link: '/user/nfts-details.html?id=' + nft._id,
      });
    } catch (_) {}
    try {
      const { sendPushToUser } = require('../utils/pushNotifications');
      const bidder = await User.findById(bid.user_id);
      if (bidder) {
        await sendPushToUser(bidder, {
          title: 'Bid rejected',
          body: `Your bid on ${nft.name} was rejected.`,
          url: '/user/nfts-details.html?id=' + nft._id,
          tag: 'nft-bid-reject',
        });
      }
    } catch (_) {}
    return res.json({ success: true, message: 'Bid rejected.', bid });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});



// ===== Account history / trading history / transfer (feature) =====
function featureUserIdFilter(uid) {
  return { $or: [{ user_id: uid }, { user: uid }, { owner: uid }] };
}

router.get('/dashboard/feature/account-history', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const tab = String(req.query.tab || 'deposits').toLowerCase();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(5, Number(req.query.limit || 15)));
    const skip = (page - 1) * limit;
    const uid = u._id;

    if (tab === 'deposits') {
      const [deps, hist] = await Promise.all([
        Deposit.find(featureUserIdFilter(uid)).sort({ createdAt: -1 }).lean(),
        AccountHistory.find({
          user_id: uid,
          type: { $regex: /deposit|express/i },
        }).sort({ date: -1, createdAt: -1 }).lean(),
      ]);
      const rows = [];
      for (const d of deps) {
        rows.push({
          _id: d._id,
          amount: Number(d.amount || 0),
          payment_mode: d.payment_method || d.paymethd_method || d.type || '—',
          status: String(d.status || 'pending').toLowerCase(),
          date: d.createdAt || d.date || d.updatedAt,
          source: 'deposit',
        });
      }
      for (const h of hist) {
        rows.push({
          _id: h._id,
          amount: Number(h.amount || 0),
          payment_mode: h.narration || h.type || 'Deposit',
          status: String(h.status || 'processed').toLowerCase(),
          date: h.date || h.createdAt,
          source: 'history',
        });
      }
      rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      const total = rows.length;
      return res.json({
        success: true,
        tab: 'deposits',
        rows: rows.slice(skip, skip + limit),
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
        balance: Number(u.account_bal ?? u.balance ?? 0),
      });
    }

    if (tab === 'withdrawals') {
      const list = await Widthdraw.find(featureUserIdFilter(uid)).sort({ createdAt: -1 }).lean();
      const rows = list.map((w) => ({
        _id: w._id,
        amount: Number(w.amount || w.amount_requested || 0),
        with_charges: Number(w.amountWithCharges || w.total || w.amount || 0),
        method: w.method || w.type || w.payment_method || '—',
        status: String(w.status || 'pending').toLowerCase(),
        date: w.createdAt || w.date,
      }));
      const total = rows.length;
      return res.json({
        success: true,
        tab: 'withdrawals',
        rows: rows.slice(skip, skip + limit),
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
        balance: Number(u.account_bal ?? u.balance ?? 0),
      });
    }

    // others — AccountHistory + feature schemas (stock, plans, NFT, real estate, mining, live trades)
    // exclude card / verify / wallet only
    const excludeRe = /card|verify|kyc|wallet|connect.?wallet/i;
    const rows = [];
    const seen = new Set();

    function pushRow(row) {
      const key = `${row.source}:${String(row._id)}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(row);
    }

    // 1) AccountHistory (all types except excluded)
    try {
      const list = await AccountHistory.find({ user_id: uid }).sort({ date: -1, createdAt: -1 }).lean();
      for (const h of list) {
        if (excludeRe.test(String(h.type || '')) || excludeRe.test(String(h.narration || ''))) continue;
        pushRow({
          _id: h._id,
          amount: Number(h.amount || 0),
          type: h.type || '—',
          plan_narration: h.narration || h.type || '—',
          status: String(h.status || 'processed').toLowerCase(),
          date: h.date || h.createdAt,
          source: 'history',
        });
      }
    } catch (e) { console.error('[account-history others] AccountHistory', e.message); }

    // 2) Stock trades
    try {
      const StockModel = (typeof FeatureStockTrade !== 'undefined') ? FeatureStockTrade : require('../models/StockTrade');
      const stocks = await StockModel.find({ user_id: uid }).sort({ createdAt: -1 }).lean();
      for (const s of stocks) {
        const side = String(s.type || s.side || 'BUY').toUpperCase();
        pushRow({
          _id: s._id,
          amount: Number(s.total || s.amount || (Number(s.shares || 0) * Number(s.price || 0)) || 0),
          type: side === 'SELL' ? 'STOCK_SELL' : 'STOCK_BUY',
          plan_narration: `STOCK: ${s.symbol || s.name || '—'}`,
          status: 'processed',
          date: s.createdAt,
          source: 'stock',
        });
      }
    } catch (e) { console.error('[account-history others] StockTrade', e.message); }

    // 3) Live / binary trades
    try {
      const TradeModel = typeof Trade !== 'undefined' ? Trade : (typeof TradeLive !== 'undefined' ? TradeLive : null);
      if (TradeModel) {
        const trades = await TradeModel.find({ user_id: uid }).sort({ createdAt: -1 }).lean();
        for (const tr of trades) {
          const pnl = Number(tr.profit_loss || 0);
          let typ = String(tr.result || '').toUpperCase();
          if (!typ) {
            if (pnl > 0) typ = 'WIN';
            else if (pnl < 0) typ = 'LOSS';
            else typ = String(tr.action || tr.status || 'TRADE').toUpperCase();
          }
          pushRow({
            _id: tr._id,
            amount: Math.abs(Number(tr.amount || pnl || 0)),
            type: typ,
            plan_narration: tr.asset_name || tr.asset_type || 'Trade',
            status: String(tr.status || 'processed').toLowerCase(),
            date: tr.settled_at || tr.opened || tr.createdAt,
            source: 'trade',
          });
        }
      }
    } catch (e) { console.error('[account-history others] Trade', e.message); }

    // 4) Investment plans (buy-plan)
    try {
      const plans = await FeatureUserPlans.find({ user: uid }).populate('plan').sort({ createdAt: -1 }).lean();
      for (const inv of plans) {
        const planName = (inv.plan && inv.plan.name) || inv.inv_duration || 'Plan';
        pushRow({
          _id: inv._id,
          amount: Number(inv.amount || 0),
          type: 'Plan purchase',
          plan_narration: planName,
          status: String(inv.active || inv.status || 'processed').toLowerCase() === 'yes' ? 'active' : String(inv.active || inv.status || 'processed').toLowerCase(),
          date: inv.activated_at || inv.createdAt,
          source: 'plan',
        });
        if (Number(inv.profit_earned) > 0) {
          pushRow({
            _id: String(inv._id) + '-roi',
            amount: Number(inv.profit_earned),
            type: 'ROI',
            plan_narration: planName,
            status: 'processed',
            date: inv.settled_at || inv.closed_at || inv.updatedAt || inv.createdAt,
            source: 'plan_roi',
          });
        }
      }
    } catch (e) { console.error('[account-history others] FeatureUserPlans', e.message); }

    // 5) NFT transactions (buyer or seller)
    try {
      const nftTx = await NftTransaction.find({
        $or: [{ to_id: uid }, { from_id: uid }],
      }).sort({ createdAt: -1 }).lean();
      for (const tx of nftTx) {
        const isBuyer = String(tx.to_id) === String(uid);
        const typ = isBuyer
          ? (tx.type === 'bid_accept' ? 'Buy NFT' : (tx.type === 'sale' ? 'Buy NFT' : String(tx.type || 'NFT')))
          : (tx.type === 'bid_accept' || tx.type === 'sale' ? 'Sell NFT' : String(tx.type || 'NFT'));
        pushRow({
          _id: tx._id,
          amount: Number(tx.amount_usd || 0) || (Number(tx.amount_eth || 0)),
          type: typ,
          plan_narration: tx.nft_name || 'NFT',
          status: 'processed',
          date: tx.createdAt,
          source: 'nft',
        });
      }
    } catch (e) { console.error('[account-history others] NftTransaction', e.message); }

    // 6) Real estate investments
    try {
      const REI = typeof FeatureRealEstateInvestment !== 'undefined'
        ? FeatureRealEstateInvestment
        : require('../models/RealEstateInvestment');
      const REProp = typeof FeatureRealEstateProperty !== 'undefined'
        ? FeatureRealEstateProperty
        : require('../models/RealEstateProperty');
      const reis = await REI.find({ user_id: uid }).populate('property_id').sort({ createdAt: -1 }).lean();
      for (const inv of reis) {
        const propName = (inv.property_id && (inv.property_id.name || inv.property_id.title)) || 'Real Estate';
        pushRow({
          _id: inv._id,
          amount: Number(inv.amount || 0),
          type: 'Real Estate Investment',
          plan_narration: propName,
          status: String(inv.status || 'active').toLowerCase(),
          date: inv.started_at || inv.createdAt,
          source: 'real_estate',
        });
        if (Number(inv.profit_earned) > 0) {
          pushRow({
            _id: String(inv._id) + '-roi',
            amount: Number(inv.profit_earned),
            type: 'Real Estate ROI',
            plan_narration: propName,
            status: 'processed',
            date: inv.updatedAt || inv.createdAt,
            source: 'real_estate_roi',
          });
        }
      }
    } catch (e) { console.error('[account-history others] RealEstate', e.message); }

    // 7) Mining subscriptions
    try {
      const MiningSub = typeof FeatureMiningSubscription !== 'undefined'
        ? FeatureMiningSubscription
        : require('../models/MiningSubscription');
      const mines = await MiningSub.find({ user_id: uid }).populate('mining_plan_id').sort({ createdAt: -1 }).lean();
      for (const s of mines) {
        const planName = (s.mining_plan_id && s.mining_plan_id.name) || 'Mining';
        pushRow({
          _id: s._id,
          amount: Number(s.invested_amount || s.amount || 0),
          type: 'Mining Investment',
          plan_narration: planName,
          status: String(s.status || 'active').toLowerCase(),
          date: s.started_at || s.createdAt,
          source: 'mining',
        });
        if (Number(s.profit_earned || s.accumulated_profit) > 0) {
          pushRow({
            _id: String(s._id) + '-roi',
            amount: Number(s.profit_earned || s.accumulated_profit),
            type: 'Mining ROI',
            plan_narration: planName,
            status: 'processed',
            date: s.updatedAt || s.createdAt,
            source: 'mining_roi',
          });
        }
      }
    } catch (e) { console.error('[account-history others] Mining', e.message); }

    rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const total = rows.length;
    return res.json({
      success: true,
      tab: 'others',
      rows: rows.slice(skip, skip + limit),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      balance: Number(u.account_bal ?? u.balance ?? 0),
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/dashboard/feature/trading-history', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(5, Number(req.query.limit || 15)));
    const skip = (page - 1) * limit;
    const uid = u._id;
    const rows = [];

    try {
      const trades = await Trade.find({ user_id: uid }).sort({ opened: -1, createdAt: -1 }).lean();
      for (const t of trades) {
        const pnl = Number(t.profit_loss || 0);
        let typ = String(t.result || t.status || 'TRADE').toUpperCase();
        if (t.result) typ = String(t.result).toUpperCase();
        else if (pnl > 0) typ = 'WIN';
        else if (pnl < 0) typ = 'LOSE';
        rows.push({
          _id: t._id,
          asset: t.asset_name || t.asset_type || 'Trade',
          amount: Math.abs(Number(t.amount || pnl || 0)),
          type: typ,
          date: t.settled_at || t.opened || t.createdAt,
          source: 'trade',
        });
      }
    } catch (_) {}

    try {
      const stocks = await (typeof FeatureStockTrade !== 'undefined' ? FeatureStockTrade : require('../models/StockTrade')).find({ user_id: uid }).sort({ createdAt: -1 }).lean();
      for (const s of stocks) {
        rows.push({
          _id: s._id,
          asset: s.symbol || s.name || 'Stock',
          amount: Math.abs(Number(s.amount || s.total || s.shares || 0)),
          type: String(s.side || s.type || s.action || 'STOCK').toUpperCase(),
          date: s.createdAt,
          source: 'stock',
        });
      }
    } catch (_) {}

    try {
      const hist = await AccountHistory.find({
        user_id: uid,
        type: { $regex: /roi|bonus|win|loss|lose|profit/i },
      }).sort({ date: -1, createdAt: -1 }).lean();
      for (const h of hist) {
        rows.push({
          _id: h._id,
          asset: h.narration || h.type || '—',
          amount: Math.abs(Number(h.amount || 0)),
          type: String(h.type || 'ROI').toUpperCase(),
          date: h.date || h.createdAt,
          source: 'history',
        });
      }
    } catch (_) {}

    rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const total = rows.length;
    return res.json({
      success: true,
      rows: rows.slice(skip, skip + limit),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      balance: Number(u.account_bal ?? u.balance ?? 0),
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/dashboard/feature/transfer', async (req, res) => {
  try {
    const sender = await featureGetUser(req);
    if (!sender) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const b = req.body || {};
    const identifier = String(b.email || b.username || b.recipient || '').toLowerCase().trim();
    const amount = Number(b.amount || 0);
    const password = typeof b.password === 'string' ? b.password : '';

    if (!identifier) return res.status(422).json({ success: false, message: 'Recipient email or username is required.' });
    if (!(amount > 0)) return res.status(422).json({ success: false, message: 'Enter a valid transfer amount.' });
    if (amount < 50) return res.status(422).json({ success: false, message: 'Minimum transfer is $50.00.' });
    if (!password) return res.status(422).json({ success: false, message: 'Account password is required.' });

    // password check
    const senderFull = await User.findById(sender._id).select('+password');
    if (!senderFull) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const ok = await senderFull.comparePassword(password);
    if (!ok) return res.status(401).json({ success: false, message: 'Incorrect password.' });

    const receiver = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });
    if (!receiver) return res.status(404).json({ success: false, message: 'Recipient not found.' });
    if (String(receiver._id) === String(sender._id)) {
      return res.status(422).json({ success: false, message: 'You cannot transfer to yourself.' });
    }

    const bal = Math.max(Number(senderFull.account_bal || 0), Number(senderFull.balance || 0));
    if (bal < amount) {
      return res.status(422).json({
        success: false,
        message: `Insufficient balance. You have $${bal.toFixed(2)}.`,
      });
    }

    // debit sender
    const newSenderBal = Math.round((bal - amount) * 100) / 100;
    senderFull.account_bal = newSenderBal;
    senderFull.balance = newSenderBal;
    await senderFull.save();

    // credit receiver
    const rBal = Math.max(Number(receiver.account_bal || 0), Number(receiver.balance || 0));
    const newRecv = Math.round((rBal + amount) * 100) / 100;
    receiver.account_bal = newRecv;
    receiver.balance = newRecv;
    await receiver.save();

    const recvName = receiver.name || receiver.username || receiver.email;
    const sendName = senderFull.name || senderFull.username || senderFull.email;

    await AccountHistory.create({
      user_id: senderFull._id,
      amount: -amount,
      type: 'Fund Transfer',
      narration: `Transferred to ${recvName}`,
      status: 'processed',
      date: new Date(),
    });
    await AccountHistory.create({
      user_id: receiver._id,
      amount: amount,
      type: 'Fund Transfer',
      narration: `Received from ${sendName}`,
      status: 'processed',
      date: new Date(),
    });

    try {
      await Notification.create({
        user_id: senderFull._id,
        title: 'Transfer sent',
        message: `You sent $${amount.toFixed(2)} to ${recvName}.`,
        type: 'transfer',
        link: '/user/accounthistory.html',
      });
      await Notification.create({
        user_id: receiver._id,
        title: 'Transfer received',
        message: `You received $${amount.toFixed(2)} from ${sendName}.`,
        type: 'transfer',
        link: '/user/accounthistory.html',
      });
    } catch (_) {}

    try {
      const { sendPushToUser } = require('../utils/pushNotifications');
      await sendPushToUser(senderFull, {
        title: 'Transfer sent',
        body: `You sent $${amount.toFixed(2)} to ${recvName}.`,
        url: '/user/accounthistory.html',
        tag: 'transfer-sent',
      });
      await sendPushToUser(receiver, {
        title: 'Transfer received',
        body: `You received $${amount.toFixed(2)} from ${sendName}.`,
        url: '/user/accounthistory.html',
        tag: 'transfer-recv',
      });
    } catch (_) {}

    return res.json({
      success: true,
      message: `Transfer successful. $${amount.toFixed(2)} sent to ${recvName}.`,
      balance: newSenderBal,
    });
  } catch (e) {
    console.error('[transfer]', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/dashboard/transfertouser', async (req, res, next) => {
  // Compatibility alias → same handler as feature/transfer
  req.url = '/dashboard/feature/transfer';
  req.originalUrl = '/user/dashboard/feature/transfer';
  return router.handle(req, res, next);
});




// ===== Unified Portfolio (all modules) =====
router.get('/dashboard/feature/portfolio', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const uid = u._id;
    const balance = Math.max(featureNum(u.account_bal), featureNum(u.balance));

    // Trading
    let openTrades = [];
    let recentTrades = [];
    let tradingInvested = 0, tradingUnrealized = 0, tradingRealized = 0;
    try {
      openTrades = await Trade.find({ user_id: uid, status: 'open' }).sort({ opened: -1, createdAt: -1 }).limit(50).lean();
      tradingInvested = openTrades.reduce((s, t) => s + featureNum(t.amount), 0);
      recentTrades = await Trade.find({ user_id: uid, status: { $in: ['closed', 'cancelled'] } }).sort({ settled_at: -1, createdAt: -1 }).limit(20).lean();
      tradingRealized = recentTrades.reduce((s, t) => s + featureNum(t.profit_loss), 0);
      // also include any closed profit_loss from history if open has pl
      tradingUnrealized = openTrades.reduce((s, t) => s + featureNum(t.profit_loss), 0);
    } catch (e) { console.error('[portfolio] trades', e.message); }

    // Investment plans
    let plans = [];
    let plansInvested = 0, plansProfit = 0, plansActive = 0;
    try {
      plans = await FeatureUserPlans.find({ user: uid }).populate('plan').sort({ createdAt: -1 }).lean();
      for (const p of plans) {
        if (String(p.active) === 'yes') {
          plansActive += 1;
          plansInvested += featureNum(p.amount);
        }
        plansProfit += featureNum(p.profit_earned);
      }
    } catch (e) { console.error('[portfolio] plans', e.message); }

    // Copy trading
    let copyPositions = [];
    let copyInvested = 0, copyProfit = 0, copyActive = 0;
    try {
      copyPositions = await FeatureCopyPosition.find({ user_id: uid }).populate('expert_id').sort({ createdAt: -1 }).lean();
      for (const c of copyPositions) {
        if (String(c.status || 'active') === 'active') {
          copyActive += 1;
          copyInvested += featureNum(c.invested_amount);
        }
        copyProfit += featureNum(c.accumulated_profit);
      }
    } catch (e) { console.error('[portfolio] copy', e.message); }

    // Bot trading
    let botSubs = [];
    let botInvested = 0, botProfit = 0, botActive = 0;
    try {
      botSubs = await FeatureBotSubscription.find({ user_id: uid }).populate('bot_id').sort({ createdAt: -1 }).lean();
      for (const b of botSubs) {
        if (String(b.status || 'active') === 'active') {
          botActive += 1;
          botInvested += featureNum(b.invested_amount);
        }
        botProfit += featureNum(b.current_profit) + featureNum(b.admin_profit_adjustment);
      }
    } catch (e) { console.error('[portfolio] bots', e.message); }

    // Stocks
    let stockPositions = [];
    let stockInvested = 0, stockValue = 0, stockPl = 0;
    try {
      const StockPos = (typeof FeatureStockPosition !== 'undefined')
        ? FeatureStockPosition
        : require('../models/StockPosition');
      stockPositions = await StockPos.find({ user_id: uid, shares: { $gt: 0 } }).lean();
      const symbols = [...new Set(stockPositions.map(p => p.symbol))];
      const assets = await FeatureTradingAsset.find({ symbol: { $in: symbols } }).lean();
      const bySym = Object.fromEntries(assets.map(a => [String(a.symbol).toUpperCase(), a]));
      stockPositions = stockPositions.map(p => {
        const a = bySym[String(p.symbol).toUpperCase()] || {};
        const price = featureNum(a.price || a.last_price || p.avg_cost);
        const invested = featureNum(p.shares) * featureNum(p.avg_cost);
        const value = featureNum(p.shares) * price;
        const pl = value - invested;
        stockInvested += invested;
        stockValue += value;
        stockPl += pl;
        return {
          ...p,
          current_price: price,
          invested,
          current_value: value,
          unrealized_pl: pl,
        };
      });
    } catch (e) { console.error('[portfolio] stocks', e.message); }

    // NFTs
    let nfts = [];
    let nftsOwned = 0, nftsListed = 0, nftsValue = 0;
    try {
      nfts = await Nft.find({ owner_id: uid }).sort({ updatedAt: -1 }).lean();
      nftsOwned = nfts.length;
      nftsListed = nfts.filter(n => String(n.status) === 'available' || n.listed).length;
      // estimate USD via ETH price
      let ethUsd = 0;
      try {
        const eth = await FeatureTradingAsset.findOne({
          $or: [{ symbol: /^ETH$/i }, { coingecko_id: 'ethereum' }, { name: /ethereum/i }],
        }).lean();
        if (eth) ethUsd = featureNum(eth.price || eth.last_price);
      } catch (_) {}
      for (const n of nfts) {
        nftsValue += featureNum(n.price_eth) * (ethUsd > 0 ? ethUsd : 0);
      }
    } catch (e) { console.error('[portfolio] nfts', e.message); }

    // Loans
    let loans = [];
    let loansActive = 0, loansOutstanding = 0, loansRepaid = 0;
    try {
      const LoanModel = require('../models/Loan');
      loans = await LoanModel.find({
        user_id: uid,
        status: { $in: ['active', 'repaying', 'approved', 'pending'] },
      }).populate('plan_id').sort({ createdAt: -1 }).lean();
      for (const l of loans) {
        const total = featureNum(l.total_repayable || l.approved_amount || l.amount);
        const repaid = featureNum(l.total_repaid);
        const outstanding = Math.max(0, total - repaid);
        if (['active', 'repaying', 'approved'].includes(String(l.status))) {
          loansActive += 1;
          loansOutstanding += outstanding;
        }
        loansRepaid += repaid;
        l._outstanding = outstanding;
        l._progress = total > 0 ? Math.min(100, (repaid / total) * 100) : 0;
      }
    } catch (e) { console.error('[portfolio] loans', e.message); }

    const totalInvested = plansInvested + copyInvested + botInvested + stockInvested + tradingInvested;
    const totalPl = plansProfit + copyProfit + botProfit + stockPl + tradingRealized + tradingUnrealized;
    const netWorth = balance + stockValue + nftsValue + plansInvested + copyInvested + botInvested + tradingInvested - loansOutstanding;

    const allocation = [
      { key: 'investments', label: 'Investments', amount: plansInvested },
      { key: 'stocks', label: 'Stocks', amount: stockInvested },
      { key: 'copy', label: 'Copy Trading', amount: copyInvested },
      { key: 'bots', label: 'Bot Trading', amount: botInvested },
      { key: 'trading', label: 'Trading', amount: tradingInvested },
      { key: 'nfts', label: 'NFTs', amount: nftsValue },
    ].filter(a => a.amount > 0);
    const allocSum = allocation.reduce((s, a) => s + a.amount, 0) || 1;
    allocation.forEach(a => { a.pct = (a.amount / allocSum) * 100; });

    return res.json({
      success: true,
      summary: {
        net_worth: Math.round(netWorth * 100) / 100,
        total_invested: Math.round(totalInvested * 100) / 100,
        total_pl: Math.round(totalPl * 100) / 100,
        account_balance: Math.round(balance * 100) / 100,
        outstanding_loans: Math.round(loansOutstanding * 100) / 100,
        loans_active: loansActive,
      },
      allocation,
      counts: {
        open_trades: openTrades.length,
        active_plans: plansActive,
        copy_positions: copyActive,
        active_bots: botActive,
        nfts_owned: nftsOwned,
      },
      trading: {
        invested: tradingInvested,
        unrealized_pl: tradingUnrealized,
        realized_pl: tradingRealized,
        open_positions: openTrades.length,
        open: openTrades,
        recent: recentTrades,
      },
      investments: {
        active_plans: plansActive,
        total_invested: plansInvested,
        profit_earned: plansProfit,
        plans,
      },
      copy: {
        active_positions: copyActive,
        total_invested: copyInvested,
        accumulated_profit: copyProfit,
        positions: copyPositions,
      },
      bots: {
        active_bots: botActive,
        total_invested: botInvested,
        accumulated_profit: botProfit,
        subscriptions: botSubs,
      },
      stocks: {
        total_invested: stockInvested,
        current_value: stockValue,
        unrealized_pl: stockPl,
        positions: stockPositions,
      },
      nfts: {
        owned: nftsOwned,
        listed: nftsListed,
        estimated_value: Math.round(nftsValue * 100) / 100,
        items: nfts,
      },
      loans: {
        active_loans: loansActive,
        outstanding: loansOutstanding,
        total_repaid: loansRepaid,
        items: loans,
      },
    });
  } catch (e) {
    console.error('[portfolio]', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});



// ===== Account Settings (profile + records) =====
router.get('/dashboard/feature/account-settings', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const uid = u._id;
    const balance = Math.max(featureNum(u.account_bal), featureNum(u.balance));
    const profit = featureNum(u.profit || u.roi);
    const bonus = featureNum(u.bonus);
    const refBonus = featureNum(u.ref_bonus);

    let trading = { open: 0, invested: 0, profit: 0, loss: 0, trades: 0 };
    try {
      const open = await Trade.find({ user_id: uid, status: 'open' }).lean();
      const closed = await Trade.find({ user_id: uid, status: { $in: ['closed','cancelled'] } }).lean();
      trading.open = open.length;
      trading.invested = open.reduce((s,t)=>s+featureNum(t.amount),0);
      trading.trades = open.length + closed.length;
      for (const t of closed) {
        const pl = featureNum(t.profit_loss);
        if (pl >= 0) trading.profit += pl; else trading.loss += Math.abs(pl);
      }
    } catch (e) { console.error('[acct] trade', e.message); }

    let copy = { active: 0, invested: 0, profit: 0 };
    try {
      const rows = await FeatureCopyPosition.find({ user_id: uid }).lean();
      for (const c of rows) {
        if (String(c.status||'active')==='active') { copy.active++; copy.invested += featureNum(c.invested_amount); }
        copy.profit += featureNum(c.accumulated_profit);
      }
    } catch (e) { console.error('[acct] copy', e.message); }

    let plans = { active: 0, invested: 0, earned: 0 };
    try {
      const rows = await FeatureUserPlans.find({ user: uid }).lean();
      for (const p of rows) {
        if (String(p.active)==='yes') { plans.active++; plans.invested += featureNum(p.amount); }
        plans.earned += featureNum(p.profit_earned);
      }
    } catch (e) { console.error('[acct] plans', e.message); }

    let stocks = { positions: 0, invested: 0, value: 0 };
    try {
      const StockPos = typeof FeatureStockPosition !== 'undefined' ? FeatureStockPosition : require('../models/StockPosition');
      const rows = await StockPos.find({ user_id: uid, shares: { $gt: 0 } }).lean();
      stocks.positions = rows.length;
      const symbols = [...new Set(rows.map(r=>r.symbol))];
      const assets = await FeatureTradingAsset.find({ symbol: { $in: symbols } }).lean();
      const bySym = Object.fromEntries(assets.map(a=>[String(a.symbol).toUpperCase(), a]));
      for (const p of rows) {
        const price = featureNum((bySym[String(p.symbol).toUpperCase()]||{}).price || p.avg_cost);
        stocks.invested += featureNum(p.shares)*featureNum(p.avg_cost);
        stocks.value += featureNum(p.shares)*price;
      }
    } catch (e) { console.error('[acct] stocks', e.message); }

    let nfts = { owned: 0, value: 0 };
    try {
      const items = await Nft.find({ owner_id: uid }).lean();
      nfts.owned = items.length;
      let ethUsd = 0;
      try {
        const eth = await FeatureTradingAsset.findOne({ $or: [{ symbol: /^ETH$/i }, { coingecko_id: 'ethereum' }] }).lean();
        if (eth) ethUsd = featureNum(eth.price);
      } catch(_){}
      for (const n of items) nfts.value += featureNum(n.price_eth) * (ethUsd || 0);
    } catch (e) { console.error('[acct] nfts', e.message); }

    let deposits = { total: 0, count: 0 };
    let withdrawals = { total: 0, count: 0 };
    try {
      const deps = await Deposit.find({ user: uid, status: { $in: ['Processed','processed','Approved','approved','completed','Completed'] } }).lean().catch(()=>[]);
      const deps2 = deps.length ? deps : await Deposit.find({ user_id: uid }).lean().catch(()=>[]);
      for (const d of (deps.length?deps:deps2)) {
        const st = String(d.status||'').toLowerCase();
        if (['processed','approved','completed','success'].includes(st) || deps.length) {
          deposits.total += featureNum(d.amount);
          deposits.count += 1;
        }
      }
    } catch (e) { console.error('[acct] dep', e.message); }
    try {
      const Widthdraw = require('../models/widthdrawSchema');
      const wds = await Widthdraw.find({ $or: [{ user: uid }, { user_id: uid }] }).lean();
      for (const w of wds) {
        const st = String(w.status||'').toLowerCase();
        if (['processed','approved','completed','paid'].includes(st)) {
          withdrawals.total += featureNum(w.amount);
          withdrawals.count += 1;
        }
      }
    } catch (e) {
      try {
        const W = require('../models/Withdrawal');
        const wds = await W.find({ user_id: uid }).lean();
        for (const w of wds) {
          withdrawals.total += featureNum(w.amount);
          withdrawals.count += 1;
        }
      } catch (e2) { console.error('[acct] wd', e2.message); }
    }

    let loans = { active: 0, outstanding: 0, repaid: 0 };
    try {
      const LoanModel = require('../models/Loan');
      const rows = await LoanModel.find({ user_id: uid }).lean();
      for (const l of rows) {
        const total = featureNum(l.total_repayable || l.approved_amount || l.amount);
        const repaid = featureNum(l.total_repaid);
        if (['active','repaying','approved'].includes(String(l.status))) {
          loans.active++;
          loans.outstanding += Math.max(0, total - repaid);
        }
        loans.repaid += repaid;
      }
    } catch (e) { console.error('[acct] loans', e.message); }

    const totalInvested = copy.invested + plans.invested + stocks.invested + trading.invested;
    const totalPl = trading.profit - trading.loss + copy.profit + plans.earned + (stocks.value - stocks.invested);
    const netWorth = balance + stocks.value + nfts.value + plans.invested + copy.invested + trading.invested - loans.outstanding;
    const winRate = featureNum(u.win_rate);
    const allocation = [
      { label: 'Copy Trading', amount: copy.invested },
      { label: 'Stocks', amount: stocks.invested },
      { label: 'Investments', amount: plans.invested },
      { label: 'Trading', amount: trading.invested },
      { label: 'NFTs', amount: nfts.value },
    ].filter(a => a.amount > 0);

    const frontend = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const refLink = u.ref_link || (frontend ? `${frontend}/register.html?ref=${encodeURIComponent(u.username)}` : `/register.html?ref=${encodeURIComponent(u.username)}`);

    return res.json({
      success: true,
      profile: {
        name: u.name, username: u.username, email: u.email, phone: u.phone,
        country: u.country, currency_code: u.currency_code, gender: u.gender,
        address: u.address || '', state: u.state || '', zip_code: u.zip_code || '',
        image: u.image || '',
        account_verify: u.account_verify || 'Not Verified',
        verificationStatus: u.verificationStatus || 'not_verified',
        isVerified: Boolean(u.isVerified),
        balance, profit, bonus, ref_bonus: refBonus, win_rate: winRate,
        ref_link: refLink,
      },
      records: {
        net_worth: Math.round(netWorth*100)/100,
        total_invested: Math.round(totalInvested*100)/100,
        total_pl: Math.round(totalPl*100)/100,
        win_rate: winRate,
        allocation,
        balance, profit, bonus, referral: refBonus,
        trading, copy, plans, stocks, nfts, deposits, withdrawals, loans,
        ref_link: refLink,
      }
    });
  } catch (e) {
    console.error('[account-settings]', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});



// ===================== SUPPORT TICKETS (USER) =====================
function genTicketId() {
  const hex = Math.random().toString(16).slice(2, 10).toUpperCase();
  return 'TKT-' + hex;
}

router.get('/dashboard/feature/support', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const tickets = await SupportTicket.find({ user_id: u._id }).sort({ updatedAt: -1 }).lean();
    const list = tickets.map((t) => {
      const msgs = t.messages || [];
      const last = msgs.length ? msgs[msgs.length - 1] : null;
      let lastPreview = '';
      if (last) {
        const who = last.sender === 'admin' ? 'Admin' : 'You';
        lastPreview = who + ': ' + String(last.body || '').slice(0, 120);
      }
      return {
        _id: t._id,
        ticket_id: t.ticket_id,
        subject: t.subject,
        priority: t.priority,
        status: t.status,
        message_count: msgs.length,
        last_message: lastPreview,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    });
    return res.json({ success: true, tickets: list });
  } catch (e) {
    console.error('[support list]', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/dashboard/feature/support', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const subject = String(req.body.subject || '').trim();
    const message = String(req.body.message || req.body.body || '').trim();
    const priority = ['Low', 'Medium', 'High'].includes(req.body.priority) ? req.body.priority : 'Medium';
    if (!subject) return res.status(400).json({ success: false, message: 'Subject is required.' });
    if (!message) return res.status(400).json({ success: false, message: 'Message is required.' });
    let ticket_id = genTicketId();
    for (let i = 0; i < 5; i++) {
      const exists = await SupportTicket.findOne({ ticket_id }).lean();
      if (!exists) break;
      ticket_id = genTicketId();
    }
    const ticket = await SupportTicket.create({
      ticket_id,
      user_id: u._id,
      subject,
      priority,
      status: 'Open',
      messages: [{
        sender: 'user',
        sender_id: u._id,
        sender_name: u.name || u.username || 'You',
        body: message,
      }],
    });
    return res.json({
      success: true,
      message: 'Your support ticket has been created successfully!',
      ticket: { _id: ticket._id, ticket_id: ticket.ticket_id },
    });
  } catch (e) {
    console.error('[support create]', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/dashboard/feature/support/:ticket', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const key = String(req.params.ticket || '');
    const ticket = await SupportTicket.findOne({
      user_id: u._id,
      $or: [{ ticket_id: key }, { _id: key.match(/^[a-f0-9]{24}$/i) ? key : null }].filter(Boolean),
    }).lean();
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
    return res.json({ success: true, ticket });
  } catch (e) {
    console.error('[support get]', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/dashboard/feature/support/:ticket/reply', async (req, res) => {
  try {
    const u = await featureGetUser(req);
    if (!u) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const key = String(req.params.ticket || '');
    const body = String(req.body.message || req.body.body || req.body.reply || '').trim();
    if (!body) return res.status(400).json({ success: false, message: 'Reply message is required.' });
    const ticket = await SupportTicket.findOne({
      user_id: u._id,
      $or: [{ ticket_id: key }, { _id: key.match(/^[a-f0-9]{24}$/i) ? key : null }].filter(Boolean),
    });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
    if (ticket.status === 'Closed') {
      return res.status(400).json({ success: false, message: 'This ticket has been closed.' });
    }
    ticket.messages.push({
      sender: 'user',
      sender_id: u._id,
      sender_name: u.name || u.username || 'You',
      body,
    });
    // User replied again → status Open
    ticket.status = 'Open';
    await ticket.save();
    return res.json({ success: true, message: 'Your reply has been sent.', ticket });
  } catch (e) {
    console.error('[support reply]', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});


module.exports = router;
