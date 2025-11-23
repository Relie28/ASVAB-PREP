// ASVAB Scoring Engine - Predicts AFQT scores based on performance
import { Question } from './question-generator';

export interface QuestionResult {
  id: number;
  difficulty: 'easy' | 'medium' | 'hard';
  difficultyWeight: number;
  correct: boolean;
  timeMs?: number;
}

export interface ScaledScores {
  AR_scaled: number;
  MK_scaled: number;
  VE_estimated: number;
  composite: number;
  percentile: number;
}

// Normal CDF approximation for percentile calculation
function normalCdf(x: number, mean: number = 0, sd: number = 1): number {
  // Abramowitz & Stegun formula 7.1.26
  const sign = (x >= mean) ? 1 : -1;
  x = Math.abs(x - mean);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

// Error function approximation
function erf(x: number): number {
  // Approximation of error function
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1.0 / (1.0 + p * Math.abs(x));
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

// Scale raw answers with difficulty weights
export function computeScaledScore(results: QuestionResult[]): number {
  if (results.length === 0) return 0;
  
  let totalWeight = 0;
  let correctWeight = 0;
  
  results.forEach(q => {
    const w = q.difficultyWeight || 1;
    totalWeight += w;
    if (q.correct) correctWeight += w;
  });
  
  // Avoid division by zero
  const ratio = totalWeight ? (correctWeight / totalWeight) : 0;
  return Math.round(ratio * 99);
}

// VE probe scoring
export function computeVEScore(correctAnswers: number, totalQuestions: number = 10): number {
  if (totalQuestions === 0) return 50; // Default if no VE data
  const ratio = correctAnswers / totalQuestions;
  return Math.round(ratio * 99);
}

// Compute composite and map to percentile AFQT
export function predictAFQT(
  arResults: QuestionResult[],
  mkResults: QuestionResult[],
  veScore?: number
): ScaledScores {
  // Calculate scaled scores
  const AR_scaled = computeScaledScore(arResults);
  const MK_scaled = computeScaledScore(mkResults);
  
  // Estimate VE if not provided
  let VE_estimated = veScore || 50; // Default to average if no VE data
  
  // If we have AR performance, we can make a better VE estimate
  // (Good math skills often correlate with verbal skills)
  if (arResults.length > 0 && !veScore) {
    const arMastery = computeScaledScore(arResults) / 99;
    // Adjust VE estimate based on AR performance with some noise
    VE_estimated = Math.round(50 + (arMastery - 0.5) * 30 + (Math.random() - 0.5) * 10);
    VE_estimated = Math.max(0, Math.min(99, VE_estimated));
  }
  
  // Composite score: AFQT = 2VE + AR + MK
  const composite = AR_scaled + MK_scaled + 2 * VE_estimated;
  
  // Normalize composite to z-score using historical ASVAB data
  // These values should be calibrated with real data
  const compositeMean = 200; // Assumed mean composite score
  const compositeSd = 70;    // Assumed standard deviation
  
  const z = (composite - compositeMean) / compositeSd;
  
  // Map to percentile (0-99)
  let percentile = Math.round(normalCdf(z) * 99);
  percentile = Math.max(0, Math.min(99, percentile));
  
  return {
    AR_scaled,
    MK_scaled,
    VE_estimated,
    composite,
    percentile
  };
}

// Calculate predicted ASVAB score from question results
export function calculatePredictedASVABScore(
  arQuestions: Question[],
  arAnswers: (number | string | null)[],
  mkQuestions: Question[],
  mkAnswers: (number | string | null)[],
  veProbeResults?: boolean[]
): {
  scaledScores: ScaledScores;
  arResults: QuestionResult[];
  mkResults: QuestionResult[];
  breakdown: {
    arCorrect: number;
    arTotal: number;
    mkCorrect: number;
    mkTotal: number;
    veCorrect?: number;
    veTotal?: number;
  };
} {
  // Process AR results
  const arResults: QuestionResult[] = arQuestions.map((q, i) => ({
    id: q.id,
    difficulty: q.difficulty,
    difficultyWeight: q.difficultyWeight,
    correct: arAnswers[i] === q.answer
  }));
  
  // Process MK results
  const mkResults: QuestionResult[] = mkQuestions.map((q, i) => ({
    id: q.id,
    difficulty: q.difficulty,
    difficultyWeight: q.difficultyWeight,
    correct: mkAnswers[i] === q.answer
  }));
  
  // Calculate VE score if probe results provided
  let veScore: number | undefined;
  if (veProbeResults) {
    const veCorrect = veProbeResults.filter(r => r).length;
    veScore = computeVEScore(veCorrect, veProbeResults.length);
  }
  
  // Get predicted AFQT
  const scaledScores = predictAFQT(arResults, mkResults, veScore);
  
  // Calculate breakdown
  const breakdown = {
    arCorrect: arResults.filter(r => r.correct).length,
    arTotal: arResults.length,
    mkCorrect: mkResults.filter(r => r.correct).length,
    mkTotal: mkResults.length,
    ...(veProbeResults && {
      veCorrect: veProbeResults.filter(r => r).length,
      veTotal: veProbeResults.length
    })
  };
  
  return {
    scaledScores,
    arResults,
    mkResults,
    breakdown
  };
}

// Generate a detailed score report
export function generateScoreReport(
  arQuestions: Question[],
  arAnswers: (number | string | null)[],
  mkQuestions: Question[],
  mkAnswers: (number | string | null)[],
  veProbeResults?: boolean[]
): {
  summary: ScaledScores;
  breakdown: {
    arCorrect: number;
    arTotal: number;
    arPercentage: number;
    mkCorrect: number;
    mkTotal: number;
    mkPercentage: number;
    veCorrect?: number;
    veTotal?: number;
    vePercentage?: number;
  };
  afqtInterpretation: string;
  recommendations: string[];
  weakAreas: string[];
  strongAreas: string[];
} {
  const { scaledScores, breakdown } = calculatePredictedASVABScore(
    arQuestions, arAnswers, mkQuestions, mkAnswers, veProbeResults
  );
  
  // Calculate percentages
  const arPercentage = Math.round((breakdown.arCorrect / breakdown.arTotal) * 100);
  const mkPercentage = Math.round((breakdown.mkCorrect / breakdown.mkTotal) * 100);
  const vePercentage = breakdown.veTotal ? Math.round((breakdown.veCorrect! / breakdown.veTotal!) * 100) : undefined;
  
  // AFQT interpretation
  let afqtInterpretation = "";
  if (scaledScores.percentile >= 90) {
    afqtInterpretation = "Exceptional - Well above average performance";
  } else if (scaledScores.percentile >= 70) {
    afqtInterpretation = "Above Average - Strong performance";
  } else if (scaledScores.percentile >= 50) {
    afqtInterpretation = "Average - Solid performance";
  } else if (scaledScores.percentile >= 30) {
    afqtInterpretation = "Below Average - Room for improvement";
  } else {
    afqtInterpretation = "Needs Improvement - Significant study recommended";
  }
  
  // Analyze weak and strong areas
  const weakAreas: string[] = [];
  const strongAreas: string[] = [];
  
  if (arPercentage < 60) weakAreas.push("Arithmetic Reasoning");
  else if (arPercentage >= 80) strongAreas.push("Arithmetic Reasoning");
  
  if (mkPercentage < 60) weakAreas.push("Mathematics Knowledge");
  else if (mkPercentage >= 80) strongAreas.push("Mathematics Knowledge");
  
  if (vePercentage !== undefined) {
    if (vePercentage < 60) weakAreas.push("Verbal Expression");
    else if (vePercentage >= 80) strongAreas.push("Verbal Expression");
  }
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (weakAreas.length > 0) {
    recommendations.push(`Focus on improving: ${weakAreas.join(", ")}`);
  }
  
  if (arPercentage < 70) {
    recommendations.push("Practice more word problems and formula identification");
  }
  
  if (mkPercentage < 70) {
    recommendations.push("Review algebra, geometry, and mathematical concepts");
  }
  
  if (vePercentage !== undefined && vePercentage < 70) {
    recommendations.push("Improve vocabulary and reading comprehension");
  }
  
  if (scaledScores.percentile < 50) {
    recommendations.push("Consider additional study time and practice tests");
  }
  
  recommendations.push("Take regular practice tests to track progress");
  
  return {
    summary: scaledScores,
    breakdown: {
      ...breakdown,
      arPercentage,
      mkPercentage,
      vePercentage
    },
    afqtInterpretation,
    recommendations,
    weakAreas,
    strongAreas
  };
}

// Test harness for synthetic users (for calibration)
export function runSyntheticTestHarness(numUsers: number = 1000): number[] {
  const scores: number[] = [];
  
  for (let i = 0; i < numUsers; i++) {
    // Generate synthetic performance
    const arAccuracy = Math.random();
    const mkAccuracy = Math.random();
    const veAccuracy = Math.random();
    
    // Generate synthetic question results
    const arResults: QuestionResult[] = Array(120).fill(null).map(() => ({
      id: Math.random(),
      difficulty: ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)] as 'easy' | 'medium' | 'hard',
      difficultyWeight: Math.random() > 0.66 ? 3 : Math.random() > 0.33 ? 2 : 1,
      correct: Math.random() < arAccuracy
    }));
    
    const mkResults: QuestionResult[] = Array(120).fill(null).map(() => ({
      id: Math.random(),
      difficulty: ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)] as 'easy' | 'medium' | 'hard',
      difficultyWeight: Math.random() > 0.66 ? 3 : Math.random() > 0.33 ? 2 : 1,
      correct: Math.random() < mkAccuracy
    }));
    
    const veScore = computeVEScore(Math.floor(veAccuracy * 10), 10);
    const prediction = predictAFQT(arResults, mkResults, veScore);
    scores.push(prediction.percentile);
  }
  
  return scores;
}

// Get score distribution statistics
export function getScoreDistribution(scores: number[]): {
  mean: number;
  median: number;
  min: number;
  max: number;
  standardDeviation: number;
  percentiles: Record<string, number>;
} {
  const sorted = [...scores].sort((a, b) => a - b);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const median = sorted[Math.floor(scores.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  
  const variance = scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / scores.length;
  const standardDeviation = Math.sqrt(variance);
  
  const percentiles = {
    '10th': sorted[Math.floor(scores.length * 0.1)],
    '25th': sorted[Math.floor(scores.length * 0.25)],
    '50th': median,
    '75th': sorted[Math.floor(scores.length * 0.75)],
    '90th': sorted[Math.floor(scores.length * 0.9)]
  };
  
  return {
    mean,
    median,
    min,
    max,
    standardDeviation,
    percentiles
  };
}