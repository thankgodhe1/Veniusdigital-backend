const mongoose = require('mongoose');
const scheduleItem = new mongoose.Schema({
  due_date: Date,
  principal: { type: Number, default: 0 },
  interest: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  late_fee: { type: Number, default: 0 },
  status: { type: String, enum: ['upcoming', 'paid', 'overdue'], default: 'upcoming' },
  paid_at: Date,
  paid_amount: { type: Number, default: 0 }
}, { _id: true });

const schema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  plan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanPlan', required: true, index: true },
  amount: { type: Number, default: 0 },
  approved_amount: { type: Number, default: 0 },
  duration_months: { type: Number, default: 1 },
  purpose: { type: String, default: '' },
  monthly_income: { type: Number, default: 0 },
  interest_rate: { type: Number, default: 0 },
  interest_type: { type: String, default: 'Simple' },
  processing_fee: { type: Number, default: 0 },
  total_repayable: { type: Number, default: 0 },
  total_repaid: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'active', 'repaying', 'completed', 'defaulted', 'rejected', 'cancelled'],
    default: 'pending',
    index: true
  },
  rejection_reason: { type: String, default: '' },
  schedule: [scheduleItem],
  disbursed_at: Date,
  maturity_date: Date,
  applied_at: { type: Date, default: Date.now },
  defaulted_at: Date
}, { timestamps: true });
module.exports = mongoose.models.Loan || mongoose.model('Loan', schema);
