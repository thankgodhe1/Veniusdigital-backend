const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  copy_position_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CopyPosition', required: true, index: true },
  trading_asset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TradingAsset' },
  asset_name: String,
  asset_class: String,
  action: String,
  entry_price: Number,
  exit_price: Number,
  amount: Number,
  profit_loss: Number,
  result: String,
  executed_at: { type: Date, default: Date.now }
}, { timestamps: true });
module.exports = mongoose.models.CopySimulatedTrade || mongoose.model('CopySimulatedTrade', schema);
