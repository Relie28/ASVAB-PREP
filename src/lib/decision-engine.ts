// Formula Recognition Decision Engine
import { Rule, RULES } from './rules';

export interface TokenizedText {
  words: string[];
  ngrams: Set<string>;
}

export interface ScoredRule {
  id: string;
  confidence: number;
  keywordScore: number;
  partnerScore: number;
  rule: Rule;
}

// Tokenize text and extract words and n-grams
export function tokenize(text: string): TokenizedText {
  const clean = text.toLowerCase().replace(/[^\w\s%\.\/\-]/g, ' ');
  const words = clean.split(/\s+/).filter(Boolean);
  const ngrams = new Set(words);
  
  // Include common bigrams
  for (let i = 0; i < words.length - 1; i++) {
    ngrams.add(words[i] + ' ' + words[i + 1]);
  }
  
  return { words, ngrams };
}

// Score a single rule against the text
export function scoreRule(rule: Rule, textTokens: TokenizedText): ScoredRule {
  const { ngrams } = textTokens;
  
  // Keyword score
  let keywordScore = 0;
  rule.keywords.forEach(k => {
    if (ngrams.has(k)) {
      // Weight longer matches higher
      keywordScore += (k.split(' ').length === 1 ? 1 : 1.5);
    }
  });
  
  // Partner score (basic: check presence of partner words)
  let partnerScore = 0;
  if (rule.partners) {
    rule.partners.forEach(p => { 
      if (ngrams.has(p)) partnerScore += 1; 
    });
  }
  
  // Exclusion penalty
  const exclusionFound = (rule.exclusions || []).some(e => ngrams.has(e)) ? 1 : 0;
  
  // Normalize: assume max keywordScore ~ 4, max partnerScore ~ 3
  const w_k = 0.6, w_p = 0.35, w_e = 0.05;
  const confidence = Math.max(0, Math.min(1,
    w_k * (keywordScore / 4) + w_p * (partnerScore / 3) - w_e * exclusionFound
  ));
  
  return { 
    id: rule.id, 
    confidence, 
    keywordScore, 
    partnerScore,
    rule
  };
}

// Main decision function - returns scored rules sorted by confidence
export function decideFormulas(problemText: string): ScoredRule[] {
  const tokens = tokenize(problemText);
  const scored = RULES.map(r => scoreRule(r, tokens));
  scored.sort((a, b) => b.confidence - a.confidence);
  return scored;
}

// User model for tracking progress
export interface UserStats {
  attempts: number;
  correct: number;
  avgTimeMs: number;
  lastAttemptAt: number | null;
  streak: number;
}

export interface UserModel {
  statsByFormula: Record<string, UserStats>;
  statsByCategory: Record<string, UserStats>;
  mastery: Record<string, number>;
  questionWeights: Record<string, number>;
  lastSession: {
    timestamp: number;
    mode: 'AR' | 'MK' | 'quiz' | 'test';
    score?: number;
  };
}

// Initialize user model
export function initializeUserModel(): UserModel {
  return {
    statsByFormula: {},
    statsByCategory: {},
    mastery: {},
    questionWeights: {},
    lastSession: {
      timestamp: Date.now(),
      mode: 'AR'
    }
  };
}

// Update user model after an attempt
export function updateUserModel(
  userModel: UserModel, 
  formulaId: string, 
  wasCorrect: boolean, 
  timeMs: number,
  category: 'AR' | 'MK'
): UserModel {
  const model = { ...userModel };
  
  // Update formula stats
  if (!model.statsByFormula[formulaId]) {
    model.statsByFormula[formulaId] = {
      attempts: 0,
      correct: 0,
      avgTimeMs: 0,
      lastAttemptAt: null,
      streak: 0
    };
  }
  
  const formulaStats = model.statsByFormula[formulaId];
  formulaStats.attempts += 1;
  if (wasCorrect) formulaStats.correct += 1;
  formulaStats.avgTimeMs = formulaStats.attempts > 1 
    ? (formulaStats.avgTimeMs * (formulaStats.attempts - 1) + timeMs) / formulaStats.attempts
    : timeMs;
  formulaStats.lastAttemptAt = Date.now();
  formulaStats.streak = wasCorrect ? Math.max(1, formulaStats.streak + 1) : Math.min(-1, formulaStats.streak - 1);
  
  // Update category stats
  if (!model.statsByCategory[category]) {
    model.statsByCategory[category] = {
      attempts: 0,
      correct: 0,
      avgTimeMs: 0,
      lastAttemptAt: null,
      streak: 0
    };
  }
  
  const categoryStats = model.statsByCategory[category];
  categoryStats.attempts += 1;
  if (wasCorrect) categoryStats.correct += 1;
  categoryStats.avgTimeMs = categoryStats.attempts > 1 
    ? (categoryStats.avgTimeMs * (categoryStats.attempts - 1) + timeMs) / categoryStats.attempts
    : timeMs;
  categoryStats.lastAttemptAt = Date.now();
  categoryStats.streak = wasCorrect ? Math.max(1, categoryStats.streak + 1) : Math.min(-1, categoryStats.streak - 1);
  
  // Update mastery
  model.mastery[formulaId] = formulaStats.correct / formulaStats.attempts;
  model.mastery[category] = categoryStats.correct / categoryStats.attempts;
  
  // Update question weights (increase weight for weaker topics)
  const errorRate = 1 - model.mastery[formulaId];
  model.questionWeights[formulaId] = 1 + errorRate * 2; // range ~1..3
  
  // Update last session
  model.lastSession = {
    timestamp: Date.now(),
    mode: category
  };
  
  return model;
}

// Save user model to localStorage
export function saveUserModel(userModel: UserModel): void {
  try {
    localStorage.setItem('asvab_user_model', JSON.stringify(userModel));
  } catch (e) {
    console.error('Failed to save user model:', e);
  }
}

// Load user model from localStorage
export function loadUserModel(): UserModel {
  try {
    const saved = localStorage.getItem('asvab_user_model');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load user model:', e);
  }
  return initializeUserModel();
}

// Get formula explanation for feedback
export function getFormulaExplanation(formulaId: string): string {
  const rule = RULES.find(r => r.id === formulaId);
  if (!rule) return "Unknown formula";
  
  const explanations: Record<string, string> = {
    "rate_distance": "This is a distance-rate-time problem. The formula is Distance = Rate × Time. Look for keywords like 'speed', 'mph', 'per hour', and 'time'.",
    "work_combined": "This is a combined work rate problem. When workers work together, their rates add up. The formula is 1/t_total = 1/t1 + 1/t2.",
    "percent_basic": "This is a percentage problem. The formula is Part = Percent × Whole. Look for '%' and 'of' keywords.",
    "ratio_proportion": "This is a ratio or proportion problem. Set up the ratio and cross-multiply to solve.",
    "algebra_linear": "This is a linear equation. Isolate the variable by performing inverse operations.",
    "pythagorean": "This uses the Pythagorean theorem: a² + b² = c² for right triangles.",
    "area_rectangle": "Area of a rectangle = Length × Width.",
    "area_circle": "Area of a circle = π × radius².",
    "fraction_addsub": "To add or subtract fractions, find a common denominator first.",
    "simple_interest": "Simple Interest = Principal × Rate × Time."
  };
  
  return explanations[formulaId] || `${rule.label}: ${rule.notes}`;
}