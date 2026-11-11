const mongoose = require('mongoose');
const NftCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, default: '' },
  status: { type: String, default: 'active' },
}, { timestamps: true });
module.exports = mongoose.model('NftCategory', NftCategorySchema);
