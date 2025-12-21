import { describe, it, expect, beforeEach } from 'vitest';
import { loadAdaptiveUserModel, registerQuestion, pickNextQuestion, getRecommendedDifficultyForCategory, adjustDifficultyOnStreak, handlePostAttempt, scheduleReview } from '../adaptive-engine';
import type { AdaptiveUserModel } from '../adaptive-engine';

function makeEmptyModel(): AdaptiveUserModel {
  const m = loadAdaptiveUserModel();
  // reset to a fresh in-memory model for tests
  m.questionPool = {} as any;
  m.statsByFormula = {} as any;
  m.statsByCategory = {} as any;
  m.questionWeights = {} as any;
  m.reviewQueue = [] as any;
  return m as AdaptiveUserModel;
}

describe('adaptive-engine', () => {
  beforeEach(() => {
    // clear localStorage keys used by the adaptive engine
    try { localStorage.clear(); } catch (e) {}
  });

  it('getRecommendedDifficultyForCategory returns easy for low data', () => {
    const m = makeEmptyModel();
    const d = getRecommendedDifficultyForCategory(m, 'AR');
    expect(d).toBe('easy');
  });

  it('getRecommendedDifficultyForCategory maps ewma to tiers including very-hard/master', () => {
    const m = makeEmptyModel();
    m.statsByCategory['AR'] = { attempts: 10, correct: 9, avgTimeMs: 0, lastAttemptAt: Date.now(), streak: 0, ewma: 0.95 } as any;
    expect(getRecommendedDifficultyForCategory(m, 'AR')).toBe('master');
    m.statsByCategory['AR'].ewma = 0.9;
    expect(getRecommendedDifficultyForCategory(m, 'AR')).toBe('very-hard');
    m.statsByCategory['AR'].ewma = 0.75;
    expect(getRecommendedDifficultyForCategory(m, 'AR')).toBe('hard');
    m.statsByCategory['AR'].ewma = 0.4;
    expect(getRecommendedDifficultyForCategory(m, 'AR')).toBe('easy');
  });

  it('pickNextQuestion returns scheduled review item first', () => {
    const m = makeEmptyModel();
    // register two questions
    registerQuestion(m, { id: 100, text: 'Q1', options: [], answer: 0, difficulty: 'medium', difficultyWeight: 2, formulaId: 'f1', category: 'AR' } as any);
    registerQuestion(m, { id: 101, text: 'Q2', options: [], answer: 0, difficulty: 'medium', difficultyWeight: 2, formulaId: 'f2', category: 'AR' } as any);
    // schedule review for 101 in the past
    scheduleReview(m, 101, -60, 10, 'mistake');
    const pick = pickNextQuestion(m, 'AR', []);
    expect(pick).toBe(101);
  });

  it('pickNextQuestion respects subject filter and exclusions', () => {
    const m = makeEmptyModel();
    registerQuestion(m, { id: 200, text: 'Q1', options: [], answer: 0, difficulty: 'easy', difficultyWeight: 1, formulaId: 'f1', category: 'AR' } as any);
    registerQuestion(m, { id: 201, text: 'Q2', options: [], answer: 0, difficulty: 'easy', difficultyWeight: 1, formulaId: 'f2', category: 'AR' } as any);
    const pick = pickNextQuestion(m, 'AR', [200]);
    expect(pick).not.toBe(200);
    expect([200, 201]).toContain(pick as number);
  });

  it('adjustDifficultyOnStreak bumps difficulty on up streak', () => {
    const m = makeEmptyModel();
    registerQuestion(m, { id: 300, text: 'Q', options: [], answer: 0, difficulty: 'easy', difficultyWeight: 1, formulaId: 'formA', category: 'AR' } as any);
    // Ensure statsByFormula exists and has a streak
    m.statsByFormula['formA'] = { attempts: 5, correct: 5, avgTimeMs: 0, lastAttemptAt: Date.now(), streak: 3 } as any;
    // call adjustDifficultyOnStreak
    adjustDifficultyOnStreak(m, 300);
    expect(m.questionPool[300].difficulty).not.toBe('easy');
  });

  it('handlePostAttempt schedules a review for incorrect answers', () => {
    const m = makeEmptyModel();
    registerQuestion(m, { id: 400, text: 'Q', options: [], answer: 0, difficulty: 'hard', difficultyWeight: 3, formulaId: 'formB', category: 'AR' } as any);
    const before = (m.reviewQueue || []).length;
    const updated = handlePostAttempt(m, { qId: 400, formulaId: 'formB', category: 'AR', correct: false, timeMs: 1000, difficulty: 'hard' });
    const after = updated.reviewQueue.length;
    expect(after).toBeGreaterThan(before);
  });
});
