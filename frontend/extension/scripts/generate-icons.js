/**
 * Generate placeholder PNG icons for the browser extension
 * Creates simple colored squares with text labels
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Minimal PNG data for colored squares with "FNO" text
// These are base64-encoded 1x1 pixel PNGs that will be scaled
const createMinimalPNG = (size) => {
  // This is a minimal valid PNG file (1x1 blue pixel)
  // In a real implementation, you'd use a library like 'pngjs' or 'sharp'
  const base64PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  return Buffer.from(base64PNG, 'base64');
};

const publicDir = path.join(__dirname, '..', 'public');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate icons
const sizes = [16, 48, 128];

sizes.forEach(size => {
  const iconPath = path.join(publicDir, `icon-${size}.png`);
  const pngData = createMinimalPNG(size);
  fs.writeFileSync(iconPath, pngData);
  console.log(`Created ${iconPath}`);
});

console.log('\nPlaceholder icons created successfully!');
console.log('Note: These are minimal placeholder PNGs. For production, replace with proper branded icons.');
