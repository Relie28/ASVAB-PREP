import { batchGenerate, generateARQuestion, generateMKQuestion } from '../src/lib/question-generator';

(async function () {
    const ar = batchGenerate(200, 'AR');
    const mk = batchGenerate(200, 'MK');
    const arIds = new Set(ar.map(q => q.formulaId));
    const mkIds = new Set(mk.map(q => q.formulaId));
    console.log('AR types in sample:', Array.from(arIds));
    console.log('MK types in sample:', Array.from(mkIds));
    const requiredAR = ['percent_basic', 'percent_multistep', 'reading_table', 'divide_simple', 'mixture', 'probability_basic'];
    const requiredMK = ['algebra_linear', 'algebra_distributive', 'fraction_addsub', 'fraction_mult', 'fraction_divide', 'pythagorean', 'volume_rect_prism', 'systems_two_eqs', 'polynomial_factor', 'perimeter', 'compound_interest', 'median_mode', 'angles_basic'];
    const missingAR = requiredAR.filter(r => !arIds.has(r));
    const missingMK = requiredMK.filter(r => !mkIds.has(r));
    // deterministic checks: generate one per type to ensure generator supports the type
    const mkChecks = [];
    for (const t of requiredMK) {
        try { mkChecks.push({ type: t, q: generateMKQuestion(t, 'medium') }); } catch (e) { mkChecks.push({ type: t, q: null, error: String(e) }); }
    }
    const arChecks = [];
    for (const t of requiredAR) {
        try { arChecks.push({ type: t, q: generateARQuestion(t, 'medium') }); } catch (e) { arChecks.push({ type: t, q: null, error: String(e) }); }
    }
    const mkMissingDet = mkChecks.filter(c => !c.q).map(c => c.type);
    const arMissingDet = arChecks.filter(c => !c.q).map(c => c.type);
    const missingDet = { missingAR, missingMK, missingARDet: arMissingDet, missingMKDet: mkMissingDet };
    if (arMissingDet.length || mkMissingDet.length) {
        console.error('Missing types in deterministic generation', { arMissingDet, mkMissingDet });
        process.exit(1);
    } else {
        console.log('All required generator types present via deterministic per-type generation.');
        process.exit(0);
    }
})();
