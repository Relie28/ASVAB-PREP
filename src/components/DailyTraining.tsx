"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Target, ArrowLeft, Lightbulb } from "lucide-react";
// Removed react-icons import, using lucide-react Lightbulb for both places
import { batchGenerate, batchGenerateAI, Question, generateARQuestion, generateMKQuestion, shuffleChoicesForQuestion } from "@/lib/question-generator";
import { normalizeText } from '@/ai/duplicates';
import { handlePostAttempt, loadAdaptiveUserModel } from "@/lib/adaptive-engine";
import { useConceptMastery } from '@/hooks/useConceptMastery';
import { Checkbox } from '@/components/ui/checkbox';
import { getDeepTeaching } from '@/lib/decision-engine';
import { isAnswerCorrect } from '@/ai/answers';

type DailyRecord = {
  date: string; // yyyy-mm-dd
  attempted: number;
  correct: number;
  entries?: Array<{
    formulaId: string;
    category: 'AR' | 'MK';
    chosen: number | string | null;
    correct: boolean;
    timeMs: number | null;
  }>;
};

type DailyState = {
  lastCompletedDate?: string;
  lastCompletedAt?: string; // ISO timestamp when last counted/completed
  streak: number;
  records: DailyRecord[]; // last N days
  dailyTarget: number; // number of questions target for today
};

const STORAGE_KEY = "asvab_daily_training";

function localDateKey(d?: Date) {
  const dt = d ? new Date(d) : new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function todayLocal() {
  return localDateKey();
}

function yesterdayLocal() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateKey(d);
}

