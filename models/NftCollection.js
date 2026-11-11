const mongoose = require('mongoose');
const NftCollectionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, default: '' },
  description: { type: String, default: '' },
  image_url: { type: String, default: '' },
  category: { type: String, default: '' },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NftCategory', default: null },
  royalty: { type: Number, default: 2.5 },
  featured: { type: Boolean, default: false },
  status: { type: String, default: 'active' },
}, { timestamps: true });
module.exports = mongoose.model('NftCollection', NftCollectionSchema);
