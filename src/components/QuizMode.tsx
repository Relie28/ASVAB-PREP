"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, CheckCircle, XCircle, Clock, Target, Trophy, Calculator } from "lucide-react";
import { Question, generateARQuestion, generateMKQuestion, batchGenerate, batchGenerateAI, shuffleChoicesForQuestion } from "@/lib/question-generator";
import { normalizeText } from '@/ai/duplicates';
import { loadUserModel, saveUserModel, updateUserModel } from "@/lib/decision-engine";
import { handlePostAttempt, loadAdaptiveUserModel } from "@/lib/adaptive-engine";
import { isAnswerCorrect } from '@/ai/answers';
import { getDeepTeaching } from '@/lib/decision-engine';
import { useConceptMastery } from '@/hooks/useConceptMastery';

interface QuizModeProps {
  mode: "AR" | "MK";
  onExit: () => void;
}

interface QuizQuestion {
  question: Question;
  userAnswer: number | string | null;
  isCorrect: boolean | null;
  timeSpent: number;
}

export default function QuizMode({ mode, onExit }: QuizModeProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [showResult, setShowResult] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [userModel, setUserModel] = useState<any>(null);
  const [adaptiveModel, setAdaptiveModel] = useState<any>(null);
  const persistGenerated = typeof window !== 'undefined' ? (localStorage.getItem('ai_persist_generated') === 'true') : false;
  const mastery = useConceptMastery();
  const [currentCycleFormula, setCurrentCycleFormula] = useState<string | null>(null);
  const [isRecallMode, setIsRecallMode] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownContent, setBreakdownContent] = useState<any | null>(null);
  const [breakdownStepsCompleted, setBreakdownStepsCompleted] = useState<boolean[]>([]);

  useEffect(() => {
    // Load user models
    const userModel = loadUserModel();
    const adaptiveModel = loadAdaptiveUserModel();
    setUserModel(userModel);
    setAdaptiveModel(adaptiveModel);
    // Generate quiz questions adaptively in small batches; keep fetching more to fill pool
    (async () => {
      const targetCount = 10;
      const initialBatchSize = 3;
      let quizQuestions: Question[] = [];
    try {
  quizQuestions = await batchGenerateAI(initialBatchSize, mode, adaptiveModel, undefined, undefined, { persist: persistGenerated });
      } catch (e) {
        quizQuestions = batchGenerate(initialBatchSize, mode);
      }
      const formattedQuestions = quizQuestions.map(q => ({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0 }));
      setQuestions(formattedQuestions);
      // Refill background until targetCount reached
      (async () => {
        while (formattedQuestions.length < targetCount) {
          try {
            const more = await batchGenerateAI(Math.min(3, targetCount - formattedQuestions.length), mode, adaptiveModel, undefined, undefined, { persist: persistGenerated });
            more.forEach(q => formattedQuestions.push({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0 }));
          } catch (e) {
            const fallback = batchGenerate(Math.min(3, targetCount - formattedQuestions.length), mode);
            fallback.forEach(q => formattedQuestions.push({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0 }));
          }
          setQuestions([...formattedQuestions]);
        }
      })();
    })();
    setStartTime(Date.now());
    setQuestionStartTime(Date.now());
  }, [mode]);

  const currentQuizQuestion = questions[currentQuestionIndex];

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
  };

  const handleSubmit = () => {
    if (!selectedAnswer || !currentQuizQuestion) return;

    const endTime = Date.now();
    const timeSpent = endTime - questionStartTime;

  const isCorrect = isAnswerCorrect(currentQuizQuestion.question.answer, selectedAnswer);
    
    // Update the question in the array
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestionIndex] = {
      ...currentQuizQuestion,
      userAnswer: selectedAnswer,
      isCorrect,
      timeSpent
    };
    setQuestions(updatedQuestions);
    
    setShowResult(true);

    // Update user models
    if (userModel && adaptiveModel) {
      const updatedUserModel = updateUserModel(
        userModel,
        currentQuizQuestion.question.formulaId,
        isCorrect,
        timeSpent,
        mode
      );
      saveUserModel(updatedUserModel);
      setUserModel(updatedUserModel);

      const updatedAdaptiveModel = handlePostAttempt(adaptiveModel, {
        qId: currentQuizQuestion.question.id,
        formulaId: currentQuizQuestion.question.formulaId,
        category: mode,
        correct: isCorrect,
        timeMs: timeSpent,
        difficulty: currentQuizQuestion.question.difficulty
      , source: 'quiz' });
      setAdaptiveModel(updatedAdaptiveModel);
    }
    // Mastery loop handling for quiz mode
    try {
      const res = mastery.recordAttempt(currentQuizQuestion.question.formulaId, isCorrect, { isRecall: isRecallMode });
      if (!isCorrect) {
        mastery.startCycle(currentQuizQuestion.question.formulaId);
        setCurrentCycleFormula(currentQuizQuestion.question.formulaId);
  const teach = getDeepTeaching(currentQuizQuestion.question.formulaId);
  const steps = (currentQuizQuestion.question.solveSteps || teach.steps || []);
  setBreakdownContent({ definition: teach.definition, steps: steps, tips: teach.tips });
  setBreakdownStepsCompleted(steps.map(() => false));
        setShowBreakdown(true);
        setIsRecallMode(false);
      } else if (res && (res as any).event === 'cycle_to_recall') {
        setIsRecallMode(true);
        setShowBreakdown(false);
      } else if (res && (res as any).event === 'recall_correct') {
        setIsRecallMode(false);
        setShowBreakdown(false);
        setCurrentCycleFormula(null);
        setBreakdownStepsCompleted([]);
      }
    } catch (e) {}
  };

  const handleNext = () => {
    // If in a mastery cycle for a formula, prefer to queue the next question for the same formula (or recall style), replacing the next item
    if (currentCycleFormula) {
      const st = mastery.get(currentCycleFormula);
      if (st && st.inRecall) {
        (async () => {
          try {
            const prevQ = currentQuizQuestion.question;
            if (!prevQ) { if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(prev => prev + 1); else setQuizCompleted(true); return; }
            const prevText = normalizeText(prevQ.text || '');
            const prevAns = prevQ.answer;
            let q: Question | null = null; let attempts = 0;
            while (attempts < 6 && !q) {
              const more = await batchGenerateAI(1, mode, loadAdaptiveUserModel(), undefined, [prevText], { persist: persistGenerated, forceParaphrase: true });
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
                const det = mode === 'AR' ? generateARQuestion(currentCycleFormula as any, 'medium') : generateMKQuestion(currentCycleFormula as any, 'medium');
                if (String(det.answer) !== String(prevAns)) fallbackCandidate = det as any;
                tries++;
              }
              if (fallbackCandidate) {
                const prevIndex = (prevQ.choices || []).findIndex(c => String(c) === String(prevAns));
                q = shuffleChoicesForQuestion(fallbackCandidate as any, prevIndex === -1 ? undefined : prevIndex);
              }
            }
            if (!q || q.formulaId !== currentCycleFormula) {
              const forced = await batchGenerateAI(1, mode, loadAdaptiveUserModel(), undefined, [prevText], { persist: persistGenerated });
              const cand = forced && forced[0] ? forced[0] : null;
              if (cand && cand.formulaId === currentCycleFormula && String(cand.answer) !== String(prevAns)) {
                const prevIndex = (prevQ.choices || []).findIndex(c => String(c) === String(prevAns));
                q = shuffleChoicesForQuestion(cand as any, prevIndex === -1 ? undefined : prevIndex);
              }
            }
            if (q) {
              const updatedQuestions = [...questions];
              if (currentQuestionIndex < updatedQuestions.length - 1) {
                updatedQuestions[currentQuestionIndex + 1] = { question: q, userAnswer: null, isCorrect: null, timeSpent: 0 };
                setQuestions(updatedQuestions);
                setCurrentQuestionIndex(prev => prev + 1);
                setSelectedAnswer("");
                setShowResult(false);
                setBreakdownStepsCompleted([]);
                setQuestionStartTime(Date.now());
              } else {
                updatedQuestions.push({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0 });
                setQuestions(updatedQuestions);
                setCurrentQuestionIndex(prev => prev + 1);
                setSelectedAnswer("");
                setShowResult(false);
                setBreakdownStepsCompleted([]);
                setQuestionStartTime(Date.now());
              }
            } else {
              if (currentQuestionIndex < questions.length - 1) { setCurrentQuestionIndex(prev => prev + 1); setSelectedAnswer(""); setShowResult(false); setQuestionStartTime(Date.now()); } else setQuizCompleted(true);
            }
          } catch (e) { if (currentQuestionIndex < questions.length - 1) { setCurrentQuestionIndex(prev => prev + 1); setSelectedAnswer(""); setShowResult(false); setQuestionStartTime(Date.now()); } else setQuizCompleted(true); }
        })();
        return;
      }
      if (st && st.inCycle) {
        (async () => {
          try {
            const prevQ = currentQuizQuestion.question;
            if (!prevQ) { if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(prev => prev + 1); else setQuizCompleted(true); return; }
            const prevText = normalizeText(prevQ.text || '');
            const prevAns = prevQ.answer;
            let q: Question | null = null; let attempts = 0;
            while (attempts < 6 && !q) {
              const more = await batchGenerateAI(1, mode, loadAdaptiveUserModel(), undefined, [prevText], { persist: persistGenerated, forceParaphrase: true });
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
                const det = mode === 'AR' ? generateARQuestion(currentCycleFormula as any, 'medium') : generateMKQuestion(currentCycleFormula as any, 'medium');
                if (String(det.answer) !== String(prevAns)) fallbackCandidate = det as any;
                tries++;
              }
              if (fallbackCandidate) {
                const prevIndex = (prevQ.choices || []).findIndex(c => String(c) === String(prevAns));
                q = shuffleChoicesForQuestion(fallbackCandidate as any, prevIndex === -1 ? undefined : prevIndex);
              }
            }
            if (!q || q.formulaId !== currentCycleFormula) {
              const forced = await batchGenerateAI(1, mode, loadAdaptiveUserModel(), undefined, [prevText], { persist: persistGenerated });
              const cand = forced && forced[0] ? forced[0] : null;
              if (cand && cand.formulaId === currentCycleFormula && String(cand.answer) !== String(prevAns)) {
                const prevIndex = (prevQ.choices || []).findIndex(c => String(c) === String(prevAns));
                q = shuffleChoicesForQuestion(cand as any, prevIndex === -1 ? undefined : prevIndex);
              }
            }
            if (q) {
              const updatedQuestions = [...questions];
              if (currentQuestionIndex < updatedQuestions.length - 1) {
                updatedQuestions[currentQuestionIndex + 1] = { question: q, userAnswer: null, isCorrect: null, timeSpent: 0 };
                setQuestions(updatedQuestions);
                setCurrentQuestionIndex(prev => prev + 1);
                setSelectedAnswer("");
                setShowResult(false);
                setBreakdownStepsCompleted([]);
                setQuestionStartTime(Date.now());
              } else {
                updatedQuestions.push({ question: q, userAnswer: null, isCorrect: null, timeSpent: 0 });
                setQuestions(updatedQuestions);
                setCurrentQuestionIndex(prev => prev + 1);
                setSelectedAnswer("");
                setShowResult(false);
                setBreakdownStepsCompleted([]);
                setQuestionStartTime(Date.now());
              }
            } else {
              if (currentQuestionIndex < questions.length - 1) { setCurrentQuestionIndex(prev => prev + 1); setSelectedAnswer(""); setShowResult(false); setBreakdownStepsCompleted([]); setQuestionStartTime(Date.now()); } else { setBreakdownStepsCompleted([]); setQuizCompleted(true); }
            }
          } catch (e) { if (currentQuestionIndex < questions.length - 1) { setCurrentQuestionIndex(prev => prev + 1); setSelectedAnswer(""); setShowResult(false); setQuestionStartTime(Date.now()); } else setQuizCompleted(true); }
        })();
        return;
      }
    }
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer("");
      setShowResult(false);
      setBreakdownStepsCompleted([]);
      setQuestionStartTime(Date.now());
    } else {
      setBreakdownStepsCompleted([]);
      setQuizCompleted(true);
    }
  };

  const getQuizScore = () => {
    const answered = questions.filter(q => q.isCorrect !== null);
    const correct = answered.filter(q => q.isCorrect).length;
    return answered.length > 0 ? Math.round((correct / answered.length) * 100) : 0;
  };

  const getScoreColor = () => {
    const score = getQuizScore();
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getAverageTime = () => {
    const answered = questions.filter(q => q.timeSpent > 0);
    if (answered.length === 0) return 0;
    const totalTime = answered.reduce((sum, q) => sum + q.timeSpent, 0);
    return Math.round(totalTime / answered.length / 1000);
  };

  const restartQuiz = () => {
    (async () => {
      let quizQuestions: Question[] = [];
      const adaptiveModel = loadAdaptiveUserModel();
  try { quizQuestions = await batchGenerateAI(10, mode, adaptiveModel, undefined, undefined, { persist: persistGenerated }); } catch (e) { quizQuestions = batchGenerate(10, mode); }
      const formattedQuestions = quizQuestions.map(q => ({
        question: q,
        userAnswer: null,
        isCorrect: null,
        timeSpent: 0
      }));
      setQuestions(formattedQuestions);
      setCurrentQuestionIndex(0);
      setSelectedAnswer("");
      setShowResult(false);
      setQuizCompleted(false);
      setStartTime(Date.now());
      setQuestionStartTime(Date.now());
    })();
  };

  if (quizCompleted) {
    const score = getQuizScore();
    const correctCount = questions.filter(q => q.isCorrect).length;
    const totalTime = Math.round((Date.now() - startTime) / 1000);

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Button variant="outline" onClick={onExit} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
            
            <Badge variant="outline" className="text-lg px-4 py-2">
              {mode === "AR" ? "Arithmetic Reasoning" : "Mathematics Knowledge"} Quiz
            </Badge>
          </div>

          {/* Results Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-600" />
                Quiz Complete!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <div className={`text-4xl font-bold ${getScoreColor()}`}>
                    {score}%
                  </div>
                  <p className="text-gray-600">Score</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600">
                    {correctCount}/{questions.length}
                  </div>
                  <p className="text-gray-600">Correct</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-600">
                    {Math.floor(totalTime / 60)}:{(totalTime % 60).toString().padStart(2, '0')}
                  </div>
                  <p className="text-gray-600">Total Time</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Question Review</h3>
                {questions.map((q, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Question {index + 1}</span>
                      <div className="flex items-center gap-2">
                        {q.isCorrect ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        <Badge variant={q.isCorrect ? "default" : "destructive"}>
                          {q.isCorrect ? "Correct" : "Incorrect"}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-gray-700 mb-2">{q.question.text}</p>
                    <div className="text-sm text-gray-600">
                      <p>Your answer: {q.userAnswer || "Not answered"}</p>
                      <p>Correct answer: {q.question.answer}</p>
                      <p>Time spent: {Math.round(q.timeSpent / 1000)}s</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4 mt-6">
                <Button onClick={restartQuiz} className="flex-1">
                  Retake Quiz
                </Button>
                <Button onClick={onExit} variant="outline" className="flex-1">
                  Finish
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!currentQuizQuestion) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading quiz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" onClick={onExit} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>
          
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-lg px-4 py-2">
              {mode === "AR" ? "Arithmetic Reasoning" : "Mathematics Knowledge"} Quiz
            </Badge>
            
            <div className="text-right">
              <p className="text-sm text-gray-600">Question</p>
              <p className="font-bold">
                {currentQuestionIndex + 1} / {questions.length}
              </p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Quiz Progress</span>
              <span className="text-sm text-gray-600">
                Score: <span className={getScoreColor()}>{getQuizScore()}%</span>
              </span>
            </div>
            <Progress value={(currentQuestionIndex / questions.length) * 100} className="h-2" />
          </CardContent>
        </Card>

        {/* Question Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Solve the Problem
            </CardTitle>
            <CardDescription>
              Select the correct answer from the options below.
              Problems are generated on the fly by the AI and adapt to your ongoing performance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-white p-6 rounded-lg border mb-6">
              <p className="text-lg font-medium">{currentQuizQuestion.question.text}</p>
            </div>

            {!showResult ? (
              <div className="space-y-4">
                <RadioGroup value={selectedAnswer} onValueChange={handleAnswerSelect}>
                  {currentQuizQuestion.question.choices.map((choice, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <RadioGroupItem value={choice.toString()} id={`choice-${index}`} />
                      <Label htmlFor={`choice-${index}`} className="cursor-pointer">
                        {choice}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>

                <Button 
                  onClick={handleSubmit} 
                  disabled={!selectedAnswer || showBreakdown}
                  className="w-full"
                >
                  Submit Answer
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert className={currentQuizQuestion.isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                  <div className="flex items-center gap-2">
                    {currentQuizQuestion.isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <AlertDescription className="font-medium">
                      {currentQuizQuestion.isCorrect ? "Correct!" : "Incorrect"}
                    </AlertDescription>
                  </div>
                </Alert>

                {!currentQuizQuestion.isCorrect && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="font-medium text-blue-900 mb-2">Correct Answer:</p>
                    <p className="text-blue-700">{currentQuizQuestion.question.answer}</p>
                  </div>
                )}

                {showBreakdown && breakdownContent && (
                  <div className="bg-white p-4 rounded-lg border mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-900">Explanation & Tips</p>
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-gray-600">{breakdownStepsCompleted.filter(Boolean).length} / {(currentQuizQuestion.question.solveSteps || breakdownContent.steps || []).length}</div>
                      </div>
                    </div>
                    <div className="mb-2"><strong>Definition:</strong> {breakdownContent.definition}</div>
                    <div className="mb-2">
                      <strong>Steps:</strong>
                      <ol className="ml-4 list-decimal">
                        {(currentQuizQuestion.question.solveSteps || breakdownContent.steps || []).map((s: string, i: number) => (
                          <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                            <Checkbox checked={!!breakdownStepsCompleted[i]} onCheckedChange={(v) => {
                              setBreakdownStepsCompleted(prev => {
                                const out = [...prev];
                                out[i] = !!v;
                                return out;
                              });
                            }} />
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
                  </div>
                )}

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-medium text-gray-900 mb-2">Solution Steps:</p>
                  <ul className="text-gray-700 space-y-1">
                    {currentQuizQuestion.question.solveSteps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Time: {Math.round(currentQuizQuestion.timeSpent / 1000)}s
                  </div>
                  <div>
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </div>
                </div>

                <Button onClick={handleNext} className="w-full" disabled={showBreakdown && breakdownStepsCompleted.length > 0 && !breakdownStepsCompleted.every(Boolean)}>
                  {currentQuestionIndex < questions.length - 1 ? "Next Question" : "Finish Quiz"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quiz Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">{getQuizScore()}%</p>
                <p className="text-sm text-gray-600">Current Score</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {questions.filter(q => q.isCorrect).length}
                </p>
                <p className="text-sm text-gray-600">Correct</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {questions.filter(q => q.isCorrect === false).length}
                </p>
                <p className="text-sm text-gray-600">Incorrect</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{getAverageTime()}s</p>
                <p className="text-sm text-gray-600">Avg Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}