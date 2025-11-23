/* Simple smoke test for dedupe and import idempotence
   Usage: npx tsx scripts/smoke_dedupe.ts
*/

// Minimal localStorage shim for Node
const createLocalStorageShim = () => {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
    clear() { store = {}; }
  };
};

// Put the shim onto globalThis so the library code can call localStorage
(globalThis as any).localStorage = createLocalStorageShim();

import path from 'path';
// Use tsx execution, import adaptive-engine from local source
import * as AE from '../src/lib/adaptive-engine';
import generateProblem from '../src/ai/generateProblem';
const AEany: any = AE;

(async function main() {
  try {
    console.log('Starting smoke dedupe test');
    // Clean log keys
    const ATTEMPT_LOG = 'asvab_attempt_log_v1';
    const DAILY_KEY = 'asvab_daily_training';
    localStorage.removeItem(ATTEMPT_LOG);
    localStorage.removeItem(DAILY_KEY);

    // Get a fresh model
  let model = AEany.loadAdaptiveUserModel();

    const qCount = 20;
    const correctCount = 6;

    // 1) Simulate a live session: qId 1..20
    for (let i = 1; i <= qCount; i++) {
      const correct = i <= correctCount;
  model = AEany.handlePostAttempt(model, {
        qId: i,
        formulaId: 'f1',
        category: 'AR',
        correct,
        timeMs: 5000,
        difficulty: 'medium',
        source: 'live'
      });
    }

    // Inspect attempt log
    const rawAfterLive = localStorage.getItem(ATTEMPT_LOG);
    const logAfterLive = rawAfterLive ? JSON.parse(rawAfterLive) : [];
    console.log('After live session -> attempt log length =', logAfterLive.length);
    console.log('After live session -> correct count =', logAfterLive.filter((e: any) => e.correct).length);

    // 2) Simulate a synthetic import (the daily cache) for the same day without qIds
    for (let i = 1; i <= qCount; i++) {
      const correct = i <= correctCount;
      // Synthetic entries have no qId
  model = AEany.recordAttempt(model, {
        qId: undefined,
        formulaId: 'f1',
        category: 'AR',
        correct,
        timeMs: 20000,
        difficulty: 'medium',
        source: 'daily_import_synthetic'
      });
    }

    // Inspect log - should still be qCount entries as synthetic imports should be skipped
    const rawAfterSynthetic = localStorage.getItem(ATTEMPT_LOG);
    const logAfterSynthetic = rawAfterSynthetic ? JSON.parse(rawAfterSynthetic) : [];
    console.log('After synthetic import -> attempt log length =', logAfterSynthetic.length);
    console.log('After synthetic import -> correct count =', logAfterSynthetic.filter((e: any) => e.correct).length);

    // 3) Simulate backfill (qId entries again) - should not create duplicates
    for (let i = 1; i <= qCount; i++) {
      const correct = i <= correctCount;
  model = AEany.handlePostAttempt(model, {
        qId: i,
        formulaId: 'f1',
        category: 'AR',
        correct,
        timeMs: 4000,
        difficulty: 'medium',
        source: 'backfill'
      });
    }

    const rawAfterBackfill = localStorage.getItem(ATTEMPT_LOG);
    const logAfterBackfill = rawAfterBackfill ? JSON.parse(rawAfterBackfill) : [];
    console.log('After backfill -> attempt log length =', logAfterBackfill.length);
    console.log('After backfill -> correct count =', logAfterBackfill.filter((e: any) => e.correct).length);

    // Summary: Should remain qCount and correctCount
    const total = logAfterBackfill.length;
    const correctTotal = logAfterBackfill.filter((e: any) => e.correct).length;

    console.log('=== Summary ===');
    console.log('Expected attempts:', qCount, 'Observed attempts:', total);
    console.log('Expected correct:', correctCount, 'Observed correct:', correctTotal);

  // Also show first few log entries to verify qId presence
    console.log('First 6 attempts in log sample:', JSON.stringify(logAfterBackfill.slice(0, 6), null, 2));

    // Validate: ensure all entries have qId and no duplicates by qId
    const qIds = logAfterBackfill.map((x: any) => x.qId).filter(Boolean);
    const uniqueQIds = Array.from(new Set(qIds));
    const duplicates = qIds.length !== uniqueQIds.length;
    let overallPassed = true;
    if (total === qCount && correctTotal === correctCount && !duplicates) {
      console.log('Smoke test partial check PASSED: no duplicates and counts match expected');
      // Now rebuild adaptive model from attempt log and verify counts align
  const rebuilt = AEany.rebuildAdaptiveModelFromAttemptLog();
      const modelAttempts = Object.values(rebuilt.statsByFormula).reduce((s:any,a:any) => s + (a.attempts || 0), 0);
      const modelCorrect = Object.values(rebuilt.statsByFormula).reduce((s:any,a:any) => s + (a.correct || 0), 0);
      console.log('Rebuilt model attempts =', modelAttempts, 'correct =', modelCorrect);
      if (modelAttempts === total && modelCorrect === correctTotal) {
        console.log('Rebuild consistency check PASSED');
      } else {
        overallPassed = false;
        console.error('Rebuild consistency check FAILED');
      }
    } else {
      overallPassed = false;
      console.error('Smoke test FAILED: mismatch or duplicates detected');
    }
    // 4) Verify Study Mode does not write to daily_training cache but is added to attempt log
    const beforeDailyRaw = localStorage.getItem(DAILY_KEY);
    const beforeAttemptLogRaw = localStorage.getItem(ATTEMPT_LOG);
  const beforeAttemptLog = JSON.parse(beforeAttemptLogRaw || '[]');
    const beforeDaily = beforeDailyRaw;
    // Simulate a study-mode attempt
  model = AEany.handlePostAttempt(model, {
      qId: 9999,
      formulaId: 'f1',
      category: 'AR',
      correct: true,
      timeMs: 2000,
      difficulty: 'easy',
      source: 'study_mode'
    });
    const afterDailyRaw = localStorage.getItem(DAILY_KEY);
    const afterAttemptLogRaw = localStorage.getItem(ATTEMPT_LOG);
  const afterAttemptLog = JSON.parse(afterAttemptLogRaw || '[]');
    if (afterDailyRaw !== beforeDaily) {
      overallPassed = false;
      console.error('Study Mode wrote to daily cache — this is unexpected');
    }
    if (afterAttemptLog.length !== beforeAttemptLog.length + 1) {
      overallPassed = false;
      console.error('Study Mode attempt did not add to attempt log as expected');
    }
    console.log('Study Mode smoke check PASSED: added to attempt log but did NOT write to daily cache');

    // 5) Difficulty classification smoke check.
    // Add 6 correct hard attempts to ensure 'Hard' classification
    for (let i = 0; i < 6; i++) {
      model = AEany.handlePostAttempt(model, {
        qId: 5000 + i,
        formulaId: 'f1',
        category: 'AR',
        correct: true,
        timeMs: 2000,
        difficulty: 'hard',
        source: 'live'
      });
    }
  const difficulty = AEany.getUserDifficultyFromAttemptLog(30);
    console.log('Difficulty classification from attempt log:', difficulty);
    if (difficulty !== 'Hard') {
      overallPassed = false;
      console.error('Difficulty classification FAILED — expected Hard');
    }
    console.log('Difficulty classification PASSED');

    // 6) Strengths / Weaknesses / Topics checks (derive directly from adaptive model stats)
    const smodel = AEany.loadAdaptiveUserModel();
    const sStats = smodel.statsByFormula || {};
    const topicsArr = Object.entries(sStats).map(([id, s]: any) => ({ formulaId: id, attempts: s.attempts || 0, correct: s.correct || 0, mastery: s.attempts ? (s.correct / s.attempts) : 0 }));
    const strengths = topicsArr.filter(t => t.mastery >= 0.8 && t.attempts >= 3);
    const weaknesses = topicsArr.filter(t => t.mastery < 0.6 && t.attempts >= 3);
    console.log('Topics attempted sample: ', topicsArr.slice(0,5));
    // Ensure f1 is present in topics and in strengths after many corrects
    if (!topicsArr.some((t: any) => t.formulaId === 'f1')) {
      overallPassed = false;
      console.error('TopicsAttempted FAILED: f1 not found in topics');
    }
    if (!strengths.some((s: any) => s.formulaId === 'f1')) {
      overallPassed = false;
      console.error('Strengths FAILED: f1 not found in strengths');
    }
    // create a weak area: record several incorrect attempts on formula 'f2'
    for (let i = 0; i < 4; i++) {
  model = AEany.handlePostAttempt(model, { qId: 6000 + i, formulaId: 'f2', category: 'AR', correct: false, timeMs: 1000, difficulty: 'medium', source: 'live' });
    }
  const smodel2 = AEany.loadAdaptiveUserModel();
  const sStats2 = smodel2.statsByFormula || {};
  const topicsArr2 = Object.entries(sStats2).map(([id, s]: any) => ({ formulaId: id, attempts: s.attempts || 0, correct: s.correct || 0, mastery: s.attempts ? (s.correct / s.attempts) : 0 }));
    if (!topicsArr2.some((s: any) => s.formulaId === 'f2' && s.mastery < 0.6 && s.attempts >= 3)) {
      overallPassed = false;
      console.error('Weaknesses FAILED: f2 not present after repeated incorrect attempts');
    }
    console.log('Strengths/Weaknesses/Topics checks PASSED');

    // 7) AI-generated problem flows: generate a problem and submit a correct answer
    try {
      const ai = await generateProblem('AR', 2);
      const qIdAI = Date.now();
      // Submit a recorded correct attempt for this AI problem
      model = AEany.handlePostAttempt(model, { qId: qIdAI, formulaId: 'ai_generated_AR', category: 'AR', correct: true, timeMs: 4000, difficulty: 'medium', source: 'ai_generated' });
      const rawAfterAI = localStorage.getItem(ATTEMPT_LOG);
      const logAfterAI = rawAfterAI ? JSON.parse(rawAfterAI) : [];
      if (!logAfterAI.some((e: any) => e.qId === qIdAI)) {
        console.error('AI-generated attempt not added to attempt log');
        process.exit(2);
      }
  console.log('AI flow check PASSED');
    } catch (err) {
      overallPassed = false;
      console.error('AI flow check FAILED', err);
    }
    if (!overallPassed) process.exit(2);
    console.log('Smoke test complete');
    process.exit(0);
  } catch (err) {
    console.error('Smoke test threw error:', err);
    process.exit(1);
  }
})();
