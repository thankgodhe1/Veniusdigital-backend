const mongoose = require('mongoose');
const cardTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, default: 'Physical' },
  network: { type: String, default: 'Visa' },
  fee: { type: Number, default: 0, min: 0 },
  issuance_fee: { type: Number, default: 0, min: 0 },
  monthly_fee: { type: Number, default: 0, min: 0 },
  delivery_days: { type: Number, default: 0, min: 0 },
  description: { type: String, default: '' },
  is_active: { type: Boolean, default: true, index: true }
}, { timestamps: true });
module.exports = mongoose.models.CardType || mongoose.model('CardType', cardTypeSchema);
