const mongoose = require('mongoose');
const cardTransactionSchema = new mongoose.Schema({
  card_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true },
  type: { type: String, required: true },
  narration: { type: String, default: '' },
  description: { type: String, default: '' },
  reference: { type: String, default: '' },
  status: { type: String, default: 'processed' }
}, { timestamps: true });
module.exports = mongoose.models.CardTransaction || mongoose.model('CardTransaction', cardTransactionSchema);
