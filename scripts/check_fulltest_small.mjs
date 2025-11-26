#!/usr/bin/env node
import { batchGenerateAI } from '../src/lib/question-generator';
import { normalizeText, structuralSignature, tokenFingerprint } from '../src/ai/duplicates';

(async function main() {
    console.log('Generating small AR and MK sets...');
    const model = null;
    const ar = await batchGenerateAI(30, 'AR', model, {});
    const mk = await batchGenerateAI(30, 'MK', model, {});
    const analyze = (arr) => {
        const map = new Map();
        const sigMap = new Map();
        for (const q of arr) {
            const text = (q.text || q.problem || q.question || '');
            const n = normalizeText(text);
            const sig = structuralSignature(text);
            map.set(n, (map.get(n) || 0) + 1);
            sigMap.set(sig, (sigMap.get(sig) || 0) + 1);
        }
        const duplicates = Array.from(map.entries()).filter(([k, v]) => v > 1);
        const sigDuplicates = Array.from(sigMap.entries()).filter(([k, v]) => v > 1);
        return { total: arr.length, unique: map.size, duplicates, sigDuplicates };
    };
    const arRes = analyze(ar);
    const mkRes = analyze(mk);
    console.log('AR:', arRes);
    console.log('MK:', mkRes);
    const combined = analyze([...ar, ...mk]);
    console.log('Combined:', combined);
})();
