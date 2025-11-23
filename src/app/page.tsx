"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Calculator, Target, TrendingUp, Trophy } from "lucide-react";
import StudyMode from "@/components/StudyMode";
import QuizMode from "@/components/QuizMode";
import Dashboard from "@/components/Dashboard";
import FullTest from "@/components/FullTest";
import DailyTraining from "@/components/DailyTraining";

type ViewMode = "home" | "study" | "quiz" | "dashboard" | "fulltest" | "veprobe" | "daily";

export default function Home() {
  const [currentView, setCurrentView] = useState<ViewMode>("home");
  const [selectedMode, setSelectedMode] = useState<"AR" | "MK" | null>(null);
  const [userProgress, setUserProgress] = useState<any>(null);

  useEffect(() => {
    // Load user progress from localStorage
    const savedProgress = localStorage.getItem("asvab_user_progress");
    if (savedProgress) {
      setUserProgress(JSON.parse(savedProgress));
    }
  }, []);

  const handleModeSelect = (mode: "AR" | "MK") => {
    setSelectedMode(mode);
    setCurrentView("study");
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "test":
        setCurrentView("fulltest");
        break;
      case "daily":
        setCurrentView("daily");
        break;
      case "study":
        if (!selectedMode) {
          setSelectedMode("AR");
        }
        setCurrentView("study");
        break;
      case "dashboard":
        setCurrentView("dashboard");
        break;
      default:
        break;
    }
  };

  const getMasteryPercentage = (subject: "AR" | "MK") => {
    if (!userProgress) return 0;
    const mastery = userProgress.mastery || {};
    const subjectMastery = mastery[subject] || 0;
    return Math.round(subjectMastery * 100);
  };

  const canUnlockQuiz = (subject: "AR" | "MK") => {
    return getMasteryPercentage(subject) >= 50;
  };

  const renderView = () => {
    switch (currentView) {
      case "study":
        return selectedMode ? (
          <StudyMode 
            mode={selectedMode} 
            onExit={() => {
              setCurrentView("home");
              setSelectedMode(null);
            }} 
          />
        ) : (
          <div>Please select a mode first</div>
        );
      case "quiz":
        return selectedMode ? (
          <QuizMode 
            mode={selectedMode} 
            onExit={() => {
              setCurrentView("home");
              setSelectedMode(null);
            }} 
          />
        ) : (
          <div>Please select a mode first</div>
        );
      case "dashboard":
        return <Dashboard onExit={() => setCurrentView("home")} />;
      case "fulltest":
        return <FullTest onExit={() => setCurrentView("home")} />;
      case "daily":
        return <DailyTraining onExit={() => setCurrentView("home")} />;
      default:
        return null;
    }
  };

  if (currentView !== "home") {
    return renderView();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center py-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">ASVAB Math Training</h1>
          <p className="text-lg text-gray-600">Master Arithmetic Reasoning & Mathematics Knowledge</p>
        </div>

        {/* Progress Overview */}
        {userProgress && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Your Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Arithmetic Reasoning (AR)</span>
                    <Badge variant="secondary">{getMasteryPercentage("AR")}%</Badge>
                  </div>
                  <Progress value={getMasteryPercentage("AR")} className="h-2" />
                  {canUnlockQuiz("AR") && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-2"
                      onClick={() => {
                        setSelectedMode("AR");
                        setCurrentView("quiz");
                      }}
                    >
                      Unlock Quiz Mode
                    </Button>
                  )}
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Mathematics Knowledge (MK)</span>
                    <Badge variant="secondary">{getMasteryPercentage("MK")}%</Badge>
                  </div>
                  <Progress value={getMasteryPercentage("MK")} className="h-2" />
                  {canUnlockQuiz("MK") && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-2"
                      onClick={() => {
                        setSelectedMode("MK");
                        setCurrentView("quiz");
                      }}
                    >
                      Unlock Quiz Mode
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleModeSelect("AR")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-blue-600" />
                Arithmetic Reasoning (AR)
              </CardTitle>
              <CardDescription>
                Learn to identify formulas and solve word problems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">• Formula recognition training</p>
                <p className="text-sm text-gray-600">• Keyword and partner identification</p>
                <p className="text-sm text-gray-600">• Real-world problem solving</p>
              </div>
              <Button className="w-full mt-4" variant="outline">
                Start AR Training
              </Button>
              {canUnlockQuiz("AR") && (
                <Badge className="ml-2" variant="default">Quiz Unlocked</Badge>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleModeSelect("MK")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-6 h-6 text-green-600" />
                Mathematics Knowledge (MK)
              </CardTitle>
              <CardDescription>
                Master mathematical concepts and operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">• Algebra and equations</p>
                <p className="text-sm text-gray-600">• Geometry and measurement</p>
                <p className="text-sm text-gray-600">• Fractions and percentages</p>
              </div>
              <Button className="w-full mt-4" variant="outline">
                Start MK Training
              </Button>
              {canUnlockQuiz("MK") && (
                <Badge className="ml-2" variant="default">Quiz Unlocked</Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button 
                variant="outline" 
                className="h-20 flex-col" 
                onClick={() => handleQuickAction("test")}
              >
                <Trophy className="w-6 h-6 mb-2" />
                Take Full Test
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex-col" 
                onClick={() => handleQuickAction("daily")}
              >
                <Target className="w-6 h-6 mb-2" />
                Daily Training
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex-col" 
                onClick={() => handleQuickAction("study")}
              >
                <BookOpen className="w-6 h-6 mb-2" />
                Study Mode
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex-col" 
                onClick={() => handleQuickAction("dashboard")}
              >
                <TrendingUp className="w-6 h-6 mb-2" />
                View Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>How to Use This Training System</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-semibold mb-2">1. Study Mode</h3>
                <p className="text-sm text-gray-600">
                  Learn to identify formulas by recognizing keywords and patterns. 
                  Focus on understanding which formula applies to each problem type.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">2. Quiz Mode</h3>
                <p className="text-sm text-gray-600">
                  Unlock quiz mode by reaching 50% mastery in study mode. 
                  Test your knowledge with multiple-choice questions.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">3. Full Test</h3>
                <p className="text-sm text-gray-600">
                  Take a complete 240-question ASVAB math simulation. 
                  Get a predicted AFQT score based on your performance.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}