const mongoose = require('mongoose');
const itemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true }, description: { type: String, required: true },
  type: { type: String, enum: ['lost', 'found'], required: true },
  category: { type: String, required: true }, location: { type: String, required: true },
  date: { type: Date, required: true }, image: String,
  status: { type: String, enum: ['open', 'claimed', 'resolved'], default: 'open' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
itemSchema.index({ title: 'text', description: 'text', location: 'text' });
module.exports = mongoose.model('Item', itemSchema);
