const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  strategy_type: { type: String, default: 'Scalping' },
  description: { type: String, default: '' },
  win_rate: { type: Number, default: 0 },
  expected_roi: { type: Number, default: 0 },
  trade_interval_minutes: { type: Number, default: 60 },
  min_investment: { type: Number, default: 0 },
  max_investment: { type: Number, default: 0 },
  max_duration_days: { type: Number, default: 30 },
  profit_min_pct: { type: Number, default: 0 },
  profit_max_pct: { type: Number, default: 0 },
  loss_min_pct: { type: Number, default: 0 },
  loss_max_pct: { type: Number, default: 0 },
  daily_roi: { type: Number, default: 0 },
  trading_asset_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TradingAsset' }],
  is_active: { type: Boolean, default: true, index: true },
  image: { type: String, default: '' }
}, { timestamps: true });
module.exports = mongoose.models.TradingBot || mongoose.model('TradingBot', schema);
