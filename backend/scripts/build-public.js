/**
 * Build React app into backend/public (requires frontend/ sibling folder).
 * Run from backend: npm run build
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, '..', '..', 'frontend');
const pkg = path.join(frontendDir, 'package.json');

if (!fs.existsSync(pkg)) {
  console.error('frontend/ not found. Build from monorepo root: npm run build');
  process.exit(1);
}

console.log('Building frontend → backend/public ...');
execSync('npm run build', { cwd: frontendDir, stdio: 'inherit', env: process.env });
console.log('Done. Deploy the backend/ folder (includes public/).');
