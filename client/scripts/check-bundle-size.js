import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distAssets = path.resolve(__dirname, '../dist/assets');

if (fs.existsSync(distAssets)) {
  const files = fs.readdirSync(distAssets);
  let hasOversized = false;
  const LIMIT_KB = 250;

  for (const file of files) {
    if (file.endsWith('.js')) {
      const stats = fs.statSync(path.join(distAssets, file));
      const sizeKB = stats.size / 1024;
      if (sizeKB > LIMIT_KB) {
        console.warn(`[Bundle Warning] ${file} is ${sizeKB.toFixed(2)} KB (limit: ${LIMIT_KB} KB)`);
        hasOversized = true;
      }
    }
  }

  if (!hasOversized) {
    console.log('✓ All client bundle chunks are within size limits');
  }
}
