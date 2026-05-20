const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    platform: { type: String, required: true, index: true },
    sheetId: { type: String, required: true },
    rowKey: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    submittedAt: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'contacted', 'converted'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

leadSchema.index({ business: 1, sheetId: 1, rowKey: 1 }, { unique: true });

module.exports = mongoose.model('Lead', leadSchema);
