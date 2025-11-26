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
  preferences?: {
    aiEnabled?: boolean;
    [key: string]: any;
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
    , preferences: {}
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

// Returns a rich teaching payload for UI: definition, step-by-step breakdown template, and identification tips
export function getDeepTeaching(formulaId: string): { definition: string; steps: string[]; tips: string[] } {
  const rule = RULES.find(r => r.id === formulaId);
  const base = getFormulaExplanation(formulaId);
  const defaultSteps = base ? [base] : [];
  const tips: string[] = [];
  const steps: string[] = [...defaultSteps];
  if (!rule) return { definition: base || 'Unknown formula', steps, tips };
  // Add more detailed teaching content for common formulas
  switch (rule.id) {
    case 'algebra_linear':
    case 'algebra_two_step':
    case 'algebra_linear_word':
      tips.push('Isolate the variable: perform inverse operations. Reverse the order of operations to isolate x.');
      steps.push('Step 1: Get variable terms on one side.');
      steps.push('Step 2: Simplify constants on the other side.');
      steps.push('Step 3: Divide or multiply to compute the variable.');
      break;
    case 'pythagorean':
      tips.push('Look for right triangle keywords: "hypotenuse", "legs", "right triangle".');
      steps.push('Step 1: Identify legs a and b.');
      steps.push('Step 2: Compute a² + b².');
      steps.push('Step 3: Take square root to find c.');
      break;
    case 'percent_basic':
    case 'percent_multistep':
      tips.push('Look for % symbols, "of", "discount", "tax", "increase", "decrease".');
      steps.push('Step 1: Convert % to decimal (p/100).');
      steps.push('Step 2: Multiply decimal by whole to find part or new value.');
      steps.push('For multiple steps, apply each percent in order (discount then tax etc).');
      break;
    case 'fraction_addsub':
    case 'fraction_mult':
    case 'fraction_divide':
      tips.push('Find common denominator for add/sub; multiply or use reciprocal for multiply/divide.');
      steps.push('Step 1: For add/sub find LCD and convert.');
      steps.push('Step 2: Perform operation on numerators then simplify.');
      steps.push('For multiply: multiply numerators and denominators; simplify. For divide: multiply by reciprocal.');
      break;
    case 'divide_simple':
      // Detailed teaching payload for division
      tips.push('Think of division as repeated subtraction or as the inverse of multiplication.');
      tips.push('Estimate first and use multiples to narrow down the quotient.');
      tips.push('Check your answer by multiplying (quotient × divisor) + remainder = dividend.');
      steps.push('Division is repeated subtraction: keep subtracting the divisor from the dividend until you reach 0 or a remainder. The number of subtractions is the quotient.');
      steps.push('Example: 20 ÷ 4 → 20 → 16 → 12 → 8 → 4 → 0. You subtracted 4 five times, so the answer is 5.');
      steps.push('Division is the opposite of multiplication: a ÷ b = c means b × c = a. Use multiplication facts to find the quotient quickly.');
      steps.push('To check answers: (quotient × divisor) + remainder = dividend. If remainder is 0, multiplication should equal dividend.');
      break;
    case 'reading_table':
      tips.push('Read the row/column labels carefully; identify whether problem requests row sum, cell, or column total.');
      steps.push('Step 1: Locate row/column cell(s) mentioned.');
      steps.push('Step 2: Sum or extract values as asked.');
      break;
    case 'probability_basic':
    case 'decimal_ops':
      tips.push('Treat decimals like whole numbers but align decimal points; for operations, convert to fractions if helpful.');
      steps.push('Step 1: Align decimal places for addition/subtraction or convert to fraction for multiplication/division.');
      break;
    case 'ratio_proportion':
      tips.push('Check if a ratio can be simplified; set up fractions and cross-multiply.');
      steps.push('Step 1: Write the ratio as a fraction.');
      steps.push('Step 2: Use cross-multiplication or scale to find the unknown.');
      break;
    case 'area_rectangle':
    case 'area_triangle':
      tips.push('Identify base/height or length/width from the shape description.');
      steps.push('Step 1: Map shape properties to the right formula (area = l×w or area = 1/2 × base × height).');
      break;
    case 'sequence_pattern':
      tips.push('Look for differences or ratios between successive terms; test arithmetic and geometric patterns.');
      steps.push('Step 1: Check common difference and common ratio.');
      break;
    case 'median_mode':
      tips.push('Sort numbers for median; mode is the most frequent value.');
      steps.push('Step 1: Sort values for median; identify repeats for mode.');
      break;
    case 'perimeter':
      tips.push('Sum up the side lengths; for regular polygons multiply side length × count');
      steps.push('Step 1: Identify number of sides and side lengths.');
      break;
      tips.push('Check the total number of outcomes and the favorable outcomes; probability = favourable / total.');
      steps.push('Step 1: Count favourable outcomes.');
      steps.push('Step 2: Divide by total outcomes and reduce fraction or decimal as needed.');
      break;
    case 'mixture':
      tips.push('Translate parts into ratio shares and multiply by total.');
      steps.push('Step 1: Add the ratio parts.');
      steps.push('Step 2: Multiply total by share fraction to get amount.');
      break;
    case 'compound_interest':
      tips.push('Identify principal (P), rate (r), compounding periods (n), and time (t).');
      steps.push('Use A = P(1 + r/n)^{n t} and compute sequentially.');
      break;
    case 'systems_two_eqs':
      tips.push('Look for two equations with two variables; use substitution or elimination.');
      steps.push('Step 1: Solve one equation for a variable.');
      steps.push('Step 2: Substitute into the other and solve; back-substitute.');
      break;
    case 'percent_find':
      tips.push('Part ÷ Whole = percent (convert to %).');
      steps.push('Step 1: Divide part by whole.');
      steps.push('Step 2: Multiply by 100 to convert to percent.');
      break;
    default:
      // Generic tips: for MK and AR
      tips.push(...rule.keywords.slice(0, 5));
      steps.push(base);
      break;
  }
  return { definition: base || rule.label, steps, tips };
}