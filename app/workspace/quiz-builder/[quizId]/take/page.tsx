"use client";

import { useEffect, useState, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/Auth";
import {
  Quiz,
  Question,
  getQuiz,
  updateQuiz,
  saveQuizAttempt,
} from "@/lib/firebase/quizStore";
import { ArrowLeft, Check, X, RotateCcw, Trophy, Target } from "lucide-react";

function fisherYatesShuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

type PageProps = {
  params: Promise<{ quizId: string }>;
};

export default function TakeQuizPage({ params }: PageProps) {
  const { quizId } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [matchingAnswers, setMatchingAnswers] = useState<Record<string, Record<string, string>>>({});
  
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user || !quizId) return;

    async function load() {
      try {
        const data = await getQuiz(quizId);
        if (!data) {
          router.replace("/workspace/quiz-builder");
          return;
        }
        setQuiz(data);

        let t = 0;
        data.questions.forEach(q => t += q.points);
        setTotal(t);

        const ma: Record<string, Record<string, string>> = {};
        data.questions.forEach(q => {
          if (q.type === "matching" && q.matchingPairs) {
            ma[q.id] = {};
          }
        });
        setMatchingAnswers(ma);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, quizId, router]);

  function isCorrect(q: Question, ans: string): boolean {
    if (q.type === "written") {
        const correct = q.correctAnswer.toLowerCase().trim();
        const given = ans.toLowerCase().trim();
        if (!given) return false;
        return correct === given;
    }
    return q.correctAnswer === ans;
 }

  function isMatchingCorrect(q: Question): boolean {
    if (!q.matchingPairs) return false;
    const userMatches = matchingAnswers[q.id] || {};
    return q.matchingPairs.every(p => userMatches[p.term] === p.definition);
  }

  function countMatchingCorrect(q: Question): number {
    if (!q.matchingPairs) return 0;
    const userMatches = matchingAnswers[q.id] || {};
    return q.matchingPairs.filter(p => userMatches[p.term] === p.definition).length;
  }

  async function handleSubmit() {
    if (!quiz || !user) return;

    let earned = 0;
    const updatedQs = quiz.questions.map(q => {
      let correct = false;

      if (q.type === "matching") {
        const matchCount = countMatchingCorrect(q);
        earned += matchCount;
        correct = isMatchingCorrect(q);
      } else {
        const ans = answers[q.id] || "";
        correct = isCorrect(q, ans);
        if (correct) earned += q.points;
      }

      return {
        ...q,
        box: correct ? Math.min(q.box + 1, 5) : 1,
        lastAnsweredCorrectly: correct,
      };
    });

    setScore(earned);
    setSubmitted(true);

    try {
      await updateQuiz(quiz.id, { questions: updatedQs });
      await saveQuizAttempt(quiz.id, user.uid, answers, earned, total, matchingAnswers);
    } catch (err) {
      console.error(err);
    }
  }

  function resetQuiz() {
    setSubmitted(false);
    setAnswers({});
    const ma: Record<string, Record<string, string>> = {};
    quiz?.questions.forEach(q => {
      if (q.type === "matching") ma[q.id] = {};
    });
    setMatchingAnswers(ma);
  }

  // Shuffle definitions once per quiz load
  const shuffledMatchingDefs = useMemo(() => {
    if (!quiz) return {};
    const map: Record<string, string[]> = {};
    quiz.questions
      .filter(q => q.type === "matching")
      .forEach(q => {
        if (q.matchingPairs) {
          map[q.id] = fisherYatesShuffle(q.matchingPairs.map(p => p.definition));
        }
      });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz?.id]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!quiz || quiz.questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No questions in this study set</p>
          <button
            onClick={() => router.push(`/workspace/quiz-builder/${quizId}`)}
            className="text-violet-400 hover:text-violet-300"
          >
            Go back to edit
          </button>
        </div>
      </div>
    );
  }

  // Results Screen
  if (submitted) {
    const pct = Math.round((score / total) * 100);
    let grade = "F";
    let gradeColor = "text-red-400";
    if (pct >= 90) { grade = "A"; gradeColor = "text-green-400"; }
    else if (pct >= 80) { grade = "B"; gradeColor = "text-green-400"; }
    else if (pct >= 70) { grade = "C"; gradeColor = "text-yellow-400"; }
    else if (pct >= 60) { grade = "D"; gradeColor = "text-orange-400"; }

    return (
      <div className="min-h-screen bg-background text-foreground">
        {/* Header */}
        <header className="border-b border-border">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <h1 className="font-semibold text-center">{quiz.title}</h1>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-6">
          {/* Score Card */}
          <div className="bg-card border border-border rounded-xl p-8 text-center mb-8">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy size={40} className={gradeColor} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Test Complete!</h2>
            <div className={`text-6xl font-bold ${gradeColor} mb-2`}>{grade}</div>
            <p className="text-xl text-muted-foreground mb-1">{score} / {total} points</p>
            <p className="text-muted-foreground">{pct}% correct</p>
            
            <div className="flex gap-3 mt-6 justify-center">
              <button
                onClick={resetQuiz}
                className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-lg font-medium text-sm hover:bg-muted transition-colors"
              >
                <RotateCcw size={16} />
                Retake
              </button>
              <button
                onClick={() => router.push("/workspace/quiz-builder")}
                className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          </div>

          {/* Review Section */}
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target size={20} />
            Review Answers
          </h3>
          
          <div className="space-y-4">
            {quiz.questions.map((q, i) => {
              let correct = false;
              let userAns = "";

              if (q.type === "matching") {
                correct = isMatchingCorrect(q);
              } else {
                userAns = answers[q.id] || "";
                correct = isCorrect(q, userAns);
              }

              return (
                <div
                  key={q.id}
                  className={`bg-card border rounded-xl p-5 ${
                    correct ? "border-green-500/30" : "border-red-500/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      correct ? "bg-green-500/20" : "bg-red-500/20"
                    }`}>
                      {correct ? (
                        <Check size={18} className="text-green-400" />
                      ) : (
                        <X size={18} className="text-red-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">Question {i + 1}</p>
                      <p className="font-medium mb-3">{q.question || "Matching"}</p>

                      {q.type !== "matching" && (
                        <div className="space-y-2">
                          <div className={`p-3 rounded-lg border ${
                            correct ? "border-green-500/30 bg-green-500/10" : "border-red-500/30 bg-red-500/10"
                          }`}>
                            <span className="text-sm text-muted-foreground">Your answer: </span>
                            <span className={correct ? "text-green-400" : "text-red-400"}>
                              {q.type === "multiple-choice" && q.options
                                ? q.options.find(o => o.id === userAns)?.text || "(none)"
                                : userAns || "(none)"}
                            </span>
                          </div>
                          {!correct && (
                            <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                              <span className="text-sm text-muted-foreground">Correct answer: </span>
                              <span className="text-green-400">
                                {q.type === "multiple-choice" && q.options
                                  ? q.options.find(o => o.id === q.correctAnswer)?.text
                                  : q.correctAnswer}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {q.type === "matching" && q.matchingPairs && (
                        <div className="space-y-2">
                          {q.matchingPairs.map(p => {
                            const userMatch = matchingAnswers[q.id]?.[p.term];
                            const isRight = userMatch === p.definition;
                            return (
                              <div key={p.id} className={`p-3 rounded-lg border ${
                                isRight ? "border-green-500/30 bg-green-500/10" : "border-red-500/30 bg-red-500/10"
                              }`}>
                                <div className="flex items-center gap-2">
                                  {isRight ? (
                                    <Check size={14} className="text-green-400" />
                                  ) : (
                                    <X size={14} className="text-red-400" />
                                  )}
                                  <span>{p.term}</span>
                                  <span className="text-muted-foreground">→</span>
                                  <span className={isRight ? "text-green-400" : "text-red-400"}>
                                    {userMatch || "(none)"}
                                  </span>
                                  {!isRight && (
                                    <span className="text-muted-foreground text-sm ml-auto">
                                      (correct: {p.definition})
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {q.explanation && (
                        <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm">
                          <span className="text-muted-foreground">💡 </span>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  // Quiz Taking Screen
  const mcQuestions = quiz.questions.filter(q => q.type === "multiple-choice");
  const tfQuestions = quiz.questions.filter(q => q.type === "true-false");
  const writtenQuestions = quiz.questions.filter(q => q.type === "written");
  const matchingQuestions = quiz.questions.filter(q => q.type === "matching");

  const answeredCount = Object.keys(answers).length + 
    Object.values(matchingAnswers).reduce((acc, m) => acc + Object.keys(m).length, 0);
  const totalQuestions = quiz.questions.length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => {
              if (confirm("Exit test? Your progress will be lost.")) {
                router.push(`/workspace/quiz-builder/${quizId}`);
              }
            }}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-sm">Exit</span>
          </button>
          <h1 className="font-semibold text-sm truncate max-w-[200px] sm:max-w-none">
            {quiz.title}
          </h1>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-foreground text-background rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Submit
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Progress</span>
            <span>{answeredCount} answered</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-violet-500 transition-all duration-300"
              style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-6 pb-24">
        {/* Multiple Choice */}
        {mcQuestions.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
              Multiple Choice ({mcQuestions.length})
            </h2>
            <div className="space-y-4">
              {mcQuestions.map((q, idx) => (
                <div key={q.id} className="bg-card border border-border rounded-xl p-5">
                  <p className="text-sm text-muted-foreground mb-2">{idx + 1} of {mcQuestions.length}</p>
                  <p className="font-medium mb-4">{q.question}</p>
                  <div className="space-y-2">
                    {q.options?.map((o, i) => (
                      <button
                        key={o.id}
                        onClick={() => setAnswers({ ...answers, [q.id]: o.id })}
                        className={`w-full text-left p-4 rounded-lg border transition-all ${
                          answers[q.id] === o.id
                            ? "border-violet-500 bg-violet-500/10"
                            : "border-border hover:border-muted-foreground"
                        }`}
                      >
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mr-3 ${
                          answers[q.id] === o.id
                            ? "bg-violet-500 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        {o.text}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* True/False */}
        {tfQuestions.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
              True or False ({tfQuestions.length})
            </h2>
            <div className="space-y-4">
              {tfQuestions.map((q, idx) => (
                <div key={q.id} className="bg-card border border-border rounded-xl p-5">
                  <p className="text-sm text-muted-foreground mb-2">{idx + 1} of {tfQuestions.length}</p>
                  <p className="font-medium mb-4">{q.question}</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setAnswers({ ...answers, [q.id]: "true" })}
                      className={`flex-1 py-3 rounded-lg border font-medium transition-all ${
                        answers[q.id] === "true"
                          ? "border-green-500 bg-green-500/10 text-green-400"
                          : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      True
                    </button>
                    <button
                      onClick={() => setAnswers({ ...answers, [q.id]: "false" })}
                      className={`flex-1 py-3 rounded-lg border font-medium transition-all ${
                        answers[q.id] === "false"
                          ? "border-red-500 bg-red-500/10 text-red-400"
                          : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      False
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Written */}
        {writtenQuestions.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
              Written ({writtenQuestions.length})
            </h2>
            <div className="space-y-4">
              {writtenQuestions.map((q, idx) => (
                <div key={q.id} className="bg-card border border-border rounded-xl p-5">
                  <p className="text-sm text-muted-foreground mb-2">{idx + 1} of {writtenQuestions.length}</p>
                  <p className="font-medium mb-4">{q.question}</p>
                  <input
                    type="text"
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    placeholder="Type your answer..."
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Matching */}
        {matchingQuestions.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
              Matching ({matchingQuestions.length})
            </h2>
            <div className="space-y-4">
              {matchingQuestions.map((q, idx) => {
                if (!q.matchingPairs) return null;
                
                const shuffledDefs = shuffledMatchingDefs[q.id] || [];

                return (
                  <div key={q.id} className="bg-card border border-border rounded-xl p-5">
                    <p className="text-sm text-muted-foreground mb-4">
                      {idx + 1} of {matchingQuestions.length} — Match each term with its definition
                    </p>
                    
                    <div className="space-y-3">
                      {q.matchingPairs.map(p => (
                        <div key={p.id} className="flex items-center gap-3">
                          <div className="flex-1 p-3 bg-muted/50 border border-border rounded-lg text-sm">
                            {p.term}
                          </div>
                          <span className="text-muted-foreground">→</span>
                          <select
                            value={matchingAnswers[q.id]?.[p.term] || ""}
                            onChange={(e) => {
                              setMatchingAnswers({
                                ...matchingAnswers,
                                [q.id]: {
                                  ...matchingAnswers[q.id],
                                  [p.term]: e.target.value,
                                },
                              });
                            }}
                            className="flex-1 bg-background border border-border rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="">Select...</option>
                            {shuffledDefs.map((def, i) => (
                              <option key={i} value={def}>{def}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Fixed Bottom Submit Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {answeredCount} of {totalQuestions} questions answered
          </p>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-foreground text-background rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Submit Test
          </button>
        </div>
      </div>
    </div>
  );
}