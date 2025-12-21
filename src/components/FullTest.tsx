"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Clock, Target, Trophy, Calculator, Timer, Flag } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogFooter, DialogHeader, DialogClose } from '@/components/ui/dialog';
import { Question, generateFullTest, generateFullTestAI, generateFullPractice, generateFullPracticeAI, backgroundRefineFullTest, generateARQuestion, generateMKQuestion, ensureChoicesIncludeAnswer } from "@/lib/question-generator";
import { ratioToDifficulty, chooseQuestionForBank, selectQuestionForSection } from '@/lib/difficulty-utils';
import asvabBank from '@/lib/asvab_bank';
import { purgeSessionCache } from '@/ai/generateProblem';
import { structuralSignature, tokenFingerprint } from '@/ai/duplicates';
import { generateScoreReport } from "@/lib/scoring-engine";
import { loadUserModel, saveUserModel, updateUserModel } from "@/lib/decision-engine";
import { handlePostAttempt, loadAdaptiveUserModel } from "@/lib/adaptive-engine";
import { isAnswerCorrect } from '@/ai/answers';

interface FullTestProps {
  onExit: () => void;
}

interface TestQuestion {
  question: Question;
  userAnswer: number | string | null;
  isCorrect: boolean | null;
  timeSpent: number;
  isFlagged: boolean;
}

interface TestSection {
  name: string;
  questions: TestQuestion[];
  currentIndex: number;
  startTime: number;
  timeLimit: number; // in minutes
}

