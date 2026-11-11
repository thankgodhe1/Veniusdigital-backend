const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'RealEstateProperty', required: true, index: true },
  amount: { type: Number, default: 0 },
  tokens: { type: Number, default: 0 },
  profit_earned: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'cancelled', 'expired', 'completed'], default: 'active', index: true },
  started_at: { type: Date, default: Date.now },
  expires_at: { type: Date },
  cancelled_at: { type: Date },
  last_growth: { type: Date, default: Date.now }
}, { timestamps: true });
module.exports = mongoose.models.RealEstateInvestment || mongoose.model('RealEstateInvestment', schema);
