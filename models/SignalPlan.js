const mongoose = require('mongoose');
const SignalPlanSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, default: 0 },
  duration_weeks: { type: Number, default: 1 },
  features: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });
module.exports = mongoose.model('SignalPlan', SignalPlanSchema);
