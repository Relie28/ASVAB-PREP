// duplicates.js - fuzzy duplicate prevention

function levenshtein(a, b) {
    if (!a || !b) return (a || '').length + (b || '').length;
    const m = a.length,
        n = b.length;
    const d = Array.from({ length: m + 1 }, () => new Array(n + 1));
    for (let i = 0; i <= m; i++) d[i][0] = i;
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        }
    }
    return d[m][n];
}

export function similarity(a, b) {
    if (!a || !b) return 0;
    a = a.toLowerCase();
    b = b.toLowerCase();
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    const dist = levenshtein(a, b);
    return 1 - dist / maxLen;
}

// Very simple normalization to reduce punctuation noise
export function normalizeText(s = '') {
    return s.replace(/[.,;:?()\"'!]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function extractNumbers(text = '') {
    return (text || '').match(/-?\d+(?:\.\d+)?/g) || [];
}

export function extractNames(text = '') {
    // Simple heuristics: capitalized words that are not at sentence start and short
    const names = [];
    (text || '').split(/\s+/).forEach((w, i) => {
        if (w && /^[A-Z][a-z]{1,10}$/.test(w)) {
            names.push(w.replace(/[^A-Za-z]/g, ''));
        }
    });
    return names;
}

export function structuralSignature(text = '') {
    if (!text) return '';
    let s = text;
    // replace numbers
    s = s.replace(/-?\d+(?:\.\d+)?/g, 'NUM');
    // replace capitalized names with NAME
    s = s.replace(/\b[A-Z][a-z]{1,10}\b/g, 'NAME');
    // collapse whitespace and lowercase
    s = normalizeText(s);
    return s;
}

export function tokenFingerprint(text = '', n = 100) {
    // very simple token count fingerprint normalized into a short string
    const toks = normalizeText(text).split(/\s+/).filter(Boolean);
    const map = {};
    toks.forEach(t => map[t] = (map[t] || 0) + 1);
    // sort tokens by alphabet and stringify top n
    const parts = Object.keys(map).sort().slice(0, n).map(k => `${k}:${map[k]}`);
    return parts.join('|');
}

export function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB) return 0;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += (vecA[i] || 0) * (vecB[i] || 0);
        magA += (vecA[i] || 0) * (vecA[i] || 0);
        magB += (vecB[i] || 0) * (vecB[i] || 0);
    }
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export async function computeEmbedding(text = '', options = {}) {
    // Try to use Grok SDK if available; fall back to token vectorization
    try {
        if (typeof window !== 'undefined') {
            const mod = await eval('import("z-ai-web-dev-sdk")');
            if (mod && typeof mod.embed === 'function') {
                const res = await mod.embed({ model: 'grok', text });
                if (res && Array.isArray(res.embedding)) return res.embedding;
            }
        } else {
            // Server-side: optionally call a configured AI endpoint to compute embeddings
            const ep = (options && options.endpoint) || process.env.AI_ENDPOINT || process.env.NEXT_PUBLIC_AI_ENDPOINT;
            if (ep) {
                try {
                    // If the endpoint is the same style as used elsewhere, allow body { text }
                    const url = ep.endsWith('/embed') ? ep : `${ep.replace(/\/$/, '')}/embed`;
                    const fetchResp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
                    if (fetchResp.ok) {
                        const data = await fetchResp.json();
                        if (Array.isArray(data.embedding)) return data.embedding;
                        if (data && data.data && Array.isArray(data.data[0] && data.data[0].embedding)) return data.data[0].embedding;
                    }
                } catch (e) {
                    // ignore and fallback
                }
            }
        }
    } catch (e) {
        // ignore and fallback
    }
    // fallback vector: top 64 tokens map to buckets
    const toks = normalizeText(text).split(/\s+/).filter(Boolean);
    const vocab = {};
    toks.forEach(t => vocab[t] = (vocab[t] || 0) + 1);
    const keys = Object.keys(vocab).sort().slice(0, 64);
    const vec = keys.map(k => vocab[k]);
    while (vec.length < 64) vec.push(0);
    return vec;
}


function jaccardSimilarity(a = '', b = '') {
    const sa = new Set((a || '').split(/\s+/).filter(Boolean));
    const sb = new Set((b || '').split(/\s+/).filter(Boolean));
    if (!sa.size || !sb.size) return 0;
    let inter = 0;
    for (const t of sa) if (sb.has(t)) inter++;
    const union = sa.size + sb.size - inter;
    return union === 0 ? 0 : inter / union;
}

function canonicalizeNumbers(text = '') {
    // Replace sequences of digits with a placeholder to avoid numeric paraphrase issues
    return (text || '').replace(/-?\d+(?:\.\d+)?/g, 'NUM');
}

export function isDuplicate(existingList, newProblem, threshold = 0.65) {
    try {
        const newText = normalizeText(newProblem.problem || newProblem);
        const newCanon = normalizeText(canonicalizeNumbers(newText));
        const newSig = structuralSignature(newText);
        const newNums = extractNumbers(newText);
        const newNames = extractNames(newText);
        const newFinger = tokenFingerprint(newText);
        const newEmbed = newProblem.embedding || null;
        for (const item of existingList || []) {
            const existingText = normalizeText(item.problem || item);
            const existingCanon = normalizeText(canonicalizeNumbers(existingText));
            const existingSig = structuralSignature(existingText);
            const existingNums = extractNumbers(existingText);
            const existingNames = extractNames(existingText);
            const existingFinger = tokenFingerprint(existingText);
            const existingEmbed = item.embedding || null;
            if (!existingText) continue;
            // string similarity check
            const sim = similarity(existingText, newText);
            if (sim >= Math.max(0.75, threshold)) return true;
            // structural signature equality
            if (existingSig === newSig) return true;
            // Jaccard word set similarity check (paraphrase tolerance)
            const jac = jaccardSimilarity(existingText, newText);
            if (jac >= 0.78) return true;
            // numeric exact equality or significant overlap
            const setA = new Set(newNums);
            const setB = new Set(existingNums);
            const interNums = [...setA].filter(x => setB.has(x));
            if (interNums.length && interNums.length >= Math.min(2, Math.max(1, Math.min(setA.size, setB.size)))) return true;
            // Names overlap
            const nameIntersect = newNames.filter(n => existingNames.includes(n));
            if (nameIntersect.length >= 1) return true;
            // token fingerprint equality
            if (existingFinger === newFinger) return true;
            // semantic embeddings compare if available
            if (existingEmbed && newEmbed) {
                const cs = cosineSimilarity(existingEmbed, newEmbed);
                if (cs >= 0.85) return true;
            }
            // canonicalized numbers equality check
            if (existingCanon && existingCanon === newCanon) return true;
            // number pattern check - test if numbers repeated and similar
            const numsA = (existingText.match(/-?\d+(?:\.\d+)?/g) || []).join(',');
            const numsB = (newText.match(/-?\d+(?:\.\d+)?/g) || []).join(',');
            if (numsA && numsB && numsA === numsB) return true;
        }
    } catch (e) {
        // be conservative and assume not duplicate
    }
    return false;
}

// Export for tests
export default { levenshtein, similarity, isDuplicate, normalizeText };
