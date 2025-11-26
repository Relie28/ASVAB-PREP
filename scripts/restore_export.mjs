import fs from 'fs/promises';
import path from 'path';

const projectRoot = path.resolve();
const apiPath = path.join(projectRoot, 'src', 'app', 'api');
const disabledPath = path.join(projectRoot, 'scripts', '._api_disabled');

async function run() {
    try {
        await fs.access(disabledPath);
        // If api already exists (maybe someone created it), remove it first to avoid conflict
        try { await fs.access(apiPath); console.log('API path already exists, removing to restore.'); await fs.rm(apiPath, { recursive: true, force: true }); } catch (e) { }
        await fs.rename(disabledPath, apiPath);
        console.log(`Restored ${disabledPath} -> ${apiPath}`);
    } catch (e) {
        console.log('No disabled API directory present; nothing to restore.');
    }
}

run().catch((e) => { console.error('restore_export failed', e); process.exit(1); });