// Adaptive Difficulty Engine for ASVAB Training
import { Question } from './question-generator';
import { UserModel, updateUserModel, saveUserModel, loadUserModel } from './decision-engine';

export interface AdaptiveConfig {
  alpha: number; // EWMA smoothing factor
  baseExploration: number; // fraction of time to choose random exploration
  masteryThreshold: number; // when considered "mastered"
  upStreakThreshold: number; // successes in a row to bump difficulty
  downStreakThreshold: number; // fails in a row to drop difficulty
  aggressiveness: number; // scales how much weight rises when low mastery
  reviewFactor: number; // amount of weight to give scheduled review items
  maxWeight: number; // clamp for question/formula weight
  minWeight: number; // floor weight
  recentWindowMs: number; // window used for recency adjustments
}

export interface QuestionPoolEntry {
  formulaId: string;
  category: 'AR' | 'MK';
  difficulty: 'easy' | 'medium' | 'hard';
  difficultyWeight: number;
  timesSeen: number;
  lastSeen: number | null;
  spacedScore: number;
}

export interface ReviewItem {
  qId: number;
  scheduledAt: number;
  priority: number;
  reason: string;
}

export interface AdaptiveUserModel extends UserModel {
  questionPool: Record<number, QuestionPoolEntry>;
  reviewQueue: ReviewItem[];
  engineConfig: AdaptiveConfig;
}

const DEFAULT_CONFIG: AdaptiveConfig = {
  alpha: 0.18,
  baseExploration: 0.08,
  masteryThreshold: 0.85,
  upStreakThreshold: 3,
  downStreakThreshold: -2,
  aggressiveness: 2.2,
  reviewFactor: 0.25,
  maxWeight: 3.0,
  minWeight: 0.5,
  recentWindowMs: 1000 * 60 * 60 * 24 * 7 // 7 days
};

const ADAPTIVE_KEY = "asvab_adaptive_user_model_v1";

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch (e) {
    return false;
  }
}

// Load adaptive user model
export function loadAdaptiveUserModel(): AdaptiveUserModel {
  try {
    if (!hasLocalStorage()) {
      // localStorage not available in this environment (Node scripts); return defaults without logging
      return {
        statsByFormula: {},
        statsByCategory: {},
        mastery: {},
        questionWeights: {},
        lastSession: { timestamp: Date.now(), mode: 'AR' },
        questionPool: {},
        reviewQueue: [],
        engineConfig: DEFAULT_CONFIG
      };
    }
    const raw = localStorage.getItem(ADAPTIVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure all required fields exist
      return {
        statsByFormula: parsed.statsByFormula || {},
        statsByCategory: parsed.statsByCategory || {},
        mastery: parsed.mastery || {},
        questionWeights: parsed.questionWeights || {},
        lastSession: parsed.lastSession || { timestamp: Date.now(), mode: 'AR' },
        questionPool: parsed.questionPool || {},
        reviewQueue: parsed.reviewQueue || [],
        engineConfig: { ...DEFAULT_CONFIG, ...parsed.engineConfig }
      };
    }
  } catch (e) { 
    console.warn("loadAdaptiveUserModel err", e); 
  }
  
  return {
    statsByFormula: {},
    statsByCategory: {},
    mastery: {},
    questionWeights: {},
    lastSession: { timestamp: Date.now(), mode: 'AR' },
    questionPool: {},
    reviewQueue: [],
    engineConfig: DEFAULT_CONFIG
  };
}

// Save adaptive user model
export function saveAdaptiveUserModel(model: AdaptiveUserModel): void {
  try {
    if (!hasLocalStorage()) {
      // Running server-side; skip persistence
      return;
    }
    localStorage.setItem(ADAPTIVE_KEY, JSON.stringify(model));
    // Notify any listeners that the adaptive model updated so UI can refresh in real-time
    try {
      if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
        window.dispatchEvent(new CustomEvent('adaptiveModelUpdated'));
      }
    } catch (e) {}
  } catch (e) {
    console.error("Failed to save adaptive user model:", e);
  }
}

