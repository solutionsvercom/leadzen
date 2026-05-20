const { parse } = require('csv-parse/sync');
const crypto = require('crypto');

function extractSheetId(url) {
  const text = String(url).trim();

  const sheetMatch = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (sheetMatch) return sheetMatch[1];

  // Google Form linked to a sheet — cannot fetch directly from form URL
  if (text.includes('/forms/')) return null;

  return null;
}

function extractGid(url) {
  const match = String(url).match(/[#?&]gid=(\d+)/);
  return match ? match[1] : null;
}

function buildFetchUrls(sheetId, gid) {
  const urls = [];

  if (gid && gid !== '0') {
    urls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`);
    urls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`);
  }

  // Omit gid=0 — Google returns HTTP 400 for many sheets when gid=0 is explicit
  urls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`);
  urls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`);

  return [...new Set(urls)];
}

async function fetchCsvText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LeadManagementApp/1.0)',
      Accept: 'text/csv,text/plain,*/*',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    return { ok: false, status: response.status, text: '' };
  }

  const text = await response.text();
  return { ok: true, status: response.status, text };
}

async function fetchSheetRows(sheetId, gid = null) {
  const urls = buildFetchUrls(sheetId, gid);
  let lastStatus = null;

  for (const url of urls) {
    const result = await fetchCsvText(url);
    lastStatus = result.status;

    if (!result.ok) continue;

    const csvText = result.text;

    if (csvText.trim().startsWith('<!DOCTYPE') || csvText.includes('<html')) {
      continue;
    }

    if (!csvText.trim()) {
      return [];
    }

    try {
      const rows = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      });
      return rows;
    } catch {
      continue;
    }
  }

  if (lastStatus === 403 || lastStatus === 401) {
    throw new Error(
      'Sheet is not publicly accessible. In Google Sheets: Share → General access → "Anyone with the link" as Viewer.'
    );
  }

  throw new Error(
    `Could not fetch sheet (HTTP ${lastStatus || 'unknown'}). Use the Google SHEET link (not the Form link). Share the sheet as "Anyone with the link" → Viewer, then try Sync again.`
  );
}

function buildRowKey(row, index) {
  const payload = JSON.stringify(row);
  return crypto.createHash('md5').update(`${index}:${payload}`).digest('hex');
}

function parseSubmittedAt(row) {
  const keys = ['Timestamp', 'timestamp', 'Submitted At', 'Date', 'date', 'Time'];
  for (const key of keys) {
    if (row[key]) {
      const d = new Date(row[key]);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

module.exports = {
  extractSheetId,
  extractGid,
  fetchSheetRows,
  buildRowKey,
  parseSubmittedAt,
};
