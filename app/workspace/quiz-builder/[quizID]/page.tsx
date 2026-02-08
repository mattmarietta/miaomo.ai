"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/Auth";
import {
  Quiz,
  Question,
  QuestionType,
  getQuiz,
  updateQuiz,
  generateId,
} from "@/lib/firebase/quizStore";
import { generateQuestionsFromText } from "@/lib/aiQuizGenerator";

type PageProps = {
  params: Promise<{ quizId: string }>;
};

export default function QuizEditorPage({ params }: PageProps) {
  const { quizId } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingQ, setEditingQ] = useState<Question | null>(null);

  const [showAI, setShowAI] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user || !quizId) return;

    async function load() {
      if (!user) return;
      try {
        const data = await getQuiz(quizId);
        if (!data || data.userId !== user.uid) {
          router.replace("/workspace/quiz-builder");
          return;
        }
        setQuiz(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, quizId, router]);

  async function save(q: Quiz) {
    setSaving(true);
    try {
      await updateQuiz(q.id, {
        title: q.title,
        description: q.description,
        questions: q.questions,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function addQuestion(type: QuestionType) {
    const q: Question = {
      id: generateId(),
      type,
      question: "",
      correctAnswer: type === "true-false" ? "true" : "",
      points: 1,
      box: 1,
    };

    if (type === "multiple-choice") {
      q.options = [
        { id: generateId(), text: "" },
        { id: generateId(), text: "" },
        { id: generateId(), text: "" },
        { id: generateId(), text: "" },
      ];
    }

    if (type === "matching") {
      q.matchingPairs = [
        { id: generateId(), term: "", definition: "" },
        { id: generateId(), term: "", definition: "" },
        { id: generateId(), term: "", definition: "" },
        { id: generateId(), term: "", definition: "" },
      ];
      q.points = 4;
    }

    setEditingQ(q);
  }

  function saveQuestion(q: Question) {
    if (!quiz) return;
    const idx = quiz.questions.findIndex(x => x.id === q.id);
    let newQs: Question[];
    if (idx >= 0) {
      newQs = [...quiz.questions];
      newQs[idx] = q;
    } else {
      newQs = [...quiz.questions, q];
    }
    const updated = { ...quiz, questions: newQs };
    setQuiz(updated);
    save(updated);
    setEditingQ(null);
  }

  function deleteQuestion(id: string) {
    if (!quiz) return;
    if (!confirm("Delete?")) return;
    const newQs = quiz.questions.filter(q => q.id !== id);
    const updated = { ...quiz, questions: newQs };
    setQuiz(updated);
    save(updated);
  }

  async function handleGenerate() {
    if (!quiz || !aiText.trim()) return;
    setGenerating(true);
    try {
      const newQs = await generateQuestionsFromText(aiText, aiCount);
      const updated = { ...quiz, questions: [...quiz.questions, ...newQs] };
      setQuiz(updated);
      await save(updated);
      setShowAI(false);
      setAiText("");
    } catch (err) {
      console.error(err);
      alert("Failed to generate");
    } finally {
      setGenerating(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (!quiz) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto p-6">

        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => router.push("/workspace/quiz-builder")}
            className="text-gray-400 hover:text-white"
          >
            ← Back
          </button>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-sm">{saving ? "Saving..." : "Saved"}</span>
            {quiz.questions.length > 0 && (
              <button
                onClick={() => router.push(`/workspace/quiz-builder/${quiz.id}/take`)}
                className="bg-[#4255ff] px-4 py-2 rounded-lg font-medium hover:bg-[#3b4de0]"
              >
                Test
              </button>
            )}
          </div>
        </div>

        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg p-4 mb-6">
          <input
            value={quiz.title}
            onChange={(e) => {
              const updated = { ...quiz, title: e.target.value };
              setQuiz(updated);
              setTimeout(() => save(updated), 1000);
            }}
            placeholder="Title"
            className="w-full bg-transparent text-xl font-bold mb-2 focus:outline-none"
          />
          <textarea
            value={quiz.description}
            onChange={(e) => {
              const updated = { ...quiz, description: e.target.value };
              setQuiz(updated);
              setTimeout(() => save(updated), 1000);
            }}
            placeholder="Description..."
            className="w-full bg-transparent text-gray-400 focus:outline-none resize-none"
            rows={2}
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setShowAI(true)}
            className="bg-purple-600 px-3 py-2 rounded-lg text-sm hover:bg-purple-700"
          >
            ✨ AI Generate
          </button>
          <button
            onClick={() => addQuestion("multiple-choice")}
            className="bg-[#2e2e2e] px-3 py-2 rounded-lg text-sm hover:bg-[#3a3a3a]"
          >
            + Multiple Choice
          </button>
          <button
            onClick={() => addQuestion("true-false")}
            className="bg-[#2e2e2e] px-3 py-2 rounded-lg text-sm hover:bg-[#3a3a3a]"
          >
            + True/False
          </button>
          <button
            onClick={() => addQuestion("written")}
            className="bg-[#2e2e2e] px-3 py-2 rounded-lg text-sm hover:bg-[#3a3a3a]"
          >
            + Written
          </button>
          <button
            onClick={() => addQuestion("matching")}
            className="bg-[#2e2e2e] px-3 py-2 rounded-lg text-sm hover:bg-[#3a3a3a]"
          >
            + Matching
          </button>
        </div>

        {quiz.questions.length === 0 ? (
          <div className="text-center py-16 text-gray-500 border border-dashed border-[#2e2e2e] rounded-lg">
            No questions yet. Add some above!
          </div>
        ) : (
          <div className="space-y-3">
            {quiz.questions.map((q, i) => (
              <div key={q.id} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg p-4">
                <div className="flex justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-gray-500 text-sm">{i + 1}</span>
                      <span className="text-xs bg-[#2e2e2e] px-2 py-0.5 rounded">{q.type}</span>
                    </div>
                    <p>{q.question || "(no question)"}</p>

                    {q.type === "multiple-choice" && q.options && (
                      <div className="mt-2 text-sm text-gray-400">
                        {q.options.map((o, j) => (
                          <div key={o.id} className={o.id === q.correctAnswer ? "text-green-400" : ""}>
                            {String.fromCharCode(65 + j)}. {o.text || "(empty)"}
                          </div>
                        ))}
                      </div>
                    )}

                    {q.type === "true-false" && (
                      <p className="mt-2 text-sm text-green-400">Answer: {q.correctAnswer}</p>
                    )}

                    {q.type === "written" && (
                      <p className="mt-2 text-sm text-gray-400">Answer: {q.correctAnswer}</p>
                    )}

                    {q.type === "matching" && q.matchingPairs && (
                      <div className="mt-2 text-sm text-gray-400">
                        {q.matchingPairs.map((p, j) => (
                          <div key={p.id}>{j + 1}. {p.term} → {p.definition}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 text-sm">
                    <button onClick={() => setEditingQ(q)} className="text-gray-400 hover:text-white">Edit</button>
                    <button onClick={() => deleteQuestion(q.id)} className="text-red-400">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingQ && (
        <QuestionModal
          question={editingQ}
          onSave={saveQuestion}
          onCancel={() => setEditingQ(null)}
        />
      )}

      {showAI && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-4">Generate with AI</h2>
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Paste your study notes here..."
              className="w-full bg-[#0a0a0a] border border-[#2e2e2e] rounded-lg p-3 mb-4 resize-none h-40 focus:outline-none focus:border-[#4255ff]"
            />
            <div className="flex items-center gap-3 mb-4">
              <span className="text-gray-400">Questions:</span>
              <select
                value={aiCount}
                onChange={(e) => setAiCount(Number(e.target.value))}
                className="bg-[#0a0a0a] border border-[#2e2e2e] rounded px-3 py-1"
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowAI(false); setAiText(""); }}
                className="flex-1 bg-[#2e2e2e] py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!aiText.trim() || generating}
                className="flex-1 bg-purple-600 py-2 rounded-lg disabled:opacity-50"
              >
                {generating ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionModal({
  question,
  onSave,
  onCancel,
}: {
  question: Question;
  onSave: (q: Question) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState<Question>(question);

  function updateOption(id: string, text: string) {
    if (!q.options) return;
    setQ({
      ...q,
      options: q.options.map(o => o.id === id ? { ...o, text } : o),
    });
  }

  function updatePair(id: string, field: "term" | "definition", value: string) {
    if (!q.matchingPairs) return;
    setQ({
      ...q,
      matchingPairs: q.matchingPairs.map(p => p.id === id ? { ...p, [field]: value } : p),
    });
  }

  function addPair() {
    if (!q.matchingPairs) return;
    setQ({
      ...q,
      matchingPairs: [...q.matchingPairs, { id: generateId(), term: "", definition: "" }],
      points: q.matchingPairs.length + 1,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">
          {question.question ? "Edit" : "New"} {q.type}
        </h2>

        {q.type !== "matching" && (
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-1 block">Question</label>
            <textarea
              value={q.question}
              onChange={(e) => setQ({ ...q, question: e.target.value })}
              placeholder="Enter question..."
              className="w-full bg-[#0a0a0a] border border-[#2e2e2e] rounded-lg p-3 resize-none focus:outline-none focus:border-[#4255ff]"
              rows={3}
            />
          </div>
        )}

        {q.type === "multiple-choice" && q.options && (
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-2 block">Options (click to mark correct)</label>
            {q.options.map((o, i) => (
              <div key={o.id} className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setQ({ ...q, correctAnswer: o.id })}
                  className={`w-8 h-8 rounded-full text-sm flex-shrink-0 ${
                    q.correctAnswer === o.id ? "bg-green-500" : "bg-[#2e2e2e]"
                  }`}
                >
                  {String.fromCharCode(65 + i)}
                </button>
                <input
                  value={o.text}
                  onChange={(e) => updateOption(o.id, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  className="flex-1 bg-[#0a0a0a] border border-[#2e2e2e] rounded-lg px-3 py-2 focus:outline-none focus:border-[#4255ff]"
                />
              </div>
            ))}
          </div>
        )}

        {q.type === "true-false" && (
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-2 block">Correct Answer</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setQ({ ...q, correctAnswer: "true" })}
                className={`flex-1 py-3 rounded-lg ${q.correctAnswer === "true" ? "bg-green-600" : "bg-[#2e2e2e]"}`}
              >
                True
              </button>
              <button
                type="button"
                onClick={() => setQ({ ...q, correctAnswer: "false" })}
                className={`flex-1 py-3 rounded-lg ${q.correctAnswer === "false" ? "bg-red-600" : "bg-[#2e2e2e]"}`}
              >
                False
              </button>
            </div>
          </div>
        )}

        {q.type === "written" && (
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-1 block">Correct Answer</label>
            <input
              value={q.correctAnswer}
              onChange={(e) => setQ({ ...q, correctAnswer: e.target.value })}
              placeholder="Answer"
              className="w-full bg-[#0a0a0a] border border-[#2e2e2e] rounded-lg px-3 py-2 focus:outline-none focus:border-[#4255ff]"
            />
          </div>
        )}

        {q.type === "matching" && q.matchingPairs && (
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-2 block">Match terms with definitions</label>
            {q.matchingPairs.map((p, i) => (
              <div key={p.id} className="flex gap-2 mb-2">
                <input
                  value={p.term}
                  onChange={(e) => updatePair(p.id, "term", e.target.value)}
                  placeholder={`Term ${i + 1}`}
                  className="flex-1 bg-[#0a0a0a] border border-[#2e2e2e] rounded-lg px-3 py-2 focus:outline-none focus:border-[#4255ff]"
                />
                <span className="text-gray-500 self-center">→</span>
                <input
                  value={p.definition}
                  onChange={(e) => updatePair(p.id, "definition", e.target.value)}
                  placeholder={`Definition ${i + 1}`}
                  className="flex-1 bg-[#0a0a0a] border border-[#2e2e2e] rounded-lg px-3 py-2 focus:outline-none focus:border-[#4255ff]"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addPair}
              className="text-sm text-[#4255ff] hover:underline"
            >
              + Add pair
            </button>
          </div>
        )}

        <div className="mb-4">
          <label className="text-sm text-gray-400 mb-1 block">Explanation (optional)</label>
          <textarea
            value={q.explanation || ""}
            onChange={(e) => setQ({ ...q, explanation: e.target.value })}
            placeholder="Why is this correct?"
            className="w-full bg-[#0a0a0a] border border-[#2e2e2e] rounded-lg p-3 resize-none focus:outline-none focus:border-[#4255ff]"
            rows={2}
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-[#2e2e2e] py-2 rounded-lg">
            Cancel
          </button>
          <button
            onClick={() => onSave(q)}
            className="flex-1 bg-[#4255ff] py-2 rounded-lg font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}