// Helper: ensure formula exists in model
function ensureFormula(model: AdaptiveUserModel, formulaId: string): void {
  model.statsByFormula[formulaId] = model.statsByFormula[formulaId] || {
    attempts: 0,
    correct: 0,
    avgTimeMs: 0,
    lastAttemptAt: null,
    streak: 0
  };
  model.questionWeights[formulaId] = model.questionWeights[formulaId] || 1.0;
}

// Update mastery after an attempt
export function recordAttempt(
  model: AdaptiveUserModel, 
  params: {
    formulaId: string;
    category: 'AR' | 'MK';
    qId?: number;
    correct: boolean;
    timeMs: number;
    difficulty: 'easy' | 'medium' | 'hard';
    source?: string; // optional origin string (live, synthetic, backfill, study, full_test)
  }
): AdaptiveUserModel {
  const { formulaId, category, qId, correct, timeMs, difficulty } = params;
  // Append the attempt to the centralized attempt log first. The attempt log is the canonical
  // source of truth for period stats — only update the adaptive model if the attempt log
  // accepted a new entry (action === 'added'). When a synthetic entry is present and we
  // receive a qId-backed entry, appendAttemptLog may return 'replaced' — in that case
  // the synthetic was previously applied and model stats have already been updated, so
  // we should not update model again.
  let action: 'added' | 'replaced' | 'skipped' = 'added';
  try {
    action = appendAttemptLog({ ts: Date.now(), qId, formulaId, category, correct, timeMs, difficulty, source: (params as any).source });
  } catch (e) {
    // If logging cannot be performed, default to behaviour of updating model
    action = 'added';
  }
  // We'll update the model only when appendAttemptLog returned 'added'. In case of 'replaced' or 'skipped',
  // assume the model was already updated and do not update again to avoid double-counting.
  const shouldUpdateModel = action === 'added';
  if (shouldUpdateModel) {
    const cfg = model.engineConfig;
    ensureFormula(model, formulaId);
    const s = model.statsByFormula[formulaId];
    // ensure ewma exists
    (s as any).ewma = (s as any).ewma || 0;
    s.attempts += 1;
    s.correct += (correct ? 1 : 0);
    s.avgTimeMs = s.avgTimeMs ? ((s.avgTimeMs * (s.attempts - 1) + timeMs) / s.attempts) : timeMs;
    s.lastAttemptAt = Date.now();
  
  // EWMA update
  (s as any).ewma = cfg.alpha * (correct ? 1 : 0) + (1 - cfg.alpha) * ((s as any).ewma || 0);
  
  // Streak update
  if (correct) {
    s.streak = Math.max(1, s.streak + 1);
  } else {
    s.streak = Math.min(-1, s.streak - 1);
  }

  // Update category
  if (category) {
    model.statsByCategory[category] = model.statsByCategory[category] || { 
      attempts: 0, 
      correct: 0, 
      avgTimeMs: 0, 
      lastAttemptAt: null, 
      streak: 0 
    };
    
    const c = model.statsByCategory[category];
    c.attempts += 1;
    c.correct += (correct ? 1 : 0);
    c.avgTimeMs = c.avgTimeMs ? ((c.avgTimeMs * (c.attempts - 1) + timeMs) / c.attempts) : timeMs;
    c.lastAttemptAt = Date.now();
  (c as any).ewma = cfg.alpha * (correct ? 1 : 0) + (1 - cfg.alpha) * ((c as any).ewma || 0);
    c.streak = correct ? Math.max(1, c.streak + 1) : Math.min(-1, c.streak - 1);
  }

    // Update mastery
    model.mastery[formulaId] = s.correct / s.attempts;
    model.mastery[category] = model.statsByCategory[category].correct / model.statsByCategory[category].attempts;

    // Adjust question weights
    adjustWeights(model, formulaId);

  }
  // Update question pool if qId exists
  if (qId && model.questionPool[qId]) {
    const qp = model.questionPool[qId];
    qp.timesSeen += 1;
    qp.lastSeen = Date.now();
    
    // Increase spaced score on wrong answers to prioritize review
    if (!correct) {
      qp.spacedScore = Math.min(1, (qp.spacedScore || 0) + 0.35);
    } else {
      qp.spacedScore = Math.max(0, (qp.spacedScore || 0) - 0.25);
    }
  }
  // Append attempt log for period-based stats (non-blocking)
  try {
    // include optional source marker
    appendAttemptLog({ ts: Date.now(), qId, formulaId, category, correct, timeMs, difficulty, source: (params as any).source });
  } catch (e) {}

  return model;
}

