"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, CheckCircle, XCircle, Clock, Target, Lightbulb } from "lucide-react";
import { Question, generateARQuestion, generateMKQuestion, batchGenerate } from "@/lib/question-generator";
import { decideFormulas, getFormulaExplanation, loadUserModel, saveUserModel, updateUserModel } from "@/lib/decision-engine";
import { handlePostAttempt, loadAdaptiveUserModel } from "@/lib/adaptive-engine";

// Study Mode shouldn't persist daily training entries locally; it updates the canonical attempt log via the adaptive engine.

interface StudyModeProps {
  mode: "AR" | "MK";
  onExit: () => void;
}

interface FormulaOption {
  id: string;
  label: string;
  confidence: number;
}

export default function StudyMode({ mode, onExit }: StudyModeProps) {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [formulaOptions, setFormulaOptions] = useState<FormulaOption[]>([]);
  const [selectedFormula, setSelectedFormula] = useState<string>("");
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [questionCount, setQuestionCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [responseTime, setResponseTime] = useState<number>(0);
  const [userModel, setUserModel] = useState<any>(null);
  const [adaptiveModel, setAdaptiveModel] = useState<any>(null);
  const [questionBank, setQuestionBank] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    
    // Load user models
    const userModel = loadUserModel();
    const adaptiveModel = loadAdaptiveUserModel();
    setUserModel(userModel);
    setAdaptiveModel(adaptiveModel);

    // Generate initial question bank
    let bank = batchGenerate(20, mode);
    
    // Fallback: if no questions generated, create a simple one
    if (bank.length === 0) {
      bank = [{
        id: 1,
        subject: mode,
        type: 'fallback',
        text: mode === 'AR' ? 'What is 15 + 25?' : 'What is 7 × 6?',
        formulaId: mode === 'AR' ? 'add_simple' : 'multiply_simple',
        keywords: mode === 'AR' ? ['add', 'sum'] : ['times', 'multiply'],
        partners: [],
        difficulty: 'easy',
        difficultyWeight: 1,
        solveSteps: mode === 'AR' ? ['15 + 25 = 40'] : ['7 × 6 = 42'],
        answer: mode === 'AR' ? 40 : 42,
        choices: mode === 'AR' ? [40, 35, 45, 50] : [42, 36, 48, 40],
        category: mode
      }];
    }
    
    setQuestionBank(bank);

    // Load first question after a short delay to ensure state is updated
    setTimeout(() => {
      if (bank.length > 0) {
        const question = bank[0];
        setQuestionBank(prev => prev.slice(1));
        
        setCurrentQuestion(question);
        setSelectedFormula("");
        setShowResult(false);
        setStartTime(Date.now());
        
        // Get formula options using decision engine
        try {
          const scoredFormulas = decideFormulas(question.text);
          const options = scoredFormulas.slice(0, 4).map(sf => ({
            id: sf.id,
            label: sf.rule.label,
            confidence: sf.confidence
          }));
          
          // Fallback: if no formula options, create basic ones
          if (options.length === 0) {
            setFormulaOptions([
              { id: question.formulaId, label: question.formulaId, confidence: 1 }
            ]);
          } else {
            setFormulaOptions(options);
          }
        } catch (error) {
          // Fallback options
          setFormulaOptions([
            { id: question.formulaId, label: "Unknown Formula", confidence: 1 }
          ]);
        }
      }
      setIsLoading(false);
    }, 100);
  }, [mode]);

  const loadNextQuestion = () => {
    let bank = [...questionBank];
    
    if (bank.length === 0) {
      // Generate more questions if needed
      bank = batchGenerate(20, mode);
      setQuestionBank(bank);
    }
    
    // Fallback: if still no questions, create a simple one
    if (bank.length === 0) {
      bank = [{
        id: Date.now(), // Use timestamp for unique ID
        subject: mode,
        type: 'fallback',
        text: mode === 'AR' ? 'What is 20 + 30?' : 'What is 8 × 7?',
        formulaId: mode === 'AR' ? 'add_simple' : 'multiply_simple',
        keywords: mode === 'AR' ? ['add', 'sum'] : ['times', 'multiply'],
        partners: [],
        difficulty: 'easy',
        difficultyWeight: 1,
        solveSteps: mode === 'AR' ? ['20 + 30 = 50'] : ['8 × 7 = 56'],
        answer: mode === 'AR' ? 50 : 56,
        choices: mode === 'AR' ? [50, 45, 55, 60] : [56, 48, 64, 49],
        category: mode
      }];
    }
    
    if (bank.length > 0) {
      // Pick the first question
      const question = bank[0];
      setQuestionBank(bank.slice(1));
      
      setCurrentQuestion(question);
      setSelectedFormula("");
      setShowResult(false);
      setStartTime(Date.now());
      
      // Get formula options using decision engine
      try {
        const scoredFormulas = decideFormulas(question.text);
        const options = scoredFormulas.slice(0, 4).map(sf => ({
          id: sf.id,
          label: sf.rule.label,
          confidence: sf.confidence
        }));
        
        // Fallback: if no formula options, create basic ones
        if (options.length === 0) {
          setFormulaOptions([
            { id: question.formulaId, label: question.formulaId, confidence: 1 }
          ]);
        } else {
          setFormulaOptions(options);
        }
      } catch (error) {
        // Fallback options
        setFormulaOptions([
          { id: question.formulaId, label: "Unknown Formula", confidence: 1 }
        ]);
      }
    }
  };

  const handleFormulaSelect = (formulaId: string) => {
    setSelectedFormula(formulaId);
  };

  const handleSubmit = () => {
    if (!selectedFormula || !currentQuestion) return;

    const endTime = Date.now();
    const timeTaken = endTime - startTime;
    setResponseTime(timeTaken);

    const correct = selectedFormula === currentQuestion.formulaId;
    setIsCorrect(correct);
    setShowResult(true);
    setQuestionCount(prev => prev + 1);
    
    if (correct) {
      setCorrectCount(prev => prev + 1);
    }

    // Get explanation
    const explanation = getFormulaExplanation(currentQuestion.formulaId);
    setExplanation(explanation);

    // Update user models
    if (userModel) {
      const updatedModel = updateUserModel(
        userModel,
        currentQuestion.formulaId,
        correct,
        timeTaken,
        mode
      );
      saveUserModel(updatedModel);
      setUserModel(updatedModel);
    }

    // Update adaptive model
    if (adaptiveModel) {
      const updatedAdaptiveModel = handlePostAttempt(adaptiveModel, {
        qId: currentQuestion.id,
        formulaId: currentQuestion.formulaId,
        category: mode,
        correct,
        timeMs: timeTaken,
        difficulty: currentQuestion.difficulty
      , source: 'study_mode' });
      setAdaptiveModel(updatedAdaptiveModel);
      try { window.dispatchEvent(new CustomEvent('adaptiveModelUpdated')); } catch (e) {}
      // Study Mode should NOT count towards the daily_training session cache, only the centralized
      // attempt log and the adaptive model. The attempt is already recorded through handlePostAttempt
      // which appends to the canonical attempt log and updates model/state. Do not write to daily
      // training storage here to avoid counting Study Mode as a Daily Training session.
    }
  };

  const handleNext = () => {
    loadNextQuestion();
  };

  const getMasteryPercentage = () => {
    if (!userModel || questionCount === 0) return 0;
    return Math.round((correctCount / questionCount) * 100);
  };

  const getAccuracyColor = () => {
    const accuracy = getMasteryPercentage();
    if (accuracy >= 80) return "text-green-600";
    if (accuracy >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  if (isLoading || !currentQuestion) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading question...</p>
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
              {mode === "AR" ? "Arithmetic Reasoning" : "Mathematics Knowledge"}
            </Badge>
            
            <div className="text-right">
              <p className="text-sm text-gray-600">Accuracy</p>
              <p className={`font-bold ${getAccuracyColor()}`}>
                {getMasteryPercentage()}%
              </p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Study Progress</span>
              <span className="text-sm text-gray-600">
                {correctCount} / {questionCount} correct
              </span>
            </div>
            <Progress value={getMasteryPercentage()} className="h-2" />
          </CardContent>
        </Card>

        {/* Question Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Identify the Formula
            </CardTitle>
            <CardDescription>
              Read the problem and select which formula or method should be used to solve it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-white p-6 rounded-lg border mb-6">
              <p className="text-lg font-medium">{currentQuestion.text}</p>
            </div>

            {!showResult ? (
              <div className="space-y-4">
                <p className="font-medium">Which formula applies to this problem?</p>
                <RadioGroup value={selectedFormula} onValueChange={handleFormulaSelect}>
                  {formulaOptions.map((option) => (
                    <div key={option.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.id} id={option.id} />
                      <Label htmlFor={option.id} className="cursor-pointer">
                        {option.label}
                      </Label>
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(option.confidence * 100)}%
                      </Badge>
                    </div>
                  ))}
                </RadioGroup>

                <Button 
                  onClick={handleSubmit} 
                  disabled={!selectedFormula}
                  className="w-full"
                >
                  Submit Answer
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert className={isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                  <div className="flex items-center gap-2">
                    {isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <AlertDescription className="font-medium">
                      {isCorrect ? "Correct!" : "Incorrect"}
                    </AlertDescription>
                  </div>
                </Alert>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium">Explanation</span>
                  </div>
                  <p className="text-gray-700">{explanation}</p>
                </div>

                {!isCorrect && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="font-medium text-blue-900 mb-2">Correct Formula:</p>
                    <p className="text-blue-700">
                      {formulaOptions.find(f => f.id === currentQuestion.formulaId)?.label}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Time: {Math.round(responseTime / 1000)}s
                  </div>
                  <div>
                    Question {questionCount}
                  </div>
                </div>

                <Button onClick={handleNext} className="w-full">
                  Next Question
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Study Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Look for keywords that indicate the type of problem</li>
              <li>• Identify numbers that work together (partners)</li>
              <li>• Focus on recognizing the formula, not solving the problem</li>
              <li>• Your accuracy determines when you unlock Quiz Mode</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}