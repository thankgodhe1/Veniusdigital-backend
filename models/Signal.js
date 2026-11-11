const mongoose = require('mongoose');
const SignalSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  entry_price: { type: Number, default: 0 },
  take_profit: { type: Number, default: 0 },
  stop_loss: { type: Number, default: 0 },
  leverage: { type: Number, default: 1 },
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
}, { timestamps: true });
module.exports = mongoose.model('Signal', SignalSchema);
