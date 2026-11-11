const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  amount: { type: Number, required: true, min: 0 },
  type: { type: String, required: true, trim: true },
  payment_method: { type: String, default: '' },
  paymethd_method: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'processed', 'rejected'], default: 'pending', index: true },
  image: { type: String, default: '' },
  proof: { type: String, default: '' },
  narration: { type: String, default: 'Deposit' },
  // Loan repayment linkage (excluded from normal deposit history)
  loan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', default: null, index: true },
  schedule_id: { type: String, default: '' },
  installment: { type: String, default: '' },
  is_loan_repayment: { type: Boolean, default: false, index: true },
}, { timestamps: true });

depositSchema.index({ user: 1, createdAt: -1 });
depositSchema.index({ user_id: 1, createdAt: -1 });

module.exports = mongoose.model('Deposit', depositSchema);
