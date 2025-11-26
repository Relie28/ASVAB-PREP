import fs from 'fs/promises';
import path from 'path';

const projectRoot = path.resolve();
const apiPath = path.join(projectRoot, 'src', 'app', 'api');
const disabledPath = path.join(projectRoot, 'scripts', '._api_disabled');

async function run() {
  try {
    await fs.access(apiPath);
    // If disabled already exists, remove it first (shouldn't happen normally)
    try { await fs.access(disabledPath); console.log('Disabled API path already exists, removing.'); await fs.rm(disabledPath, { recursive: true, force: true }); } catch (e) { }
    await fs.rename(apiPath, disabledPath);
    console.log(`Moved ${apiPath} -> ${disabledPath}`);
  } catch (e) {
    console.log('No API directory present; nothing to move.');
  }
}

run().catch((e) => { console.error('prepare_export failed', e); process.exit(1); });