#!/usr/bin/env node
import { generateFullTestAI, backgroundRefineFullTest } from '../src/lib/question-generator';
import { structuralSignature, normalizeText } from '../src/ai/duplicates';

async function main() {
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
    // Force AI enabled to test heavy refine path
    global.localStorage.setItem('ai_enabled', 'true');
    const model = { statsByFormula: {}, preferences: { aiEnabled: true }, questionWeights: {} };
    const TIMEOUT_MS = 30 * 1000;
    const generated = await generateFullTestAI(model, { timeoutMs: 15000, fastMode: true });
    const ar = generated.arQuestions;
    const mk = generated.mkQuestions;
    function analyze(arr) {
        const sigMap = new Map();
        for (const q of arr) {
            const sig = structuralSignature(q.text || '');
            sigMap.set(sig, (sigMap.get(sig) || 0) + 1);
        }
        const duplicates = Array.from(sigMap.entries()).filter(([k, v]) => v > 1);
        return { total: arr.length, unique: sigMap.size, duplicates, sigMap };
    }
    const beforeAr = analyze(ar);
    const beforeMk = analyze(mk);
    console.log(`Before refine AR: total=${beforeAr.total} unique=${beforeAr.unique} dupGroups=${beforeAr.duplicates.length}`);
    console.log(`Before refine MK: total=${beforeMk.total} unique=${beforeMk.unique} dupGroups=${beforeMk.duplicates.length}`);
    const refined = await backgroundRefineFullTest(ar, mk, model, { timeoutMs: TIMEOUT_MS, signal: undefined, heavy: true });
    const afterAr = analyze(refined.arQuestions);
    const afterMk = analyze(refined.mkQuestions);
    console.log(`After refine AR: total=${afterAr.total} unique=${afterAr.unique} dupGroups=${afterAr.duplicates.length}`);
    console.log(`After refine MK: total=${afterMk.total} unique=${afterMk.unique} dupGroups=${afterMk.duplicates.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
