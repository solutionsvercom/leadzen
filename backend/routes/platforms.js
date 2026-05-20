const express = require('express');
const Platform = require('../models/Platform');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const platforms = await Platform.find({ enabled: true }).sort({ order: 1 });
    res.json({ platforms });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
