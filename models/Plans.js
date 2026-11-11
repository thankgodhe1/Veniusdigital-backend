const mongoose = require('mongoose');

const plansSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, default: 0 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 0 },
  min_price: { type: Number, default: 0 },
  max_price: { type: Number, default: 0 },
  min_return: { type: Number, default: 0 },
  max_return: { type: Number, default: 0 },
  minr: { type: Number, default: 0 },
  maxr: { type: Number, default: 0 },
  duration: { type: Number, default: 30 },
  expiration: { type: String, default: '30 Days' },
  return: { type: Number, default: 0 },
  type: { type: String, default: 'Main' },
  status: { type: String, enum: ['active','inactive'], default: 'active' },
  tag: { type: String, default: '' },
  icon: { type: String, default: 'chart-bar' },
  increment_interval: { type: String, default: 'Daily' },
  increment_type: { type: String, default: 'Percentage' },
  increment_amount: { type: Number, default: 0 },
  gift: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.models.Plans || mongoose.model('Plans', plansSchema);
