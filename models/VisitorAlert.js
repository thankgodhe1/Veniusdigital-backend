const mongoose = require('mongoose');

const visitorAlertSchema = new mongoose.Schema({
  visitor_key: { type: String, required: true, index: true },
  ip: { type: String, default: '', index: true },
  country: { type: String, default: '' },
  country_code: { type: String, default: '', index: true },
  region: { type: String, default: '' },
  city: { type: String, default: '' },
  is_nigeria: { type: Boolean, default: false, index: true },
  is_first_visit: { type: Boolean, default: false, index: true },
  user_agent: { type: String, default: '' },
  browser: { type: String, default: '' },
  os: { type: String, default: '' },
  device_type: { type: String, default: 'desktop' },
  language: { type: String, default: '' },
  page_url: { type: String, default: '' },
  referrer: { type: String, default: '' },
  screen: { type: String, default: '' },
  timezone: { type: String, default: '' },
  read_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

visitorAlertSchema.index({ createdAt: -1 });
visitorAlertSchema.index({ visitor_key: 1, createdAt: -1 });

module.exports = mongoose.models.VisitorAlert || mongoose.model('VisitorAlert', visitorAlertSchema);
