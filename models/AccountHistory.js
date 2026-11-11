const mongoose = require('mongoose');

const accountHistorySchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true },
  type: { type: String, required: true, trim: true },
  narration: { type: String, default: '' },
  status: { type: String, default: 'processed' },
  date: { type: Date, default: Date.now, index: true },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

accountHistorySchema.index({ user_id: 1, date: -1 });

module.exports = mongoose.model('AccountHistory', accountHistorySchema);
