const mongoose = require('mongoose');

const widthdrawSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  amount: { type: Number, required: true, min: 0 },
  amount_requested: { type: Number, default: 0, min: 0 },
  amountWithCharges: { type: Number, default: 0, min: 0 },
  total: { type: Number, default: 0, min: 0 },
  type: { type: String, default: '' },
  method: { type: String, default: '' },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['pending', 'processed', 'rejected'], default: 'pending', index: true },
  narration: { type: String, default: 'Withdrawal' },
}, { timestamps: true });

widthdrawSchema.index({ user: 1, createdAt: -1 });
widthdrawSchema.index({ user_id: 1, createdAt: -1 });

module.exports = mongoose.model('Widthdraw', widthdrawSchema);
