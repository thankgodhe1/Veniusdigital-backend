const mongoose = require('mongoose');
const NftBidSchema = new mongoose.Schema({
  nft_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Nft', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  user_name: { type: String, default: '' },
  amount_eth: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
}, { timestamps: true });
module.exports = mongoose.model('NftBid', NftBidSchema);
