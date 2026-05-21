const { extractSheetId, extractGid } = require('../utils/googleSheets');
const { isValidPlatform } = require('../utils/platforms');
const { syncAllSheets } = require('./syncLeads');

/**
 * Validate and append sheet links to a business, then sync leads.
 * @param {import('../models/Business')} business
 * @param {Array<{ url: string, platform: string, label?: string }>} links
 */
async function applySheetLinks(business, links) {
  if (!Array.isArray(links) || links.length === 0) {
    const err = new Error('At least one Google Sheet link is required');
    err.status = 400;
    throw err;
  }

  const newLinks = [];
  const seenSheetIds = new Set(
    business.sheetLinks.map((link) => `${link.sheetId}:${link.gid || 'default'}`)
  );

  for (const item of links) {
    const url = item.url?.trim();
    const platform = item.platform?.toLowerCase();

    if (!url || !platform || !(await isValidPlatform(platform))) {
      const err = new Error('Each link needs a valid URL and an enabled platform');
      err.status = 400;
      throw err;
    }

    const sheetId = extractSheetId(url);
    if (!sheetId) {
      const err = new Error(`Invalid Google Sheet URL: ${url}`);
      err.status = 400;
      throw err;
    }

    const gid = extractGid(url) || undefined;
    const dedupeKey = `${sheetId}:${gid || 'default'}`;

    if (seenSheetIds.has(dedupeKey)) {
      const err = new Error(
        'This Google Sheet is already added. Use one sheet (or tab) per platform — do not paste the same link multiple times.'
      );
      err.status = 400;
      throw err;
    }

    seenSheetIds.add(dedupeKey);

    newLinks.push({
      url,
      platform,
      sheetId,
      gid,
      label: item.label?.trim() || platform,
    });
  }

  business.sheetLinks.push(...newLinks);
  await business.save();

  const syncResults = await syncAllSheets(business._id);

  return { sheetLinks: business.sheetLinks, syncResults };
}

module.exports = { applySheetLinks };
