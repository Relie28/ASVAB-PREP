import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

const projectRoot = path.resolve();
const apiPath = path.join(projectRoot, 'src', 'app', 'api');
const disabledPath = path.join(projectRoot, 'scripts', '._api_disabled');

async function prepare() {
  try {
    await fs.access(apiPath);
    try { await fs.access(disabledPath); console.log('Cleaning existing disabled path'); await fs.rm(disabledPath, { recursive: true, force: true }); } catch(e) {}
    await fs.rename(apiPath, disabledPath);
    console.log('API directory moved to disabled');
  } catch(e) { console.log('No API directory present; nothing to move'); }
}

async function restore() {
  try {
    await fs.access(disabledPath);
    try { await fs.access(apiPath); console.log('Cleaning existing API path'); await fs.rm(apiPath, { recursive: true, force: true }); } catch(e) {}
    await fs.rename(disabledPath, apiPath);
    console.log('API directory restored');
  } catch(e) { console.log('No disabled API directory present; nothing to restore'); }
}

function runBuild() {
  console.log('Running next build...');
  const res = spawnSync('npx', ['--no-install', 'next', 'build'], { stdio: 'inherit' });
  if (res.status !== 0) {
    const err = new Error('next build failed: ' + res.status);
    err.status = res.status;
    throw err;
  }
}

(async () => {
  await prepare();
  try {
    runBuild();
  } catch(e) {
    console.error('Build failed:', e.message || e);
    throw e;
  } finally {
    await restore();
  }
})();
