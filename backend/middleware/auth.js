const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = header.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).populate('business');

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (user.role === 'superadmin') {
      return res.status(403).json({ message: 'Use admin portal at /admin' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: 'Account is disabled' });
    }

    if (!user.business) {
      return res.status(403).json({ message: 'Business account not configured' });
    }

    req.user = user;
    req.business = user.business;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = auth;
