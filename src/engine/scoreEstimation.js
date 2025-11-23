// scoreEstimation.js - AFQT estimate based on multiple categories

function logistic(x) {
  const k = 1 / (1 + Math.exp(-x));
  return k;
}

function difficultyWeight(d) {
  // difficulty 1..5: higher difficulty weight increases raw score
  return 0.8 + (d - 1) * 0.2; // 1->0.8, 5->1.6
}

export function estimateAFQT(statsByCategory = {}, formulaMasteries = [], options = {}) {
  // We'll take recent 30d windows implicitly (assuming caller provides statsByCategory as recent)
  // Build raw score from categories: AR, MK, WK (word knowledge), PC (par comp), MIXED
  const categories = ['AR', 'MK', 'WK', 'PC', 'MIXED'];
  let raw = 0;
  let totalWeight = 0;
  categories.forEach(c => {
    const s = statsByCategory[c] || { attempts: 0, correct: 0 };
    const attempts = s.attempts || 0;
    const correct = s.correct || 0;
    const acc = attempts ? (correct / attempts) : 0;
    const catWeight = (c === 'AR' || c === 'MK') ? 1.2 : (c === 'MIXED' ? 1.0 : 0.9);
    raw += acc * catWeight;
    totalWeight += catWeight;
  });
  // difficulty adjustment via average formula difficulty weight
  const avgDiff = formulaMasteries && formulaMasteries.length ? formulaMasteries.reduce((s,f)=>s+(f.difficultyWeight||1),0) / formulaMasteries.length : 1;
  const difficultyAdj = avgDiff || 1;
  const avg = raw / Math.max(1, totalWeight);
  const scaled = logistic((avg * 2 - 1) * difficultyAdj); // map to logistic
  // scale to 0..99
  const final = Math.round(scaled * 99);
  return final;
}

export default estimateAFQT;
