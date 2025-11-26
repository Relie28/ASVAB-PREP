// Small answer normalization and comparison helpers.
import { normalizeText, similarity } from './duplicates';

function tryParseNumber(s) {
    if (s === null || s === undefined) return NaN;
    // Remove commas & spaces
    const cleaned = String(s).replace(/,/g, '').trim();
    const n = Number(cleaned);
    return isNaN(n) ? NaN : n;
}

// Convert common English word numbers to numeric value (supports 0..9999-ish)
function wordsToNumber(s) {
    if (!s) return NaN;
    const cleaned = String(s).toLowerCase().replace(/[,\-]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter(t => t.length);
    if (!tokens.length) return NaN;
    const small = {
        zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
        ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19
    };
    const tens = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
    let total = 0;
    let current = 0;
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        // Handle 'point' decimal parts like 'two point five'
        if (t === 'point') {
            let frac = '';
            for (let j = i + 1; j < tokens.length; j++) {
                const tok = tokens[j];
                if (small.hasOwnProperty(tok)) {
                    frac += small[tok].toString();
                } else if (!isNaN(Number(tok))) {
                    frac += tok;
                } else {
                    break;
                }
            }
            const fnum = Number('0.' + frac);
            return total + current + fnum;
        }
        if (small.hasOwnProperty(t)) {
            current += small[t];
            continue;
        }
        if (tens.hasOwnProperty(t)) {
            current += tens[t];
            continue;
        }
        if (t === 'hundred') {
            if (current === 0) current = 1;
            current *= 100;
            continue;
        }
        if (t === 'thousand') {
            if (current === 0) current = 1;
            total += current * 1000;
            current = 0;
            continue;
        }
        if (t === 'million') {
            if (current === 0) current = 1;
            total += current * 1000000;
            current = 0;
            continue;
        }
        if (t === 'billion') {
            if (current === 0) current = 1;
            total += current * 1000000000;
            current = 0;
            continue;
        }
        // skip 'and' or other common filler
        if (t === 'and') continue;
        // If token is numeric string, parse as number
        const num = Number(t);
        if (!isNaN(num)) {
            current += num;
            continue;
        }
        // Unknown token -> not a numeric phrase
        return NaN;
    }
    return total + current;
}

export function isAnswerCorrect(expected, actual, tolerance = 0.02) {
    try {
        if (expected === null || expected === undefined) return false;
        if (actual === null || actual === undefined) return false;
        let eNum = tryParseNumber(expected);
        let aNum = tryParseNumber(actual);
        if (Number.isNaN(eNum)) eNum = wordsToNumber(expected);
        if (Number.isNaN(aNum)) aNum = wordsToNumber(actual);
        if (!Number.isNaN(eNum) && !Number.isNaN(aNum)) {
            // Accept small floating differences with a relative tolerance (default 2%)
            const diff = Math.abs(eNum - aNum);
            const threshold = Math.max(Math.abs(eNum) * tolerance, tolerance);
            if (diff <= threshold) return true;
            // small integer rounding tolerance
            if (Math.round(eNum) === Math.round(aNum)) return true;
            return false;
        }
        // Pre-normalize units/synonyms (metre->meter, percent->% etc.)
        const synonymMap = {
            'metre': 'meter',
            'metres': 'meters',
            'centimetre': 'centimeter',
            'centimetres': 'centimeters',
            'percent': '%',
            'per cent': '%',
            'percentage': '%',
            'km': 'kilometer',
            'kms': 'kilometers',
            'kilometre': 'kilometer',
            'kilometres': 'kilometers'
        };

        function mapSynonyms(s) {
            let out = s.toString().toLowerCase();
            Object.keys(synonymMap).forEach(k => { out = out.split(k).join(synonymMap[k]); });
            return out;
        }

        expected = mapSynonyms(expected);
        actual = mapSynonyms(actual);

        // Text fallback: normalized exact or fuzzy similarity
        const ne = normalizeText(String(expected));
        const na = normalizeText(String(actual));
        // debug: inspect values
        // debug: isAnswerCorrect internal values are ne/na
        // Debugging logs (remove in production)
        // console.debug('isAnswerCorrect ne/na:', ne, na);
        if (!ne || !na) return false;
        if (ne === na) return true;
        // Levenshtein-derived similarity from duplicates.js
        const sim = similarity(ne, na);
        return sim >= 0.75;
    } catch (e) {
        return false;
    }
}

export default { isAnswerCorrect };
