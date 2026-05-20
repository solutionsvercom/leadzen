require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Business = require('../models/Business');
const Lead = require('../models/Lead');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const users = await User.find().populate('business');
  console.log(
    'Users found:',
    users.map((u) => ({ username: u.username, name: u.name, business: u.business?.name }))
  );

  for (const user of users) {
    const businessId = user.business?._id;
    const logo = user.business?.logo;

    if (businessId) {
      const leads = await Lead.deleteMany({ business: businessId });
      await Business.deleteOne({ _id: businessId });
      console.log(`Deleted business "${user.business.name}" and ${leads.deletedCount} leads`);
    }

    await User.deleteOne({ _id: user._id });
    console.log(`Deleted user "${user.username}"`);

    if (logo && logo.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', logo);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted logo file: ${logo}`);
      }
    }
  }

  console.log('Done. Database cleared for fresh start.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
