const mongoose = require('mongoose');
const SignalSubscriptionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SignalPlan', required: true },
  plan_name: { type: String, default: '' },
  price_paid: { type: Number, default: 0 },
  duration_weeks: { type: Number, default: 1 },
  features: { type: String, default: '' },
  status: { type: String, enum: ['active', 'cancelled', 'expired'], default: 'active' },
  starts_at: { type: Date, default: Date.now },
  ends_at: { type: Date, required: true },
  cancelled_at: { type: Date, default: null },
}, { timestamps: true });
module.exports = mongoose.model('SignalSubscription', SignalSubscriptionSchema);
