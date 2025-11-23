// duplicates.js - fuzzy duplicate prevention

function levenshtein(a, b) {
  if (!a || !b) return (a || '').length + (b || '').length;
  const m = a.length,
    n = b.length;
  const d = Array.from({length: m + 1}, () => new Array(n + 1));
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

function similarity(a, b) {
  if (!a || !b) return 0;
  a = a.toLowerCase();
  b = b.toLowerCase();
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / maxLen;
}

// Very simple normalization to reduce punctuation noise
function normalizeText(s = '') {
  return s.replace(/[.,;:?()\"'!]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function isDuplicate(existingList, newProblem, threshold = 0.65) {
  try {
    const newText = normalizeText(newProblem.problem || newProblem);
    for (const item of existingList || []) {
      const existingText = normalizeText(item.problem || item);
      if (!existingText) continue;
      // string similarity check
      const sim = similarity(existingText, newText);
      if (sim >= threshold) return true;
      // number pattern check - test if numbers repeated and similar
      const numsA = (existingText.match(/-?\d+/g) || []).join(',');
      const numsB = (newText.match(/-?\d+/g) || []).join(',');
      if (numsA && numsB && numsA === numsB) return true;
    }
  } catch (e) {
    // be conservative and assume not duplicate
  }
  return false;
}

// Export for tests
export default { levenshtein, similarity, isDuplicate, normalizeText };
