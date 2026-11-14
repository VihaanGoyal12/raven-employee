import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = process.cwd();
const resDir = path.join(root, 'resources');
if (!fs.existsSync(resDir)) {
    fs.mkdirSync(resDir, { recursive: true });
}

const apps = [
    { dir: 'app/salesorders/webapp', zip: 'ravensalessalesorders.zip' },
    { dir: 'app/inventory/webapp', zip: 'raveninventory.zip' },
    { dir: 'app/fulfillmentcockpit/webapp', zip: 'ravenfulfillmentcockpit.zip' },
    { dir: 'app/fulfillmentsummary/webapp', zip: 'ravenfulfillmentsummary.zip' }
];

for (const app of apps) {
    const fullDir = path.join(root, app.dir);
    const zipPath = path.join(resDir, app.zip);
    if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
    }
    execSync(`zip -r "${zipPath}" .`, { cwd: fullDir, stdio: 'ignore' });
    console.log(`Successfully packaged ${app.zip}`);
}
