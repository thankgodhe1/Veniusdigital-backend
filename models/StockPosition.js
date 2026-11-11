const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  asset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TradingAsset', index: true },
  symbol: { type: String, required: true, uppercase: true, index: true },
  name: { type: String, default: '' },
  logo_url: { type: String, default: '' },
  shares: { type: Number, default: 0, min: 0 },
  avg_cost: { type: Number, default: 0, min: 0 },
  total_invested: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
  closed_pl: { type: Number, default: 0 }
}, { timestamps: true });
schema.index({ user_id: 1, symbol: 1, status: 1 });
module.exports = mongoose.models.StockPosition || mongoose.model('StockPosition', schema);
