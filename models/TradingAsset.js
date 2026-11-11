const mongoose = require('mongoose');

const tradingAssetSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  symbol: { type: String, required: true, trim: true, uppercase: true, index: true },
  asset_class: { type: String, enum: ['crypto','stock','forex','etf','index','indices','stocks'], default: 'crypto', index: true },
  price: { type: Number, default: 0, min: 0 },
  price_change_24h: { type: Number, default: 0 },
  change_24h: { type: Number, default: 0 },
  price_change_pct_24h: { type: Number, default: 0 },
  high_24h: { type: Number, default: 0 },
  low_24h: { type: Number, default: 0 },
  volume_24h: { type: Number, default: 0 },
  market_cap: { type: Number, default: 0 },
  logo_url: { type: String, default: '' },
  data_source: { type: String, default: 'manual' },
  external_id: { type: String, default: '' },
  coingecko_id: { type: String, default: '' },
  twelvedata_symbol: { type: String, default: '' },
  is_active: { type: Boolean, default: true, index: true }
}, { timestamps: true });

module.exports = mongoose.models.TradingAsset || mongoose.model('TradingAsset', tradingAssetSchema);
