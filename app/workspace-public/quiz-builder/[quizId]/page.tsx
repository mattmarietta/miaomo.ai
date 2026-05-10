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
import { ArrowLeft, Play, Sparkles, Plus, Pencil, Trash2, Check, X } from "lucide-react";

type PageProps = {
  params: Promise<{ quizId: string }>;
};

export default function QuizEditorPage({ params }: PageProps) {
  const { quizId } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Quiz state
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingQ, setEditingQ] = useState<Question | null>(null);

  // AI generation state
  const [showAI, setShowAI] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  
  // AI question type toggles
  const [aiMultipleChoice, setAiMultipleChoice] = useState(true);
  const [aiTrueFalse, setAiTrueFalse] = useState(true);
  const [aiWritten, setAiWritten] = useState(false);
  const [aiMatching, setAiMatching] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login");
  }, [authLoading, user, router]);

  // Load quiz data
  useEffect(() => {
    if (!user || !quizId) return;

    async function load() {
      if (!user) return;
      try {
        const data = await getQuiz(quizId);
        if (!data || data.userId !== user.uid) {
          router.replace("/workspace-public/quiz-builder");
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

  // Save quiz to Firebase
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

  // Add new question
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

  // Save question (add or update)
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

  // Delete question
  function deleteQuestion(id: string) {
    if (!quiz) return;
    if (!confirm("Delete this question?")) return;
    const newQs = quiz.questions.filter(q => q.id !== id);
    const updated = { ...quiz, questions: newQs };
    setQuiz(updated);
    save(updated);
  }

  // Generate questions with AI
  async function handleGenerate() {
    if (!quiz || !aiText.trim()) return;
    
    // Collect selected types
    const types: string[] = [];
    if (aiMultipleChoice) types.push("multiple-choice");
    if (aiTrueFalse) types.push("true-false");
    if (aiWritten) types.push("written");
    if (aiMatching) types.push("matching");
    
    if (types.length === 0) {
      alert("Select at least one question type");
      return;
    }
    
    setGenerating(true);
    try {
      const token = await user!.getIdToken();
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: aiText, count: aiCount, types }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const { questions: newQs } = await res.json();
      const updated = { ...quiz, questions: [...quiz.questions, ...newQs] };
      setQuiz(updated);
      await save(updated);
      setShowAI(false);
      setAiText("");
    } catch (err) {
      console.error(err);
      alert("Failed to generate questions");
    } finally {
      setGenerating(false);
    }
  }

  // Get readable question type label
  function getQuestionTypeLabel(type: string) {
    switch (type) {
      case "multiple-choice": return "Multiple Choice";
      case "true-false": return "True/False";
      case "written": return "Written";
      case "matching": return "Matching";
      default: return type;
    }
  }

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!quiz) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/workspace-public/quiz-builder")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-sm">Back</span>
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {saving ? "Saving..." : "Saved"}
            </span>
            {quiz.questions.length > 0 && (
              <button
                onClick={() => router.push(`/workspace-public/quiz-builder/${quiz.id}/take`)}
                className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
              >
                <Play size={16} />
                Take Test
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {/* Title & Description */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <input
            value={quiz.title}
            onChange={(e) => {
              const updated = { ...quiz, title: e.target.value };
              setQuiz(updated);
              setTimeout(() => save(updated), 1000);
            }}
            placeholder="Study Set Title"
            className="w-full bg-transparent text-xl font-semibold mb-2 focus:outline-none placeholder-muted-foreground"
          />
          <textarea
            value={quiz.description}
            onChange={(e) => {
              const updated = { ...quiz, description: e.target.value };
              setQuiz(updated);
              setTimeout(() => save(updated), 1000);
            }}
            placeholder="Add a description..."
            className="w-full bg-transparent text-muted-foreground text-sm focus:outline-none resize-none placeholder-muted-foreground/50"
            rows={2}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setShowAI(true)}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
          >
            <Sparkles size={16} />
            AI Generate
          </button>
          <button
            onClick={() => addQuestion("multiple-choice")}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm hover:bg-muted transition-colors"
          >
            <Plus size={16} />
            Multiple Choice
          </button>
          <button
            onClick={() => addQuestion("true-false")}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm hover:bg-muted transition-colors"
          >
            <Plus size={16} />
            True/False
          </button>
          <button
            onClick={() => addQuestion("written")}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm hover:bg-muted transition-colors"
          >
            <Plus size={16} />
            Written
          </button>
          <button
            onClick={() => addQuestion("matching")}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm hover:bg-muted transition-colors"
          >
            <Plus size={16} />
            Matching
          </button>
        </div>

        {/* Questions List */}
        {quiz.questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-border rounded-xl">
            <p className="text-muted-foreground mb-2">No questions yet</p>
            <p className="text-sm text-muted-foreground/70">Add questions using the buttons above</p>
          </div>
        ) : (
          <div className="space-y-4">
            {quiz.questions.map((q, i) => (
              <div key={q.id} className="bg-card border border-border rounded-xl p-5 group">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center text-sm font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground">
                      {getQuestionTypeLabel(q.type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingQ(q)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil size={16} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => deleteQuestion(q.id)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} className="text-muted-foreground hover:text-red-500" />
                    </button>
                  </div>
                </div>

                <p className="font-medium mb-3">{q.question || "(No question text)"}</p>

                {/* Multiple Choice Display */}
                {q.type === "multiple-choice" && q.options && (
                  <div className="space-y-2">
                    {q.options.map((o, j) => (
                      <div
                        key={o.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          o.id === q.correctAnswer
                            ? "border-green-500/50 bg-green-500/10"
                            : "border-border bg-muted/30"
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          o.id === q.correctAnswer
                            ? "bg-green-500 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {String.fromCharCode(65 + j)}
                        </span>
                        <span className={o.id === q.correctAnswer ? "text-green-400" : ""}>
                          {o.text || "(empty)"}
                        </span>
                        {o.id === q.correctAnswer && (
                          <Check size={16} className="text-green-500 ml-auto" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* True/False Display */}
                {q.type === "true-false" && (
                  <div className="flex gap-3">
                    <div className={`flex-1 p-3 rounded-lg border text-center ${
                      q.correctAnswer === "true"
                        ? "border-green-500/50 bg-green-500/10 text-green-400"
                        : "border-border bg-muted/30 text-muted-foreground"
                    }`}>
                      True {q.correctAnswer === "true" && <Check size={14} className="inline ml-1" />}
                    </div>
                    <div className={`flex-1 p-3 rounded-lg border text-center ${
                      q.correctAnswer === "false"
                        ? "border-green-500/50 bg-green-500/10 text-green-400"
                        : "border-border bg-muted/30 text-muted-foreground"
                    }`}>
                      False {q.correctAnswer === "false" && <Check size={14} className="inline ml-1" />}
                    </div>
                  </div>
                )}

                {/* Written Display */}
                {q.type === "written" && (
                  <div className="p-3 rounded-lg border border-green-500/50 bg-green-500/10">
                    <span className="text-xs text-muted-foreground">Answer: </span>
                    <span className="text-green-400">{q.correctAnswer}</span>
                  </div>
                )}

                {/* Matching Display */}
                {q.type === "matching" && q.matchingPairs && (
                  <div className="space-y-2">
                    {q.matchingPairs.map((p, j) => (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                        <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                          {j + 1}
                        </span>
                        <span className="flex-1">{p.term || "(term)"}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="flex-1 text-muted-foreground">{p.definition || "(definition)"}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Explanation */}
                {q.explanation && (
                  <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm">
                    <span className="text-muted-foreground font-medium">Explanation: </span>
                    {q.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Edit Question Modal */}
      {editingQ && (
        <QuestionModal
          question={editingQ}
          onSave={saveQuestion}
          onCancel={() => setEditingQ(null)}
        />
      )}

      {/* AI Generate Modal */}
      {showAI && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Generate with AI</h2>
            
            {/* Text Input */}
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Paste your study notes here..."
              className="w-full bg-background border border-border rounded-lg p-3 mb-4 resize-none h-32 focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
            
            {/* Question Types */}
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">Question types</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAiMultipleChoice(!aiMultipleChoice)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    aiMultipleChoice
                      ? "bg-foreground border-foreground text-background"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  Multiple Choice
                </button>
                <button
                  onClick={() => setAiTrueFalse(!aiTrueFalse)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    aiTrueFalse
                      ? "bg-foreground border-foreground text-background"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  True/False
                </button>
                <button
                  onClick={() => setAiWritten(!aiWritten)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    aiWritten
                      ? "bg-foreground border-foreground text-background"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  Written
                </button>
                <button
                  onClick={() => setAiMatching(!aiMatching)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    aiMatching
                      ? "bg-foreground border-foreground text-background"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  Matching
                </button>
              </div>
            </div>
            
            {/* Question Count */}
            <div className="mb-5">
              <p className="text-sm text-muted-foreground mb-2">Number of questions</p>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <button
                    key={n}
                    onClick={() => setAiCount(n)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium border transition-colors ${
                      aiCount === n
                        ? "bg-foreground text-background border-foreground"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowAI(false); setAiText(""); }}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg font-medium text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!aiText.trim() || generating}
                className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg font-medium text-sm disabled:opacity-50 hover:opacity-90 transition-colors"
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

// Question Edit Modal Component
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

  // Update multiple choice option text
  function updateOption(id: string, text: string) {
    if (!q.options) return;
    setQ({
      ...q,
      options: q.options.map(o => o.id === id ? { ...o, text } : o),
    });
  }

  // Update matching pair
  function updatePair(id: string, field: "term" | "definition", value: string) {
    if (!q.matchingPairs) return;
    setQ({
      ...q,
      matchingPairs: q.matchingPairs.map(p => p.id === id ? { ...p, [field]: value } : p),
    });
  }

  // Add new matching pair
  function addPair() {
    if (!q.matchingPairs) return;
    setQ({
      ...q,
      matchingPairs: [...q.matchingPairs, { id: generateId(), term: "", definition: "" }],
      points: q.matchingPairs.length + 1,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {question.question ? "Edit Question" : "New Question"}
          </h2>
          <button onClick={onCancel} className="p-1 hover:bg-muted rounded-lg">
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Question Text (not for matching) */}
        {q.type !== "matching" && (
          <div className="mb-4">
            <label className="text-sm text-muted-foreground mb-2 block">Question</label>
            <textarea
              value={q.question}
              onChange={(e) => setQ({ ...q, question: e.target.value })}
              placeholder="Enter your question..."
              className="w-full bg-background border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              rows={3}
            />
          </div>
        )}

        {/* Multiple Choice Options */}
        {q.type === "multiple-choice" && q.options && (
          <div className="mb-4">
            <label className="text-sm text-muted-foreground mb-2 block">Options (click letter to mark correct)</label>
            {q.options.map((o, i) => (
              <div key={o.id} className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setQ({ ...q, correctAnswer: o.id })}
                  className={`w-8 h-8 rounded-full text-sm font-medium flex-shrink-0 transition-colors ${
                    q.correctAnswer === o.id 
                      ? "bg-green-500 text-white" 
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {String.fromCharCode(65 + i)}
                </button>
                <input
                  value={o.text}
                  onChange={(e) => updateOption(o.id, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ))}
          </div>
        )}

        {/* True/False Selection */}
        {q.type === "true-false" && (
          <div className="mb-4">
            <label className="text-sm text-muted-foreground mb-2 block">Correct Answer</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setQ({ ...q, correctAnswer: "true" })}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                  q.correctAnswer === "true" 
                    ? "bg-green-500 text-white" 
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                True
              </button>
              <button
                type="button"
                onClick={() => setQ({ ...q, correctAnswer: "false" })}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                  q.correctAnswer === "false" 
                    ? "bg-red-500 text-white" 
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                False
              </button>
            </div>
          </div>
        )}

        {/* Written Answer */}
        {q.type === "written" && (
          <div className="mb-4">
            <label className="text-sm text-muted-foreground mb-2 block">Correct Answer</label>
            <input
              value={q.correctAnswer}
              onChange={(e) => setQ({ ...q, correctAnswer: e.target.value })}
              placeholder="Enter the correct answer"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {/* Matching Pairs */}
        {q.type === "matching" && q.matchingPairs && (
          <div className="mb-4">
            <label className="text-sm text-muted-foreground mb-2 block">Match terms with definitions</label>
            {q.matchingPairs.map((p, i) => (
              <div key={p.id} className="flex gap-2 mb-2">
                <input
                  value={p.term}
                  onChange={(e) => updatePair(p.id, "term", e.target.value)}
                  placeholder={`Term ${i + 1}`}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-muted-foreground self-center">→</span>
                <input
                  value={p.definition}
                  onChange={(e) => updatePair(p.id, "definition", e.target.value)}
                  placeholder={`Definition ${i + 1}`}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addPair}
              className="text-sm text-muted-foreground hover:text-foreground mt-1"
            >
              + Add pair
            </button>
          </div>
        )}

        {/* Explanation */}
        <div className="mb-4">
          <label className="text-sm text-muted-foreground mb-2 block">Explanation (optional)</label>
          <textarea
            value={q.explanation || ""}
            onChange={(e) => setQ({ ...q, explanation: e.target.value })}
            placeholder="Why is this the correct answer?"
            className="w-full bg-background border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            rows={2}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-border rounded-lg font-medium text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(q)}
            className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Save Question
          </button>
        </div>
      </div>
    </div>
  );
}