import { generateMKQuestion } from '../src/lib/question-generator.js';

(async function run() {
    let failed = 0;
    for (let i = 0; i < 200; i++) {
        const q = generateMKQuestion('multiply_simple', 'easy');
        // parse a and b out of text like: 'What is 11 × 3?' or 'What is 11 x 3?'
        const m = q.text.match(/(-?\d+)\s*[×xX]\s*(-?\d+)/);
        if (!m) {
            console.log('No match for text:', q.text);
            failed++;
            continue;
        }
        const a = Number(m[1]);
        const b = Number(m[2]);
        const expected = a * b;
        if (Number(q.answer) !== expected) {
            console.error('Mismatch:', q.text, 'expected', expected, 'but answer', q.answer);
            failed++;
        }
    }
    if (failed) console.log('Failed checks:', failed); else console.log('All multiply_simple checks passed.');
})();
