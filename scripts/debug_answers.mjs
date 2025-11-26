import * as A from '../src/ai/answers.js';
import { normalizeText } from '../src/ai/duplicates.js';
const isAnswerCorrect = A.default?.isAnswerCorrect || A.isAnswerCorrect || A;
console.log('A keys', Object.keys(A));
console.log('A.default keys', A.default ? Object.keys(A.default) : undefined);
console.log('isAnswerCorrect type', typeof isAnswerCorrect);
// replicate parsing helpers
function tryParseNumber(s) { const cleaned = String(s).replace(/,/g, '').trim(); const n = Number(cleaned); return isNaN(n) ? NaN : n; }
function wordsToNumberLocal(s) { try { return (A && A.default && A.default.wordsToNumber) ? (A.default.wordsToNumber(s)) : NaN; } catch (e) { return NaN; } }
function mapSynonymsLocal(s) { const synonymMap = { 'metre': 'meter', 'metres': 'meters', 'centimetre': 'centimeter', 'centimetres': 'centimeters', 'percent': '%', 'per cent': '%', 'percentage': '%', 'km': 'kilometer', 'kms': 'kilometers', 'kilometre': 'kilometer', 'kilometres': 'kilometers' }; let out = String(s).toLowerCase(); Object.keys(synonymMap).forEach(k => { out = out.split(k).join(synonymMap[k]); }); return out; }
// helper functions from answers to reconstruct steps
// Not importing helpers from answers.js to avoid naming collisions; local replicas used instead

console.log('normalizeText apple =>', normalizeText('apple'));
console.log('isAnswerCorrect apple =>', isAnswerCorrect('apple', 'apple'));
console.log('named A.isAnswerCorrect =>', (A.isAnswerCorrect ? A.isAnswerCorrect('apple', 'apple') : 'no'));
console.log('default A.default.isAnswerCorrect =>', (A.default && A.default.isAnswerCorrect ? A.default.isAnswerCorrect('apple', 'apple') : 'no'));
console.log('Is number? eNum,aNum (apple):', tryParseNumber('apple'), tryParseNumber('apple'));
console.log('wordsToNumber(apple) local:', wordsToNumberLocal('apple'));
console.log('mapSynonyms apple ->', mapSynonymsLocal('apple'));
console.log('normalize apple', normalizeText(mapSynonymsLocal('apple')));
console.log('isAnswerCorrect colour/color =>', isAnswerCorrect('colour', 'color'));
console.log('wordsToNumber 25 =>', isAnswerCorrect('25', 'twenty five'));
console.log('Washington =>', isAnswerCorrect('Washington', 'Washngton'));

function isAnswerCorrectLocal(expected, actual) {
    if (expected === null || expected === undefined) return false;
    if (actual === null || actual === undefined) return false;
    let eNum = tryParseNumber(expected);
    let aNum = tryParseNumber(actual);
    if (Number.isNaN(eNum)) eNum = wordsToNumberLocal(expected);
    if (Number.isNaN(aNum)) aNum = wordsToNumberLocal(actual);
    if (!Number.isNaN(eNum) && !Number.isNaN(aNum)) {
        const diff = Math.abs(eNum - aNum);
        const threshold = Math.max(Math.abs(eNum) * 0.02, 0.02);
        if (diff <= threshold) return true;
        if (Math.round(eNum) === Math.round(aNum)) return true;
        return false;
    }
    const ne = normalizeText(mapSynonymsLocal(expected));
    const na = normalizeText(mapSynonymsLocal(actual));
    console.log('Local isAnswerCorrect ne/na', ne, na);
    if (!ne || !na) return false;
    if (ne === na) return true;
    return ((A && (A.default?.similarity || A.similarity) ? (A.default?.similarity || A.similarity)(ne, na) : 0) >= 0.75);
}

console.log('Local isAnswerCorrect apple =>', isAnswerCorrectLocal('apple', 'apple'));
console.log('Local isAnswerCorrect colour =>', isAnswerCorrectLocal('colour', 'color'));
console.log('Local isAnswerCorrect 25 =>', isAnswerCorrectLocal('25', 'twenty five'));


