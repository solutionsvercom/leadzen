const Lead = require('../models/Lead');
const Business = require('../models/Business');
const {
  fetchSheetRows,
  buildRowKey,
  parseSubmittedAt,
} = require('../utils/googleSheets');

function isSuppressed(suppressedLeads, sheetId, rowKey) {
  return (suppressedLeads || []).some((s) => s.sheetId === sheetId && s.rowKey === rowKey);
}

async function syncSheetLink(businessId, sheetLink, suppressedLeads = []) {
  const gid = sheetLink.gid && sheetLink.gid !== '0' ? sheetLink.gid : null;
  const rows = await fetchSheetRows(sheetLink.sheetId, gid);
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowKey = buildRowKey(row, i);
    const submittedAt = parseSubmittedAt(row);

    if (isSuppressed(suppressedLeads, sheetLink.sheetId, rowKey)) {
      skipped++;
      continue;
    }

    await Lead.findOneAndUpdate(
      { business: businessId, sheetId: sheetLink.sheetId, rowKey },
      {
        $set: {
          business: businessId,
          platform: sheetLink.platform,
          sheetId: sheetLink.sheetId,
          rowKey,
          data: row,
          submittedAt,
        },
        $setOnInsert: { status: 'pending' },
      },
      { upsert: true, new: true }
    );
    imported++;
  }

  return { imported, skipped };
}

async function syncAllSheets(businessId) {
  const business = await Business.findById(businessId);
  if (!business) throw new Error('Business not found');

  const results = [];

  const suppressedLeads = business.suppressedLeads || [];

  for (const link of business.sheetLinks) {
    try {
      const { imported, skipped } = await syncSheetLink(businessId, link, suppressedLeads);
      link.lastSyncedAt = new Date();
      results.push({
        sheetId: link.sheetId,
        platform: link.platform,
        count: imported,
        skipped,
        success: true,
      });
    } catch (err) {
      results.push({
        sheetId: link.sheetId,
        platform: link.platform,
        success: false,
        error: err.message,
      });
    }
  }

  business.onboardingComplete = business.sheetLinks.length > 0;
  await business.save();

  return results;
}

module.exports = { syncSheetLink, syncAllSheets };
