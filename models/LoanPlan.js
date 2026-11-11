const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  min_amount: { type: Number, default: 0 },
  max_amount: { type: Number, default: 0 },
  interest_rate: { type: Number, default: 0 },
  interest_type: { type: String, enum: ['Simple', 'Compound'], default: 'Simple' },
  min_duration: { type: Number, default: 1 },
  max_duration: { type: Number, default: 12 },
  max_active_loans: { type: Number, default: 1 },
  min_account_balance: { type: Number, default: 0 },
  processing_fee: { type: Number, default: 0 },
  grace_period_days: { type: Number, default: 0 },
  late_fee: { type: Number, default: 0 },
  requires_collateral: { type: Boolean, default: false },
  collateral_percentage: { type: Number, default: 0 },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },
  is_active: { type: Boolean, default: true, index: true }
}, { timestamps: true });
module.exports = mongoose.models.LoanPlan || mongoose.model('LoanPlan', schema);
