const mongoose = require('mongoose');

const userPlansSchema = new mongoose.Schema({
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plans', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  active: { type: String, enum: ['yes','no','cancelled','expired'], default: 'yes', index: true },
  inv_duration: { type: String, default: '' },
  expire_date: { type: Date, required: true, index: true },
  activated_at: { type: Date, default: Date.now },
  last_growth: { type: Date, default: Date.now },
  profit_earned: { type: Number, default: 0 },
  payments_received: { type: Number, default: 0 },
  closed_at: Date,
  settled_at: Date,
  settlement_type: String
}, { timestamps: true });

userPlansSchema.virtual('dplan', { ref: 'Plans', localField: 'plan', foreignField: '_id', justOne: true });
userPlansSchema.virtual('planDetails', { ref: 'Plans', localField: 'plan', foreignField: '_id', justOne: true });
userPlansSchema.set('toJSON', { virtuals: true });
userPlansSchema.set('toObject', { virtuals: true });

module.exports = mongoose.models.User_plans || mongoose.model('User_plans', userPlansSchema);
