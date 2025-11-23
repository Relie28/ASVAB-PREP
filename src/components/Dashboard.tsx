"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, Target, Trophy, BookOpen, Calculator, Award, AlertCircle } from "lucide-react";
import { loadUserModel } from "@/lib/decision-engine";
import { loadAdaptiveUserModel, saveAdaptiveUserModel, recordAttempt, rebuildAdaptiveModelFromAttemptLog, getUserDifficultyFromAttemptLog, handlePostAttempt, registerQuestion } from "@/lib/adaptive-engine";
import generateProblem from '@/ai/generateProblem';
import { runAutoPurge } from '@/utils/purge';
import { estimateAFQT } from '@/engine/scoreEstimation';
import { adjustDifficulty } from '@/engine/difficulty';
import { predictAFQT, computeScaledScore } from "@/lib/scoring-engine";
import { RULES } from "@/lib/rules";

interface DashboardProps {
  onExit: () => void;
}

interface FormulaMastery {
  id: string;
  label: string;
  mastery: number;
  attempts: number;
  category: 'AR' | 'MK';
}

export default function Dashboard({ onExit }: DashboardProps) {
  const [userModel, setUserModel] = useState<any>(null);
  const [adaptiveModel, setAdaptiveModel] = useState<any>(null);
  const [formulaMasteries, setFormulaMasteries] = useState<FormulaMastery[]>([]);
  const [predictedScore, setPredictedScore] = useState<number | null>(null);
  const [dailyTrainingInfo, setDailyTrainingInfo] = useState<any>(null);
  const [mergedFormulaStats, setMergedFormulaStats] = useState<Record<string, any> | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<Array<any>>([]);
  const [rebuildNeeded, setRebuildNeeded] = useState<boolean>(false);
  const [difficulty, setDifficulty] = useState<'Easy'|'Intermediate'|'Hard'|'Unknown'>('Unknown');
  const isDev = process.env.NODE_ENV === 'development';
  const [aiProblem, setAiProblem] = useState<any | null>(null);
  const [aiAnswer, setAiAnswer] = useState<string>('');
  const [aiFeedback, setAiFeedback] = useState<any>(null);
  const [aiTopic, setAiTopic] = useState<'AR' | 'MK'>('AR');
  const [aiDifficultySetting, setAiDifficultySetting] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [aiStartTime, setAiStartTime] = useState<number | null>(null);
  const [scoreEstimate, setScoreEstimate] = useState<number | null>(null);

  useEffect(() => {
    runAutoPurge();
    loadData();
    // Listen for adaptive model updates fired by DailyTraining (or other places) so we can refresh UI in realtime
    const onAdaptiveUpdate = () => {
      try {
        // Re-run the full loadData() reconciler to refresh derived stats and attempt-log based counts.
        // This ensures that when Study Mode updates the adaptive model or the centralized attempt log,
        // the dashboard recalculates formula masteries, monthly summaries, merged stats and period-derived counts.
        loadData();
      } catch (e) {}
    };
    window.addEventListener('adaptiveModelUpdated', onAdaptiveUpdate as EventListener);
    // also listen for storage events in case another tab updated the model
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === 'asvab_adaptive_user_model_v1') onAdaptiveUpdate();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('adaptiveModelUpdated', onAdaptiveUpdate as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Local date helper (YYYY-MM-DD) — used to decide whether a stored streak should still be shown
  function localDateKey(d?: Date) {
    const dt = d ? new Date(d) : new Date();
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  const loadData = () => {
    const baseUserModel = loadUserModel();
    const adaptiveModel = loadAdaptiveUserModel();
    // Prefer adaptive model stats when available so Daily Training updates are reflected in the dashboard
    if (adaptiveModel && adaptiveModel.statsByCategory && Object.keys(adaptiveModel.statsByCategory).length > 0) {
      setUserModel(adaptiveModel as any);
    } else {
      setUserModel(baseUserModel);
    }
    setAdaptiveModel(adaptiveModel);

    // Import cached daily training records into the adaptive model if they haven't been imported yet.
    try {
      const raw = localStorage.getItem('asvab_daily_training');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.records) && parsed.records.length) {
          let modified = false;
          const mdl = loadAdaptiveUserModel();
          // Use RULES list to pick formula ids when we need to allocate synthetic attempts
          const formulas = Array.isArray(RULES) ? RULES.map(r => ({ id: r.id, category: (r as any).category || 'AR' })) : [];
          parsed.records.forEach((rec: any) => {
            // Skip empty or already-imported records
            if (!rec) return;
            if (rec.imported) return;

            // read attempt log once for deduplication
            const rawAttemptLog = localStorage.getItem('asvab_attempt_log_v1');
            const attemptLog = rawAttemptLog ? JSON.parse(rawAttemptLog) as Array<any> : [];

            if (Array.isArray(rec.entries) && rec.entries.length) {
              // Import exact per-question entries when available
                  rec.entries.forEach((e: any) => {
                try {
                  // Avoid importing if this qId already exists in attempt log
                  const exists = e.qId ? attemptLog.some((a: any) => a && a.qId === e.qId) : false;
                  if (exists) return;
                  // Include qId when importing per-question entries so the centralized attempt log
                  // keeps the stable identifier and can be used for deduplication later.
                  recordAttempt(mdl, {
                    qId: e.qId,
                    formulaId: e.formulaId,
                    category: e.category || 'AR',
                    correct: !!e.correct,
                    timeMs: e.timeMs || 20000,
                    difficulty: 'medium',
                    source: 'daily_import'
                  } as any);
                  modified = true;
                } catch (er) {
                  // ignore
                }
              });
            } else if (rec.attempted) {
              const attempted = Math.max(0, rec.attempted || 0);
              const correct = Math.max(0, Math.min(attempted, rec.correct || 0));
              // Create synthetic attempts: distribute across formulas in round-robin
              for (let i = 0; i < attempted; i++) {
                const isCorrect = i < correct;
                const pick = formulas.length ? formulas[i % formulas.length] : { id: 'generic', category: 'AR' };
                try {
                  // Avoid importing synthetic attempts if a matching formula+date already exists in attempt log
                  const dayStart = new Date(rec.date + 'T00:00:00').getTime();
                  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
                  const exists = attemptLog.some((a: any) => a && a.formulaId === pick.id && a.ts >= dayStart && a.ts < dayEnd && a.correct === isCorrect);
                  if (exists) continue;
                  recordAttempt(mdl, {
                    formulaId: pick.id,
                    category: pick.category as 'AR' | 'MK',
                    correct: !!isCorrect,
                    timeMs: 20000,
                    difficulty: 'medium',
                    source: 'daily_import_synthetic'
                  } as any);
                  modified = true;
                } catch (e) {
                  // ignore per-attempt errors
                }
              }
            }
            // mark this record as imported so we don't re-import
            rec.imported = true;
          });
          if (modified) {
            try {
              saveAdaptiveUserModel(mdl);
              localStorage.setItem('asvab_daily_training', JSON.stringify(parsed));
              // update state copies
              setAdaptiveModel(mdl);
              setDailyTrainingInfo(parsed);
            } catch (e) {}
          }
        }
      }
    } catch (e) {
      // ignore import errors
    }

    // Calculate formula masteries
    // Build formula masteries from mergedFormulaStats when available, fallback to userModel.statsByFormula
    const formulaSource = mergedFormulaStats || (userModel && userModel.statsByFormula) || {};
    const masteries: FormulaMastery[] = Object.entries(formulaSource).map(([id, stats]: [string, any]) => {
      const rule = RULES.find(r => r.id === id);
      const attempts = stats?.attempts || 0;
      const correct = stats?.correct || 0;
      return {
        id,
        label: rule?.label || id,
        mastery: attempts ? (correct / attempts) : 0,
        attempts,
        category: rule?.category || 'AR'
      };
    });
    setFormulaMasteries(masteries);

    // Calculate predicted score only if the user has completed a full test.
    try {
      const rawFull = localStorage.getItem('asvab_full_test_completed_v1');
      if (rawFull) {
        const parsed = JSON.parse(rawFull);
        if (parsed && parsed.report && parsed.report.summary && typeof parsed.report.summary.percentile === 'number') {
          setPredictedScore(parsed.report.summary.percentile);
        }
      } else {
        // No full test taken yet — clear any prediction
        setPredictedScore(null);
      }
    } catch (e) {
      setPredictedScore(null);
    }

    // Load daily training info from localStorage if present
    try {
      const raw = localStorage.getItem('asvab_daily_training');
      if (raw) {
        const parsed = JSON.parse(raw);
        setDailyTrainingInfo(parsed);
      }
    } catch (e) {
      // ignore
    }

    // Compute merged formula stats for display. Prefer the adaptive model as the canonical source
    // — only fall back to merging cached daily aggregates if the adaptive model is empty/missing.
    try {
      const baseStats: Record<string, any> = (adaptiveModel && adaptiveModel.statsByFormula && Object.keys(adaptiveModel.statsByFormula).length > 0)
        ? { ...adaptiveModel.statsByFormula }
        : (baseUserModel && baseUserModel.statsByFormula) ? { ...baseUserModel.statsByFormula } : {};
      const merged = { ...baseStats };

      // If we have NO adaptive/base stats, use cached daily_training records to build a display-only view.
      // Additionally, include any cached records that haven't been imported into the adaptive model yet
      // so they still contribute to totals until the user imports them.
      const raw = localStorage.getItem('asvab_daily_training');
      if (!Object.keys(merged).length) {
        const raw = localStorage.getItem('asvab_daily_training');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.records) && parsed.records.length) {
            const formulas = Array.isArray(RULES) ? RULES.map(r => ({ id: r.id, category: (r as any).category || 'AR' })) : [];
            parsed.records.forEach((rec: any) => {
              // only include records that haven't been imported into the adaptive model
              if (!rec || !rec.attempted || rec.imported) return;
              if (Array.isArray(rec.entries) && rec.entries.length) {
                rec.entries.forEach((e: any, idx: number) => {
                  const pickId = e.formulaId || (formulas[idx % formulas.length]?.id) || 'generic';
                  merged[pickId] = merged[pickId] || { attempts: 0, correct: 0 };
                  merged[pickId].attempts += 1;
                  if (e.correct) merged[pickId].correct += 1;
                });
              } else {
                const attempted = Math.max(0, rec.attempted || 0);
                const correct = Math.max(0, Math.min(attempted, rec.correct || 0));
                for (let i = 0; i < attempted; i++) {
                  const pick = formulas.length ? formulas[i % formulas.length] : { id: 'generic', category: 'AR' };
                  merged[pick.id] = merged[pick.id] || { attempts: 0, correct: 0 };
                  merged[pick.id].attempts += 1;
                  if (i < correct) merged[pick.id].correct += 1;
                }
              }
            });
          }
        }
      }
  // Include cached records into merged stats only when we have no canonical attempt log
  // or when we have no adaptive/base stats. This avoids double-counting when the
  // centralized attempt log already contains the same attempts (live writes).
  const rawAttemptLog2 = localStorage.getItem('asvab_attempt_log_v1');
  const attemptLog2 = rawAttemptLog2 ? JSON.parse(rawAttemptLog2) as Array<any> : [];
  const shouldIncludeCached = (!attemptLog2 || attemptLog2.length === 0) || !Object.keys(merged).length;
  if (shouldIncludeCached && raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.records) && parsed.records.length) {
            const formulas = Array.isArray(RULES) ? RULES.map(r => ({ id: r.id, category: (r as any).category || 'AR' })) : [];
            parsed.records.forEach((rec: any) => {
              if (!rec || !rec.attempted || rec.imported) return;
              if (Array.isArray(rec.entries) && rec.entries.length) {
                rec.entries.forEach((e: any, idx: number) => {
                  const pickId = e.formulaId || (formulas[idx % formulas.length]?.id) || 'generic';
                  merged[pickId] = merged[pickId] || { attempts: 0, correct: 0 };
                  merged[pickId].attempts += 1;
                  if (e.correct) merged[pickId].correct += 1;
                });
              } else {
                const attempted = Math.max(0, rec.attempted || 0);
                const correct = Math.max(0, Math.min(attempted, rec.correct || 0));
                for (let i = 0; i < attempted; i++) {
                  const pick = formulas.length ? formulas[i % formulas.length] : { id: 'generic', category: 'AR' };
                  merged[pick.id] = merged[pick.id] || { attempts: 0, correct: 0 };
                  merged[pick.id].attempts += 1;
                  if (i < correct) merged[pick.id].correct += 1;
                }
              }
            });
          }
        } catch (e) {
          // ignore
        }
      }

      setMergedFormulaStats(merged);
    } catch (e) {
      setMergedFormulaStats(null);
    }

  // Load monthly summaries (last 12 months) if present; otherwise try to build from attempt log
    try {
      const rawMonthly = localStorage.getItem('asvab_monthly_summary_v1');
      if (rawMonthly) {
        const parsed = JSON.parse(rawMonthly);
        setMonthlySummary(parsed || []);
      } else {
        // fallback: build from attempt log
        const rawLog = localStorage.getItem('asvab_attempt_log_v1');
        if (rawLog) {
          const entries = JSON.parse(rawLog) as Array<any>;
          const map: Record<string, { attempts: number; correct: number }> = {};
          entries.forEach((e) => {
            if (!e || !e.ts) return;
            const d = new Date(e.ts);
            const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
          setMonthlySummary(out);
        }
      }
    } catch (e) {
      // ignore
    }

    // Check for adaptive model vs attempt log mismatch and mark rebuildNeeded when they differ
    try {
      const rawLog = localStorage.getItem('asvab_attempt_log_v1');
      const entries = rawLog ? JSON.parse(rawLog) as Array<any> : [];
      const logAttempts = entries.length;
      const modelAttempts = Object.values((adaptiveModel && adaptiveModel.statsByFormula) ? adaptiveModel.statsByFormula : {}).reduce((s: number, stat: any) => s + (stat.attempts || 0), 0);
      if (logAttempts !== modelAttempts) {
        setRebuildNeeded(true);
      } else {
        setRebuildNeeded(false);
      }
  // Update computed difficulty using last 30 days
      try { setDifficulty(getUserDifficultyFromAttemptLog(30)); } catch (e) { setDifficulty('Unknown'); }
  // compute score estimate
  try { setScoreEstimate(estimateAFQT(adaptiveModel?.statsByCategory || {}, formulaMasteries || [])); } catch (e) { setScoreEstimate(null); }
  // strengths/weaknesses/topics are computed directly from `formulaMasteries` for display
    } catch (e) { setRebuildNeeded(false); }
  };

  // Fix/reset daily training counts and ensure cached records are imported into adaptive model
  const fixDailyTrainingCounts = () => {
    try {
      const raw = localStorage.getItem('asvab_daily_training');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.records)) return;

      const mdl = loadAdaptiveUserModel();
      let modified = false;

      parsed.records.forEach((rec: any) => {
        if (!rec) return;
        // Normalize attempted/correct to match entries if present
        if (Array.isArray(rec.entries) && rec.entries.length) {
          const attempted = rec.entries.length;
          const correct = rec.entries.filter((e: any) => e.correct).length;
          if (rec.attempted !== attempted || rec.correct !== correct) {
            rec.attempted = attempted;
            rec.correct = correct;
            modified = true;
          }

          // Import any unimported records into adaptive model
            if (!rec.imported) {
            rec.entries.forEach((e: any) => {
                try {
                // Preserve qId when importing so later dedup logic can reliably detect existing attempts
                recordAttempt(mdl, {
                  qId: e.qId,
                  formulaId: e.formulaId,
                  category: e.category || 'AR',
                  correct: !!e.correct,
                  timeMs: e.timeMs || 20000,
                  difficulty: 'medium',
                  source: 'daily_fix_import'
                } as any);
              } catch (err) {
                // ignore per-attempt errors
              }
            });
            rec.imported = true;
            modified = true;
          }
        } else {
          // No entries: ensure correct isn't greater than attempted and clamp values
          const attempted = Math.max(0, rec.attempted || 0);
          const correct = Math.max(0, Math.min(attempted, rec.correct || 0));
          if (rec.attempted !== attempted || rec.correct !== correct) {
            rec.attempted = attempted;
            rec.correct = correct;
            modified = true;
          }
          // If not imported and attempted>0, create synthetic imports
          if (!rec.imported && attempted > 0) {
            // Use RULES to spread synthetic attempts. Before importing, check the centralized attempt log
            // so we don't duplicate existing synthetic or per-question attempts.
            const formulas = Array.isArray(RULES) ? RULES.map(r => ({ id: r.id, category: (r as any).category || 'AR' })) : [];
            const c = Math.max(0, Math.min(attempted, rec.correct || 0));
            // read attempt log once for deduplication
            const rawAttemptLog = localStorage.getItem('asvab_attempt_log_v1');
            const attemptLog = rawAttemptLog ? JSON.parse(rawAttemptLog) as Array<any> : [];
            const dayStart = new Date(rec.date + 'T00:00:00').getTime();
            const dayEnd = dayStart + 24 * 60 * 60 * 1000;
            for (let i = 0; i < attempted; i++) {
              const isCorrect = i < c;
              const pick = formulas.length ? formulas[i % formulas.length] : { id: 'generic', category: 'AR' };
              try {
                // Avoid importing synthetic attempts if a matching formula+date+correctness already exists in attempt log
                const exists = attemptLog.some((a: any) => a && a.formulaId === pick.id && a.ts >= dayStart && a.ts < dayEnd && a.correct === isCorrect);
                if (exists) continue;
                recordAttempt(mdl, {
                  formulaId: pick.id,
                  category: pick.category as 'AR' | 'MK',
                  correct: !!isCorrect,
                  timeMs: 20000,
                  difficulty: 'medium'
                  ,
                  source: 'daily_fix_import_synthetic'
                } as any);
              } catch (err) {}
            }
            rec.imported = true;
            modified = true;
          }
        }
      });

      if (modified) {
        try {
          saveAdaptiveUserModel(mdl);
        } catch (e) {}
        try {
          localStorage.setItem('asvab_daily_training', JSON.stringify(parsed));
        } catch (e) {}
        // refresh local state views
        setAdaptiveModel(mdl);
        setDailyTrainingInfo(parsed);
        try { window.dispatchEvent(new CustomEvent('adaptiveModelUpdated')); } catch (e) {}
      }
    } catch (e) {
      // ignore
    }
  };

  // Reset daily training entirely: clear cache, reset streaks and records, and unlock module
  const resetDailyTraining = () => {
    try {
      const empty = { streak: 0, records: [], dailyTarget: 20 };
      localStorage.setItem('asvab_daily_training', JSON.stringify(empty));
      setDailyTrainingInfo(empty);
      // Notify listeners and refresh UI
      try { window.dispatchEvent(new CustomEvent('adaptiveModelUpdated')); } catch (e) {}
      try { alert('Daily Training has been reset. You can start a fresh session now.'); } catch (e) {}
    } catch (e) {
      // ignore
    }
  };

  // Clear the centralized attempt log and related aggregated artifacts
  const resetAttemptLog = () => {
    try {
      const confirmed = confirm('This will clear all recorded attempts and monthly summaries. This is permanent. Continue?');
      if (!confirmed) return;
      // Remove the canonical attempt log and monthly summary
      localStorage.removeItem('asvab_attempt_log_v1');
      localStorage.removeItem('asvab_monthly_summary_v1');
      // Remove stored full test results (since they are part of aggregate stats)
      localStorage.removeItem('asvab_full_test_completed_v1');

      // Reset adaptive model stats to empty while preserving engine config and pool
      try {
        const mdl = loadAdaptiveUserModel();
        const cleared = {
          ...mdl,
          statsByFormula: {},
          statsByCategory: {},
          mastery: {},
          questionWeights: {}
        } as any;
        saveAdaptiveUserModel(cleared);
        setAdaptiveModel(cleared);
      } catch (e) {
        // fallback: remove the stored adaptive model entirely
        try { localStorage.removeItem('asvab_adaptive_user_model_v1'); } catch (e) {}
        setAdaptiveModel(loadAdaptiveUserModel());
      }

      // Refresh UI state and monthly summary
      try { localStorage.setItem('asvab_monthly_summary_v1', JSON.stringify([])); } catch (e) {}
      setMonthlySummary([]);
      setDailyTrainingInfo(JSON.parse(localStorage.getItem('asvab_daily_training') || '{}') || null);
      try { window.dispatchEvent(new CustomEvent('adaptiveModelUpdated')); } catch (e) {}
      alert('Attempt log and adaptive model reset successfully. Dashboard refreshed.');
    } catch (e) {
      alert('Failed to reset attempt log. Check console for details.');
      console.error('Reset attempt log failed', e);
    }
  };

  // Clear all local caches with a required typed confirmation to prevent accidental loss
  const clearAllCaches = async () => {
    try {
      const required = 'CLEAR ALL';
      const typed = prompt(`Type '${required}' to confirm clearing all local caches (this action is irreversible).`);
      if (!typed || typed.trim() !== required) {
        alert('Clear cancelled. You must type exactly: ' + required);
        return;
      }

      // Optional backup step to preserve data in case of mistakes
      const makeBackup = confirm('Do you want to save a backup of your current attempt log and adaptive model before clearing?');
      if (makeBackup) {
        try {
          const backupKey = 'asvab_backup_' + Date.now();
          const payload: any = {
            attemptLog: localStorage.getItem('asvab_attempt_log_v1'),
            adaptiveModel: localStorage.getItem('asvab_adaptive_user_model_v1'),
            dailyTraining: localStorage.getItem('asvab_daily_training'),
            monthlySummary: localStorage.getItem('asvab_monthly_summary_v1'),
            fullTest: localStorage.getItem('asvab_full_test_completed_v1')
          };
          localStorage.setItem(backupKey, JSON.stringify(payload));
          alert('Backup saved to localStorage key: ' + backupKey);
        } catch (e) {}
      }

      // Clear all keys starting with 'asvab_' to fully wipe all app caches and backups.
      try {
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          if (key.startsWith('asvab_') || key.startsWith('asvab-backup') || key.startsWith('asvab_backup_')) {
            toRemove.push(key);
          }
        }
        toRemove.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
      } catch (e) {
        // ignore
      }

      // Reset local state to default model
      try {
        const mdl = loadAdaptiveUserModel();
        saveAdaptiveUserModel(mdl);
        setAdaptiveModel(mdl);
      } catch (e) {}

      // Refresh UI state
  setDailyTrainingInfo(null);
      setMonthlySummary([]);
      setPredictedScore(null);
  setUserModel(loadUserModel());
      try { setMergedFormulaStats({}); } catch (e) {}
      try { window.dispatchEvent(new CustomEvent('adaptiveModelUpdated')); } catch (e) {}

      alert('All local caches cleared. Dashboard refreshed.');
    } catch (e) {
      console.error('Failed to clear all caches', e);
      alert('Failed to clear all caches. Check console for details.');
    }
  };

  const rebuildAdaptiveFromLog = () => {
    try {
      const rebuilt = rebuildAdaptiveModelFromAttemptLog();
      setAdaptiveModel(rebuilt);
      try { window.dispatchEvent(new CustomEvent('adaptiveModelUpdated')); } catch (e) {}
      alert('Adaptive model rebuilt from centralized attempt log. Dashboard refreshed.');
    } catch (e) {
      alert('Failed to rebuild adaptive model from attempt log');
    }
  };

  // AI Practice — request a new AI-generated problem
  const loadNextAiProblem = async (topic?: 'AR' | 'MK', difficulty?: 'easy' | 'medium' | 'hard') => {
    try {
      const t = topic || aiTopic;
      const d = difficulty || aiDifficultySetting;
      const diffScore = d === 'easy' ? 1 : d === 'medium' ? 2 : 3;
      const out = await generateProblem(t, diffScore);
      if (!out) return;
      // Use a numeric qId so engine can register and track it
      const qId = Date.now();

      // Register question in adaptive model to make it trackable
      try {
        const mdl = loadAdaptiveUserModel();
        const q = {
          id: qId,
          subject: t,
          type: 'ai_generated',
          text: out.problem,
          formulaId: `ai_generated_${t}`,
          keywords: [],
          partners: [],
          difficulty: d,
          difficultyWeight: d === 'easy' ? 1 : d === 'medium' ? 2 : 3,
          solveSteps: [out.explanation || ''],
          answer: out.answer,
          choices: [],
          category: t
        } as any;
        registerQuestion(mdl, q as any);
        // Save model after registering so the questionPool is persisted
        saveAdaptiveUserModel(mdl);
        setAdaptiveModel(mdl);
      } catch (e) {
        // ignore registration errors
      }

      setAiProblem({ ...out, _qId: qId });
      setAiAnswer('');
      setAiFeedback(null);
      setAiStartTime(Date.now());
    } catch (e) {
      console.error('Failed to get AI problem', e);
    }
  };

  const submitAiAnswer = (userAnswer: string) => {
    if (!aiProblem) return;
    try {
      const elapsedMs = aiStartTime ? (Date.now() - aiStartTime) : 10000;
      // Normalize comparison: numeric or trimmed string
      let correct = false;
      const expected = (aiProblem.answer || '').toString().trim().toLowerCase();
      const actual = (userAnswer || '').toString().trim().toLowerCase();
      if (expected === actual) correct = true;
      // Try numeric equality if both parse as numbers
      const nExp = Number(expected);
      const nAct = Number(actual);
      if (!isNaN(nExp) && !isNaN(nAct) && nExp === nAct) correct = true;

      const mdl = handlePostAttempt(loadAdaptiveUserModel(), {
        qId: aiProblem._qId,
        formulaId: `ai_generated_${aiProblem.topic || aiTopic}`,
        category: aiProblem.topic || aiTopic,
        correct,
        timeMs: elapsedMs,
        difficulty: aiProblem.difficulty || aiDifficultySetting,
        source: 'ai_generated'
      });
      setAdaptiveModel(mdl);
      setAiFeedback({ correct, expected: aiProblem.answer, explanation: aiProblem.explanation || '' });
      // Update score estimate
      try { setScoreEstimate(estimateAFQT(mdl?.statsByCategory || {}, formulaMasteries || [])); } catch (e) {}
    } catch (e) {
      console.error('Failed to submit AI answer', e);
    }
  };

  const getOverallMastery = () => {
    // Prefer computing overall mastery from formula masteries (which may include cached aggregates)
    if (formulaMasteries && formulaMasteries.length) {
      const ar = formulaMasteries.filter(f => f.category === 'AR');
      const mk = formulaMasteries.filter(f => f.category === 'MK');
      const arAttempts = ar.reduce((s, f) => s + f.attempts, 0);
      const mkAttempts = mk.reduce((s, f) => s + f.attempts, 0);
      const arCorrect = ar.reduce((s, f) => s + (f.mastery * f.attempts), 0);
      const mkCorrect = mk.reduce((s, f) => s + (f.mastery * f.attempts), 0);
      const arMastery = arAttempts ? (arCorrect / arAttempts) : 0;
      const mkMastery = mkAttempts ? (mkCorrect / mkAttempts) : 0;
      return Math.round(((arMastery + mkMastery) / 2) * 100);
    }
    // Fallback to existing userModel stats
    if (!userModel || !userModel.statsByCategory) return 0;
    const arStats = userModel.statsByCategory.AR;
    const mkStats = userModel.statsByCategory.MK;
    if (!arStats || !mkStats) return 0;
    const arMastery = arStats.correct / arStats.attempts;
    const mkMastery = mkStats.correct / mkStats.attempts;
    return Math.round(((arMastery + mkMastery) / 2) * 100);
  };

  const getARMastery = () => {
    // Prefer computing from formulaMasteries when available
    if (formulaMasteries && formulaMasteries.length) {
      const ar = formulaMasteries.filter(f => f.category === 'AR');
      const attempts = ar.reduce((s, f) => s + f.attempts, 0);
      const correct = ar.reduce((s, f) => s + (f.mastery * f.attempts), 0);
      return attempts ? Math.round((correct / attempts) * 100) : 0;
    }
    if (!userModel || !userModel.statsByCategory.AR) return 0;
    const stats = userModel.statsByCategory.AR;
    return Math.round((stats.correct / stats.attempts) * 100);
  };

  const getMKMastery = () => {
    // Prefer computing from formulaMasteries when available
    if (formulaMasteries && formulaMasteries.length) {
      const mk = formulaMasteries.filter(f => f.category === 'MK');
      const attempts = mk.reduce((s, f) => s + f.attempts, 0);
      const correct = mk.reduce((s, f) => s + (f.mastery * f.attempts), 0);
      return attempts ? Math.round((correct / attempts) * 100) : 0;
    }
    if (!userModel || !userModel.statsByCategory.MK) return 0;
    const stats = userModel.statsByCategory.MK;
    return Math.round((stats.correct / stats.attempts) * 100);
  };

  const getStrongAreas = () => {
    return formulaMasteries
      .filter(f => f.mastery >= 0.8 && f.attempts >= 3)
      .sort((a, b) => b.mastery - a.mastery)
      .slice(0, 5);
  };

  const getWeakAreas = () => {
    return formulaMasteries
      .filter(f => f.mastery < 0.6 && f.attempts >= 3)
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 5);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreMessage = (score: number) => {
    if (score >= 90) return "Exceptional";
    if (score >= 70) return "Above Average";
    if (score >= 50) return "Average";
    if (score >= 30) return "Below Average";
    return "Needs Improvement";
  };

  const getTotalAttempts = () => {
    // Prefer centralized attempt log when available
    try {
      const rawLog = localStorage.getItem('asvab_attempt_log_v1');
      if (rawLog) {
        const entries = JSON.parse(rawLog) as Array<any>;
        return entries.length;
      }
    } catch (e) {}

    // Prefer mergedFormulaStats when available (includes cached aggregates)
    if (mergedFormulaStats && Object.keys(mergedFormulaStats).length) {
      return Object.values(mergedFormulaStats).reduce((sum: number, stats: any) => sum + (stats.attempts || 0), 0);
    }
    if (!userModel || !userModel.statsByFormula) {
      // fallback to cached daily training if no model
      try {
        const extra = (dailyTrainingInfo && Array.isArray(dailyTrainingInfo.records)) ?
          (dailyTrainingInfo.records.reduce((s: number, r: any) => s + (r.attempted || 0), 0)) : 0;
        return extra;
      } catch (e) {
        return 0;
      }
    }
    const fromModel = Object.values(userModel.statsByFormula).reduce((sum: number, stats: any) => sum + stats.attempts, 0);
    // include any unimported cached records (so they count until import) but avoid double-counting
    try {
      const extra = (dailyTrainingInfo && Array.isArray(dailyTrainingInfo.records)) ?
        (dailyTrainingInfo.records.filter((r: any) => !r.imported).reduce((s: number, r: any) => s + (r.attempted || 0), 0)) : 0;
      return fromModel + extra;
    } catch (e) {
      return fromModel;
    }
  };

  const getTotalCorrect = () => {
    // Prefer centralized attempt log when available
    try {
      const rawLog = localStorage.getItem('asvab_attempt_log_v1');
      if (rawLog) {
        const entries = JSON.parse(rawLog) as Array<any>;
        return entries.filter(e => e && e.correct).length;
      }
    } catch (e) {}

    if (mergedFormulaStats && Object.keys(mergedFormulaStats).length) {
      return Object.values(mergedFormulaStats).reduce((sum: number, stats: any) => sum + (stats.correct || 0), 0);
    }
    if (!userModel || !userModel.statsByFormula) {
      try {
        const extra = (dailyTrainingInfo && Array.isArray(dailyTrainingInfo.records)) ?
          (dailyTrainingInfo.records.reduce((s: number, r: any) => s + (r.correct || 0), 0)) : 0;
        return extra;
      } catch (e) {
        return 0;
      }
    }
    const fromModel = Object.values(userModel.statsByFormula).reduce((sum: number, stats: any) => sum + stats.correct, 0);
    try {
      const extra = (dailyTrainingInfo && Array.isArray(dailyTrainingInfo.records)) ?
        (dailyTrainingInfo.records.filter((r: any) => !r.imported).reduce((s: number, r: any) => s + (r.correct || 0), 0)) : 0;
      return fromModel + extra;
    } catch (e) {
      return fromModel;
    }
  };

  function getPeriodStats(days: number) {
    // Prefer the centralized attempt log (contains every recorded attempt across modes).
    // Fall back to daily_training records if the attempt log is missing.
    const now = new Date();
    now.setHours(0,0,0,0);
    const cutoff = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000); // include today
    let attempts = 0;
    let correct = 0;
    try {
      const rawLog = localStorage.getItem('asvab_attempt_log_v1');
      if (rawLog) {
        const entries = JSON.parse(rawLog) as Array<any>;
        entries.forEach((e) => {
          if (!e || !e.ts) return;
          const d = new Date(e.ts);
          d.setHours(0,0,0,0);
          if (d < cutoff) return;
          attempts += 1;
          if (e.correct) correct += 1;
        });
        return { attempts, correct };
      }

      // Fallback: read from daily_training records
      const raw = localStorage.getItem('asvab_daily_training');
      if (!raw) return { attempts: 0, correct: 0 };
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.records)) return { attempts: 0, correct: 0 };
      parsed.records.forEach((rec: any) => {
        if (!rec) return;
        const dateStr = rec.date;
        if (!dateStr) return;
        const d = new Date(dateStr + 'T00:00:00');
        if (d < cutoff) return;
        if (Array.isArray(rec.entries) && rec.entries.length) {
          attempts += rec.entries.length;
          correct += rec.entries.filter((e: any) => e.correct).length;
        } else if (rec.attempted) {
          attempts += (rec.attempted || 0);
          correct += (rec.correct || 0);
        }
      });
    } catch (e) {
      return { attempts: 0, correct: 0 };
    }
    return { attempts, correct };
  }

  // Provide a breakdown of the attempt log sources for a given period (days)
  function getPeriodSourceBreakdown(days: number) {
    const now = new Date();
    now.setHours(0,0,0,0);
    const cutoff = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    const result: Record<string, number> = {};
    try {
      const rawLog = localStorage.getItem('asvab_attempt_log_v1');
      if (!rawLog) return result;
      const entries = JSON.parse(rawLog) as Array<any>;
      entries.forEach((e) => {
        if (!e || !e.ts) return;
        const d = new Date(e.ts);
        d.setHours(0,0,0,0);
        if (d < cutoff) return;
        const src = e.source || (e.qId ? 'live' : 'synthetic');
        result[src] = (result[src] || 0) + 1;
      });
    } catch (e) { }
    return result;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" onClick={onExit} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>
          
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Your Dashboard</h1>
            <Badge variant="outline" className="text-lg px-4 py-2">
              Progress Overview
            </Badge>
          </div>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-600">Overall Mastery</span>
              </div>
              <div className={`text-3xl font-bold ${getScoreColor(getOverallMastery())}`}>
                {getOverallMastery()}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-600">AR Mastery</span>
              </div>
              <div className={`text-3xl font-bold ${getScoreColor(getARMastery())}`}>
                {getARMastery()}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="w-5 h-5 text-purple-600" />
                <span className="text-sm text-gray-600">MK Mastery</span>
              </div>
              <div className={`text-3xl font-bold ${getScoreColor(getMKMastery())}`}>
                {getMKMastery()}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-yellow-600" />
                <span className="text-sm text-gray-600">Predicted ASVAB</span>
                <span className="text-sm text-gray-500 ml-3">Estimate: {scoreEstimate !== null ? scoreEstimate : '--'}</span>
              </div>
              <div className={`text-3xl font-bold ${predictedScore ? getScoreColor(predictedScore) : "text-gray-400"}`}>
                {predictedScore || '--'}
              </div>
              {predictedScore && (
                <p className="text-xs text-gray-600">{getScoreMessage(predictedScore)}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Daily Training Summary */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Daily Training
            </CardTitle>
            <CardDescription>
              Your streak and today's training progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dailyTrainingInfo ? (
              (() => {
                // Decide what streak to display. If the lastCompletedDate is missing or older than yesterday (gap >= 2 days), show 0.
                const last = dailyTrainingInfo.lastCompletedDate;
                let displayedStreak = (dailyTrainingInfo.streak || 0);
                if (!last) {
                  displayedStreak = 0;
                } else {
                  try {
                    const lastDate = new Date(last + 'T00:00:00');
                    const todayStart = new Date();
                    todayStart.setHours(0,0,0,0);
                    const msDiff = todayStart.getTime() - lastDate.setHours(0,0,0,0);
                    const dayDiff = Math.floor(msDiff / (24 * 60 * 60 * 1000));
                    if (dayDiff >= 2) {
                      // missed a day -> streak should appear as 0
                      displayedStreak = 0;
                    }
                  } catch (e) {
                    // fallback: show stored streak
                  }
                }

                return (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Current streak</p>
                      <p className="text-2xl font-bold text-blue-600">{displayedStreak} days</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">Today's progress</p>
                      <p className="font-bold">{(dailyTrainingInfo.records || []).slice(-1)[0] ? `${(dailyTrainingInfo.records || []).slice(-1)[0].attempted} attempted • ${(dailyTrainingInfo.records || []).slice(-1)[0].correct} correct` : 'No session yet'}</p>
                      <p className="text-sm text-gray-500">Target: {dailyTrainingInfo.dailyTarget || '--'} questions</p>
                    </div>

                    <div className="w-1/3">
                      <p className="text-sm text-gray-600">Last 7-day average accuracy</p>
                      {(() => {
                        const records = (dailyTrainingInfo.records || []).slice(-7);
                        if (records.length === 0) return <p className="text-sm text-gray-500">No data</p>;
                        const avg = Math.round((records.reduce((s: number, r: any) => s + (r.attempted ? (r.correct / r.attempted) : 0), 0) / records.length) * 100);
                        return <p className="font-bold text-green-600">{avg}%</p>;
                      })()}
                    </div>
                  </div>
                );
              })()
            ) : (
              <p className="text-sm text-gray-600">No daily training data yet. Try the Daily Training from Quick Actions.</p>
            )}
            {isDev && (
              <>
                <div className="mt-4">
                  {isDev && (
                    <Button onClick={() => {
                      fixDailyTrainingCounts();
                      // small visual hint
                      try { alert('Daily training cache normalized and imported where needed. Dashboard refreshed.'); } catch (e) {}
                    }} variant="secondary">Fix / Reset Daily Training</Button>
                  )}
                </div>
                <div className="mt-3">
                  <Button onClick={() => { resetDailyTraining(); }} variant="ghost">Reset Daily Training</Button>
                </div>
                <div className="mt-3">
                  <Button onClick={() => { rebuildAdaptiveFromLog(); }} variant="outline">Rebuild Adaptive Model from Attempt Log</Button>
                </div>
              </>
            )}
            {rebuildNeeded && isDev && (
              <div className="mt-3 p-3 bg-yellow-50 border-yellow-200 rounded">
                <p className="text-sm text-yellow-700">Your adaptive model seems out-of-sync with the centralized attempt log. Click "Rebuild Adaptive Model from Attempt Log" to reconcile.</p>
              </div>
            )}
            {isDev && (
              <>
                {isDev && (
                  <>
                    <div className="mt-3">
                      <Button onClick={() => { resetAttemptLog(); }} variant="destructive">Reset Attempt Log (clear all)</Button>
                    </div>
                    <div className="mt-3">
                      <Button onClick={() => { clearAllCaches(); }} variant="destructive">Clear All Caches</Button>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* AI Practice Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>AI Practice</CardTitle>
            <CardDescription>Generate a custom practice problem (client-only)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-sm text-gray-600">Topic</label>
                <select className="w-full mt-1 p-2 border rounded" value={aiTopic} onChange={(e) => setAiTopic(e.target.value as any)}>
                  <option value="AR">AR - Arithmetic Reasoning</option>
                  <option value="MK">MK - Mathematics Knowledge</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">Difficulty</label>
                <select className="w-full mt-1 p-2 border rounded" value={aiDifficultySetting} onChange={(e) => setAiDifficultySetting(e.target.value as any)}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={() => loadNextAiProblem()} className="w-full">Next Problem</Button>
              </div>
            </div>

            {aiProblem ? (
              <div className="border rounded p-4 bg-white">
                <div className="mb-2 text-sm text-gray-600">Problem</div>
                <div className="text-lg font-medium mb-3">{aiProblem.problem}</div>
                <div className="mb-3">
                  <input value={aiAnswer} onChange={(e) => setAiAnswer(e.target.value)} className="w-full p-2 border rounded" placeholder="Enter your answer" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => submitAiAnswer(aiAnswer)}>Submit Answer</Button>
                  <Button variant="ghost" onClick={() => setAiProblem(null)}>Clear</Button>
                </div>
                {aiFeedback && (
                  <div className={`mt-3 p-3 ${aiFeedback.correct ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'} rounded`}> 
                    <div>{aiFeedback.correct ? 'Correct!' : 'Incorrect'}</div>
                    <div className="text-xs mt-1">Answer: {aiFeedback.expected}</div>
                    {aiFeedback.explanation && <div className="text-xs mt-2 text-gray-700">{aiFeedback.explanation}</div>}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No AI problem loaded. Click "Next Problem" to generate one.</div>
            )}
          </CardContent>
        </Card>

          {/* Quick insights are shown in the 'All Topics Mastery' tab at the bottom of the Dashboard. */}

        {/* Weekly / Monthly summaries */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Progress</CardTitle>
              <CardDescription>Last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const stats = getPeriodStats(7);
                const acc = stats.attempts ? Math.round((stats.correct / stats.attempts) * 100) : 0;
                return (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">Attempts</div>
                    <div className="text-2xl font-bold">{stats.attempts}</div>
                    <div className="text-sm text-gray-600">Correct</div>
                    <div className="text-2xl font-bold text-green-600">{stats.correct}</div>
                    <div className="text-sm text-gray-600">Accuracy</div>
                    <div className="text-2xl font-bold">{acc}%</div>
                      <div className="mt-3 text-xs text-gray-500">
                        Data used (7d): detailed per-question attempts captured from user sessions (Daily Training, Study Mode, Quiz Mode, Full Tests, or live per-question answers) within the last 7 days.
                      </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Progress</CardTitle>
              <CardDescription>Last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const stats = getPeriodStats(30);
                const acc = stats.attempts ? Math.round((stats.correct / stats.attempts) * 100) : 0;
                return (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">Attempts</div>
                    <div className="text-2xl font-bold">{stats.attempts}</div>
                    <div className="text-sm text-gray-600">Correct</div>
                    <div className="text-2xl font-bold text-green-600">{stats.correct}</div>
                    <div className="text-sm text-gray-600">Accuracy</div>
                    <div className="text-2xl font-bold">{acc}%</div>
                    <div className="mt-3 text-xs text-gray-500">
                      Data used (30d): detailed per-question attempts captured from user sessions (Daily Training, Study Mode, Quiz Mode, Full Tests, or live per-question answers) within the last 30 days.
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Monthly history (last 12 months) */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Monthly History (last 12 months)</CardTitle>
            <CardDescription>Keep a rolling record of each month's attempts and accuracy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {monthlySummary && monthlySummary.length ? monthlySummary.map((m) => (
                <div key={m.month} className="border rounded-lg p-3 text-center bg-white">
                  <div className="text-sm font-medium">{m.month}</div>
                  <div className="text-lg font-bold text-blue-600">{m.attempts}</div>
                  <div className="text-xs text-gray-600">{m.correct} correct</div>
                  <div className="text-sm text-green-600 mt-1">{m.attempts ? Math.round(m.accuracy * 100) : 0}%</div>
                </div>
              )) : (
                <div className="text-sm text-gray-500">No monthly data yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Subject Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Arithmetic Reasoning</span>
                    <Badge variant="secondary">{getARMastery()}%</Badge>
                  </div>
                  <Progress value={getARMastery()} className="h-3" />
                  <p className="text-sm text-gray-600 mt-1">
                    {userModel?.statsByCategory?.AR ? 
                      `${userModel.statsByCategory.AR.correct}/${userModel.statsByCategory.AR.attempts} correct` : 
                      'No data yet'
                    }
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Mathematics Knowledge</span>
                    <Badge variant="secondary">{getMKMastery()}%</Badge>
                  </div>
                  <Progress value={getMKMastery()} className="h-3" />
                  <p className="text-sm text-gray-600 mt-1">
                    {userModel?.statsByCategory?.MK ? 
                      `${userModel.statsByCategory.MK.correct}/${userModel.statsByCategory.MK.attempts} correct` : 
                      'No data yet'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                Overall Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{getTotalAttempts()}</div>
                  <p className="text-sm text-gray-600">Total Attempts</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{getTotalCorrect()}</div>
                  <p className="text-sm text-gray-600">Total Correct</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {getTotalAttempts() > 0 ? Math.round((getTotalCorrect() / getTotalAttempts()) * 100) : 0}%
                  </div>
                  <p className="text-sm text-gray-600">Overall Accuracy</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {formulaMasteries.filter(f => f.mastery >= 0.8).length}
                  </div>
                  <p className="text-sm text-gray-600">Mastered Topics</p>
                </div>
              </div>
             
                {/* Period breakdown: Today / 7 days / 30 days / YTD */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {(() => {
                    const periods = [
                      { label: 'Today', days: 1 },
                      { label: '7d', days: 7 },
                      { label: '30d', days: 30 },
                      { label: 'YTD', days: (() => {
                        const now = new Date();
                        const start = new Date(now.getFullYear(), 0, 1);
                        const diff = Math.ceil((new Date().getTime() - start.getTime()) / (24*60*60*1000));
                        return Math.max(1, diff);
                      })() }
                    ];

                    return periods.map(p => {
                      const st = getPeriodStats(p.days);
                      const acc = st.attempts ? Math.round((st.correct / st.attempts) * 100) : 0;
                      return (
                        <div key={p.label} className="border rounded-lg p-3 text-center bg-white">
                          <div className="text-xs text-gray-500">{p.label}</div>
                          <div className="text-lg font-bold text-blue-600">{st.attempts}</div>
                          <div className="text-xs text-gray-600">Attempts</div>
                          <div className="text-sm font-semibold text-green-600 mt-2">{st.correct} correct • {acc}%</div>
                        </div>
                      );
                    });
                  })()}
                </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Analysis */}
        <Tabs defaultValue="strengths" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="strengths">Strong Areas</TabsTrigger>
            <TabsTrigger value="weaknesses">Areas to Improve</TabsTrigger>
            <TabsTrigger value="topics">All Topics</TabsTrigger>
          </TabsList>

          <TabsContent value="strengths">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Your Strong Areas
                </CardTitle>
                <CardDescription>
                  Topics you've mastered (80%+ accuracy with 3+ attempts)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {getStrongAreas().length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getStrongAreas().map((formula) => (
                      <div key={formula.id} className="border rounded-lg p-4 bg-green-50">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium">{formula.label}</h3>
                          <Badge variant="default" className="bg-green-600">
                            {Math.round(formula.mastery * 100)}%
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>{formula.attempts} attempts</span>
                          <Badge variant="outline" className="text-xs">
                            {formula.category}
                          </Badge>
                        </div>
                        <Progress value={formula.mastery * 100} className="h-2 mt-2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Keep studying to unlock your strong areas!</p>
                    <p className="text-sm text-gray-500">Complete 3+ attempts with 80%+ accuracy on any topic.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="weaknesses">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                  Areas to Improve
                </CardTitle>
                <CardDescription>
                  Topics that need more practice (below 60% accuracy with 3+ attempts)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {getWeakAreas().length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getWeakAreas().map((formula) => (
                      <div key={formula.id} className="border rounded-lg p-4 bg-red-50">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium">{formula.label}</h3>
                          <Badge variant="destructive">
                            {Math.round(formula.mastery * 100)}%
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>{formula.attempts} attempts</span>
                          <Badge variant="outline" className="text-xs">
                            {formula.category}
                          </Badge>
                        </div>
                        <Progress value={formula.mastery * 100} className="h-2 mt-2" />
                        <p className="text-xs text-red-600 mt-2">
                          Focus on this topic to improve your score
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No weak areas identified yet!</p>
                    <p className="text-sm text-gray-500">Continue practicing to see areas that need improvement.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="topics">
            <Card>
              <CardHeader>
                <CardTitle>All Topics Mastery</CardTitle>
                <CardDescription>
                  Your progress on all math topics
                </CardDescription>
                  <div className="mt-3">
                    {(() => {
                      const top = [...formulaMasteries].sort((a,b) => b.mastery - a.mastery).slice(0,3);
                      const bottom = [...formulaMasteries].sort((a,b) => a.mastery - b.mastery).filter(x => x.attempts >= 2).slice(0,3);
                      if (!top.length && !bottom.length) return null;
                      return (
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <div className="text-sm text-gray-600">Top Strengths</div>
                            {top.map(t => (
                              <div key={t.id} className="text-sm font-medium">{(RULES.find(r => r.id === t.id) || { label: t.id }).label} — {Math.round(t.mastery * 100)}%</div>
                            ))}
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">Areas to Improve</div>
                            {bottom.map(t => (
                              <div key={t.id} className="text-sm font-medium">{(RULES.find(r => r.id === t.id) || { label: t.id }).label} — {Math.round(t.mastery * 100)}% ({t.attempts} attempts)</div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {formulaMasteries
                    .sort((a, b) => b.mastery - a.mastery)
                    .map((formula) => (
                      <div key={formula.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-medium">{formula.label}</h3>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={formula.mastery >= 0.8 ? "default" : formula.mastery >= 0.6 ? "secondary" : "destructive"}
                            >
                            <div className="text-sm text-gray-600">Difficulty: <strong className="ml-2">{difficulty}</strong></div>
                              {Math.round(formula.mastery * 100)}%
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {formula.category}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>{formula.attempts} attempts</span>
                          <span>{Math.round(formula.mastery * formula.attempts)}/{formula.attempts} correct</span>
                        </div>
                        <Progress value={formula.mastery * 100} className="h-2 mt-2" />
                      </div>
                    ))}
                  
                  {formulaMasteries.length === 0 && (
                    <div className="text-center py-8">
                      <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No topics practiced yet</p>
                      <p className="text-sm text-gray-500">Start studying to see your topic mastery progress.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}