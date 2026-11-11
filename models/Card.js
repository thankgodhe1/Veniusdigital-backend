const mongoose = require('mongoose');
const cardSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  card_type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CardType', required: true, index: true },
  card_holder: { type: String, default: '' },
  card_number: { type: String, default: '' },
  expiry_month: Number,
  expiry_year: Number,
  cvv: { type: String, default: '' },
  balance: { type: Number, default: 0 },
  status: { type: String, enum: ['pending','active','frozen','blocked','rejected','cancelled'], default: 'pending', index: true },
  shipping_address: { type: mongoose.Schema.Types.Mixed, default: null },
  description: { type: String, default: '' },
  tracking_number: { type: String, default: '' },
  issued_at: Date,
  expires_at: Date,
  activated_at: Date,
  blocked_at: Date,
  block_reason: String
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });
cardSchema.virtual('user', { ref: 'User', localField: 'user_id', foreignField: '_id', justOne: true });
cardSchema.virtual('cardType', { ref: 'CardType', localField: 'card_type_id', foreignField: '_id', justOne: true });
cardSchema.virtual('transactions', { ref: 'CardTransaction', localField: '_id', foreignField: 'card_id' });
cardSchema.virtual('masked_number').get(function(){ return this.card_number ? `•••• •••• •••• ${String(this.card_number).slice(-4)}` : '•••• •••• •••• ••••'; });
cardSchema.virtual('expiry_display').get(function(){ return this.expiry_month && this.expiry_year ? `${String(this.expiry_month).padStart(2,'0')}/${String(this.expiry_year).slice(-2)}` : '--/--'; });
module.exports = mongoose.models.Card || mongoose.model('Card', cardSchema);
