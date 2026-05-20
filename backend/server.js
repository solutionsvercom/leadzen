require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const businessRoutes = require('./routes/business');
const leadsRoutes = require('./routes/leads');
const platformsRoutes = require('./routes/platforms');
const adminRoutes = require('./routes/admin');
const { seedPlatforms, seedSuperAdmin } = require('./services/seedDefaults');

const app = express();
const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || '0.0.0.0';
const serveFrontend =
  process.env.NODE_ENV === 'production' || process.env.SERVE_FRONTEND === '1';

if (serveFrontend) {
  app.set('trust proxy', 1);
}

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/platforms', platformsRoutes);
app.use('/api/admin', adminRoutes);

if (serveFrontend) {
  const publicDir = path.join(__dirname, 'public');
  const indexHtml = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(publicDir, { index: false }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
      }
      res.sendFile(indexHtml);
    });
  } else {
    console.warn(
      'SERVE_FRONTEND is on but backend/public is missing. Run: npm run build (from project root or frontend/)'
    );
  }
}

app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

async function start() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lead-management';

  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected');

    const Lead = require('./models/Lead');
    const migrated = await Lead.updateMany(
      { $or: [{ status: { $exists: false } }, { status: null }] },
      { $set: { status: 'pending' } }
    );
    if (migrated.modifiedCount > 0) {
      console.log(`Set default status "pending" on ${migrated.modifiedCount} existing leads`);
    }

    const User = require('./models/User');
    const roleMigrated = await User.updateMany(
      { role: { $exists: false }, business: { $exists: true, $ne: null } },
      { $set: { role: 'user', isActive: true } }
    );
    if (roleMigrated.modifiedCount > 0) {
      console.log(`Set role "user" on ${roleMigrated.modifiedCount} existing account(s)`);
    }

    await seedPlatforms();
    await seedSuperAdmin();
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, HOST, () => {
    const mode = serveFrontend ? 'API + frontend' : 'API only';
    console.log(`Server running (${mode}) on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `Port ${PORT} is already in use. Stop the other process or set PORT in backend/.env to a different value.`
      );
      console.error(`Windows: netstat -ano | findstr :${PORT}  then  taskkill /PID <pid> /F`);
    } else {
      console.error('Server failed to start:', err.message);
    }
    process.exit(1);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down...`);
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
