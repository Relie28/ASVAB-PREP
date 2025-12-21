import type { Question } from './question-generator';
import asvabBank from './asvab_bank';
import { generateARQuestion, generateMKQuestion } from './question-generator';
import { loadAdaptiveUserModel, getRecommendedDifficultyForCategory } from './adaptive-engine';

export const ratioToDifficulty = (ratio: number): 'easy' | 'medium' | 'hard' | 'very-hard' | 'master' => {
  // New thresholds for a 5-tier system
  if (ratio >= 0.94) return 'master';
  if (ratio >= 0.86) return 'very-hard';
  if (ratio >= 0.72) return 'hard';
  if (ratio >= 0.55) return 'medium';
  return 'easy';
};

export const chooseQuestionForBank = (bank: Question[], recentPerformance: boolean[] | null, tierOverride?: 'easy' | 'medium' | 'hard' | 'very-hard' | 'master', excludeIds: number[] = [], minTier?: 'easy' | 'medium' | 'hard' | 'very-hard' | 'master'): Question => {
  const recent = recentPerformance || [];
  const correct = recent.filter(Boolean).length;
  const ratio = recent.length ? (correct / recent.length) : 0;
  // debug helper when tests fail intermittently
  // console.debug && console.debug('chooseQuestionForBank', { ratio, recent, tierOverride, minTier, bankCounts: bank.reduce((acc, q) => { acc[q.difficulty] = (acc[q.difficulty] || 0) + 1; return acc; }, {} as any) });
  let diff = tierOverride ?? ratioToDifficulty(ratio);
  const rank = (d: 'easy'|'medium'|'hard'|'very-hard'|'master') => (d === 'easy' ? 0 : (d === 'medium' ? 1 : (d === 'hard' ? 2 : (d === 'very-hard' ? 3 : 4))));
  if (minTier && rank(diff) < rank(minTier)) diff = minTier;

  let candidates: Question[] = [];
  // If a minimum tier is provided, prefer any question at or above that tier
  if (minTier) {
    const tierCandidates = bank.filter(q => rank(q.difficulty) >= rank(minTier) && !excludeIds.includes(q.id));
    if (tierCandidates.length) return tierCandidates[Math.floor(Math.random() * tierCandidates.length)];
    // If none found at or above minTier, fall through to try any tier below
    // Try to find the nearest available difficulty (search outward from minTier)
    const diffs: Array<'easy'|'medium'|'hard'|'very-hard'|'master'> = ['easy','medium','hard','very-hard','master'];
    const desiredIdx = diffs.indexOf(minTier);
    for (let offset = 1; offset < diffs.length; offset++) {
      const higherIdx = desiredIdx + offset;
      const lowerIdx = desiredIdx - offset;
      if (higherIdx < diffs.length) {
        const cand = bank.filter(q => q.difficulty === diffs[higherIdx] && !excludeIds.includes(q.id));
        if (cand.length) return cand[Math.floor(Math.random() * cand.length)];
      }
      if (lowerIdx >= 0) {
        const cand = bank.filter(q => q.difficulty === diffs[lowerIdx] && !excludeIds.includes(q.id));
        if (cand.length) return cand[Math.floor(Math.random() * cand.length)];
      }
    }
  } else {
    // Prefer the desired difficulty, but if none found, search outward for nearest available difficulty
    candidates = bank.filter(q => q.difficulty === diff && !excludeIds.includes(q.id));
    if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
    const diffs: Array<'easy'|'medium'|'hard'|'very-hard'|'master'> = ['easy','medium','hard','very-hard','master'];
    const desiredIdx = diffs.indexOf(diff);
    // search by increasing distance: prefer nearer difficulties (check lower first then higher)
    for (let offset = 1; offset < diffs.length; offset++) {
      const lowerIdx = desiredIdx - offset;
      const higherIdx = desiredIdx + offset;
      if (lowerIdx >= 0) {
        candidates = bank.filter(q => q.difficulty === diffs[lowerIdx] && !excludeIds.includes(q.id));
        if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
      }
      if (higherIdx < diffs.length) {
        candidates = bank.filter(q => q.difficulty === diffs[higherIdx] && !excludeIds.includes(q.id));
        if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
  }
  // fallback: any question not in exclude list
  candidates = bank.filter(q => !excludeIds.includes(q.id));
  if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
  // final fallback: pick any
  return bank[Math.floor(Math.random() * bank.length)];
};

export default { ratioToDifficulty, chooseQuestionForBank };

// Select question for a section given an optional recentPerformance override
export const selectQuestionForSection = (section: 'WK' | 'PC' | 'GS' | 'MK' | 'AR', recentPerformance: boolean[] | null = null, tierOverride?: 'easy' | 'medium' | 'hard' | 'very-hard' | 'master', excludeIds: number[] = [], minTier?: 'easy' | 'medium' | 'hard' | 'very-hard' | 'master'): Question => {
  if (section === 'AR') {
    let diff = tierOverride ?? getRecommendedDifficultyForCategory(loadAdaptiveUserModel(), 'AR');
    const rank = (d: 'easy'|'medium'|'hard') => (d === 'easy' ? 0 : (d === 'medium' ? 1 : 2));
    if (minTier && rank(diff) < rank(minTier)) diff = minTier;
    const types = ["rate_distance","work_combined","percent_basic","ratio_proportion","average_mean","simple_interest","reading_table","percent_multistep","divide_simple","mixture","probability_basic","mode_of_set","next_in_sequence"];
    // Try a few times to avoid IDs in exclude list (session seen questions)
    for (let i = 0; i < 6; i++) {
      const q = generateARQuestion(types[Math.floor(Math.random() * types.length)], diff as any);
      if (!excludeIds.includes(q.id)) return q;
    }
    return generateARQuestion(types[Math.floor(Math.random() * types.length)], diff as any);
  }
  if (section === 'MK') {
    let diff = tierOverride ?? getRecommendedDifficultyForCategory(loadAdaptiveUserModel(), 'MK');
    const rank = (d: 'easy'|'medium'|'hard') => (d === 'easy' ? 0 : (d === 'medium' ? 1 : 2));
    if (minTier && rank(diff) < rank(minTier)) diff = minTier;
    const types = ["algebra_linear","fraction_addsub","pythagorean","area_circle","perimeter","decimal_ops","exponents_rules","algebra_two_step"];
    for (let i = 0; i < 6; i++) {
      const q = generateMKQuestion(types[Math.floor(Math.random() * types.length)], diff as any);
      if (!excludeIds.includes(q.id)) return q;
    }
    return generateMKQuestion(types[Math.floor(Math.random() * types.length)], diff as any);
  }

  const bank = section === 'GS' ? asvabBank.GS : (section === 'WK' ? asvabBank.WK : asvabBank.PC);
  return chooseQuestionForBank(bank, recentPerformance, tierOverride, excludeIds, minTier);
};

// selectQuestionForSection is exported above
