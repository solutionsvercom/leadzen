const express = require('express');
const User = require('../models/User');
const Business = require('../models/Business');
const Lead = require('../models/Lead');
const Platform = require('../models/Platform');
const adminAuth = require('../middleware/adminAuth');
const { extractSheetId, extractGid } = require('../utils/googleSheets');
const { syncAllSheets } = require('../services/syncLeads');
const { isValidPlatform } = require('../utils/platforms');
const { mergeBusinessPeriodFilter, isValidPeriod, PERIOD_LABELS } = require('../utils/periodFilter');

const router = express.Router();

router.use(adminAuth);

async function getClientStats(businessId, period = 'all') {
  const match = mergeBusinessPeriodFilter(businessId, period);
  const [platformStats, statusStats, leadCount] = await Promise.all([
    Lead.aggregate([{ $match: match }, { $group: { _id: '$platform', count: { $sum: 1 } } }]),
    Lead.aggregate([
      { $match: match },
      { $group: { _id: { $ifNull: ['$status', 'pending'] }, count: { $sum: 1 } } },
    ]),
    Lead.countDocuments(match),
  ]);

  const platformCounts = {};
  platformStats.forEach((s) => {
    platformCounts[s._id] = s.count;
  });

  const statusCounts = { pending: 0, contacted: 0, converted: 0 };
  statusStats.forEach((s) => {
    if (s._id) statusCounts[s._id] = s.count;
  });

  return { platformCounts, statusCounts, leadCount };
}

