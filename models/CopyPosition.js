const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expert_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Expert', required: true, index: true },
  invested_amount: { type: Number, default: 0 },
  accumulated_profit: { type: Number, default: 0 },
  daily_roi_snapshot: { type: Number, default: 0 },
  started_at: { type: Date, default: Date.now },
  expires_at: Date,
  stopped_at: Date,
  settled_at: Date,
  status: { type: String, enum: ['active','stopped','completed','settled'], default: 'active', index: true },
  settled_by: String,
  admin_profit_adjustment: { type: Number, default: 0 },
  admin_notes: { type: String, default: '' }
}, { timestamps: true });
module.exports = mongoose.models.CopyPosition || mongoose.model('CopyPosition', schema);
