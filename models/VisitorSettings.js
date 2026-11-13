const mongoose = require('mongoose');

/**
 * Singleton site settings for visitor alerts.
 * alert_non_nigeria_every_visit: when true, admins are alerted on every visit
 * from a non-Nigeria IP (in addition to always-on first-visit alerts).
 */
const visitorSettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'default', unique: true },
  alert_non_nigeria_every_visit: { type: Boolean, default: false },
  first_visit_alerts_enabled: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.models.VisitorSettings || mongoose.model('VisitorSettings', visitorSettingsSchema);
