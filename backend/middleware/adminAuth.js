const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function adminAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Admin authentication required' });
    }

    const token = header.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Super admin access required' });
    }

    req.admin = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired admin token' });
  }
}

module.exports = adminAuth;
