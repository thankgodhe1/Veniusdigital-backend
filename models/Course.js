const mongoose = require('mongoose');
const CourseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category: { type: String, default: '' },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseCategory', default: null },
  price: { type: Number, default: 0 },
  image: { type: String, default: '' },
  image_url: { type: String, default: '' },
  status: { type: String, enum: ['published', 'draft'], default: 'draft' },
  lessons_count: { type: Number, default: 0 },
  enrolled_count: { type: Number, default: 0 },
}, { timestamps: true });
module.exports = mongoose.model('Course', CourseSchema);
