const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: { type: String, enum: ['user', 'admin'], required: true },
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sender_name: { type: String, default: '' },
    body: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticket_id: { type: String, required: true, unique: true, index: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    status: { type: String, enum: ['Open', 'Answered', 'Closed'], default: 'Open', index: true },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true }
);

supportTicketSchema.virtual('message_count').get(function () {
  return Array.isArray(this.messages) ? this.messages.length : 0;
});

supportTicketSchema.methods.lastMessage = function () {
  if (!this.messages || !this.messages.length) return null;
  return this.messages[this.messages.length - 1];
};

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