router.get('/clients', async (req, res) => {
  try {
    const periodKey = isValidPeriod(req.query.period) ? req.query.period || 'all' : 'all';
    const users = await User.find({
      $or: [{ role: 'user' }, { role: { $exists: false }, business: { $exists: true, $ne: null } }],
    })
      .populate('business')
      .sort({ createdAt: -1 });

    const clients = await Promise.all(
      users.map(async (user) => {
        const stats = user.business ? await getClientStats(user.business._id, periodKey) : { leadCount: 0 };
        return {
          userId: user._id,
          name: user.name,
          username: user.username,
          isActive: user.isActive,
          createdAt: user.createdAt,
          business: user.business
            ? {
                id: user.business._id,
                name: user.business.name,
                logo: user.business.logo,
                onboardingComplete: user.business.onboardingComplete,
                sheetLinksCount: user.business.sheetLinks?.length || 0,
                sheetLinks: user.business.sheetLinks,
              }
            : null,
          leadCount: stats.leadCount,
          platformCounts: stats.platformCounts,
        };
      })
    );

    res.json({
      clients,
      period: periodKey,
      periodLabel: PERIOD_LABELS[periodKey] || PERIOD_LABELS.all,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/clients/:businessId', async (req, res) => {
  try {
    const periodKey = isValidPeriod(req.query.period) ? req.query.period || 'all' : 'all';
    const business = await Business.findById(req.params.businessId);
    if (!business) return res.status(404).json({ message: 'Client not found' });

    const user = await User.findOne({
      business: business._id,
      $or: [{ role: 'user' }, { role: { $exists: false } }],
    });
    const stats = await getClientStats(business._id, periodKey);
    const leadMatch = mergeBusinessPeriodFilter(business._id, periodKey);
    const leads = await Lead.find(leadMatch).sort({ submittedAt: -1, createdAt: -1 }).limit(500);

    res.json({
      user: user
        ? {
            id: user._id,
            name: user.name,
            username: user.username,
            isActive: user.isActive,
            signUpPaymentRef: user.signUpPaymentRef || undefined,
          }
        : null,
      business,
      leads,
      ...stats,
      period: periodKey,
      periodLabel: PERIOD_LABELS[periodKey] || PERIOD_LABELS.all,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/users/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user || user.role !== 'user') {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, username, password, isActive } = req.body;
    if (name) user.name = name.trim();
    if (username) user.username = username.toLowerCase().trim();
    if (password) user.password = password;
    if (typeof isActive === 'boolean') user.isActive = isActive;

    await user.save();
    res.json({ message: 'User updated', user: { id: user._id, name: user.name, username: user.username, isActive: user.isActive } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/clients/:businessId', async (req, res) => {
  try {
    const business = await Business.findById(req.params.businessId);
    if (!business) return res.status(404).json({ message: 'Client not found' });

    const { name, onboardingComplete, logo } = req.body;
    if (name) business.name = name.trim();
    if (typeof onboardingComplete === 'boolean') business.onboardingComplete = onboardingComplete;
    if (logo !== undefined) business.logo = logo;

    await business.save();
    res.json({ business });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/clients/:businessId/sheet-links', async (req, res) => {
  try {
    const business = await Business.findById(req.params.businessId);
    if (!business) return res.status(404).json({ message: 'Client not found' });

    const { url, platform, label } = req.body;
    if (!url?.trim() || !platform) {
      return res.status(400).json({ message: 'URL and platform are required' });
    }

    if (!(await isValidPlatform(platform))) {
      return res.status(400).json({ message: 'Invalid or disabled platform' });
    }

    const sheetId = extractSheetId(url);
    if (!sheetId) return res.status(400).json({ message: 'Invalid Google Sheet URL' });

    const gid = extractGid(url) || undefined;
    const dedupeKey = `${sheetId}:${gid || 'default'}`;
    const exists = business.sheetLinks.some((l) => `${l.sheetId}:${l.gid || 'default'}` === dedupeKey);
    if (exists) {
      return res.status(400).json({ message: 'This sheet is already linked for this client' });
    }

    business.sheetLinks.push({
      url: url.trim(),
      platform: platform.toLowerCase(),
      sheetId,
      gid,
      label: label?.trim() || platform,
    });
    await business.save();

    const syncResults = await syncAllSheets(business._id);
    res.json({ business, syncResults });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/clients/:businessId/sheet-links/:linkId', async (req, res) => {
  try {
    const business = await Business.findById(req.params.businessId);
    if (!business) return res.status(404).json({ message: 'Client not found' });

    const link = business.sheetLinks.id(req.params.linkId);
    if (!link) return res.status(404).json({ message: 'Sheet link not found' });

    const { url, platform, label } = req.body;
    if (platform && !(await isValidPlatform(platform))) {
      return res.status(400).json({ message: 'Invalid or disabled platform' });
    }
    if (url) {
      const sheetId = extractSheetId(url);
      if (!sheetId) return res.status(400).json({ message: 'Invalid Google Sheet URL' });
      link.url = url.trim();
      link.sheetId = sheetId;
      link.gid = extractGid(url) || undefined;
    }
    if (platform) {
      link.platform = platform.toLowerCase();
      await Lead.updateMany({ business: business._id, sheetId: link.sheetId }, { $set: { platform: link.platform } });
    }
    if (label !== undefined) link.label = label.trim();

    await business.save();
    res.json({ business });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/clients/:businessId/sheet-links/:linkId', async (req, res) => {
  try {
    const business = await Business.findById(req.params.businessId);
    if (!business) return res.status(404).json({ message: 'Client not found' });

    const link = business.sheetLinks.id(req.params.linkId);
    if (!link) return res.status(404).json({ message: 'Sheet link not found' });

    const sheetId = link.sheetId;
    link.deleteOne();
    business.suppressedLeads = (business.suppressedLeads || []).filter((s) => s.sheetId !== sheetId);
    await business.save();
    await Lead.deleteMany({ business: business._id, sheetId });

    res.json({ business });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/clients/:businessId/sync', async (req, res) => {
  try {
    const business = await Business.findById(req.params.businessId);
    if (!business) return res.status(404).json({ message: 'Client not found' });

    const syncResults = await syncAllSheets(business._id);
    res.json({ syncResults });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/clients/:businessId', async (req, res) => {
  try {
    const business = await Business.findById(req.params.businessId);
    if (!business) return res.status(404).json({ message: 'Client not found' });

    await Lead.deleteMany({ business: business._id });
    await User.deleteMany({ business: business._id });
    await Business.deleteOne({ _id: business._id });

    res.json({ message: 'Client and all data deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/platforms', async (_req, res) => {
  try {
    const platforms = await Platform.find().sort({ order: 1 });
    res.json({ platforms });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/platforms', async (req, res) => {
  try {
    const { value, label, color, enabled, order } = req.body;
    if (!value?.trim() || !label?.trim()) {
      return res.status(400).json({ message: 'Value and label are required' });
    }

    const platform = await Platform.create({
      value: value.toLowerCase().trim(),
      label: label.trim(),
      color: color || '#2563eb',
      enabled: enabled !== false,
      order: order ?? 0,
    });

    res.status(201).json({ platform });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/platforms/:id', async (req, res) => {
  try {
    const platform = await Platform.findById(req.params.id);
    if (!platform) return res.status(404).json({ message: 'Platform not found' });

    const { label, color, enabled, order } = req.body;
    if (label) platform.label = label.trim();
    if (color) platform.color = color;
    if (typeof enabled === 'boolean') platform.enabled = enabled;
    if (order !== undefined) platform.order = order;

    await platform.save();
    res.json({ platform });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/platforms/:id', async (req, res) => {
  try {
    const platform = await Platform.findByIdAndDelete(req.params.id);
    if (!platform) return res.status(404).json({ message: 'Platform not found' });
    res.json({ message: 'Platform deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
