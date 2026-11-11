const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  bot_subscription_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BotSubscription', required: true, index: true },
  trading_asset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TradingAsset' },
  asset_name: String,
  action: String,
  amount: Number,
  profit_loss: Number,
  result: String,
  executed_at: { type: Date, default: Date.now }
}, { timestamps: true });
module.exports = mongoose.models.BotSimulatedTrade || mongoose.model('BotSimulatedTrade', schema);
