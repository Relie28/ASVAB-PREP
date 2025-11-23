"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, CheckCircle, XCircle, Clock, Target, Trophy, Calculator, Timer, Flag } from "lucide-react";
import { Question, generateFullTest } from "@/lib/question-generator";
import { generateScoreReport } from "@/lib/scoring-engine";
import { loadUserModel, saveUserModel, updateUserModel } from "@/lib/decision-engine";
import { handlePostAttempt, loadAdaptiveUserModel } from "@/lib/adaptive-engine";

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
  const [showResult, setShowResult] = useState(false);
  const [userModel, setUserModel] = useState<any>(null);
  const [adaptiveModel, setAdaptiveModel] = useState<any>(null);
  const [scoreReport, setScoreReport] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState({ AR: 0, MK: 0 });

  useEffect(() => {
    // Load user models
    const userModel = loadUserModel();
    const adaptiveModel = loadAdaptiveUserModel();
    setUserModel(userModel);
    setAdaptiveModel(adaptiveModel);
  }, []);

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
    const { arQuestions, mkQuestions } = generateFullTest();
    
    const arTestQuestions: TestQuestion[] = arQuestions.map(q => ({
      question: q,
      userAnswer: null,
      isCorrect: null,
      timeSpent: 0,
      isFlagged: false
    }));
    
    const mkTestQuestions: TestQuestion[] = mkQuestions.map(q => ({
      question: q,
      userAnswer: null,
      isCorrect: null,
      timeSpent: 0,
      isFlagged: false
    }));
    
    setArSection({
      ...arSection,
      questions: arTestQuestions,
      startTime: Date.now()
    });
    
    setMkSection({
      ...mkSection,
      questions: mkTestQuestions
    });
    
    setTestStarted(true);
    setTimeRemaining({ AR: arSection.timeLimit, MK: mkSection.timeLimit });
  };

  const startVEProbe = () => {
    setVeProbeStarted(true);
    setVeProbeResults(Array(10).fill(false));
  };

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
  };

  const handleSubmit = () => {
    if (!selectedAnswer) return;

    const currentQ = currentSection === 'AR' ? arSection : mkSection;
    const currentQuestion = currentQ.questions[currentQ.currentIndex];
    const endTime = Date.now();
    const timeSpent = endTime - (currentQ.startTime + currentQ.questions.slice(0, currentQ.currentIndex).reduce((sum, q) => sum + q.timeSpent, 0));

    const isCorrect = selectedAnswer === currentQuestion.question.answer.toString();
    
    // Update the question
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
    
    setShowResult(true);

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
        difficulty: currentQuestion.question.difficulty
      , source: 'full_test' });
      setAdaptiveModel(updatedAdaptiveModel);
    }
  };

  const handleNext = () => {
    const currentQ = currentSection === 'AR' ? arSection : mkSection;
    
    if (currentQ.currentIndex < currentQ.questions.length - 1) {
      // Move to next question
      if (currentSection === 'AR') {
        setArSection({ ...arSection, currentIndex: arSection.currentIndex + 1 });
      } else {
        setMkSection({ ...mkSection, currentIndex: mkSection.currentIndex + 1 });
      }
      
      setSelectedAnswer("");
      setShowResult(false);
    } else {
      // Section complete
      handleSectionComplete(currentSection);
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

  const getSectionProgress = () => {
    const currentQ = currentSection === 'AR' ? arSection : mkSection;
    return ((currentQ.currentIndex + 1) / currentQ.questions.length) * 100;
  };

  const getSectionScore = () => {
    const currentQ = currentSection === 'AR' ? arSection : mkSection;
    const answered = currentQ.questions.filter(q => q.isCorrect !== null);
    const correct = answered.filter(q => q.isCorrect).length;
    return answered.length > 0 ? Math.round((correct / answered.length) * 100) : 0;
  };

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
            <Button onClick={toggleFlag} variant="outline" size="sm">
              <Flag className={`w-4 h-4 ${currentQuestion.isFlagged ? 'text-red-600 fill-current' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Progress */}
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Section Progress</span>
              <span className="text-sm text-gray-600">
                Score: <span className={getSectionScore() >= 70 ? 'text-green-600' : getSectionScore() >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                  {getSectionScore()}%
                </span>
              </span>
            </div>
            <Progress value={getSectionProgress()} className="h-2" />
          </CardContent>
        </Card>

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

            {!showResult ? (
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

                <Button 
                  onClick={handleSubmit} 
                  disabled={!selectedAnswer}
                  className="w-full"
                >
                  Submit Answer
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert className={currentQuestion.isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                  <div className="flex items-center gap-2">
                    {currentQuestion.isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <AlertDescription className="font-medium">
                      {currentQuestion.isCorrect ? "Correct!" : "Incorrect"}
                    </AlertDescription>
                  </div>
                </Alert>

                {!currentQuestion.isCorrect && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="font-medium text-blue-900 mb-2">Correct Answer:</p>
                    <p className="text-blue-700">{currentQuestion.question.answer}</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Button onClick={handleNext} className="flex-1">
                    {currentQ.currentIndex < currentQ.questions.length - 1 ? "Next Question" : "Finish Section"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Question Navigator */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Question Navigator</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-10 gap-2">
              {currentQ.questions.map((q, index) => (
                <Button
                  key={index}
                  variant={index === currentQ.currentIndex ? "default" : q.userAnswer !== null ? "secondary" : "outline"}
                  size="sm"
                  className="aspect-square p-0"
                >
                  {index + 1}
                  {q.isFlagged && <Flag className="w-3 h-3 text-red-600 absolute top-0 right-0" />}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}