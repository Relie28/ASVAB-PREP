// purge.js - 2-day local memory purge for generatedProblems & problemHistory

const KEY_GENERATED = 'generatedProblems';
const KEY_HISTORY = 'problemHistory';
const KEY_LAST_PURGE = 'lastPurgeAt';

export function runAutoPurge() {
  try {
    const last = parseInt(localStorage.getItem(KEY_LAST_PURGE) || '0', 10) || 0;
    const now = Date.now();
    const HOURS_48 = 48 * 60 * 60 * 1000;
    if (!last || (now - last) > HOURS_48) {
      localStorage.removeItem(KEY_GENERATED);
      localStorage.removeItem(KEY_HISTORY);
      localStorage.setItem(KEY_LAST_PURGE, String(now));
      // keep adaptive model and attempt log intact
    }
  } catch (e) {
    // ignore
  }
}

export default { runAutoPurge };
