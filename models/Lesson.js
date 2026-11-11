const mongoose = require('mongoose');
const LessonSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  course_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
  category: { type: String, default: '' },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseCategory', default: null },
  duration: { type: String, default: '' },
  video_url: { type: String, default: '' },
  image: { type: String, default: '' },
  image_url: { type: String, default: '' },
  is_preview: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  standalone: { type: Boolean, default: false },
}, { timestamps: true });
module.exports = mongoose.model('Lesson', LessonSchema);
