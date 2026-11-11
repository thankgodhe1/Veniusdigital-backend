const mongoose = require('mongoose');
const expertSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  profile_picture: { type: String, default: '' },
  bio: { type: String, default: '' },
  area_of_expertise: { type: String, default: '' },
  daily_roi: { type: Number, default: 0 },
  duration_days: { type: Number, default: 30 },
  win_rate: { type: Number, default: 0 },
  min_startup_capital: { type: Number, default: 0 },
  max_capital: { type: Number, default: 0 },
  profit_share_percentage: { type: Number, default: 0 },
  total_profit: { type: Number, default: 0 },
  followers_count: { type: Number, default: 0 },
  total_roi: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true, index: true }
}, { timestamps: true });
module.exports = mongoose.models.Expert || mongoose.model('Expert', expertSchema);
