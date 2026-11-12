const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  symbol: { type: String, default: '', trim: true },
  logo_url: { type: String, default: '' },
  badge: { type: String, default: '' },
  address: { type: String, default: '', trim: true },
  networks: { type: [String], default: [] },
  network: { type: String, default: '' },
  min_amount: { type: Number, default: 10 },
  qr_image_url: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  sort_order: { type: Number, default: 0 },
  icon_class: { type: String, default: '' },
  color: { type: String, default: '#ffffff' },
  bg: { type: String, default: '' },
}, { timestamps: true });

paymentMethodSchema.index({ name: 1 });
paymentMethodSchema.index({ status: 1, sort_order: 1 });

module.exports = mongoose.models.PaymentMethod || mongoose.model('PaymentMethod', paymentMethodSchema);
