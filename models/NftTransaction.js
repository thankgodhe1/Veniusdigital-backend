const mongoose = require('mongoose');
const NftTransactionSchema = new mongoose.Schema({
  nft_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Nft', required: true },
  nft_name: { type: String, default: '' },
  from_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  to_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  from_name: { type: String, default: '' },
  to_name: { type: String, default: '' },
  type: { type: String, enum: ['mint', 'sale', 'transfer', 'bid_accept'], default: 'mint' },
  amount_eth: { type: Number, default: 0 },
  amount_usd: { type: Number, default: 0 },
}, { timestamps: true });
module.exports = mongoose.model('NftTransaction', NftTransactionSchema);
