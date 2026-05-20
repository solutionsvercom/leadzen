const express = require('express');
const auth = require('../middleware/auth');
const Lead = require('../models/Lead');
const Business = require('../models/Business');
const { syncAllSheets } = require('../services/syncLeads');
const { mergeBusinessPeriodFilter, isValidPeriod, PERIOD_LABELS } = require('../utils/periodFilter');

const router = express.Router();
const VALID_STATUSES = ['pending', 'contacted', 'converted'];

function buildStatusFilter(status) {
  if (status === 'pending') {
    return {
      $or: [{ status: 'pending' }, { status: { $exists: false } }, { status: null }],
    };
  }
  return { status };
}

router.get('/', auth, async (req, res) => {
  try {
    const { platform, status, search, page = 1, limit = 7, period = 'all' } = req.query;
    const periodKey = isValidPeriod(period) ? period || 'all' : 'all';
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(50, Math.max(1, Number(limit) || 7));
    const andConditions = [mergeBusinessPeriodFilter(req.business._id, periodKey)];

    if (platform && platform !== 'all') {
      andConditions.push({ platform });
    }

    if (status && status !== 'all' && VALID_STATUSES.includes(status)) {
      andConditions.push(buildStatusFilter(status));
    }

    if (search?.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      andConditions.push({
        $or: [
          { 'data.Name': regex },
          { 'data.name': regex },
          { 'data.Email': regex },
          { 'data.email': regex },
          { 'data.Phone': regex },
          { 'data.phone': regex },
          { 'data.Mobile': regex },
          { 'data.WhatsApp': regex },
        ],
      });
    }

    const filter = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

    const skip = (pageNum - 1) * limitNum;
    const [leads, total, platformStats, statusStats] = await Promise.all([
      Lead.find(filter).sort({ submittedAt: -1, createdAt: -1 }).skip(skip).limit(limitNum),
      Lead.countDocuments(filter),
      Lead.aggregate([
        { $match: mergeBusinessPeriodFilter(req.business._id, periodKey) },
        { $group: { _id: '$platform', count: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: mergeBusinessPeriodFilter(req.business._id, periodKey) },
        {
          $group: {
            _id: { $ifNull: ['$status', 'pending'] },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const platformCounts = {
      instagram: 0,
      facebook: 0,
      youtube: 0,
      whatsapp: 0,
      total: 0,
    };
    platformStats.forEach((s) => {
      platformCounts[s._id] = s.count;
      platformCounts.total += s.count;
    });

    const statusCounts = {
      pending: 0,
      contacted: 0,
      converted: 0,
    };
    statusStats.forEach((s) => {
      if (s._id && statusCounts[s._id] !== undefined) {
        statusCounts[s._id] = s.count;
      }
    });

    const totalPages = Math.max(1, Math.ceil(total / limitNum));

    res.json({
      leads,
      total,
      platformCounts,
      statusCounts,
      page: Math.min(pageNum, totalPages),
      limit: limitNum,
      totalPages,
      period: periodKey,
      periodLabel: PERIOD_LABELS[periodKey] || PERIOD_LABELS.all,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Status must be pending, contacted, or converted' });
    }

    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, business: req.business._id },
      { status },
      { new: true }
    );

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.json({ lead });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const lead = await Lead.findOneAndDelete({ _id: req.params.id, business: req.business._id });

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    await Business.updateOne(
      { _id: req.business._id },
      {
        $addToSet: {
          suppressedLeads: { sheetId: lead.sheetId, rowKey: lead.rowKey },
        },
      }
    );

    res.json({ message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/sync', auth, async (req, res) => {
  try {
    if (req.business.sheetLinks.length === 0) {
      return res.status(400).json({ message: 'No Google Sheet links configured' });
    }

    const syncResults = await syncAllSheets(req.business._id);
    res.json({ syncResults });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Sync failed' });
  }
});

module.exports = router;
