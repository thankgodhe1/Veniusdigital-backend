const mongoose = require('mongoose');

const walletConnectionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  walletName: { type: String, required: true, trim: true },
  walletKey: { type: String, required: true, trim: true },
  walletLogo: { type: String, default: '' },
  status: { type: String, enum: ['active','inactive'], default: 'active', index: true },
  connectionMethod: { type: String, default: 'external-wallet' },
  connectedAt: { type: Date, default: Date.now }
}, { timestamps: true });
walletConnectionSchema.index({ user_id: 1, walletKey: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
module.exports = mongoose.models.WalletConnection || mongoose.model('WalletConnection', walletConnectionSchema);
