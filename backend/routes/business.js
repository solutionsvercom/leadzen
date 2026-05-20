const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const Lead = require('../models/Lead');
const Business = require('../models/Business');
const { extractSheetId, extractGid } = require('../utils/googleSheets');
const { syncAllSheets } = require('../services/syncLeads');
const { isValidPlatform } = require('../utils/platforms');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(jpe?g|png|gif|webp|svg)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Only image files are allowed for logo'));
  },
});

router.patch('/logo', auth, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Logo file is required' });
    }

    const logoPath = `/uploads/${req.file.filename}`;
    req.business.logo = logoPath;
    await req.business.save();

    res.json({ logo: logoPath });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/sheet-links', auth, async (req, res) => {
  try {
    const { links } = req.body;

    if (!Array.isArray(links) || links.length === 0) {
      return res.status(400).json({ message: 'At least one Google Sheet link is required' });
    }

    const newLinks = [];
    const seenSheetIds = new Set(
      req.business.sheetLinks.map((link) => `${link.sheetId}:${link.gid || 'default'}`)
    );

    for (const item of links) {
      const url = item.url?.trim();
      const platform = item.platform?.toLowerCase();

      if (!url || !platform || !(await isValidPlatform(platform))) {
        return res.status(400).json({
          message: 'Each link needs a valid URL and an enabled platform',
        });
      }

      const sheetId = extractSheetId(url);
      if (!sheetId) {
        return res.status(400).json({ message: `Invalid Google Sheet URL: ${url}` });
      }

      const gid = extractGid(url) || undefined;
      const dedupeKey = `${sheetId}:${gid || 'default'}`;

      if (seenSheetIds.has(dedupeKey)) {
        return res.status(400).json({
          message:
            'This Google Sheet is already added. Use one sheet (or tab) per platform — do not paste the same link multiple times.',
        });
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

    req.business.sheetLinks.push(...newLinks);
    await req.business.save();

    const syncResults = await syncAllSheets(req.business._id);

    res.json({
      sheetLinks: req.business.sheetLinks,
      syncResults,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to save sheet links' });
  }
});

router.put('/sheet-links/:linkId', auth, async (req, res) => {
  try {
    const { platform, label } = req.body;
    const validPlatforms = ['instagram', 'facebook', 'youtube', 'whatsapp'];

    if (platform && !validPlatforms.includes(platform)) {
      return res.status(400).json({ message: 'Invalid platform' });
    }

    const link = req.business.sheetLinks.id(req.params.linkId);
    if (!link) {
      return res.status(404).json({ message: 'Sheet link not found' });
    }

    if (platform) link.platform = platform;
    if (label !== undefined) link.label = label;

    await req.business.save();

    if (platform) {
      await Lead.updateMany(
        { business: req.business._id, sheetId: link.sheetId },
        { $set: { platform } }
      );
    }

    res.json({ sheetLinks: req.business.sheetLinks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/sheet-links/:linkId', auth, async (req, res) => {
  try {
    const link = req.business.sheetLinks.id(req.params.linkId);
    if (!link) {
      return res.status(404).json({ message: 'Sheet link not found' });
    }

    const sheetId = link.sheetId;
    link.deleteOne();
    req.business.suppressedLeads = (req.business.suppressedLeads || []).filter((s) => s.sheetId !== sheetId);
    await req.business.save();

    await Lead.deleteMany({ business: req.business._id, sheetId });

    res.json({ sheetLinks: req.business.sheetLinks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/complete-onboarding', auth, async (req, res) => {
  try {
    if (req.business.sheetLinks.length === 0) {
      return res.status(400).json({ message: 'Add at least one Google Sheet link first' });
    }

    req.business.onboardingComplete = true;
    await req.business.save();

    res.json({ onboardingComplete: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/profile', auth, (req, res) => {
  res.json({
    business: {
      id: req.business._id,
      name: req.business.name,
      logo: req.business.logo,
      onboardingComplete: req.business.onboardingComplete,
      sheetLinks: req.business.sheetLinks,
    },
  });
});

module.exports = router;
