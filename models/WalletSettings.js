const mongoose = require('mongoose');
const walletSettingsSchema = new mongoose.Schema({
  _id: { type: Number, default: 1 },
  min_balance: { type: Number, default: 0 },
  daily_reward: { type: Number, default: 3000 },
  wallet_status: { type: String, enum: ['on','off'], default: 'on' }
}, { timestamps: true, _id: false });
module.exports = mongoose.models.WalletSettings || mongoose.model('WalletSettings', walletSettingsSchema);
