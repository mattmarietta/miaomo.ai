"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/Auth";
import {
  Quiz,
  Question,
  getQuiz,
  updateQuiz,
  saveQuizAttempt,
} from "@/lib/firebase/quizStore";

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
      return correct === given || correct.includes(given) || given.includes(correct);
    }
    return q.correctAnswer === ans;
  }

  function isMatchingCorrect(q: Question): boolean {
    if (!q.matchingPairs) return false;
    const userMatches = matchingAnswers[q.id] || {};
    let allCorrect = true;
    q.matchingPairs.forEach(p => {
      if (userMatches[p.term] !== p.definition) {
        allCorrect = false;
      }
    });
    return allCorrect;
  }

  function countMatchingCorrect(q: Question): number {
    if (!q.matchingPairs) return 0;
    const userMatches = matchingAnswers[q.id] || {};
    let count = 0;
    q.matchingPairs.forEach(p => {
      if (userMatches[p.term] === p.definition) count++;
    });
    return count;
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (!quiz || quiz.questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-gray-400 mb-4">No questions in this set</p>
          <button
            onClick={() => router.push(`/workspace/quiz-builder/${quizId}`)}
            className="text-[#4255ff]"
          >
            Go back to edit
          </button>
        </div>
      </div>
    );
  }

  const mcQuestions = quiz.questions.filter(q => q.type === "multiple-choice");
  const tfQuestions = quiz.questions.filter(q => q.type === "true-false");
  const writtenQuestions = quiz.questions.filter(q => q.type === "written");
  const matchingQuestions = quiz.questions.filter(q => q.type === "matching");

  if (submitted) {
    const pct = Math.round((score / total) * 100);
    let grade = "F";
    if (pct >= 90) grade = "A";
    else if (pct >= 80) grade = "B";
    else if (pct >= 70) grade = "C";
    else if (pct >= 60) grade = "D";

    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
        <div className="max-w-2xl mx-auto">
          
          <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg p-8 text-center mb-8">
            <h1 className="text-2xl font-bold mb-4">Test Complete!</h1>
            <div className="text-6xl font-bold mb-2">{grade}</div>
            <div className="text-2xl">{score} / {total}</div>
            <div className="text-gray-400">{pct}%</div>
            
            <div className="flex gap-3 mt-6 justify-center">
              <button
                onClick={() => {
                  setSubmitted(false);
                  setAnswers({});
                  const ma: Record<string, Record<string, string>> = {};
                  quiz.questions.forEach(q => {
                    if (q.type === "matching") ma[q.id] = {};
                  });
                  setMatchingAnswers(ma);
                }}
                className="bg-[#2e2e2e] px-6 py-2 rounded-lg"
              >
                Retake
              </button>
              <button
                onClick={() => router.push("/workspace/quiz-builder")}
                className="bg-[#4255ff] px-6 py-2 rounded-lg"
              >
                Done
              </button>
            </div>
          </div>

          <h2 className="text-xl font-bold mb-4">Review Answers</h2>
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
                  className={`bg-[#1a1a1a] border rounded-lg p-4 ${
                    correct ? "border-green-500/50" : "border-red-500/50"
                  }`}
                >
                  <div className="flex gap-3">
                    <span className={correct ? "text-green-400" : "text-red-400"}>
                      {correct ? "✓" : "✗"}
                    </span>
                    <div className="flex-1">
                      <p className="text-gray-400 text-sm">Question {i + 1} ({q.type})</p>
                      <p className="mb-2">{q.question || "Matching"}</p>

                      {q.type !== "matching" && (
                        <>
                          <p className="text-sm">
                            <span className="text-gray-500">Your answer: </span>
                            <span className={correct ? "text-green-400" : "text-red-400"}>
                              {q.type === "multiple-choice" && q.options
                                ? q.options.find(o => o.id === userAns)?.text || "(none)"
                                : userAns || "(none)"}
                            </span>
                          </p>
                          {!correct && (
                            <p className="text-sm">
                              <span className="text-gray-500">Correct: </span>
                              <span className="text-green-400">
                                {q.type === "multiple-choice" && q.options
                                  ? q.options.find(o => o.id === q.correctAnswer)?.text
                                  : q.correctAnswer}
                              </span>
                            </p>
                          )}
                        </>
                      )}

                      {q.type === "matching" && q.matchingPairs && (
                        <div className="text-sm mt-2">
                          {q.matchingPairs.map(p => {
                            const userMatch = matchingAnswers[q.id]?.[p.term];
                            const isRight = userMatch === p.definition;
                            return (
                              <div key={p.id} className="flex gap-2">
                                <span className={isRight ? "text-green-400" : "text-red-400"}>
                                  {isRight ? "✓" : "✗"}
                                </span>
                                <span>{p.term} → {userMatch || "(none)"}</span>
                                {!isRight && (
                                  <span className="text-gray-500">(correct: {p.definition})</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {q.explanation && (
                        <p className="text-sm text-gray-500 mt-2">💡 {q.explanation}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="sticky top-0 bg-[#0a0a0a] border-b border-[#2e2e2e] p-4 z-10">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <button
            onClick={() => {
              if (confirm("Leave test?")) router.push(`/workspace/quiz-builder/${quizId}`);
            }}
            className="text-gray-400"
          >
            ✕ Exit
          </button>
          <h1 className="font-semibold">{quiz.title}</h1>
          <button
            onClick={handleSubmit}
            className="bg-[#4255ff] px-4 py-2 rounded-lg font-medium"
          >
            Submit
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6">

        {mcQuestions.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold mb-4 text-gray-400">
              Multiple Choice ({mcQuestions.length})
            </h2>
            <div className="space-y-6">
              {mcQuestions.map((q, idx) => (
                <div key={q.id} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg p-5">
                  <p className="text-gray-400 text-sm mb-2">{idx + 1} of {mcQuestions.length}</p>
                  <p className="text-lg mb-4">{q.question}</p>
                  <div className="space-y-2">
                    {q.options?.map((o, i) => (
                      <button
                        key={o.id}
                        onClick={() => setAnswers({ ...answers, [q.id]: o.id })}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          answers[q.id] === o.id
                            ? "border-[#4255ff] bg-[#4255ff]/10"
                            : "border-[#2e2e2e] hover:border-[#4a4a4a]"
                        }`}
                      >
                        <span className="mr-3 text-gray-500">{String.fromCharCode(65 + i)}</span>
                        {o.text}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tfQuestions.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold mb-4 text-gray-400">
              True or False ({tfQuestions.length})
            </h2>
            <div className="space-y-6">
              {tfQuestions.map((q, idx) => (
                <div key={q.id} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg p-5">
                  <p className="text-gray-400 text-sm mb-2">{idx + 1} of {tfQuestions.length}</p>
                  <p className="text-lg mb-4">{q.question}</p>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setAnswers({ ...answers, [q.id]: "true" })}
                      className={`flex-1 py-3 rounded-lg border transition-colors ${
                        answers[q.id] === "true"
                          ? "border-green-500 bg-green-500/10 text-green-400"
                          : "border-[#2e2e2e] hover:border-[#4a4a4a]"
                      }`}
                    >
                      True
                    </button>
                    <button
                      onClick={() => setAnswers({ ...answers, [q.id]: "false" })}
                      className={`flex-1 py-3 rounded-lg border transition-colors ${
                        answers[q.id] === "false"
                          ? "border-red-500 bg-red-500/10 text-red-400"
                          : "border-[#2e2e2e] hover:border-[#4a4a4a]"
                      }`}
                    >
                      False
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {writtenQuestions.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold mb-4 text-gray-400">
              Written ({writtenQuestions.length})
            </h2>
            <div className="space-y-6">
              {writtenQuestions.map((q, idx) => (
                <div key={q.id} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg p-5">
                  <p className="text-gray-400 text-sm mb-2">{idx + 1} of {writtenQuestions.length}</p>
                  <p className="text-lg mb-4">{q.question}</p>
                  <input
                    type="text"
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    placeholder="Type your answer..."
                    className="w-full bg-[#0a0a0a] border border-[#2e2e2e] rounded-lg px-4 py-3 focus:border-[#4255ff] focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {matchingQuestions.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold mb-4 text-gray-400">
              Matching ({matchingQuestions.length})
            </h2>
            <div className="space-y-6">
              {matchingQuestions.map((q, idx) => {
                if (!q.matchingPairs) return null;
                
                const shuffledDefs = [...q.matchingPairs]
                  .sort(() => Math.random() - 0.5)
                  .map(p => p.definition);

                return (
                  <div key={q.id} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg p-5">
                    <p className="text-gray-400 text-sm mb-4">{idx + 1} of {matchingQuestions.length}</p>
                    <p className="text-sm text-gray-400 mb-4">Match each term with its definition</p>
                    
                    <div className="space-y-3">
                      {q.matchingPairs.map(p => (
                        <div key={p.id} className="flex items-center gap-3">
                          <div className="flex-1 bg-[#0a0a0a] border border-[#2e2e2e] rounded-lg px-4 py-3">
                            {p.term}
                          </div>
                          <span className="text-gray-500">→</span>
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
                            className="flex-1 bg-[#0a0a0a] border border-[#2e2e2e] rounded-lg px-4 py-3 focus:border-[#4255ff] focus:outline-none"
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
          </div>
        )}

        <div className="text-center pb-10">
          <button
            onClick={handleSubmit}
            className="bg-[#4255ff] px-8 py-3 rounded-lg font-medium text-lg hover:bg-[#3b4de0]"
          >
            Submit Test
          </button>
        </div>
      </div>
    </div>
  );
}