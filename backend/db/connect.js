const mongoose = require('mongoose');

const DEFAULT_LOCAL_URI = 'mongodb://127.0.0.1:27017/lead-management';

/**
 * Connect to MongoDB (local or Atlas mongodb+srv).
 * Atlas: allow 0.0.0.0/0 in Network Access so Hostinger can reach the cluster.
 */
async function connectDatabase() {
  const uri = (process.env.MONGODB_URI || DEFAULT_LOCAL_URI).trim();

  if (!uri) {
    throw new Error('MONGODB_URI is empty. Set it in backend/.env or Hostinger environment variables.');
  }

  const isAtlas = uri.startsWith('mongodb+srv://');

  if (process.env.NODE_ENV === 'production' && !isAtlas && !uri.includes('127.0.0.1')) {
    console.warn('Production should use MongoDB Atlas (mongodb+srv://) on Hostinger.');
  }

  const options = {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
  };

  await mongoose.connect(uri, options);

  const { host, name } = mongoose.connection;
  console.log(`MongoDB connected (${isAtlas ? 'Atlas' : 'local'}) — ${host} / ${name}`);
}

module.exports = { connectDatabase };