export default function FullTest({ onExit }: FullTestProps) {
  const [testStarted, setTestStarted] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);
  // VE probe removed: AFQT is calculated from the full test (WK/PC/GS/MK/AR)
  
  const [arSection, setArSection] = useState<TestSection>({
    name: "Arithmetic Reasoning",
    questions: [],
    currentIndex: 0,
    startTime: 0,
    timeLimit: 55 // 55 minutes for AR (full practice spec)
  });
  
  const [mkSection, setMkSection] = useState<TestSection>({
    name: "Mathematics Knowledge",
    questions: [],
    currentIndex: 0,
    startTime: 0,
    timeLimit: 23 // 23 minutes for MK (algebra & geometry included)
  });
  const [wkSection, setWkSection] = useState<TestSection>({
    name: "Word Knowledge",
    questions: [],
    currentIndex: 0,
    startTime: 0,
    timeLimit: 8 // 8 minutes for WK
  });

  const [pcSection, setPcSection] = useState<TestSection>({
    name: "Paragraph Comprehension",
    questions: [],
    currentIndex: 0,
    startTime: 0,
    timeLimit: 38 // 38 minutes for PC
  });

  const [gsSection, setGsSection] = useState<TestSection>({
    name: "General Science",
    questions: [],
    currentIndex: 0,
    startTime: 0,
    timeLimit: 11 // 11 minutes for GS
  });

  const [currentSection, setCurrentSection] = useState<'WK' | 'PC' | 'GS' | 'MK' | 'AR'>('WK');
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  // For Full Test, we don't show per-question results, so no showResult state is needed
  const [isFlagDialogOpen, setIsFlagDialogOpen] = useState(false);
  const [userModel, setUserModel] = useState<any>(null);
  const [adaptiveModel, setAdaptiveModel] = useState<any>(null);
  const [scoreReport, setScoreReport] = useState<any>(null);
  const [refining, setRefining] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState({ WK: 0, PC: 0, GS: 0, MK: 0, AR: 0 } as Record<string, number>);
  const [liveRefineEnabled, setLiveRefineEnabled] = useState(true);

  // Adaptive difficulty helpers: track recent correctness per section (for GS/WK/PC)
  const recentWindowSize = 8;
  const [recentPerformance, setRecentPerformance] = useState<Record<string, boolean[]>>({ WK: [], PC: [], GS: [], MK: [], AR: [] });
  // Track presented question IDs for the current session to avoid repeats
  const [presentedQuestionIds, setPresentedQuestionIds] = useState<Set<number>>(new Set());
  // Track last correct answer index per section so next question can avoid same position
  const [lastCorrectIndexPerSection, setLastCorrectIndexPerSection] = useState<Record<string, number | null>>({ WK: null, PC: null, GS: null, MK: null, AR: null });
  // Track an explicit tier per section (upgrades/downgrades immediately on correct/incorrect answers)
  const [sectionTier, setSectionTier] = useState<Record<string, 'easy'|'medium'|'hard'|'very-hard'|'master'>>({ WK: 'easy', PC: 'easy', GS: 'easy', MK: 'easy', AR: 'easy' });

  // Use shared mapping so tests can validate behavior deterministically
  const pickDifficultyForSection = (section: 'WK' | 'PC' | 'GS' | 'MK' | 'AR') => {
    try {
      if (section === 'AR' || section === 'MK') {
        const model = loadAdaptiveUserModel();
        return getRecommendedDifficultyForCategory(model, section === 'AR' ? 'AR' : 'MK');
      }
    } catch (e) {}
    const recent = recentPerformance[section] || [];
    const correct = recent.filter(Boolean).length;
    const ratio = recent.length ? (correct / recent.length) : 0.0;
    return ratioToDifficulty(ratio as number) as 'easy' | 'medium' | 'hard' | 'very-hard' | 'master';
  };

  // Selection logic delegated to `selectQuestionForSection` in difficulty-utils

  useEffect(() => {
    // Load user models
    const userModel = loadUserModel();
    const adaptiveModel = loadAdaptiveUserModel();
    setUserModel(userModel);
    setAdaptiveModel(adaptiveModel);
  }, []);

  // Live refine loop: runs periodically to remove duplicates during the test, replacing only unanswered and not-current questions.
  useEffect(() => {
    if (!testStarted || testCompleted || !liveRefineEnabled) return;
    let running = true;
    const intervalMs = 20000; // every 20 seconds
    const doRefine = async () => {
      try {
        const wkQs = wkSection.questions.map(q => q.question);
        const pcQs = pcSection.questions.map(q => q.question);
        const gsQs = gsSection.questions.map(q => q.question);
        const arQs = arSection.questions.map(q => q.question);
        const mkQs = mkSection.questions.map(q => q.question);

        // Quick local check for duplicates across all sections
        const combined = [...wkQs, ...pcQs, ...gsQs, ...mkQs, ...arQs];
        const seen = new Set<string>();
        let duplicatesFound = false;
        for (let i = 0; i < combined.length; i++) {
          const q = combined[i] as any;
          const sig = (q as any).structuralSignature || structuralSignature(q.text || '');
          if (seen.has(sig)) { duplicatesFound = true; break; }
          seen.add(sig);
        }
        if (!duplicatesFound) return;

        const controller = new AbortController();
        const timeoutMs = 20000;
        const t = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const resp = await fetch('/api/ai/refine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wkQuestions: wkQs, pcQuestions: pcQs, gsQuestions: gsQs, arQuestions: arQs, mkQuestions: mkQs, timeoutMs, heavy: true }), signal: controller.signal });
          if (!resp.ok) return;
          const data = await resp.json();
          if (!data) return;

          const applyReplacements = (origSection: TestSection, improvedArr: Question[] | undefined) => {
            if (!improvedArr) return { updated: origSection.questions, applied: 0 };
            let applied = 0;
            const updated = origSection.questions.map((tq, idx) => {
              if (tq.userAnswer != null) return tq; // don't replace answered
              if (origSection.currentIndex === idx) return tq; // avoid replacement for current question
              const improved = improvedArr[idx];
              if (improved && improved.text !== tq.question.text && applied < 5) {
                applied++;
                return { ...tq, question: improved, userAnswer: null, isCorrect: null, timeSpent: 0 };
              }
              return tq;
            });
            return { updated, applied } as { updated: TestQuestion[]; applied: number };
          };

          const { updated: newWk, applied: wkApplied } = applyReplacements(wkSection, data.wkQuestions);
          const { updated: newPc, applied: pcApplied } = applyReplacements(pcSection, data.pcQuestions);
          const { updated: newGs, applied: gsApplied } = applyReplacements(gsSection, data.gsQuestions);
          const { updated: newAr, applied: arApplied } = applyReplacements(arSection, data.arQuestions);
          const { updated: newMk, applied: mkApplied } = applyReplacements(mkSection, data.mkQuestions);

          if (wkApplied || pcApplied || gsApplied || arApplied || mkApplied) {
            if (wkApplied) setWkSection(s => ({ ...s, questions: newWk }));
            if (pcApplied) setPcSection(s => ({ ...s, questions: newPc }));
            if (gsApplied) setGsSection(s => ({ ...s, questions: newGs }));
            if (arApplied) setArSection(s => ({ ...s, questions: newAr }));
            if (mkApplied) setMkSection(s => ({ ...s, questions: newMk }));
            setRefining(true);
            setTimeout(() => setRefining(false), 2500);
          }
        } catch (e) {
          // ignore aborted or failed refinements
        } finally { clearTimeout(t); }
      } catch (err) {
        // ignore
      }
    };
    const id = setInterval(() => { if (running) doRefine(); }, intervalMs);
    // start immediately
    doRefine();
    return () => { running = false; clearInterval(id); };
  }, [testStarted, testCompleted, liveRefineEnabled, wkSection, pcSection, gsSection, arSection, mkSection, wkSection.currentIndex, pcSection.currentIndex, gsSection.currentIndex, arSection.currentIndex, mkSection.currentIndex, adaptiveModel]);

  useEffect(() => {
    let timer: NodeJS.Timeout;

      const getRemaining = (section: TestSection) => {
        if (!section.startTime) return section.timeLimit * 60; // return seconds
        const now = Date.now();
        const elapsed = Math.floor((now - section.startTime) / 1000);
        return Math.max(0, section.timeLimit * 60 - elapsed);
      };

    if (testStarted && !testCompleted) {
      timer = setInterval(() => {
        const wkRemaining = getRemaining(wkSection);
        const pcRemaining = getRemaining(pcSection);
        const gsRemaining = getRemaining(gsSection);
        const mkRemaining = getRemaining(mkSection);
        const arRemaining = getRemaining(arSection);

        setTimeRemaining({ WK: wkRemaining, PC: pcRemaining, GS: gsRemaining, MK: mkRemaining, AR: arRemaining });

        // Auto-submit if time runs out for current section
        if (currentSection === 'WK' && wkRemaining === 0) handleSectionComplete('WK' as any);
        else if (currentSection === 'PC' && pcRemaining === 0) handleSectionComplete('PC' as any);
        else if (currentSection === 'GS' && gsRemaining === 0) handleSectionComplete('GS' as any);
        else if (currentSection === 'MK' && mkRemaining === 0) handleSectionComplete('MK' as any);
        else if (currentSection === 'AR' && arRemaining === 0) handleSectionComplete('AR' as any);
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [testStarted, testCompleted, currentSection, arSection, mkSection]);

  const startTest = () => {
    // Immediately set a deterministic fallback so UI doesn't hang
    // Purge any previously generated cached problems so we don't reuse identical items across flows
    try { purgeSessionCache({ keepUniqueCount: 0 }); } catch (e) {}
    const std = generateFullPractice();
    const wkQuestions: Question[] = std.wkQuestions;
    const pcQuestions: Question[] = std.pcQuestions;
    const gsQuestions: Question[] = std.gsQuestions;
    const mkQuestions: Question[] = std.mkQuestions;
    const arQuestions: Question[] = std.arQuestions;

    const makeTestQs = (q: Question) => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false });

    // Seed each section with a random EASY question (start with GS)
    const seedFor = (subject: 'GS' | 'AR' | 'WK' | 'MK' | 'PC'): Question => {
      if (subject === 'AR') return generateARQuestion('rate_distance', 'easy');
      if (subject === 'MK') return generateMKQuestion('algebra_linear', 'easy');
      const bank = subject === 'GS' ? asvabBank.GS : (subject === 'WK' ? asvabBank.WK : asvabBank.PC);
      const easy = bank.filter((b: Question) => b.difficulty === 'easy');
      return easy[Math.floor(Math.random() * easy.length)];
    };
    const wkSeed = ensureChoicesIncludeAnswer(seedFor('WK'), lastCorrectIndexPerSection['WK']);
    const pcSeed = ensureChoicesIncludeAnswer(seedFor('PC'), lastCorrectIndexPerSection['PC']);
    const gsSeed = ensureChoicesIncludeAnswer(seedFor('GS'), lastCorrectIndexPerSection['GS']);
    const mkSeed = ensureChoicesIncludeAnswer(seedFor('MK'), lastCorrectIndexPerSection['MK']);
    const arSeed = ensureChoicesIncludeAnswer(seedFor('AR'), lastCorrectIndexPerSection['AR']);
    setWkSection({ ...wkSection, questions: [makeTestQs(wkSeed)] });
    setPcSection({ ...pcSection, questions: [makeTestQs(pcSeed)] });
    setGsSection({ ...gsSection, questions: [makeTestQs(gsSeed)], startTime: Date.now() });
    setMkSection({ ...mkSection, questions: [makeTestQs(mkSeed)] });
    setArSection({ ...arSection, questions: [makeTestQs(arSeed)] });
    // Mark seeded questions as presented in this session
    setPresentedQuestionIds(prev => { const s = new Set(prev); s.add(wkSeed.id as number); s.add(pcSeed.id as number); s.add(gsSeed.id as number); s.add(mkSeed.id as number); s.add(arSeed.id as number); return s; });
    setTestStarted(true);
    setCurrentSection('GS');
    setTimeRemaining({ WK: wkSection.timeLimit * 60, PC: pcSection.timeLimit * 60, GS: gsSection.timeLimit * 60, MK: mkSection.timeLimit * 60, AR: arSection.timeLimit * 60 });

    // Attempt to generate an AI-backed test in the background; replace only if user hasn't answered yet
  (async () => {
      try {
        setRefining(true);
  const model = loadAdaptiveUserModel();
        const controller = new AbortController();
        const TIMEOUT_MS = 15000; // 15s
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          // Fast mode: only light checks and quick generation to avoid hanging UI
          const aiSet = await generateFullPracticeAI(model);
          if (!aiSet) return;
          // If user hasn't answered anything, replace the fallback questions
          const answered = [wkSection, pcSection, gsSection, mkSection, arSection].some(s => (s.questions || []).some(q => q.userAnswer != null));
          if (answered) return;
          const wkTestQuestionsAI: TestQuestion[] = aiSet.wkQuestions.map(q => ({ question: ensureChoicesIncludeAnswer(q), userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false }));
          const pcTestQuestionsAI: TestQuestion[] = aiSet.pcQuestions.map(q => ({ question: ensureChoicesIncludeAnswer(q), userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false }));
          const gsTestQuestionsAI: TestQuestion[] = aiSet.gsQuestions.map(q => ({ question: ensureChoicesIncludeAnswer(q), userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false }));
          const mkTestQuestionsAI: TestQuestion[] = aiSet.mkQuestions.map(q => ({ question: ensureChoicesIncludeAnswer(q), userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false }));
          const arTestQuestionsAI: TestQuestion[] = aiSet.arQuestions.map(q => ({ question: ensureChoicesIncludeAnswer(q), userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false }));
          setWkSection(s => ({ ...s, questions: wkTestQuestionsAI }));
          setPcSection(s => ({ ...s, questions: pcTestQuestionsAI }));
          setGsSection(s => ({ ...s, questions: gsTestQuestionsAI }));
          setMkSection(s => ({ ...s, questions: mkTestQuestionsAI }));
          setArSection(s => ({ ...s, questions: arTestQuestionsAI }));
        } finally {
          clearTimeout(timeout);
          setRefining(false);
        }
      } catch (e) {
        // Ignore errors and keep deterministic fallback
      }
    })();
    // In background, attempt heavy dedupe and refinement (don't block UI)
  (async () => {
      try {
        const model = loadAdaptiveUserModel();
        const BACKGROUND_TIMEOUT = 30 * 1000; // 30s
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), BACKGROUND_TIMEOUT);
        // Prefer to run the heavy refine via a web worker + server endpoint so it doesn't block
        let improved: null | { wkQuestions?: Question[]; pcQuestions?: Question[]; gsQuestions?: Question[]; mkQuestions?: Question[]; arQuestions?: Question[] } = null;
        if (typeof Worker !== 'undefined') {
          const worker = new Worker('/refineWorker.js');
          worker.postMessage({ wkQuestions, pcQuestions, gsQuestions, mkQuestions, arQuestions, timeoutMs: BACKGROUND_TIMEOUT, heavy: true });
          worker.onmessage = (e) => {
            const data = e.data;
            worker.terminate();
            if (data && data.ok && data.payload) {
              const payload = data.payload as any;
              const anyAnswered = [wkSection, pcSection, gsSection, mkSection, arSection].some(s => (s.questions || []).some(q => q.userAnswer != null));
              if (!anyAnswered && payload) {
                if (payload.wkQuestions) setWkSection(s => ({ ...s, questions: payload.wkQuestions.map((q: Question) => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false })) }));
                if (payload.pcQuestions) setPcSection(s => ({ ...s, questions: payload.pcQuestions.map((q: Question) => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false })) }));
                if (payload.gsQuestions) setGsSection(s => ({ ...s, questions: payload.gsQuestions.map((q: Question) => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false })) }));
                if (payload.mkQuestions) setMkSection(s => ({ ...s, questions: payload.mkQuestions.map((q: Question) => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false })) }));
                if (payload.arQuestions) setArSection(s => ({ ...s, questions: payload.arQuestions.map((q: Question) => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false })) }));
              }
            }
          };
        } else {
          try {
            const resp = await fetch('/api/ai/refine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wkQuestions, pcQuestions, gsQuestions, mkQuestions, arQuestions, timeoutMs: BACKGROUND_TIMEOUT, heavy: true }), signal: controller.signal });
            if (resp.ok) {
              const payload = await resp.json();
              const anyAnswered = [wkSection, pcSection, gsSection, mkSection, arSection].some(s => (s.questions || []).some(q => q.userAnswer != null));
              if (!anyAnswered && payload) {
                if (payload.wkQuestions) setWkSection(s => ({ ...s, questions: payload.wkQuestions.map((q: Question) => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false })) }));
                if (payload.pcQuestions) setPcSection(s => ({ ...s, questions: payload.pcQuestions.map((q: Question) => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false })) }));
                if (payload.gsQuestions) setGsSection(s => ({ ...s, questions: payload.gsQuestions.map((q: Question) => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false })) }));
                if (payload.mkQuestions) setMkSection(s => ({ ...s, questions: payload.mkQuestions.map((q: Question) => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false })) }));
                if (payload.arQuestions) setArSection(s => ({ ...s, questions: payload.arQuestions.map((q: Question) => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false })) }));
              }
            }
          } catch (e) { /* ignore */ }
        }
        clearTimeout(timeout);
      } catch (e) {
        // ignore background refine errors
      }
    })();
  };

  // VE probe removed

  // Helpers to map section code to state and setters
  const getSection = (code: 'WK' | 'PC' | 'GS' | 'MK' | 'AR') => {
    if (code === 'WK') return wkSection;
    if (code === 'PC') return pcSection;
    if (code === 'GS') return gsSection;
    if (code === 'MK') return mkSection;
    return arSection;
  };

  const setSection = (code: 'WK' | 'PC' | 'GS' | 'MK' | 'AR', s: TestSection) => {
    if (code === 'WK') setWkSection(s);
    else if (code === 'PC') setPcSection(s);
    else if (code === 'GS') setGsSection(s);
    else if (code === 'MK') setMkSection(s);
    else setArSection(s);
  };

  // Keep selectedAnswer in sync with the question's stored answer when navigating
  useEffect(() => {
    const currentQ = getCurrentQuestion();
    setSelectedAnswer(currentQ?.userAnswer != null ? String(currentQ.userAnswer) : "");
  }, [currentSection, wkSection.currentIndex, pcSection.currentIndex, gsSection.currentIndex, mkSection.currentIndex, arSection.currentIndex]);

  // VE probe removed

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);

    // Persist the selected answer to the current question so it appears when the user navigates back
    const currentQ = getSection(currentSection);
    const currentQuestion = currentQ.questions[currentQ.currentIndex];
    if (!currentQuestion) return;

    const updatedQuestions = [...currentQ.questions];
    updatedQuestions[currentQ.currentIndex] = { ...currentQuestion, userAnswer: answer };
    setSection(currentSection, { ...currentQ, questions: updatedQuestions });
  };

  const recordCurrentAnswer = () => {
    if (!selectedAnswer) return;

    const currentQ = getSection(currentSection);
    const currentQuestion = currentQ.questions[currentQ.currentIndex];
    const endTime = Date.now();
    const timeSpent = endTime - (currentQ.startTime + currentQ.questions.slice(0, currentQ.currentIndex).reduce((sum, q) => sum + q.timeSpent, 0));

    const isCorrect = isAnswerCorrect(currentQuestion.question.answer, selectedAnswer);

    // Update the question (record answer, correctness and time)
    const updatedQuestions = [...currentQ.questions];
    updatedQuestions[currentQ.currentIndex] = { ...currentQuestion, userAnswer: selectedAnswer, isCorrect, timeSpent };
    setSection(currentSection, { ...currentQ, questions: updatedQuestions });

    // Update user models only for AR/MK categories (adaptive model tracks these categories)
    if ((currentSection === 'AR' || currentSection === 'MK') && userModel && adaptiveModel) {
      const updatedUserModel = updateUserModel(userModel, currentQuestion.question.formulaId, isCorrect, timeSpent, currentSection);
      saveUserModel(updatedUserModel);
      setUserModel(updatedUserModel);

      const updatedAdaptiveModel = handlePostAttempt(adaptiveModel, {
        qId: currentQuestion.question.id,
        formulaId: currentQuestion.question.formulaId,
        category: currentSection,
        correct: isCorrect,
        timeMs: timeSpent,
        difficulty: currentQuestion.question.difficulty,
        source: 'full_test'
      });
      setAdaptiveModel(updatedAdaptiveModel);
    }

    // Update recent performance for section (used to adapt difficulty for non-AR/MK)
    setRecentPerformance(prev => {
      const arr = (prev[currentSection] || []).slice();
      arr.push(!!isCorrect);
      while (arr.length > recentWindowSize) arr.shift();
      return { ...prev, [currentSection]: arr };
    });

    // Compute and persist the new tier synchronously so subsequent selection can use it
    const order: Array<'easy'|'medium'|'hard'|'very-hard'|'master'> = ['easy','medium','hard','very-hard','master'];
    const curTier = sectionTier[currentSection] || 'easy';
    const curIdx = order.indexOf(curTier);
    let newIdx = curIdx;
    if (isCorrect && curIdx < order.length - 1) newIdx = curIdx + 1;
    if (!isCorrect && curIdx > 0) newIdx = curIdx - 1;
    const newTier = order[newIdx];
    setSectionTier(prev => ({ ...prev, [currentSection]: newTier }));

    // Mark the question as presented in this session (avoid repeats)
    try {
      const qid = currentQuestion?.question?.id as number | undefined;
      if (qid) setPresentedQuestionIds(prev => { const s = new Set(prev); s.add(qid); return s; });
      // Record the index where the correct answer is placed so next question alternates
      const correctIdx = currentQuestion?.question?.choices?.findIndex((c: any) => String(c) === String(currentQuestion.question.answer));
      setLastCorrectIndexPerSection(prev => ({ ...prev, [currentSection]: correctIdx != null && correctIdx >= 0 ? correctIdx : prev[currentSection] }));
    } catch (e) { /* ignore */ }

    // Preload the next question immediately to avoid races/repeats. This ensures a fresh question
    // is available when the user advances and allows us to replace duplicates right away.
    try {
      const SECTION_TOTALS: Record<string, number> = { GS: 30, AR: 35, WK: 40, MK: 30, PC: 20 };
      const total = SECTION_TOTALS[currentSection];
      const nextIndex = currentQ.currentIndex + 1;
      if (nextIndex < total) {
        const recentOverride = ((recentPerformance[currentSection] || []).slice()).concat([!!isCorrect]).slice(-recentWindowSize);
        // compute desired tier from newTier
        const desiredTier = newTier;
        // build exclude list including already presented ids and current q id
        const excludeIds = Array.from(presentedQuestionIds);
        if (currentQuestion && currentQuestion.question && currentQuestion.question.id) excludeIds.push(currentQuestion.question.id as number);

        const existingNext = currentQ.questions[nextIndex];
        // Replace if missing, duplicate, or otherwise undesirable (same id or in exclude list)
        if (!existingNext || (existingNext.question && excludeIds.includes(existingNext.question.id as number)) || existingNext.question.difficulty !== desiredTier) {
          // Attempt multiple times to select a replacement that meets the desired tier. If
          // the selector keeps returning a lower-tier item (due to exclusions), fall back
          // to a direct bank search for a qualifying question.
          let replacement: Question | null = null;
          const rank = (d: any) => (d === 'easy' ? 0 : (d === 'medium' ? 1 : (d === 'hard' ? 2 : (d === 'very-hard' ? 3 : 4))));
          const bank = currentSection === 'GS' ? asvabBank.GS : (currentSection === 'WK' ? asvabBank.WK : asvabBank.PC);
          const mutableExcludes = excludeIds.slice();
          if (existingNext && existingNext.question && existingNext.question.id) mutableExcludes.push(existingNext.question.id as number);
          for (let attempt = 0; attempt < 6; attempt++) {
            const cand = ensureChoicesIncludeAnswer(selectQuestionForSection(currentSection as any, recentOverride as any, desiredTier as any, mutableExcludes, desiredTier), lastCorrectIndexPerSection[currentSection]);
            // eslint-disable-next-line no-console
            if (rank(cand.difficulty) >= rank(desiredTier) && !mutableExcludes.includes(cand.id as number)) { replacement = cand; break; }
            mutableExcludes.push(cand.id as number);
          }
          if (!replacement) {
            let direct = bank.filter(q => rank(q.difficulty) >= rank(desiredTier) && !mutableExcludes.includes(q.id));
            if (!direct.length) {
              // if nothing available excluding seen ids, allow picking from bank regardless of excludes
              direct = bank.filter(q => rank(q.difficulty) >= rank(desiredTier));
            }
            if (direct.length) replacement = ensureChoicesIncludeAnswer(direct[Math.floor(Math.random() * direct.length)], lastCorrectIndexPerSection[currentSection]);
            else replacement = ensureChoicesIncludeAnswer(selectQuestionForSection(currentSection as any, recentOverride as any, desiredTier as any, excludeIds, desiredTier), lastCorrectIndexPerSection[currentSection]);
          }
          const wrapped: TestQuestion = { question: replacement, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false };
          const updated = [...currentQ.questions];
          updated[nextIndex] = wrapped;
          setSection(currentSection, { ...currentQ, questions: updated });
          setPresentedQuestionIds(prev => { const s = new Set(prev); s.add(replacement.id as number); return s; });
          setLastCorrectIndexPerSection(prev => ({ ...prev, [currentSection]: replacement.choices.findIndex((c: any) => String(c) === String(replacement.answer)) }));
        }
      }
    } catch (e) { /* ignore */ }

    return isCorrect;
  };

  const handleNext = () => {
    const currentQ = getSection(currentSection);

    // Record an answer if one has been selected (allow overriding previous answers)
    const q = currentQ.questions[currentQ.currentIndex];
    let lastIsCorrect: boolean | null = null;
    if (q && selectedAnswer) {
      lastIsCorrect = recordCurrentAnswer();
    }

    const SECTION_TOTALS: Record<string, number> = { GS: 30, AR: 35, WK: 40, MK: 30, PC: 20 };

    const total = SECTION_TOTALS[currentSection];
    const nextIndex = currentQ.currentIndex + 1;

    if (nextIndex < total) {
      // If the next question hasn't been generated yet, generate it adaptively
      if (!currentQ.questions[nextIndex]) {
        // If we have a freshly recorded correctness, include it in the immediate recent window
        const recentOverride = lastIsCorrect == null ? undefined : ((recentPerformance[currentSection] || []).slice()).concat([lastIsCorrect]).slice(-recentWindowSize);
        // Determine a tier override immediately if we just answered — this allows instant upgrade/downgrade
        const tierOverride = lastIsCorrect == null ? undefined : ((): 'easy'|'medium'|'hard'|'very-hard'|'master' => {
          const order: Array<'easy'|'medium'|'hard'|'very-hard'|'master'> = ['easy','medium','hard','very-hard','master'];
          const cur = sectionTier[currentSection] || 'easy';
          const idx = order.indexOf(cur);
          let nextIdx = idx;
          if (lastIsCorrect && idx < order.length - 1) nextIdx = idx + 1;
          if (!lastIsCorrect && idx > 0) nextIdx = idx - 1;
          return order[nextIdx];
        })();
        // Persist the tier change for future selections
        if (tierOverride) setSectionTier(prev => ({ ...prev, [currentSection]: tierOverride }));

        const avoidIdx = lastCorrectIndexPerSection[currentSection];
        const nextQ = ensureChoicesIncludeAnswer(selectQuestionForSection(currentSection as any, recentOverride as any, tierOverride as any, Array.from(presentedQuestionIds), sectionTier[currentSection]), avoidIdx);
        const wrapped: TestQuestion = { question: nextQ, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false };
        const updated = [...currentQ.questions];
        updated[nextIndex] = wrapped;
        setSection(currentSection, { ...currentQ, questions: updated, currentIndex: nextIndex });
        // Mark presented and record correct answer index
        setPresentedQuestionIds(prev => { const s = new Set(prev); s.add(nextQ.id as number); return s; });
        // determine correct index and persist for alternating placements
        const correctIdx = nextQ.choices.findIndex(c => String(c) === String(nextQ.answer));
        setLastCorrectIndexPerSection(prev => ({ ...prev, [currentSection]: correctIdx }));
      } else {
        // If the next question already exists (e.g., AI pre-generated), check if the newly computed tier should replace it
        if (lastIsCorrect != null) {
          const recentOverride = ((recentPerformance[currentSection] || []).slice()).concat([lastIsCorrect]).slice(-recentWindowSize);
          const order: Array<'easy'|'medium'|'hard'|'very-hard'|'master'> = ['easy','medium','hard','very-hard','master'];
          const curTier = sectionTier[currentSection] || 'easy';
          const curIdx = order.indexOf(curTier);
          let desiredIdx = curIdx;
          if (lastIsCorrect && curIdx < order.length - 1) desiredIdx = curIdx + 1;
          if (!lastIsCorrect && curIdx > 0) desiredIdx = curIdx - 1;
          const desiredTier = order[desiredIdx];

          const existingNext = currentQ.questions[nextIndex];
          if (existingNext && existingNext.question.difficulty !== desiredTier) {
            // Replace the existing next question to reflect tier change. Retry selection several
            // times and fall back to a direct bank search if needed to ensure escalation.
            let replacement: Question | null = null;
            const rank = (d: any) => (d === 'easy' ? 0 : (d === 'medium' ? 1 : (d === 'hard' ? 2 : (d === 'very-hard' ? 3 : 4))));
            const bank = currentSection === 'GS' ? asvabBank.GS : (currentSection === 'WK' ? asvabBank.WK : asvabBank.PC);
            const mutableExcludes = Array.from(presentedQuestionIds);
            if (existingNext && existingNext.question && existingNext.question.id) mutableExcludes.push(existingNext.question.id as number);
            for (let attempt = 0; attempt < 6; attempt++) {
              const cand = ensureChoicesIncludeAnswer(selectQuestionForSection(currentSection as any, recentOverride as any, desiredTier as any, mutableExcludes, desiredTier), desiredIdx);
              if (rank(cand.difficulty) >= rank(desiredTier) && !mutableExcludes.includes(cand.id as number)) { replacement = cand; break; }
              mutableExcludes.push(cand.id as number);
            }
            if (!replacement) {
              let direct = bank.filter(q => rank(q.difficulty) >= rank(desiredTier) && !mutableExcludes.includes(q.id));
              if (!direct.length) direct = bank.filter(q => rank(q.difficulty) >= rank(desiredTier));
              if (direct.length) replacement = ensureChoicesIncludeAnswer(direct[Math.floor(Math.random() * direct.length)], desiredIdx);
              else replacement = ensureChoicesIncludeAnswer(selectQuestionForSection(currentSection as any, recentOverride as any, desiredTier as any, Array.from(presentedQuestionIds), desiredTier), desiredIdx);
            }
            const wrapped: TestQuestion = { question: replacement, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false };
            const updated = [...currentQ.questions];
            updated[nextIndex] = wrapped;
            setSection(currentSection, { ...currentQ, questions: updated, currentIndex: nextIndex });
            // Persist tier
            setSectionTier(prev => ({ ...prev, [currentSection]: desiredTier }));
            setPresentedQuestionIds(prev => { const s = new Set(prev); s.add(replacement.id as number); return s; });
            setLastCorrectIndexPerSection(prev => ({ ...prev, [currentSection]: replacement.choices.findIndex(c => String(c) === String(replacement.answer)) }));
            setSelectedAnswer("");
            return;
          }
        }
        setSection(currentSection, { ...currentQ, currentIndex: nextIndex });
        // Mark presented if navigating to an existing question
        const navNext = currentQ.questions[nextIndex];
        if (navNext && navNext.question && navNext.question.id) {
          setPresentedQuestionIds(prev => { const s = new Set(prev); s.add(navNext.question.id as number); return s; });
          setLastCorrectIndexPerSection(prev => ({ ...prev, [currentSection]: navNext.question.choices.findIndex((c: any) => String(c) === String(navNext.question.answer)) }));
        }
      }
      setSelectedAnswer("");
    } else {
      // Section complete
      handleSectionComplete(currentSection);
    }
  };

  // Previous navigation removed — full test is sequential and users cannot go back to prior questions

  const gotoFlaggedQuestion = (section: 'WK' | 'PC' | 'GS' | 'MK' | 'AR', index: number) => {
    setCurrentSection(section);
    const cur = getSection(section);
    setSection(section, { ...cur, currentIndex: index });
  };

  const handleSectionComplete = (section: 'WK' | 'PC' | 'GS' | 'MK' | 'AR') => {
    // New sequence: GS -> AR -> WK -> MK -> PC
    if (section === 'GS') {
      // start AR
      if (!arSection.startTime) setArSection({ ...arSection, startTime: Date.now() });
      setCurrentSection('AR');
    } else if (section === 'AR') {
      if (!wkSection.startTime) setWkSection({ ...wkSection, startTime: Date.now() });
      setCurrentSection('WK');
    } else if (section === 'WK') {
      if (!mkSection.startTime) setMkSection({ ...mkSection, startTime: Date.now() });
      setCurrentSection('MK');
    } else if (section === 'MK') {
      if (!pcSection.startTime) setPcSection({ ...pcSection, startTime: Date.now() });
      setCurrentSection('PC');
    } else {
      // PC complete -> finish full test
      completeTest();
    }
  };

  const toggleFlag = () => {
    const currentQ = getSection(currentSection);
    const currentQuestion = currentQ.questions[currentQ.currentIndex];
    const updatedQuestions = [...currentQ.questions];
    updatedQuestions[currentQ.currentIndex] = { ...currentQuestion, isFlagged: !currentQuestion.isFlagged };
    setSection(currentSection, { ...currentQ, questions: updatedQuestions });
  };

  const completeTest = () => {
    setTestCompleted(true);
    
    // Generate score report
    const wkAnswers = wkSection.questions.map(q => q.userAnswer);
    const pcAnswers = pcSection.questions.map(q => q.userAnswer);
    const arAnswers = arSection.questions.map(q => q.userAnswer);
    const mkAnswers = mkSection.questions.map(q => q.userAnswer);
    const wkQuestions = wkSection.questions.map(q => q.question);
    const pcQuestions = pcSection.questions.map(q => q.question);
    const arQuestions = arSection.questions.map(q => q.question);
    const mkQuestions = mkSection.questions.map(q => q.question);

    const report = generateScoreReport(
      arQuestions,
      arAnswers,
      mkQuestions,
      mkAnswers,
      wkQuestions,
      wkAnswers,
      pcQuestions,
      pcAnswers
    );
    
    setScoreReport(report);
    try {
      // Persist a marker that the user completed a full test along with the report
      localStorage.setItem('asvab_full_test_completed_v1', JSON.stringify({ ts: Date.now(), report }));
    } catch (e) {
      // ignore storage errors
    }
  };

  const getCurrentQuestion = () => {
    const currentQ = getSection(currentSection);
    return currentQ.questions[currentQ.currentIndex];
  };

  // No section progress or live score during Full Test.

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m)}:${String(s).padStart(2, '0')}`;
  }

  if (!testStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
    <div className="flex items-center justify-between mb-6">
            <Button variant="outline" onClick={onExit} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
            
            <h1 className="text-2xl font-bold">Full ASVAB Practice Test</h1>
            {refining && (
              <Badge variant="secondary" className="ml-4">Refining test in background</Badge>
            )}
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-6 h-6" />
                Test Instructions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-2">General Science (GS)</h3>
                    <ul className="space-y-1 text-sm text-gray-600">
                      <li>• 30 questions</li>
                      <li>• 11 minutes time limit</li>
                      <li>• Basic science facts and applications</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Arithmetic Reasoning (AR)</h3>
                    <ul className="space-y-1 text-sm text-gray-600">
                      <li>• 35 questions</li>
                      <li>• 55 minutes time limit</li>
                      <li>• Word problems and multi-step reasoning</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Word Knowledge (WK)</h3>
                    <ul className="space-y-1 text-sm text-gray-600">
                      <li>• 40 questions</li>
                      <li>• 8 minutes time limit</li>
                      <li>• Vocabulary: synonyms, context clues</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Mathematics Knowledge (MK)</h3>
                    <ul className="space-y-1 text-sm text-gray-600">
                      <li>• 30 questions</li>
                      <li>• 23 minutes time limit</li>
                      <li>• Algebra and geometry (algebra, geometry, and core math)</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Paragraph Comprehension (PC)</h3>
                    <ul className="space-y-1 text-sm text-gray-600">
                      <li>• 20 questions</li>
                      <li>• 38 minutes time limit</li>
                      <li>• Reading comprehension, inference, main idea</li>
                    </ul>
                  </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">Important Notes</h3>
                  <ul className="space-y-1 text-sm text-blue-800">
                    <li>• You cannot pause the test once started</li>
                    <li>• Each section has its own time limit</li>
                    <li>• Your progress will be saved</li>
                    <li>• You'll receive a predicted ASVAB score</li>
                  </ul>
                </div>

                <div className="flex gap-4">
                  <Button onClick={startTest} className="flex-1" size="lg">
                    Start Full Test
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // VE probe removed: AFQT estimated from full test sections

  if (testCompleted && scoreReport) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Button variant="outline" onClick={onExit} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
            
            <h1 className="text-2xl font-bold">Test Results</h1>
          </div>

          {/* Score Summary */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-600" />
                Your ASVAB Score Prediction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600">
                    {scoreReport.summary.percentile}
                  </div>
                  <p className="text-gray-600">Predicted AFQT</p>
                  <Badge variant="outline" className="mt-1">
                    {scoreReport.afqtInterpretation}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600">
                    {scoreReport.summary.AR_scaled}
                  </div>
                  <p className="text-gray-600">AR Scaled</p>
                  <p className="text-sm text-gray-500">
                    {scoreReport.breakdown.arCorrect}/{scoreReport.breakdown.arTotal}
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-600">
                    {scoreReport.summary.MK_scaled}
                  </div>
                  <p className="text-gray-600">MK Scaled</p>
                  <p className="text-sm text-gray-500">
                    {scoreReport.breakdown.mkCorrect}/{scoreReport.breakdown.mkTotal}
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-orange-600">
                    {scoreReport.summary.VE_estimated}
                  </div>
                  <p className="text-gray-600">VE Estimated</p>
                  {scoreReport.breakdown.veTotal && (
                    <p className="text-sm text-gray-500">
                      {scoreReport.breakdown.veCorrect}/{scoreReport.breakdown.veTotal}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Recommendations</h3>
                  <ul className="space-y-2">
                    {scoreReport.recommendations.map((rec: string, index: number) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Performance Analysis</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">AR Accuracy</span>
                        <span className="text-sm font-medium">{scoreReport.breakdown.arPercentage}%</span>
                      </div>
                      <Progress value={scoreReport.breakdown.arPercentage} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">MK Accuracy</span>
                        <span className="text-sm font-medium">{scoreReport.breakdown.mkPercentage}%</span>
                      </div>
                      <Progress value={scoreReport.breakdown.mkPercentage} className="h-2" />
                    </div>
                    {scoreReport.breakdown.vePercentage !== undefined && (
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">VE Accuracy</span>
                          <span className="text-sm font-medium">{scoreReport.breakdown.vePercentage}%</span>
                        </div>
                        <Progress value={scoreReport.breakdown.vePercentage} className="h-2" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t">
                <Button onClick={onExit} className="w-full">
                  Finish and Return to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const currentQuestion = getCurrentQuestion();
  const currentQ = getSection(currentSection);

  const flaggedCount = currentSection === 'AR' ? (arSection.questions.filter(q => q.isFlagged).length) : (mkSection.questions.filter(q => q.isFlagged).length);

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading test...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-lg px-4 py-2">
              {getSection(currentSection).name}
            </Badge>
            <div className="flex items-center gap-2 text-sm">
              <Timer className="w-4 h-4" />
              <span className={timeRemaining[currentSection] < 10 ? 'text-red-600 font-bold' : ''}>
                {formatTime(timeRemaining[currentSection])} remaining
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Question</p>
              <p className="font-bold">
                {currentQ.currentIndex + 1} / {currentQ.questions.length}
              </p>
            </div>
            <Button onClick={toggleFlag} variant="outline" size="sm" aria-pressed={currentQuestion.isFlagged}>
              <Flag className={`w-4 h-4 ${currentQuestion.isFlagged ? 'text-red-600 fill-current' : 'text-gray-600'}`} />
            </Button>
            <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <span className="ml-0">Marked ({flaggedCount})</span>
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Marked Questions</DialogTitle>
                </DialogHeader>
                <DialogDescription>
                  Select a marked question to review. Correctness won't be shown during a Full Test.
                </DialogDescription>
                <div className="mt-4 space-y-2 max-h-64 overflow-auto">
                  <div className="text-sm font-semibold">{getSection(currentSection).name} — Marked</div>
                  <div className="grid grid-cols-1 gap-1">
                    {getSection(currentSection).questions.map((q, idx) => (
                      <DialogClose asChild key={`${currentSection}-${idx}`}>
                        <button
                          onClick={() => gotoFlaggedQuestion(currentSection, idx)}
                          className="flex items-center justify-between p-2 rounded hover:bg-gray-50 text-left w-full"
                          aria-label={`Go to ${currentSection} question ${idx + 1}`}
                        >
                          <div className="text-sm truncate">{idx + 1}. {q.question.text.slice(0, 120)}</div>
                          <div className="ml-2 flex-shrink-0">
                            {q.isFlagged ? <Flag className="w-4 h-4 text-red-600 fill-current" /> : <Flag className="w-4 h-4 text-gray-300" />}
                          </div>
                        </button>
                      </DialogClose>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Close</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Section progress and live score are intentionally hidden during a Full Test */}

        {/* Question Card */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Question {currentQ.currentIndex + 1}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-white p-6 rounded-lg border mb-6">
              <p className="text-lg font-medium">{currentQuestion.question.text}</p>
            </div>

            <div className="space-y-4">
                <RadioGroup value={selectedAnswer} onValueChange={handleAnswerSelect}>
                  {currentQuestion.question.choices.map((choice, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <RadioGroupItem value={choice.toString()} id={`choice-${index}`} />
                      <Label htmlFor={`choice-${index}`} className="cursor-pointer">
                        {choice}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>

                <div className="w-full">
                  <Button
                    onClick={() => { handleNext(); }}
                    disabled={!selectedAnswer}
                    className="w-full block"
                  >
                    {currentQ.currentIndex < currentQ.questions.length - 1 ? "Next Question" : "Finish Section"}
                  </Button>
                </div>
              </div>
          </CardContent>
        </Card>

        {/* Question Navigator removed for Full Test to match real ASVAB; navigation between questions is sequential only. */}
      </div>
    </div>
  );
}