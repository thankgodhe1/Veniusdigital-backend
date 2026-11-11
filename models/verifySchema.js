const mongoose = require('mongoose');

const verifySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  document_type: { type: String, required: true, trim: true },
  frontimg: { type: String, required: true },
  backimg: { type: String, required: true },
  idcardFront: { type: String, default: '' },
  idcardBack: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending', index: true },
  message: { type: String, default: '' },
  subject: { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

verifySchema.index({ user: 1, createdAt: -1 });
verifySchema.index({ user_id: 1, createdAt: -1 });

module.exports = mongoose.model('Verify', verifySchema);
