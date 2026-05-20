const User = require('../models/User');
const Platform = require('../models/Platform');

const DEFAULT_PLATFORMS = [
  { value: 'instagram', label: 'Instagram', color: '#E1306C', order: 1 },
  { value: 'facebook', label: 'Facebook', color: '#1877F2', order: 2 },
  { value: 'youtube', label: 'YouTube', color: '#FF0000', order: 3 },
  { value: 'whatsapp', label: 'WhatsApp', color: '#25D366', order: 4 },
];

async function seedPlatforms() {
  for (const p of DEFAULT_PLATFORMS) {
    await Platform.findOneAndUpdate({ value: p.value }, p, { upsert: true });
  }
}

async function seedSuperAdmin() {
  const username = (process.env.ADMIN_USERNAME || 'superadmin').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const existing = await User.findOne({ username });
  if (existing) {
    if (existing.role !== 'superadmin') {
      existing.role = 'superadmin';
      existing.business = undefined;
      await existing.save();
    }
    return;
  }

  await User.create({
    name: 'Super Admin',
    username,
    password,
    role: 'superadmin',
  });

  console.log(`Super admin ready (username: ${username})`);
}

module.exports = { seedPlatforms, seedSuperAdmin, DEFAULT_PLATFORMS };
