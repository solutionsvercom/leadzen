const Platform = require('../models/Platform');

async function getEnabledPlatformValues() {
  const platforms = await Platform.find({ enabled: true }).sort({ order: 1 });
  return platforms.map((p) => p.value);
}

async function isValidPlatform(platform) {
  const values = await getEnabledPlatformValues();
  return values.includes(String(platform).toLowerCase());
}

module.exports = { getEnabledPlatformValues, isValidPlatform };
