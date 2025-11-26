import { useState, useCallback } from 'react';

// Simple per-session mastery loop hook: tracks per-formula cycles and recommends next action
// This is intentionally lightweight and kept in-memory (not persisted). It tracks consecutive corrects
// and transitions to recall tests after the required number of corrects.

export type MasteryState = {
  consecutiveCorrect: number;
  inCycle: boolean; // true if the user is in the mastery cycle for this concept
  inRecall: boolean; // true if the recall test is active for this concept
  mastered: boolean; // true if the user achieved mastery this session
  lastFailedAt?: number;
};

export function useConceptMastery(requiredCorrects = 3) {
  const [states, setStates] = useState<Record<string, MasteryState>>({});

  const get = useCallback((formulaId: string) => {
    return states[formulaId] || { consecutiveCorrect: 0, inCycle: false, inRecall: false, mastered: false };
  }, [states]);

  const startCycle = useCallback((formulaId: string) => {
    setStates(prev => ({ ...prev, [formulaId]: { ...(prev[formulaId] || { consecutiveCorrect: 0 }), consecutiveCorrect: 0, inCycle: true, inRecall: false, mastered: false, lastFailedAt: Date.now() } }));
  }, []);

  const resetCycle = useCallback((formulaId: string) => {
    setStates(prev => ({ ...prev, [formulaId]: { consecutiveCorrect: 0, inCycle: false, inRecall: false, mastered: false } }));
  }, []);

  const recordAttempt = useCallback((formulaId: string, isCorrect: boolean, opts: { isRecall?: boolean } = {}) => {
    const st = states[formulaId] || { consecutiveCorrect: 0, inCycle: false, inRecall: false, mastered: false };
    // If the concept was already mastered in this session, no further action
    if (st.mastered) return { state: st, event: 'already_mastered' as const };
    if (!isCorrect) {
      // Start or continue a cycle; reset consecutive correct
      const newState: MasteryState = { ...st, inCycle: true, consecutiveCorrect: 0, inRecall: false, lastFailedAt: Date.now(), mastered: false };
      setStates(prev => ({ ...prev, [formulaId]: newState }));
      return { state: newState, event: 'wrong' as const };
    }
    // Correct attempt
    if (opts.isRecall) {
      // If recall was correct, mark mastered and reset cycle flags
      const newState: MasteryState = { ...st, consecutiveCorrect: requiredCorrects, inCycle: false, inRecall: false, mastered: true };
      setStates(prev => ({ ...prev, [formulaId]: newState }));
      return { state: newState, event: 'recall_correct' as const };
    }
    // If in cycle, increase the consecutive count and check threshold
    if (st.inCycle) {
      const newCount = (st.consecutiveCorrect || 0) + 1;
      const newState: MasteryState = { ...st, consecutiveCorrect: newCount };
      let event: 'cycle_continues' | 'cycle_to_recall' = 'cycle_continues';
      if (newCount >= requiredCorrects) {
        // Enter recall test
        newState.inRecall = true;
        newState.inCycle = false;
        event = 'cycle_to_recall';
      }
      setStates(prev => ({ ...prev, [formulaId]: newState }));
      return { state: newState, event };
    }
    // Not in cycle and not a recall: regular correct - no changes
    const unchanged = st;
    return { state: unchanged, event: 'correct' as const };
  }, [states, requiredCorrects]);

  const enterRecall = useCallback((formulaId: string) => {
    const st = states[formulaId] || { consecutiveCorrect: 0, inCycle: false, inRecall: false, mastered: false };
    const newState = { ...st, inCycle: false, inRecall: true };
    setStates(prev => ({ ...prev, [formulaId]: newState }));
    return newState;
  }, [states]);

  const getState = useCallback(() => states, [states]);

  return { get, getState, startCycle, resetCycle, recordAttempt, enterRecall };
}