export default function DailyTraining({ onExit }: { onExit?: () => void }) {
  // Load or init state
  const [state, setState] = useState<DailyState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { streak: 0, records: [], dailyTarget: 20 };
  });

  // Session state
  const TOTAL_SECONDS = 30 * 60; // 30 minutes
  const [remainingSeconds, setRemainingSeconds] = useState(TOTAL_SECONDS);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | string | null)[]>([]);
  const [responseTimes, setResponseTimes] = useState<(number | null)[]>([]);
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState<number | null>(null);
  const [hintUnlocked, setHintUnlocked] = useState(false);
  const sessionTimerRef = useRef<number | null>(null);
  const startQuestionTimeRef = useRef<number | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const [sessionResults, setSessionResults] = useState<any | null>(null);
  const persistGenerated = typeof window !== 'undefined' ? (localStorage.getItem('ai_persist_generated') === 'true') : false;
  const mastery = useConceptMastery();
  const [currentCycleFormula, setCurrentCycleFormula] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownContent, setBreakdownContent] = useState<any | null>(null);
  const [breakdownStepsCompleted, setBreakdownStepsCompleted] = useState<boolean[]>([]);
  const [isRecallMode, setIsRecallMode] = useState(false);

  // whether a new session is allowed (24-hour lockout since lastCompletedAt)
  const allowedToStart = (() => {
    try {
      if (!state.lastCompletedAt) return true;
      const last = new Date(state.lastCompletedAt).getTime();
      const now = Date.now();
      return now - last >= 24 * 60 * 60 * 1000;
    } catch (e) {
      return true;
    }
  })();

  // derive target questions from state.dailyTarget — only generate when allowedToStart
  useEffect(() => {
    if (!allowedToStart) {
      setQuestions([]);
      setAnswers([]);
      setResponseTimes([]);
      return;
    }

    const target = Math.max(5, Math.round(state.dailyTarget));
    // generate mixed AR & MK questions using AI when possible
    const mixedCount = Math.max(1, Math.floor(target * 0.1));
    const half = Math.ceil((target - mixedCount) / 2);
    (async () => {
      let ar: Question[] = [];
      let mk: Question[] = [];
      let mixed: Question[] = [];
  try {
    const model = loadAdaptiveUserModel();
  ar = await batchGenerateAI(half, 'AR', model, undefined, undefined, { persist: persistGenerated });
  mk = await batchGenerateAI(target - half - mixedCount, 'MK', model, undefined, undefined, { persist: persistGenerated });
  mixed = await batchGenerateAI(mixedCount, 'MIXED', model, undefined, undefined, { persist: persistGenerated });
      } catch (e) {
        ar = batchGenerate(half, "AR");
        mk = batchGenerate(target - half - mixedCount, "MK");
        mixed = batchGenerate(mixedCount, "AR");
      }
    // interleave with occasional mixed problems
    const merging: Question[] = [];
    for (let i = 0; i < target; i++) {
      if (mixed.length && i % 5 === 0) {
        merging.push(mixed.shift()!);
        continue;
      }
      merging.push(i % 2 === 0 ? ar.shift()! : mk.shift()!);
    }
  setQuestions(merging);
      setAnswers(Array(mixed.length).fill(null));
      setResponseTimes(Array(mixed.length).fill(null));
      // reset timers and state
      setRemainingSeconds(TOTAL_SECONDS);
      setCurrentIdx(0);
      startQuestionTimeRef.current = Date.now();
      sessionStartRef.current = Date.now();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.dailyTarget, allowedToStart]);

  // clear selected choice when moving to a new question
  useEffect(() => {
    setSelectedChoiceIndex(null);
  }, [currentIdx]);

  // reset hintUnlocked for each new question so the Show Hint button appears again
  useEffect(() => {
    setHintUnlocked(false);
  }, [currentIdx]);

  // Session timer — only run when a session actually exists (questions present) and start is allowed
  useEffect(() => {
    if (!allowedToStart || questions.length === 0) return undefined;
    sessionTimerRef.current = window.setInterval(() => {
      setRemainingSeconds((s) => {
        if (s <= 1) {
          if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, [allowedToStart, questions.length]);

  // No per-question timer: users have the full session time to think. We track per-question response times instead.

  // End session when overall timer hits 0 (only count streak when time expired or completed)
  useEffect(() => {
    if (remainingSeconds <= 0) {
      finishSession(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds]);

  function persist(newState: DailyState) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newState)); } catch (e) {}
    setState(newState);
  }

  function handleAnswer(choice: number | string | null, timedOut = false) {
    // record answer and response time (work with local copies to avoid async state timing issues)
    setAnswers((prev) => {
      const out = [...prev];
      out[currentIdx] = choice;
      return out;
    });
    setResponseTimes((prev) => {
      const out = [...prev];
      const start = startQuestionTimeRef.current || Date.now();
      out[currentIdx] = Date.now() - start;
      return out;
    });
    // create copies representing the updated state so we can finish reliably
    const nextAnswers = [...answers];
    nextAnswers[currentIdx] = choice;
    const start = startQuestionTimeRef.current || Date.now();
    const nextResponseTimes = [...responseTimes];
    nextResponseTimes[currentIdx] = Date.now() - start;
    // reset start time for next question
    startQuestionTimeRef.current = Date.now();
    // record this single attempt immediately into adaptive model so dashboard updates in realtime
    try {
      const q = questions[currentIdx];
      if (q) {
        handlePostAttempt(loadAdaptiveUserModel(), {
          qId: q.id,
          formulaId: q.formulaId,
          category: q.category,
          correct: choice !== null && isAnswerCorrect(q.answer, choice),
          timeMs: nextResponseTimes[currentIdx] || 0,
          difficulty: q.difficulty
        , source: 'live' });
        // notify listeners (Dashboard) that adaptive model changed
        try { window.dispatchEvent(new CustomEvent('adaptiveModelUpdated')); } catch (e) {}
      }
    } catch (e) {
      console.warn('Failed to record live attempt', e);
    }
    // Mastery loop: start cycle on incorrect answers and show breakdown, pause progression
    try {
      const q = questions[currentIdx];
      const wasCorrect = q && choice !== null && isAnswerCorrect(q.answer, choice);
      if (!q) {
        // nothing
      } else {
        const res = mastery.recordAttempt(q.formulaId, wasCorrect, { isRecall: isRecallMode });
        if (!wasCorrect) {
          mastery.startCycle(q.formulaId);
          setCurrentCycleFormula(q.formulaId);
        const teach = getDeepTeaching(q.formulaId);
        const steps = (q.solveSteps || teach.steps || []);
        setBreakdownContent({ definition: teach.definition, steps: steps, tips: teach.tips });
      setBreakdownStepsCompleted(steps.map(() => false));
          setShowBreakdown(true);
          // don't auto-advance - user must tap continue
          return;
        } else if (res && (res as any).event === 'cycle_to_recall') {
          setIsRecallMode(true);
          setShowBreakdown(false);
        } else if (res && (res as any).event === 'recall_correct') {
          setIsRecallMode(false);
          setShowBreakdown(false);
          setCurrentCycleFormula(null);
          setBreakdownStepsCompleted([]);
        }
      }
    } catch (e) {}
    // move to next if any
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      // finish early (didn't wait for full 30 minutes) - pass the latest arrays to finishSession
      finishSession(false, nextAnswers, nextResponseTimes);
    }
  }

  const handleMasteryContinue = async () => {
    if (!currentCycleFormula) {
      // nothing — fallback to next question
      if (currentIdx < questions.length - 1) setCurrentIdx(i => i + 1);
      return;
    }
    try {
      const prevQ = questions[currentIdx];
      if (!prevQ) { if (currentIdx < questions.length - 1) setCurrentIdx(i => i + 1); return; }
      const prevText = normalizeText(prevQ.text || '');
      const prevAns = prevQ.answer;
      let q: Question | null = null; let attempts = 0;
      while (attempts < 6 && !q) {
        const more = await batchGenerateAI(1, 'MIXED', loadAdaptiveUserModel(), undefined, [prevText], { persist: persistGenerated, forceParaphrase: true });
        const cand = more && more.length ? more[0] : null;
        if (cand && cand.formulaId === currentCycleFormula && String(cand.answer) !== String(prevAns)) {
          const prevIndex = (prevQ.choices || []).findIndex(c => String(c) === String(prevAns));
          q = shuffleChoicesForQuestion(cand, prevIndex === -1 ? undefined : prevIndex);
          break;
        }
        attempts++;
      }
      if (!q) {
        let fallbackCandidate: Question | null = null; let tries = 0;
        while (!fallbackCandidate && tries < 10) {
          const det = questions[currentIdx].category === 'AR' ? generateARQuestion(currentCycleFormula as any, 'medium') : generateMKQuestion(currentCycleFormula as any, 'medium');
          if (String(det.answer) !== String(prevAns)) fallbackCandidate = det as any;
          tries++;
        }
        if (fallbackCandidate) {
          const prevIndex = (prevQ.choices || []).findIndex(c => String(c) === String(prevAns));
          q = shuffleChoicesForQuestion(fallbackCandidate as any, prevIndex === -1 ? undefined : prevIndex);
        }
      }
      if (!q || q.formulaId !== currentCycleFormula) {
        const forced = await batchGenerateAI(1, 'MIXED', loadAdaptiveUserModel(), undefined, [prevText], { persist: persistGenerated });
        const cand = forced && forced[0] ? forced[0] : null;
        if (cand && cand.formulaId === currentCycleFormula && String(cand.answer) !== String(prevAns)) {
          const prevIndex = (currentQuestion ? (currentQuestion.choices || []).findIndex(c => String(c) === String(prevAns)) : -1);
          q = shuffleChoicesForQuestion(cand as any, prevIndex === -1 ? undefined : prevIndex);
        }
      }
      if (q) {
        const updated = [...questions];
        if (currentIdx < updated.length - 1) {
          updated[currentIdx + 1] = q;
        } else updated.push(q);
        setQuestions(updated);
        setSelectedChoiceIndex(null);
        setShowBreakdown(false);
  setCurrentIdx(i => i + 1);
  setBreakdownStepsCompleted([]);
      } else {
        if (currentIdx < questions.length - 1) setCurrentIdx(i => i + 1);
      }
    } catch (e) {
      // fallback simple next
      if (currentIdx < questions.length - 1) setCurrentIdx(i => i + 1);
    }
  };

  function finishSession(isTimeExpired: boolean = false, answersArg?: (number | string | null)[], responseTimesArg?: (number | null)[]) {
    // stop timers
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    // compute stats and per-question results
    const answersToUse = answersArg ?? answers;
    const responseTimesToUse = responseTimesArg ?? responseTimes;
    const attempted = answersToUse.filter((a) => a !== null).length;
    let correct = 0;
    const perQuestionResults = questions.map((q, i) => {
      const chosen = answersToUse[i];
      const isCorrect = chosen !== null && isAnswerCorrect(q.answer, chosen);
      if (isCorrect) correct++;
      return {
        id: q.id,
        text: q.text,
        formulaId: q.formulaId,
        category: q.category,
        chosen,
        correctAnswer: q.answer,
        correct: isCorrect,
        timeMs: responseTimesToUse[i] || null,
        difficulty: q.difficulty
      };
    });

    // NOTE: per-question attempts are recorded live in handleAnswer to avoid double-recording here.
    const recordDate = todayLocal();
    const record: DailyRecord = { date: recordDate, attempted, correct };
    // attach per-question entries for exact importing/merging later
    const entries = perQuestionResults.filter((r: any) => r.chosen !== null).map((r: any) => ({
      formulaId: r.formulaId,
      category: r.category,
      qId: r.id,
      chosen: r.chosen,
      correct: !!r.correct,
      timeMs: r.timeMs || null
    }));
    if (entries.length) record.entries = entries;

    // Ensure any per-question attempts that failed to write live are recorded now.
    // We check the centralized attempt log for entries with matching qId within this session window
    try {
      const raw = localStorage.getItem('asvab_attempt_log_v1');
      const parsedLog = raw ? JSON.parse(raw) as Array<any> : [];
      const sessionStart = sessionStartRef.current || 0;
      // compute day window for the record date so we can detect synthetic imports (which don't have qId)
      const dayStart = new Date(recordDate + 'T00:00:00').getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      perQuestionResults.forEach((r: any) => {
        if (!r || r.chosen === null) return;
        // If there's already an attempt in the log for this qId and ts >= sessionStart, skip.
        // Additionally, if a synthetic import exists for the same formulaId on the same day with the same correctness,
        // treat it as existing to avoid creating a duplicate (one with qId and one without).
        const exists = parsedLog.some((e: any) => {
          if (!e) return false;
          // exact qId match and within session window
          if (e.qId && r.id && e.qId === r.id && e.ts >= sessionStart) return true;
          // synthetic match: same formulaId on same day and same correctness
          if (e.formulaId === r.formulaId && e.ts >= dayStart && e.ts < dayEnd && e.correct === !!r.correct) return true;
          return false;
        });
        if (!exists) {
          try {
            handlePostAttempt(loadAdaptiveUserModel(), {
              qId: r.id,
              formulaId: r.formulaId,
              category: r.category,
              correct: !!r.correct,
              timeMs: r.timeMs || 0,
              difficulty: r.difficulty || 'medium'
            , source: 'backfill' });
            // handlePostAttempt will append to the centralized attempt log
          } catch (e) {
            // ignore
          }
        }
      });
    } catch (e) {
      // ignore attempt-log check errors
    }
    

    // update streak if session ended by time or completed all questions
    let streak = state.streak || 0;
    const sessionCompleted = attempted === questions.length;
    const lastDate = state.lastCompletedDate;
    const today = todayLocal();
    const yesterday = yesterdayLocal();

    // Determine whether the session qualifies to award/reset streak.
    // Award only when (time expired || session completed) AND attempted>0 && correct>0.
    let awarded = false;
    if (isTimeExpired || sessionCompleted) {
      if (attempted === 0 || correct === 0) {
        // no progress: explicitly clear streak (per rule: counts only if progress shown)
        streak = 0;
      } else if (lastDate === today) {
        // already awarded today — don't change streak
        awarded = false;
      } else if (lastDate === yesterday) {
        // contiguous day -> increment
        streak = (state.streak || 0) + 1;
        awarded = true;
      } else {
        // gap > 1 day (or no previous) -> reset to 1 (start new streak)
        streak = 1;
        awarded = true;
        
      }
    }

    const records = [...state.records.filter(r => r.date !== record.date), record].slice(-30);

    // weekly adjustment: check last 7 days average accuracy
    const last7 = records.slice(-7);
    const avgAcc = last7.length ? (last7.reduce((s, r) => s + (r.attempted ? (r.correct / r.attempted) : 0), 0) / last7.length) : 0;
    let dailyTarget = state.dailyTarget || 20;
    // If avgAcc >= 0.8 increase by 10% (rounded) else keep same. Only change once per week (use lastCompletedDate week check)
    try {
      const lastWeekCheck = localStorage.getItem(STORAGE_KEY + ":lastWeekCheck");
      // simple approach: if 7 records exist and lastWeekCheck !== weekKey, adjust once
      if (records.length >= 7) {
        const weekKey = records.slice(-7)[0].date; // simple marker for the week window
        if (lastWeekCheck !== weekKey) {
          if (avgAcc >= 0.8) {
            dailyTarget = Math.round(dailyTarget * 1.1);
          }
          localStorage.setItem(STORAGE_KEY + ":lastWeekCheck", weekKey);
        }
      }
    } catch (e) {}

    const newState: DailyState = {
      ...state,
      // set lastCompletedDate and timestamp only when the session actually qualifies (awarded)
      lastCompletedDate: awarded ? record.date : state.lastCompletedDate,
      lastCompletedAt: awarded ? new Date().toISOString() : state.lastCompletedAt,
      streak,
      records,
      dailyTarget,
    };
    persist(newState);
    // set results for in-app summary view; include whether a streak award was granted
    setSessionResults({ attempted, correct, streak, perQuestionResults, streakAwarded: awarded });
  }

  const currentQuestion = questions[currentIdx];

  const progress = useMemo(() => {
    const attempted = answers.filter((a) => a !== null).length;
    return { attempted, total: questions.length };
  }, [answers, questions]);

  if (sessionResults) {
    // Results view after session ends
    const { attempted, correct, streak, perQuestionResults, streakAwarded } = sessionResults;
    const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;
    const topCorrect = perQuestionResults.filter((r: any) => r.correct).slice(0, 5);
    const topIncorrect = perQuestionResults.filter((r: any) => !r.correct).slice(0, 5);

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Daily Training — Results</CardTitle>
              <CardDescription>Session summary and question-level feedback</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Attempted</p>
                  <p className="text-2xl font-bold">{attempted}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Correct</p>
                  <p className="text-2xl font-bold text-green-600">{correct}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Accuracy</p>
                  <p className="text-2xl font-bold">{accuracy}%</p>
                </div>
              </div>

              <div className="mb-4">
                {streakAwarded ? (
                  <p className="text-sm text-green-600">Good job — your daily streak was incremented.</p>
                ) : (
                  <p className="text-sm text-gray-600">Session ended before the full 30 minutes — streak not incremented.</p>
                )}
              </div>

              <div className="mb-4">
                <h3 className="font-medium mb-2">Questions you did well on</h3>
                {topCorrect.length ? (
                  topCorrect.map((q: any) => (
                    <div key={q.id} className="border rounded p-3 mb-2 bg-green-50">
                      <div className="font-medium">{q.text}</div>
                      <div className="text-sm text-gray-600">Chosen: {String(q.chosen)} • Time: {q.timeMs ? Math.round(q.timeMs/1000) + 's' : '—'}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-600">No correctly answered questions in this session.</p>
                )}
              </div>

              <div className="mb-4">
                <h3 className="font-medium mb-2">Questions to review</h3>
                {topIncorrect.length ? (
                  topIncorrect.map((q: any) => (
                    <div key={q.id} className="border rounded p-3 mb-2 bg-red-50">
                      <div className="font-medium">{q.text}</div>
                      <div className="text-sm text-gray-600">Chosen: {String(q.chosen)} • Correct: {String(q.correctAnswer)}</div>
                      <div className="text-sm text-gray-600">Formula hint: {q.formulaId}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-600">Nice work — no items to review from this session.</p>
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={() => { if (onExit) onExit(); }}>Return to Home</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // If user is still within the 24-hour lockout window, show a friendly message and prevent starting a session
  if (!allowedToStart) {
    let nextAvailableText = 'Tomorrow';
    try {
      const nextMs = new Date(state.lastCompletedAt!).getTime() + 24 * 60 * 60 * 1000;
      nextAvailableText = new Date(nextMs).toLocaleString();
    } catch (e) {}

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Daily Training — Locked</CardTitle>
              <CardDescription>You can only complete Daily Training once every 24 hours.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <p className="text-sm text-gray-600">You've already completed today's Daily Training.</p>
                <p className="text-sm text-gray-700 mt-2">Next available: <strong>{nextAvailableText}</strong></p>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => { if (onExit) onExit(); }}>Return to Home</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" onClick={onExit} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>

          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-lg px-4 py-2">
              Daily Training
            </Badge>
          </div>
        </div>
        <Card className="mb-6">
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Streak: <strong>{state.streak > 0 ? state.streak : 0}</strong></div>
                  <div className="text-sm text-gray-600">Daily target: <strong>{state.dailyTarget}</strong> questions</div>
                </div>
                <div className="w-1/2">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{progress.attempted}/{progress.total}</span>
                  </div>
                  <Progress value={Math.round((progress.attempted / Math.max(1, progress.total)) * 100)} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

        {currentQuestion ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Question {currentIdx + 1} / {questions.length}
              </CardTitle>
              <CardDescription>
                Take your time to think through each problem — the session ends when the 30 minutes are up.
                Problems are generated by the AI and adapt to your strengths and weaknesses.
              </CardDescription>

              {/* Hint panel moved below the question so the question text appears first */}
            </CardHeader>
            <CardContent>
              <div className="bg-white rounded-lg mb-4">
                <p className="text-lg font-medium">{currentQuestion.text}</p>
              </div>

              {/* Hint panel (border + icon always visible). Placed after the question so the question appears above the hint. */}
              <div
                className={`mt-3 border rounded-md bg-gray-50 mb-6 cursor-pointer py-[2px] px-1 ${!hintUnlocked ? 'max-w-[135px] hover:bg-yellow-50' : ''}`}
                style={{ padding: undefined }}
                onClick={() => { if (!hintUnlocked) setHintUnlocked(true); }}
                tabIndex={0}
                role="button"
                aria-label="Show Hint"
              >
                <div className={`flex ${hintUnlocked ? 'items-start' : 'items-center'} gap-3`}>
                  <Lightbulb className="w-[22px] h-[22px] text-gray-400 mt-[2px] align-middle" />
                  <div className="flex-1">
                    {!hintUnlocked ? (
                      <div className="mt-0 w-full flex justify-center">
                        <span className="inline-block text-sm text-gray-500 font-medium px-0 py-1 rounded whitespace-nowrap" style={{marginRight: '12px'}}>Show Hint</span>
                      </div>
                    ) : (
                      <div className="mt-0 py-[3px]">
                        <div className="text-sm text-gray-700 font-medium flex items-center">Suggested Formula</div>
                        <div className="mt-2 text-sm text-gray-600">
                          <div className="font-medium">{currentQuestion.formulaId}</div>
                          {currentQuestion.solveSteps?.[0] && (
                            <div className="mt-1">{currentQuestion.solveSteps[0]}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <RadioGroup value={selectedChoiceIndex !== null ? String(selectedChoiceIndex) : ""} onValueChange={(v) => setSelectedChoiceIndex(v === "" ? null : parseInt(v))}>
                  <div className="space-y-2 mb-3">
                    {currentQuestion.choices.map((c, i) => (
                      <div key={i} className="flex items-center space-x-2">
                        <RadioGroupItem value={String(i)} id={`choice-${i}`} />
                        <Label htmlFor={`choice-${i}`} className="cursor-pointer">
                          {typeof c === 'number' ? c : c}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>

                
                <Button onClick={() => {
                  if (selectedChoiceIndex === null) return;
                  const chosen = currentQuestion.choices[selectedChoiceIndex];
                  handleAnswer(chosen);
                }} className="w-full py-3" disabled={selectedChoiceIndex === null || showBreakdown}>
                  Submit Answer
                </Button>
                {showBreakdown && breakdownContent && (
                  <div className="bg-white p-4 rounded-lg border mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-900">Detailed Breakdown</p>
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-gray-600">{breakdownStepsCompleted.filter(Boolean).length} / {(currentQuestion.solveSteps || breakdownContent.steps || []).length}</div>
                      </div>
                    </div>
                    <div className="mb-2"><strong>Correct Answer:</strong> {currentQuestion.answer}</div>
                    <div className="mb-2"><strong>Definition:</strong> {breakdownContent.definition}</div>
                    <div className="mb-2">
                      <strong>Steps:</strong>
                      <ol className="ml-4 list-decimal">
                        {(currentQuestion.solveSteps || breakdownContent.steps || []).map((s: string, i: number) => (
                          <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                            <Checkbox checked={!!breakdownStepsCompleted[i]} onCheckedChange={(v) => setBreakdownStepsCompleted(prev => {
                              const out = [...prev]; out[i] = !!v; return out;
                            })} />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    {breakdownContent.tips && breakdownContent.tips.length > 0 && (
                      <div className="mb-2">
                        <strong>How to identify:</strong>
                        <ul className="ml-4 list-disc text-sm text-gray-700">
                          {breakdownContent.tips.map((t: string, i: number) => <li key={i}>{t}</li>)}
                        </ul>
                      </div>
                    )}
                      <div className="flex gap-3 mt-3">
                      <Button onClick={handleMasteryContinue} className="flex-1" disabled={breakdownStepsCompleted.length > 0 && !breakdownStepsCompleted.every(Boolean)}>Continue</Button>
                      <Button variant="outline" onClick={() => { setShowBreakdown(false); setBreakdownStepsCompleted([]); if (currentIdx < questions.length - 1) setCurrentIdx(i => i + 1); }}>Skip</Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div>Preparing questions…</div>
        )}

        {/* No Abort/Exit controls during session to encourage focus; session ends when time expires or all questions answered */}
      </div>
    </div>
  );
}
