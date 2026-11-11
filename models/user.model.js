const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { roles } = require('../utils/constants');

const accountTypes = [
  'Binary Option Trading',
  'Forex Trading',
  'Stock Trading',
  'CryptoCurrency Investment',
  'NFT Trading',
];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Full name is required'], trim: true, maxlength: [120, 'Full name is too long'] },
    username: {
      type: String, required: [true, 'Username is required'], unique: true, trim: true, lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'], maxlength: [40, 'Username must be at most 40 characters'],
      match: [/^[a-z0-9_.-]+$/, 'Username contains invalid characters'],
    },
    email: {
      type: String, required: [true, 'Email is required'], unique: true, trim: true, lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    phone: { type: String, required: [true, 'Phone is required'], trim: true, maxlength: [30, 'Phone is too long'], default: 'Not provided' },
    gender: { type: String, required: [true, 'Gender is required'], enum: { values: ['Female', 'Male', 'Others'], message: 'Invalid gender' }, default: 'Others' },
    country: { type: String, required: [true, 'Country is required'], trim: true, default: 'Not specified' },
    currency_code: { type: String, required: [true, 'Preferred currency is required'], trim: true, default: '$', maxlength: [12, 'Currency symbol is too long'] },
    password: { type: String, required: [true, 'Password is required'], minlength: [6, 'Password must be at least 6 characters'], select: false },
    account: {
      type: [String],
      required: [true, 'Select at least one account type'],
      default: ['Forex Trading'],
      validate: { validator(value) { return Array.isArray(value) && value.length > 0 && value.every((item) => accountTypes.includes(item)); }, message: 'Select at least one valid account type' },
    },
    role: { type: String, enum: [roles.admin, roles.moderator, roles.client], default: roles.client },

    // Existing financial/trading fields.
    balance: { type: Number, default: 0, min: 0 },
    account_bal: { type: Number, default: 0, min: 0 },
    frozen_bal: { type: Number, default: 0, min: 0 },
    profit: { type: Number, default: 0, min: 0 },
    roi: { type: Number, default: 0, min: 0 },
    bonus: { type: Number, default: 0, min: 0 },
    ref_bonus: { type: Number, default: 0, min: 0 },
    signal_strength: { type: Number, default: 0, min: 0, max: 100 },
    signal_strength_score: { type: Number, default: 0, min: 0, max: 100 },
    signal_strength_enabled: { type: Boolean, default: false },
    trade_prog: { type: Number, default: 0, min: 0, max: 100 },
    trading_progress_score: { type: Number, default: 0, min: 0, max: 100 },
    trading_progress_enabled: { type: Boolean, default: false },
    win_rate: { type: Number, default: 0, min: 0, max: 100 },
    trade_mode: { type: String, enum: ['on', 'off'], default: 'on' },
    wallet_connect_status: { type: String, enum: ['on', 'off'], default: 'on' },
    connectWallet: { type: Boolean, default: true },
    status: { type: String, enum: ['active', 'blocked'], default: 'active', index: true },

    // Verification/KYC dashboard state.
    isVerified: { type: Boolean, default: false },
    verificationStatus: { type: String, enum: ['not_verified', 'pending', 'verified'], default: 'not_verified', index: true },
    account_verify: { type: String, enum: ['Not Verified', 'Pending', 'Verified', 'Rejected'], default: 'Not Verified' },
    verificationBannerDismissed: { type: Boolean, default: false },

    // Dashboard banner.
    dashboard_banner_message: { type: String, default: '' },
    dashboard_banner_type: { type: String, enum: ['warning', 'success', 'danger'], default: 'warning' },
    dashboard_banner_enabled: { type: Boolean, default: false },

    // Five withdrawal-code controls.
    code1_enabled: { type: Boolean, default: false }, code1_label: { type: String, default: 'Broker Commission Fee Code' }, code1: { type: String, default: '', maxlength: 4 },
    code2_enabled: { type: Boolean, default: false }, code2_label: { type: String, default: 'Anti-Theft Security Code' }, code2: { type: String, default: '', maxlength: 4 },
    code3_enabled: { type: Boolean, default: false }, code3_label: { type: String, default: 'IMF Code' }, code3: { type: String, default: '', maxlength: 4 },
    code4_enabled: { type: Boolean, default: false }, code4_label: { type: String, default: 'Cost of Transfer Code' }, code4: { type: String, default: '', maxlength: 4 },
    code5_enabled: { type: Boolean, default: false }, code5_label: { type: String, default: 'Taxation Code' }, code5: { type: String, default: '', maxlength: 4 },

    image: { type: String, default: '' },
    address: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    zip_code: { type: String, default: '', trim: true },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    pushSubscription: { type: mongoose.Schema.Types.Mixed, default: null },
    pushSubscriptions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    ref_link: { type: String, default: '' },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.pre('save', function syncLegacyBalance(next) {
  // Keep the application's original `balance` and the admin-facing `account_bal`
  // synchronized without allowing either one to become negative.
  const balanceChanged = this.isModified('balance');
  const accountBalChanged = this.isModified('account_bal');
  if (balanceChanged && !accountBalChanged) this.account_bal = Math.max(0, Number(this.balance || 0));
  if (accountBalChanged && !balanceChanged) this.balance = Math.max(0, Number(this.account_bal || 0));
  if (this.isVerified || this.verificationStatus === 'verified' || this.account_verify === 'Verified') {
    this.isVerified = true;
    this.verificationStatus = 'verified';
    this.account_verify = 'Verified';
  }
  if (this.verificationStatus === 'pending') this.account_verify = 'Pending';
  if (this.verificationStatus === 'not_verified' && this.account_verify === 'Verified') this.verificationStatus = 'verified';
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
