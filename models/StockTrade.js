const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  asset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TradingAsset', index: true },
  position_id: { type: mongoose.Schema.Types.ObjectId, ref: 'StockPosition' },
  symbol: { type: String, required: true, uppercase: true, index: true },
  name: { type: String, default: '' },
  logo_url: { type: String, default: '' },
  type: { type: String, enum: ['BUY', 'SELL'], required: true, index: true },
  shares: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  fee: { type: Number, default: 0 },
  is_admin_adjust: { type: Boolean, default: false }
}, { timestamps: true });
schema.index({ user_id: 1, createdAt: -1 });
module.exports = mongoose.models.StockTrade || mongoose.model('StockTrade', schema);
