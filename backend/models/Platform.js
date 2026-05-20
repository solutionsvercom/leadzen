const mongoose = require('mongoose');

const platformSchema = new mongoose.Schema(
  {
    value: { type: String, required: true, unique: true, lowercase: true, trim: true },
    label: { type: String, required: true, trim: true },
    color: { type: String, default: '#2563eb' },
    enabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Platform', platformSchema);
