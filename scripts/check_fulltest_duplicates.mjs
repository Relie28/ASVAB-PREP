#!/usr/bin/env node
import { generateFullTestAI } from '../src/lib/question-generator';
import { normalizeText, structuralSignature, tokenFingerprint } from '../src/ai/duplicates';

async function main() {
    console.log('Generating a full AI test...');
    // Provide a minimal mock adaptive model to avoid client-side localStorage access in node
    // Setup a simple localStorage shim so helpers that expect localStorage don't crash
    if (typeof global.localStorage === 'undefined') {
        global.localStorage = (function () {
            const map = new Map();
            return {
                getItem(k) { return map.has(k) ? map.get(k) : null; },
                setItem(k, v) { map.set(k, String(v)); },
                removeItem(k) { map.delete(k); }
            };
        })();
    }
    // Force AI disabled: ensure we use deterministic fallback generators to avoid network/SDK latency during diagnostics
    global.localStorage.setItem('ai_enabled', 'false');
    const model = {
        statsByFormula: {},
        questionWeights: {},
        statsByCategory: { AR: { attempts: 0, correct: 0, avgTimeMs: 0, lastAttemptAt: null, streak: 0 }, MK: { attempts: 0, correct: 0, avgTimeMs: 0, lastAttemptAt: null, streak: 0 } },
        // Ensure model hints AI disabled to use fallback batch generator path even when window is undefined
        preferences: { aiEnabled: false },
        lastSession: { timestamp: Date.now(), mode: 'AR' }
    };
    const TIMEOUT_SECONDS = Math.max(10, parseInt(process.env.AI_TEST_TIMEOUT || '30', 10));
    // Wrap generation with a timeout to avoid long hangs. Force exit on timeout to avoid linger.
    const genPromise = generateFullTestAI(model, { timeoutMs: TIMEOUT_SECONDS * 1000, fastMode: true });
    let arQuestions, mkQuestions;
    let timedOut = false;
    const timeoutHandle = setTimeout(() => {
        timedOut = true;
        console.error(`ERROR: generateFullTestAI timed out after ${TIMEOUT_SECONDS}s. Forcing exit.`);
        // Force exit (no graceful cleanup) to ensure the script doesn't linger when AI calls hang
        process.exit(1);
    }, TIMEOUT_SECONDS * 1000);
    try {
        const result = await Promise.race([
            genPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(`generateFullTestAI timed out after ${TIMEOUT_SECONDS}s`)), (TIMEOUT_SECONDS + 1) * 1000))
        ]);
        ({ arQuestions, mkQuestions } = result);
        if (!timedOut) clearTimeout(timeoutHandle);
    } catch (err) {
        if (!timedOut) clearTimeout(timeoutHandle);
        console.error('Error during test generation:', err.message || err);
        process.exit(1);
        return;
    }
    function analyze(arr) {
        const map = new Map();
        const sigMap = new Map();
        const fpMap = new Map();
        for (const q of arr) {
            const text = (q.text || q.problem || q.question || '');
            const n = normalizeText(text);
            const sig = structuralSignature(text);
            const fp = tokenFingerprint(text);
            map.set(n, (map.get(n) || 0) + 1);
            sigMap.set(sig, (sigMap.get(sig) || 0) + 1);
            fpMap.set(fp, (fpMap.get(fp) || 0) + 1);
        }
        const duplicates = Array.from(map.entries()).filter(([k, v]) => v > 1);
        const sigDuplicates = Array.from(sigMap.entries()).filter(([k, v]) => v > 1);
        const fpDuplicates = Array.from(fpMap.entries()).filter(([k, v]) => v > 1);
        return { total: arr.length, unique: map.size, duplicates, sigDuplicates, fpDuplicates };
    }
    const ar = analyze(arQuestions);
    const mk = analyze(mkQuestions);
    console.log('AR: total=%d unique=%d duplicates=%d', ar.total, ar.unique, ar.duplicates.length);
    if (ar.sigDuplicates.length) console.log('AR structural duplicates sample:', ar.sigDuplicates.slice(0, 5));
    if (ar.fpDuplicates.length) console.log('AR fingerprint duplicates sample:', ar.fpDuplicates.slice(0, 5));
    if (ar.duplicates.length) console.log('AR duplicates sample:', ar.duplicates.slice(0, 5));
    console.log('MK: total=%d unique=%d duplicates=%d', mk.total, mk.unique, mk.duplicates.length);
    if (mk.sigDuplicates.length) console.log('MK structural duplicates sample:', mk.sigDuplicates.slice(0, 5));
    if (mk.fpDuplicates.length) console.log('MK fingerprint duplicates sample:', mk.fpDuplicates.slice(0, 5));
    if (mk.duplicates.length) console.log('MK duplicates sample:', mk.duplicates.slice(0, 5));
    const combined = [...arQuestions, ...mkQuestions];
    const comb = analyze(combined);
    console.log('Combined: total=%d unique=%d duplicates=%d', comb.total, comb.unique, comb.duplicates.length);
    if (comb.sigDuplicates.length) console.log('Combined structural duplicates sample:', comb.sigDuplicates.slice(0, 5));
    if (comb.fpDuplicates.length) console.log('Combined fingerprint duplicates sample:', comb.fpDuplicates.slice(0, 5));
}

main().catch(err => { console.error(err); process.exit(1); });
