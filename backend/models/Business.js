const mongoose = require('mongoose');

const sheetLinkSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    platform: { type: String, required: true, lowercase: true, trim: true },
    sheetId: { type: String, required: true },
    label: { type: String, default: '' },
    lastSyncedAt: { type: Date },
  },
  { _id: true }
);

const suppressedLeadSchema = new mongoose.Schema(
  {
    sheetId: { type: String, required: true },
    rowKey: { type: String, required: true },
  },
  { _id: false }
);

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    logo: { type: String, default: '' },
    sheetLinks: [sheetLinkSchema],
    onboardingComplete: { type: Boolean, default: false },
    /** Rows removed by user; sync will not re-import these from Google Sheets */
    suppressedLeads: { type: [suppressedLeadSchema], default: [] },
  },
  { timestamps: true }
);

businessSchema.index({ 'suppressedLeads.sheetId': 1, 'suppressedLeads.rowKey': 1 });

module.exports = mongoose.model('Business', businessSchema);
