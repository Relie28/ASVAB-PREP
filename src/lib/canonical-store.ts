// Avoid importing Node-only modules at top-level. This file is imported from both
// server and client bundles; importing 'fs' or 'path' at module load time causes
// bundlers to fail when used in client components. We dynamically import
// 'fs' and 'path' only when running on the server (Node environment).

const STORE_PATH = (typeof process !== 'undefined' && process.cwd) ? (process.cwd() + '/db/unique_signatures.json') : '/tmp/unique_signatures.json';

function ensureStoreSync() {
  // no-op in client browsers
  if (typeof window !== 'undefined') return;
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(STORE_PATH)) fs.writeFileSync(STORE_PATH, JSON.stringify([]));
  } catch (e) {
    // ignore server file system errors
  }
}

export type CanonicalStore = {
  structural: string[]
  fingerprint: string[]
  text: string[]
  embeddings?: number[][]
}

export function loadSignatures(): CanonicalStore {
  try {
    // In browser return empty canonical store instead of attempting file IO
    if (typeof window !== 'undefined') return { structural: [], fingerprint: [], text: [], embeddings: [] };
    // For server runs ensure store exists and read file
    ensureStoreSync();
    const fs = require('fs');
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    if (Array.isArray(parsed)) {
      // migrate legacy array of structural signatures into object
      return { structural: parsed, fingerprint: [], text: [], embeddings: [] };
    }
    return { structural: parsed.structural || [], fingerprint: parsed.fingerprint || [], text: parsed.text || [], embeddings: parsed.embeddings || [] };
  } catch (e) {
    return { structural: [], fingerprint: [], text: [], embeddings: [] };
  }
}

export function hasSignature(sig: string, type: 'structural' | 'fingerprint' | 'text' = 'structural') {
  try {
    const obj = loadSignatures();
    const list = obj && obj[type] ? obj[type] : [];
    return list.includes(sig);
  } catch (e) { return false; }
}

export function addSignatures(sigs: string[] = [], type: 'structural' | 'fingerprint' | 'text' = 'structural') {
  try {
    // Skip on client
    if (typeof window !== 'undefined') return false;
    // ensure store exists on server
    require('fs'); // exist check; ensureStore is async, but we keep simple here
    const curr = loadSignatures();
    const existing = new Set(curr[type] || []);
    for (const s of sigs) existing.add(s);
    curr[type] = Array.from(existing);
    // also keep other arrays as-is
    const fs = require('fs');
    fs.writeFileSync(STORE_PATH, JSON.stringify(curr));
    return true;
  } catch (e) { return false; }
}

export function addEmbeddings(newEmbeddings: number[][] = []) {
  try {
    if (typeof window !== 'undefined') return false;
    const curr = loadSignatures();
    const old = curr.embeddings || [];
    curr.embeddings = old.concat(newEmbeddings);
    const fs = require('fs');
    fs.writeFileSync(STORE_PATH, JSON.stringify(curr));
    return true;
  } catch (e) { return false; }
}

export function hasSimilarEmbedding(embedding: number[], threshold = 0.92) {
  try {
    // In browser, we don't have canonical embeddings; return false to accept candidate
    if (typeof window !== 'undefined') return false;
    const curr = loadSignatures();
    if (!curr.embeddings || curr.embeddings.length === 0) return false;
    let maxSim = -1;
    for (const e of curr.embeddings) {
      if (!e || e.length !== embedding.length) continue;
      let dot = 0;
      let a2 = 0;
      let b2 = 0;
      for (let i = 0; i < e.length; i++) {
        dot += e[i] * embedding[i];
        a2 += e[i] * e[i];
        b2 += embedding[i] * embedding[i];
      }
      const sim = dot / (Math.sqrt(a2) * Math.sqrt(b2) + 1e-12);
      if (sim > maxSim) maxSim = sim;
      if (sim >= threshold) return true;
    }
    return false;
  } catch (e) { return false; }
}

export default { loadSignatures, hasSignature, addSignatures, addEmbeddings, hasSimilarEmbedding };
