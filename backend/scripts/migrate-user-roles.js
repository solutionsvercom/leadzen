require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Business = require('../models/Business');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const result = await User.updateMany(
    { role: { $exists: false }, business: { $exists: true, $ne: null } },
    { $set: { role: 'user', isActive: true } }
  );

  console.log(`Migrated ${result.modifiedCount} user(s) to role "user"`);

  const vinay = await User.findOne({ username: 'vinaytomar98@gmail.com' }).populate('business');
  if (vinay) {
    if (!vinay.role) {
      vinay.role = 'user';
      vinay.isActive = true;
      await vinay.save();
      console.log('Updated vinaytomar98@gmail.com');
    }
    console.log('Vinay business:', vinay.business?.name);
    console.log('Sheet links:', vinay.business?.sheetLinks?.length ?? 0);
  } else {
    console.log('vinaytomar98@gmail.com not found');
  }

  const count = await User.countDocuments({ role: 'user' });
  console.log('Total clients (role=user):', count);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
