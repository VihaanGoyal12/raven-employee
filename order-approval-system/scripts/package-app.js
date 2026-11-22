import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = process.cwd();
const resDir = path.join(root, 'resources');
const distDir = path.join(root, 'app/salesorders/dist');
const webappDir = path.join(root, 'app/salesorders/webapp');

fs.mkdirSync(resDir, { recursive: true });
fs.mkdirSync(distDir, { recursive: true });

// Clean rogue files/folders if present from earlier failed attempts
for (const rogue of ['*', '&&', '-r', 'cp']) {
  const p1 = path.join(webappDir, rogue);
  if (fs.existsSync(p1)) fs.rmSync(p1, { recursive: true, force: true });
  const p2 = path.join(root, 'app/salesorders', rogue);
  if (fs.existsSync(p2)) fs.rmSync(p2, { recursive: true, force: true });
}

// Create zip in dist and copy to resources
const zipInDist = path.join(distDir, 'orderapprovalsalesorders.zip');
const zipInRes = path.join(resDir, 'orderapprovalsalesorders.zip');

if (fs.existsSync(zipInDist)) fs.unlinkSync(zipInDist);
if (fs.existsSync(zipInRes)) fs.unlinkSync(zipInRes);

execSync(`zip -r "${zipInDist}" .`, { cwd: webappDir, stdio: 'inherit' });
fs.copyFileSync(zipInDist, zipInRes);
console.log('Successfully packaged orderapprovalsalesorders.zip into dist/ and resources/');
