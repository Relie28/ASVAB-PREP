"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Clock, Target, Trophy, Calculator, Timer, Flag } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogFooter, DialogHeader, DialogClose } from '@/components/ui/dialog';
import { Question, generateFullTest, generateFullTestAI, backgroundRefineFullTest } from "@/lib/question-generator";
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
  const [veProbeStarted, setVeProbeStarted] = useState(false);
  const [veProbeCompleted, setVeProbeCompleted] = useState(false);
  const [veProbeResults, setVeProbeResults] = useState<boolean[]>([]);
  
  const [arSection, setArSection] = useState<TestSection>({
    name: "Arithmetic Reasoning",
    questions: [],
    currentIndex: 0,
    startTime: 0,
    timeLimit: 75 // 75 minutes for AR
  });
  
  const [mkSection, setMkSection] = useState<TestSection>({
    name: "Mathematics Knowledge",
    questions: [],
    currentIndex: 0,
    startTime: 0,
    timeLimit: 60 // 60 minutes for MK
  });
  
  const [currentSection, setCurrentSection] = useState<'AR' | 'MK'>('AR');
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  // For Full Test, we don't show per-question results, so no showResult state is needed
  const [isFlagDialogOpen, setIsFlagDialogOpen] = useState(false);
  const [userModel, setUserModel] = useState<any>(null);
  const [adaptiveModel, setAdaptiveModel] = useState<any>(null);
  const [scoreReport, setScoreReport] = useState<any>(null);
  const [refining, setRefining] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState({ AR: 0, MK: 0 });
  const [liveRefineEnabled, setLiveRefineEnabled] = useState(true);

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
        const arQs = arSection.questions.map(q => q.question);
        const mkQs = mkSection.questions.map(q => q.question);
        // Quick local check for duplicates using structuralSignature and isDuplicate for fast detection
        const combined = [...arQs, ...mkQs];
        const duplicatesIdx: { idx: number; subject: 'AR' | 'MK' }[] = [];
        const seen = new Set<string>();
        for (let i = 0; i < combined.length; i++) {
          const q = combined[i] as any;
          const sig = (q as any).structuralSignature || structuralSignature(q.text || '');
          if (seen.has(sig)) {
            const isAr = i < arQs.length;
            // Ensure it's not the current question and not answered
            const curSection = isAr ? arSection : mkSection;
            const idxInSection = isAr ? i : i - arQs.length;
            const qItem = curSection.questions[idxInSection];
            if (qItem && qItem.userAnswer == null && !(curSection.currentIndex === idxInSection)) {
              duplicatesIdx.push({ idx: idxInSection, subject: isAr ? 'AR' : 'MK' });
            }
          } else {
            seen.add(sig);
          }
        }
        if (!duplicatesIdx.length) return;
        // If duplicates found, request heavy server-side refine for the whole test and then replace only unanswered questions that differ
        const controller = new AbortController();
        const timeoutMs = 20000;
        const t = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const resp = await fetch('/api/ai/refine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ arQuestions: arQs, mkQuestions: mkQs, timeoutMs, heavy: true }), signal: controller.signal });
          if (!resp.ok) return;
          const data = await resp.json();
          if (!data || !data.arQuestions || !data.mkQuestions) return;
          // Apply only differences for unanswered questions
          const applyReplacements = (origSection: TestSection, improvedArr: Question[]) => {
            let applied = 0;
            const updated = origSection.questions.map((tq, idx) => {
              if (tq.userAnswer != null) return tq; // don't replace answered
              if (origSection.currentIndex === idx) return tq; // avoid replacement for current question
              const improved = improvedArr[idx];
              if (improved && improved.text !== tq.question.text && applied < 5) { // limit to 5 replacements per refine
                applied++;
                return { ...tq, question: improved, userAnswer: null, isCorrect: null, timeSpent: 0 };
              }
              return tq;
            });
            return { updated, applied } as { updated: TestQuestion[]; applied: number };
          };
          const { updated: newArQuestions, applied: arApplied } = applyReplacements(arSection, data.arQuestions);
          const { updated: newMkQuestions, applied: mkApplied } = applyReplacements(mkSection, data.mkQuestions);
          if (arApplied || mkApplied) {
            setArSection(s => ({ ...s, questions: newArQuestions }));
            setMkSection(s => ({ ...s, questions: newMkQuestions }));
            // optional: briefly show refining indicator
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
  }, [testStarted, testCompleted, liveRefineEnabled, arSection, mkSection, arSection.currentIndex, mkSection.currentIndex, adaptiveModel]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (testStarted && !testCompleted) {
      timer = setInterval(() => {
        const now = Date.now();
        const arElapsed = Math.floor((now - arSection.startTime) / 1000 / 60);
        const mkElapsed = currentSection === 'MK' ? Math.floor((now - mkSection.startTime) / 1000 / 60) : 0;
        
        const arRemaining = Math.max(0, arSection.timeLimit - arElapsed);
        const mkRemaining = Math.max(0, mkSection.timeLimit - mkElapsed);
        
        setTimeRemaining({ AR: arRemaining, MK: mkRemaining });
        
        // Auto-submit if time runs out
        if (currentSection === 'AR' && arRemaining === 0) {
          handleSectionComplete('AR');
        } else if (currentSection === 'MK' && mkRemaining === 0) {
          handleSectionComplete('MK');
        }
      }, 1000);
    }
    
    return () => clearInterval(timer);
  }, [testStarted, testCompleted, currentSection, arSection, mkSection]);

  const startTest = () => {
    // Immediately set a deterministic fallback so UI doesn't hang
    // Purge any previously generated cached problems so we don't reuse identical items across flows
    try { purgeSessionCache({ keepUniqueCount: 0 }); } catch (e) {}
    const std = generateFullTest();
    const arQuestions: Question[] = std.arQuestions;
    const mkQuestions: Question[] = std.mkQuestions;
    const arTestQuestions: TestQuestion[] = arQuestions.map(q => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false }));
    const mkTestQuestions: TestQuestion[] = mkQuestions.map(q => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false }));

    // Set initial questions synchronously to avoid waiting for AI
    setArSection({ ...arSection, questions: arTestQuestions, startTime: Date.now() });
    setMkSection({ ...mkSection, questions: mkTestQuestions });
    setTestStarted(true);
    setTimeRemaining({ AR: 75, MK: 60 });

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
          const aiSet = await generateFullTestAI(model, { timeoutMs: TIMEOUT_MS, signal: controller.signal, fastMode: true });
          if (!aiSet) return;
          // If user hasn't answered anything, replace the fallback questions
          const arAnswered = (arSection.questions || []).some(q => q.userAnswer != null);
          const mkAnswered = (mkSection.questions || []).some(q => q.userAnswer != null);
          if (arAnswered || mkAnswered) return;
          const arTestQuestionsAI: TestQuestion[] = aiSet.arQuestions.map(q => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false }));
          const mkTestQuestionsAI: TestQuestion[] = aiSet.mkQuestions.map(q => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false }));
          setArSection(s => ({ ...s, questions: arTestQuestionsAI }));
          setMkSection(s => ({ ...s, questions: mkTestQuestionsAI }));
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
  let improved = null as null | { arQuestions: Question[]; mkQuestions: Question[] };
          if (typeof Worker !== 'undefined') {
          const worker = new Worker('/refineWorker.js');
          // for initial background refine prefer heavy dedupe on server
          worker.postMessage({ arQuestions, mkQuestions, timeoutMs: BACKGROUND_TIMEOUT, heavy: true });
          worker.onmessage = (e) => {
            const data = e.data;
            worker.terminate();
            if (data && data.ok && data.payload) {
              improved = data.payload as { arQuestions: Question[]; mkQuestions: Question[] };
              const anyAnswered = (arSection.questions || []).some(q => q.userAnswer != null) || (mkSection.questions || []).some(q => q.userAnswer != null);
              if (!anyAnswered && improved) {
                if (improved) {
                  const imp = improved;
                  setArSection(s => ({ ...s, questions: imp.arQuestions.map(q => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false })) }));
                  setMkSection(s => ({ ...s, questions: imp.mkQuestions.map(q => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false })) }));
                }
              }
            }
          };
        } else {
          improved = await backgroundRefineFullTest(arQuestions, mkQuestions, model, { timeoutMs: BACKGROUND_TIMEOUT, signal: controller.signal });
          const anyAnswered = (arSection.questions || []).some(q => q.userAnswer != null) || (mkSection.questions || []).some(q => q.userAnswer != null);
          if (!anyAnswered && improved) {
            if (improved) {
              const imp = improved;
              setArSection(s => ({ ...s, questions: imp.arQuestions.map(q => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false })) }));
              setMkSection(s => ({ ...s, questions: imp.mkQuestions.map(q => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false })) }));
            }
          }
        }
        clearTimeout(timeout);
  // Replace only if still no answers
  const anyAnswered = (arSection.questions || []).some(q => q.userAnswer != null) || (mkSection.questions || []).some(q => q.userAnswer != null);
        if (!anyAnswered && improved) {
          if (improved) {
            const imp = improved;
            setArSection(s => ({ ...s, questions: imp.arQuestions.map(q => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false })) }));
            setMkSection(s => ({ ...s, questions: imp.mkQuestions.map(q => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0, isFlagged: false })) }));
          }
        }
      } catch (e) {
        // ignore background refine errors
      }
    })();
  };

  const startVEProbe = () => {
    setVeProbeStarted(true);
    setVeProbeResults(Array(10).fill(false));
  };

  // Keep selectedAnswer in sync with the question's stored answer when navigating
  useEffect(() => {
    const currentQ = getCurrentQuestion();
    setSelectedAnswer(currentQ?.userAnswer != null ? String(currentQ.userAnswer) : "");
  }, [currentSection, arSection.currentIndex, mkSection.currentIndex]);

  const handleVEAnswer = (questionIndex: number, answerIndex: number, correctIndex: number) => {
    const newResults = [...veProbeResults];
    newResults[questionIndex] = answerIndex === correctIndex;
    setVeProbeResults(newResults);
    
    if (questionIndex === 9) {
      setTimeout(() => setVeProbeCompleted(true), 1000);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);

    // Persist the selected answer to the current question so it appears when the user navigates back
    const currentQ = currentSection === 'AR' ? arSection : mkSection;
    const currentQuestion = currentQ.questions[currentQ.currentIndex];
    if (!currentQuestion) return;

    const updatedQuestions = [...currentQ.questions];
    updatedQuestions[currentQ.currentIndex] = {
      ...currentQuestion,
      userAnswer: answer
    };

    if (currentSection === 'AR') {
      setArSection({ ...arSection, questions: updatedQuestions });
    } else {
      setMkSection({ ...mkSection, questions: updatedQuestions });
    }
  };

  const recordCurrentAnswer = () => {
    if (!selectedAnswer) return;

    const currentQ = currentSection === 'AR' ? arSection : mkSection;
    const currentQuestion = currentQ.questions[currentQ.currentIndex];
    const endTime = Date.now();
    const timeSpent = endTime - (currentQ.startTime + currentQ.questions.slice(0, currentQ.currentIndex).reduce((sum, q) => sum + q.timeSpent, 0));

  const isCorrect = isAnswerCorrect(currentQuestion.question.answer, selectedAnswer);

    // Update the question (record answer, correctness and time)
    const updatedQuestions = [...currentQ.questions];
    updatedQuestions[currentQ.currentIndex] = {
      ...currentQuestion,
      userAnswer: selectedAnswer,
      isCorrect,
      timeSpent
    };

    if (currentSection === 'AR') {
      setArSection({ ...arSection, questions: updatedQuestions });
    } else {
      setMkSection({ ...mkSection, questions: updatedQuestions });
    }

    // Update user models
    if (userModel && adaptiveModel) {
      const updatedUserModel = updateUserModel(
        userModel,
        currentQuestion.question.formulaId,
        isCorrect,
        timeSpent,
        currentSection
      );
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
  };

  const handleNext = () => {
    const currentQ = currentSection === 'AR' ? arSection : mkSection;

    // Record an answer if one has been selected (allow overriding previous answers)
    const q = currentQ.questions[currentQ.currentIndex];
    if (q && selectedAnswer) {
      recordCurrentAnswer();
    }

    if (currentQ.currentIndex < currentQ.questions.length - 1) {
      // Move to next question
      if (currentSection === 'AR') {
        setArSection({ ...arSection, currentIndex: arSection.currentIndex + 1 });
      } else {
        setMkSection({ ...mkSection, currentIndex: mkSection.currentIndex + 1 });
      }

      setSelectedAnswer("");
    } else {
      // Section complete
      handleSectionComplete(currentSection);
    }
  };

  const handlePrev = () => {
    const currentQ = currentSection === 'AR' ? arSection : mkSection;
    if (currentQ.currentIndex > 0) {
      if (currentSection === 'AR') {
        setArSection({ ...arSection, currentIndex: arSection.currentIndex - 1 });
      } else {
        setMkSection({ ...mkSection, currentIndex: mkSection.currentIndex - 1 });
      }
    }
  };

  const gotoFlaggedQuestion = (section: 'AR' | 'MK', index: number) => {
    if (section === 'AR') {
      setCurrentSection('AR');
      setArSection({ ...arSection, currentIndex: index });
    } else {
      setCurrentSection('MK');
      setMkSection({ ...mkSection, currentIndex: index });
    }
  };

  const handleSectionComplete = (section: 'AR' | 'MK') => {
    if (section === 'AR' && !mkSection.startTime) {
      // Start MK section
      setMkSection({
        ...mkSection,
        startTime: Date.now()
      });
      setCurrentSection('MK');
    } else {
      // Test complete
      completeTest();
    }
  };

  const toggleFlag = () => {
    const currentQ = currentSection === 'AR' ? arSection : mkSection;
    const currentQuestion = currentQ.questions[currentQ.currentIndex];
    
    const updatedQuestions = [...currentQ.questions];
    updatedQuestions[currentQ.currentIndex] = {
      ...currentQuestion,
      isFlagged: !currentQuestion.isFlagged
    };

    if (currentSection === 'AR') {
      setArSection({ ...arSection, questions: updatedQuestions });
    } else {
      setMkSection({ ...mkSection, questions: updatedQuestions });
    }
  };

  const completeTest = () => {
    setTestCompleted(true);
    
    // Generate score report
    const arAnswers = arSection.questions.map(q => q.userAnswer);
    const mkAnswers = mkSection.questions.map(q => q.userAnswer);
    const arQuestions = arSection.questions.map(q => q.question);
    const mkQuestions = mkSection.questions.map(q => q.question);
    
    const report = generateScoreReport(
      arQuestions,
      arAnswers,
      mkQuestions,
      mkAnswers,
      veProbeCompleted ? veProbeResults : undefined
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
    const currentQ = currentSection === 'AR' ? arSection : mkSection;
    return currentQ.questions[currentQ.currentIndex];
  };

  // No section progress or live score during Full Test.

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (!testStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
    <div className="flex items-center justify-between mb-6">
            <Button variant="outline" onClick={onExit} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
            
            <h1 className="text-2xl font-bold">Full ASVAB Math Test</h1>
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
                    <h3 className="font-semibold mb-2">Arithmetic Reasoning (AR)</h3>
                    <ul className="space-y-1 text-sm text-gray-600">
                      <li>• 120 questions</li>
                      <li>• 75 minutes time limit</li>
                      <li>• Word problems and formulas</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Mathematics Knowledge (MK)</h3>
                    <ul className="space-y-1 text-sm text-gray-600">
                      <li>• 120 questions</li>
                      <li>• 60 minutes time limit</li>
                      <li>• Algebra, geometry, concepts</li>
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
                  <Button onClick={startVEProbe} variant="outline" className="flex-1" size="lg">
                    Take VE Probe First (Optional)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (veProbeStarted && !veProbeCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Verbal Expression (VE) Probe</CardTitle>
              <CardDescription>
                This 10-question probe helps improve your ASVAB score prediction
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  {
                    type: "WK",
                    q: "Choose the word closest in meaning to: ABRUPT",
                    choices: ["sudden", "gradual", "polite", "careful"],
                    answer: 0
                  },
                  {
                    type: "PC",
                    passage: "Most plants require sunlight to perform photosynthesis, the process by which they convert light into chemical energy. Without adequate light, many plants weaken and may die.",
                    q: "Why is sunlight important to plants?",
                    choices: ["It provides chemical energy via photosynthesis", "It makes plants look green", "It cools plants down", "It attracts pollinators"],
                    answer: 0
                  }
                ].map((item, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    {item.type === "PC" && (
                      <div className="bg-gray-50 p-3 rounded mb-3">
                        <p className="text-sm">{item.passage}</p>
                      </div>
                    )}
                    <p className="font-medium mb-3">{item.q}</p>
                    <RadioGroup onValueChange={(value) => handleVEAnswer(index, parseInt(value), item.answer)}>
                      {item.choices.map((choice, choiceIndex) => (
                        <div key={choiceIndex} className="flex items-center space-x-2">
                          <RadioGroupItem value={choiceIndex.toString()} id={`ve-${index}-${choiceIndex}`} />
                          <Label htmlFor={`ve-${index}-${choiceIndex}`} className="cursor-pointer">
                            {choice}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
  const currentQ = currentSection === 'AR' ? arSection : mkSection;

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
              {currentSection === 'AR' ? 'Arithmetic Reasoning' : 'Mathematics Knowledge'}
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
                  {currentSection === 'AR' ? (
                    <>
                      <div className="text-sm font-semibold">AR Marked</div>
                      <div className="grid grid-cols-1 gap-1">
                        {arSection.questions.map((q, idx) => (
                          <DialogClose asChild key={`ar-${idx}`}>
                            <button
                              onClick={() => gotoFlaggedQuestion('AR', idx)}
                              className="flex items-center justify-between p-2 rounded hover:bg-gray-50 text-left w-full"
                              aria-label={`Go to AR question ${idx + 1}`}
                            >
                              <div className="text-sm truncate">{idx + 1}. {q.question.text.slice(0, 120)}</div>
                              <div className="ml-2 flex-shrink-0">
                                {q.isFlagged ? <Flag className="w-4 h-4 text-red-600 fill-current" /> : <Flag className="w-4 h-4 text-gray-300" />}
                              </div>
                            </button>
                          </DialogClose>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold">MK Marked</div>
                      <div className="grid grid-cols-1 gap-1">
                        {mkSection.questions.map((q, idx) => (
                          <DialogClose asChild key={`mk-${idx}`}>
                            <button
                              onClick={() => gotoFlaggedQuestion('MK', idx)}
                              className="flex items-center justify-between p-2 rounded hover:bg-gray-50 text-left w-full"
                              aria-label={`Go to MK question ${idx + 1}`}
                            >
                              <div className="text-sm truncate">{idx + 1}. {q.question.text.slice(0, 120)}</div>
                              <div className="ml-2 flex-shrink-0">
                                {q.isFlagged ? <Flag className="w-4 h-4 text-red-600 fill-current" /> : <Flag className="w-4 h-4 text-gray-300" />}
                              </div>
                            </button>
                          </DialogClose>
                        ))}
                      </div>
                    </>
                  )}
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

                <div className="flex items-center justify-between gap-4">
                  <Button
                    onClick={handlePrev}
                    disabled={currentQ.currentIndex === 0}
                    variant="outline"
                    className="w-1/3"
                  >
                    Previous
                  </Button>

                  <Button
                    onClick={() => { if (selectedAnswer) { recordCurrentAnswer(); handleNext(); } }}
                    disabled={!selectedAnswer}
                    className="w-2/3"
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