// Append a simple attempt log entry to localStorage for period calculations
const ATTEMPT_LOG_KEY = 'asvab_attempt_log_v1';
function appendAttemptLog(entry: { ts: number; qId?: number; formulaId: string; category: string; correct: boolean; timeMs: number; difficulty: string; source?: string; [key: string]: any }): 'added' | 'replaced' | 'skipped' {
  try {
    if (!hasLocalStorage()) return 'skipped';
    const raw = localStorage.getItem(ATTEMPT_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const dayKey = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    // If qId provided: skip append if an existing entry has the qId
    if (entry.qId && parsed.some((a: any) => a && a.qId === entry.qId)) {
      return 'skipped';
    }

    // If qId provided, remove any synthetic previous match for the same day and formula+correctness
  if (entry.qId) {
      const ek = dayKey(entry.ts);
      const foundIdx = parsed.findIndex((a: any) => (!a.qId) && a.formulaId === entry.formulaId && a.correct === entry.correct && dayKey(a.ts) === ek);
      if (foundIdx !== -1) {
        // Replace synthetic with canonical qId entry
        parsed.splice(foundIdx, 1);
        parsed.push(entry);
        if (parsed.length > 10000) parsed.splice(0, parsed.length - 10000);
        try { localStorage.setItem(ATTEMPT_LOG_KEY, JSON.stringify(parsed)); } catch (e) {}
        try { updateMonthlySummaries(parsed); } catch (e) {}
        return 'replaced';
      }
    }

    // If no qId provided (synthetic import), avoid creating duplicate synthetic entries for the same day+formula+correctness
    // also, if a qId-backed entry already exists for this day/formula/correctness, don't append the synthetic entry
    if (!entry.qId && (parsed.some((a: any) => (!a.qId) && a.formulaId === entry.formulaId && a.correct === entry.correct && dayKey(a.ts) === dayKey(entry.ts))
      || parsed.some((a: any) => a.qId && a.formulaId === entry.formulaId && a.correct === entry.correct && dayKey(a.ts) === dayKey(entry.ts)))) {
      return 'skipped';
    }

  parsed.push(entry);
    // keep last 365*3 entries or 10000 entries to avoid unbounded growth
    if (parsed.length > 10000) parsed.splice(0, parsed.length - 10000);
  try { localStorage.setItem(ATTEMPT_LOG_KEY, JSON.stringify(parsed)); } catch (e) {}
    // Update monthly summaries after appending a new attempt
    try { updateMonthlySummaries(parsed); } catch (e) {}
    return 'added';
  } catch (e) {
    // ignore logging errors
    return 'skipped';
  }
}

const MONTHLY_SUMMARY_KEY = 'asvab_monthly_summary_v1';

function monthKeyFromTs(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function updateMonthlySummaries(attemptLog: Array<any>) {
  try {
    const map: Record<string, { attempts: number; correct: number }> = {};
    attemptLog.forEach((e: any) => {
      if (!e || !e.ts) return;
      const k = monthKeyFromTs(e.ts);
      map[k] = map[k] || { attempts: 0, correct: 0 };
      map[k].attempts += 1;
      if (e.correct) map[k].correct += 1;
    });

    const out: Array<any> = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const entry = map[k] || { attempts: 0, correct: 0 };
      out.push({ month: k, attempts: entry.attempts, correct: entry.correct, accuracy: entry.attempts ? (entry.correct / entry.attempts) : 0 });
    }

  try { if (hasLocalStorage()) localStorage.setItem(MONTHLY_SUMMARY_KEY, JSON.stringify(out)); } catch (e) {}
  } catch (e) {
    // swallow
  }
}

// Rebuild adaptive model stats from the centralized attempt log. This is used to ensure
// the adaptive model remains consistent with the canonical attempt log (e.g., after
// historical imports or fixes). Only rebuilds statistical counters (attempts, correct, avgTime).
export function rebuildAdaptiveModelFromAttemptLog(): AdaptiveUserModel {
  const mdl = loadAdaptiveUserModel();
  try {
    if (!hasLocalStorage()) return mdl;
    const raw = localStorage.getItem(ATTEMPT_LOG_KEY);
    if (!raw) return mdl;
    const entries = JSON.parse(raw) as Array<any>;
    const statsByFormula: Record<string, any> = {};
    const statsByCategory: Record<string, any> = {};
    entries.forEach((e) => {
      if (!e || !e.formulaId) return;
      const f = statsByFormula[e.formulaId] = statsByFormula[e.formulaId] || { attempts: 0, correct: 0, avgTimeMs: 0, lastAttemptAt: null, streak: 0 };
      f.attempts += 1;
      f.correct += (e.correct ? 1 : 0);
      f.avgTimeMs = f.avgTimeMs ? ((f.avgTimeMs * (f.attempts - 1) + (e.timeMs || 0)) / f.attempts) : (e.timeMs || 0);
      f.lastAttemptAt = Math.max(f.lastAttemptAt || 0, e.ts || 0);

      const cId = e.category || 'AR';
      const c = statsByCategory[cId] = statsByCategory[cId] || { attempts: 0, correct: 0, avgTimeMs: 0, lastAttemptAt: null, streak: 0 };
      c.attempts += 1;
      c.correct += (e.correct ? 1 : 0);
      c.avgTimeMs = c.avgTimeMs ? ((c.avgTimeMs * (c.attempts - 1) + (e.timeMs || 0)) / c.attempts) : (e.timeMs || 0);
      c.lastAttemptAt = Math.max(c.lastAttemptAt || 0, e.ts || 0);
    });

    // Operate on a copy of the model so we keep engineConfig and pool, but replace stats
    const out = { ...mdl } as AdaptiveUserModel;
    out.statsByFormula = statsByFormula;
    out.statsByCategory = statsByCategory;
    // Recompute mastery per formula and category
    out.mastery = {};
    Object.keys(statsByFormula).forEach((k) => {
      out.mastery[k] = statsByFormula[k].attempts ? (statsByFormula[k].correct / statsByFormula[k].attempts) : 0;
    });
    Object.keys(statsByCategory).forEach((k) => {
      out.mastery[k] = statsByCategory[k].attempts ? (statsByCategory[k].correct / statsByCategory[k].attempts) : 0;
    });

    saveAdaptiveUserModel(out);
    return out;
  } catch (e) {
    return mdl;
  }
}

// Compute the user's current difficulty level (Easy|Intermediate|Hard|Unknown) from the centralized attempt log.
// Rules (simple heuristic):
// - Use attempts from the last `days` days (default 30).
// - If total correct answers < 5 -> 'Unknown'.
// - If >=50% of correct answers are on 'hard' and >=5 correct on 'hard' -> 'Hard'
// - Else if >=40% of correct answers are on 'medium' and >=5 correct on 'medium' -> 'Intermediate'
// - Else if >=50% of correct answers are on 'easy' and >=5 correct on 'easy' -> 'Easy'
// - Otherwise, 'Intermediate' as a balanced default.
export function getUserDifficultyFromAttemptLog(days: number = 30): 'Easy' | 'Intermediate' | 'Hard' | 'Unknown' {
  try {
    const raw = localStorage.getItem(ATTEMPT_LOG_KEY);
    if (!raw) return 'Unknown';
    const entries = JSON.parse(raw) as Array<any>;
    const now = new Date();
    now.setHours(0,0,0,0);
    const cutoff = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    const counts: Record<string, { attempts: number; correct: number }> = { easy: { attempts: 0, correct: 0 }, medium: { attempts: 0, correct: 0 }, hard: { attempts: 0, correct: 0 } };
    entries.forEach((e) => {
      if (!e || !e.ts) return;
      const d = new Date(e.ts);
      d.setHours(0,0,0,0);
      if (d < cutoff) return;
      const diff = (e.difficulty || 'medium').toLowerCase();
      if (!counts[diff]) return;
      counts[diff].attempts += 1;
      if (e.correct) counts[diff].correct += 1;
    });
    const totalCorrect = counts.easy.correct + counts.medium.correct + counts.hard.correct;
    if (totalCorrect < 5) return 'Unknown';
    if (counts.hard.correct >= 5 && (counts.hard.correct / totalCorrect) >= 0.5) return 'Hard';
    if (counts.medium.correct >= 5 && (counts.medium.correct / totalCorrect) >= 0.4) return 'Intermediate';
    if (counts.easy.correct >= 5 && (counts.easy.correct / totalCorrect) >= 0.5) return 'Easy';
    return 'Intermediate';
  } catch (e) {
    return 'Unknown';
  }
}

// Recommend difficulty for a category using category mastery and recent performance
export function getRecommendedDifficultyForCategory(model: AdaptiveUserModel | null, category: 'AR' | 'MK'): 'easy' | 'medium' | 'hard' {
  try {
    const mdl = model || loadAdaptiveUserModel();
    const stats = (mdl && mdl.statsByCategory && mdl.statsByCategory[category]) || null;
    // Not enough data -> start easy
    if (!stats || (stats.attempts || 0) < 5) return 'easy';
    const mastery = stats.correct / stats.attempts;
    const ewma = (stats as any)?.ewma || mastery;
    // Use scaled rules
    if (ewma >= 0.86) return 'hard';
    if (ewma >= 0.65) return 'medium';
    return 'easy';
  } catch (e) {
    return 'easy';
  }
}

// Recompute weight for a formula
function adjustWeights(model: AdaptiveUserModel, formulaId: string): number {
  const cfg = model.engineConfig;
  ensureFormula(model, formulaId);
  const s = model.statsByFormula[formulaId];
  
  // Base weight scales with (1 - mastery)
  let weight = 1 + (1 - (((s as any).ewma) || 0)) * cfg.aggressiveness;
  
  // Increase if negative streak
  if (s.streak < 0) {
    weight *= (1 + Math.abs(s.streak) * 0.25);
  }
  
  // Clamp
  weight = Math.max(cfg.minWeight, Math.min(cfg.maxWeight, weight));
  model.questionWeights[formulaId] = weight;
  
  return weight;
}

// Add question to pool
export function registerQuestion(model: AdaptiveUserModel, q: Question): void {
  model.questionPool[q.id] = {
    formulaId: q.formulaId,
    category: q.category,
    difficulty: q.difficulty,
    difficultyWeight: q.difficultyWeight,
    timesSeen: 0,
    lastSeen: null,
    spacedScore: 0.0
  };
}

// Pick the next question
export function pickNextQuestion(
  model: AdaptiveUserModel, 
  subjectFilter: 'AR' | 'MK' | null = null,
  excludeRecentQIds: number[] = []
): number | null {
  const cfg = model.engineConfig;
  const now = Date.now();

  // Check review queue for due items (priority order)
  const due = model.reviewQueue.filter(r => r.scheduledAt <= now).sort((a, b) => b.priority - a.priority);
  if (due.length) {
    const top = due[0];
    // Remove from queue
    model.reviewQueue = model.reviewQueue.filter(r => r.qId !== top.qId);
    saveAdaptiveUserModel(model);
    return top.qId;
  }

  // Build candidate list from pool
  const poolEntries = Object.entries(model.questionPool).filter(([qIdStr, q]) => {
    const qId = parseInt(qIdStr);
    if (subjectFilter && q.category !== subjectFilter) return false;
    if (excludeRecentQIds.includes(qId)) return false;
    return true;
  });

  if (!poolEntries.length) return null;

  // Compute weight for each question
  const candidates = poolEntries.map(([qIdStr, q]) => {
    const qId = parseInt(qIdStr);
    const fWeight = model.questionWeights[q.formulaId] || 1.0;
    const spaced = q.spacedScore || 0;
    
    // Recency factor: prefer not recently seen items
    const recencyMs = q.lastSeen ? (now - q.lastSeen) : Number.MAX_SAFE_INTEGER;
    const recencyFactor = Math.min(2, 1 + Math.log10((recencyMs / (1000 * 60 * 60)) + 1));
    
    let qWeight = fWeight * (1 + spaced * cfg.reviewFactor) * recencyFactor;
    qWeight = Math.max(cfg.minWeight * 0.2, Math.min(cfg.maxWeight * 2, qWeight));
    
    return { qId, q, qWeight };
  });

  // Exploration: small chance pick a random question
  if (Math.random() < cfg.baseExploration) {
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return pick.qId;
  }

  // Weighted random selection
  const total = candidates.reduce((s, c) => s + c.qWeight, 0);
  let r = Math.random() * total;
  
  for (const c of candidates) {
    r -= c.qWeight;
    if (r <= 0) return c.qId;
  }
  
  // Fallback
  return candidates[0]?.qId || null;
}

// Schedule a review
export function scheduleReview(
  model: AdaptiveUserModel, 
  qId: number, 
  secondsFromNow: number = 60 * 5,
  priority: number = 1, 
  reason: string = "mistake"
): void {
  const scheduledAt = Date.now() + secondsFromNow * 1000;
  model.reviewQueue.push({ qId, scheduledAt, priority, reason });
  model.reviewQueue.sort((a, b) => a.scheduledAt - b.scheduledAt);
}

// Adjust difficulty based on streak
export function adjustDifficultyOnStreak(model: AdaptiveUserModel, qId: number): void {
  const q = model.questionPool[qId];
  if (!q) return;
  
  const formula = q.formulaId;
  const s = model.statsByFormula[formula];
  if (!s) return;
  
  const cfg = model.engineConfig;
  
  // Bump up difficulty after success streak
  if (s.streak >= cfg.upStreakThreshold && q.difficulty === 'easy') {
    q.difficulty = 'medium';
    q.difficultyWeight = 2;
  } else if (s.streak >= cfg.upStreakThreshold + 2 && q.difficulty === 'medium') {
    q.difficulty = 'hard';
    q.difficultyWeight = 3;
  }
  
  // Degrade difficulty on failure streak
  if (s.streak <= cfg.downStreakThreshold && q.difficulty === 'hard') {
    q.difficulty = 'medium';
    q.difficultyWeight = 2;
  } else if (s.streak <= cfg.downStreakThreshold - 1 && q.difficulty === 'medium') {
    q.difficulty = 'easy';
    q.difficultyWeight = 1;
  }
}

// Handle post-attempt logic
export function handlePostAttempt(
  model: AdaptiveUserModel,
  params: {
    qId: number;
    formulaId: string;
    category: 'AR' | 'MK';
    correct: boolean;
    timeMs: number;
    difficulty: 'easy' | 'medium' | 'hard';
    source?: string;
  }
): AdaptiveUserModel {
  const { qId, formulaId, category, correct, timeMs, difficulty } = params;
  const cfg = model.engineConfig;
  
  // Record attempt
  const updatedModel = recordAttempt(model, { 
    qId, 
    formulaId, 
    category, 
    correct, 
    timeMs, 
    difficulty 
    ,
    source: (params as any).source
  });
  
  // Schedule review for incorrect answers
  if (!correct) {
    const q = updatedModel.questionPool[qId];
    const base = q?.difficulty === 'hard' ? 60 * 5 : (q?.difficulty === 'medium' ? 60 * 15 : 60 * 60);
    scheduleReview(updatedModel, qId, base, 2, "incorrect");
  } else {
    // Schedule spaced review based on mastery
    const s = updatedModel.statsByFormula[formulaId];
  const mastery = (s as any).ewma || 0;
    const intervalSeconds = Math.round(60 * 60 * 24 * Math.max(1, Math.pow(2, mastery * 3)));
    scheduleReview(updatedModel, qId, intervalSeconds, 0.5, "spaced");
  }
  
  // Adjust difficulty
  adjustDifficultyOnStreak(updatedModel, qId);
  
  // Save model
  saveAdaptiveUserModel(updatedModel);
  
  return updatedModel;
}

// Get recommended next question
export function getNextQuestion(
  subject: 'AR' | 'MK',
  questionBank: Question[],
  excludeIds: number[] = []
): Question | null {
  const model = loadAdaptiveUserModel();
  
  // Register any new questions
  questionBank.forEach(q => {
    if (!model.questionPool[q.id]) {
      registerQuestion(model, q);
    }
  });
  
  const nextQId = pickNextQuestion(model, subject, excludeIds);
  if (!nextQId) return null;
  
  return questionBank.find(q => q.id === nextQId) || null;
}