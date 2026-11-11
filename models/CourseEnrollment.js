const mongoose = require('mongoose');
const CourseEnrollmentSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  amount_paid: { type: Number, default: 0 },
  status: { type: String, default: 'active' },
}, { timestamps: true });
CourseEnrollmentSchema.index({ user_id: 1, course_id: 1 }, { unique: true });
module.exports = mongoose.model('CourseEnrollment', CourseEnrollmentSchema);
