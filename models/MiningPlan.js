const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  hashrate: { type: String, default: '' },
  description: { type: String, default: '' },
  daily_roi_percentage: { type: Number, default: 0 },
  duration_days: { type: Number, default: 30 },
  sort_order: { type: Number, default: 0, index: true },
  min_investment: { type: Number, default: 0 },
  max_investment: { type: Number, default: 0 },
  icon_color: { type: String, default: '' },
  is_active: { type: Boolean, default: true, index: true }
}, { timestamps: true });
module.exports = mongoose.models.MiningPlan || mongoose.model('MiningPlan', schema);
