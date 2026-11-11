const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  location: { type: String, default: '' },
  description: { type: String, default: '' },
  main_image: { type: String, default: '' },
  room_images: { type: [String], default: [] },
  tag: { type: String, default: '', enum: ['', 'HOT', 'TOP', 'NEW', 'None'] },
  property_value: { type: Number, default: 0 },
  roi_percentage: { type: Number, default: 0 },
  total_tokens: { type: Number, default: 0 },
  token_price: { type: Number, default: 0 },
  tokens_sold: { type: Number, default: 0 },
  min_investment: { type: Number, default: 0 },
  max_investment: { type: Number, default: 0 },
  roi_interval: { type: String, default: 'Daily' },
  roi_type: { type: String, default: 'Percentage of invested amount' },
  roi_amount_per_interval: { type: Number, default: 0 },
  duration_days: { type: Number, default: 365 },
  bedrooms: { type: String, default: '' },
  bathrooms: { type: String, default: '' },
  sqft: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },
  is_active: { type: Boolean, default: true, index: true }
}, { timestamps: true });
module.exports = mongoose.models.RealEstateProperty || mongoose.model('RealEstateProperty', schema);
