import { Question, generateId } from "./firebase/quizStore";

type AIQuestion = {
  type: "multiple-choice" | "true-false" | "written" | "matching";
  question: string;
  options?: string[];
  correctAnswer?: string;
  matchingPairs?: { term: string; definition: string }[];
  explanation?: string;
};

export async function generateQuestionsFromText(
  text: string,
  count: number = 10,
  types: string[] = ["multiple-choice", "true-false", "written", "matching"]
): Promise<Question[]> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("No Gemini API key found. Add NEXT_PUBLIC_GEMINI_API_KEY to your .env.local file.");
  }

  const typeInstructions = types.map(t => {
    switch (t) {
      case "multiple-choice":
        return "- Multiple choice: exactly 4 options, one correct answer";
      case "true-false":
        return "- True/false: statement that is either true or false";
      case "written":
        return "- Written: short answer question (answer should be 1-3 words)";
      case "matching":
        return "- Matching: 4 term-definition pairs to match";
      default:
        return "";
    }
  }).filter(Boolean).join("\n");

  const prompt = `Create exactly ${count} quiz questions from this study material. 
Use ONLY these question types: ${types.join(", ")}

Rules for each type:
${typeInstructions}

Study material:
"""
${text}
"""

Return ONLY a valid JSON array with no extra text. Each question should follow this format:

For multiple-choice:
{"type": "multiple-choice", "question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "A", "explanation": "..."}

For true-false:
{"type": "true-false", "question": "...", "correctAnswer": "true", "explanation": "..."}

For written:
{"type": "written", "question": "...", "correctAnswer": "...", "explanation": "..."}

For matching:
{"type": "matching", "question": "Match the following terms", "matchingPairs": [{"term": "...", "definition": "..."}, ...]}

Return ONLY the JSON array, no markdown, no explanation.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { 
            temperature: 0.7, 
            maxOutputTokens: 8192 
          },
        }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json();
      console.error("Gemini API error:", errorData);
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!responseText) {
      throw new Error("Empty response from Gemini");
    }

    let jsonStr = responseText;
    
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }
    
    jsonStr = jsonStr.trim();
    
    if (!jsonStr.startsWith("[")) {
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }
    }

    let aiQuestions: AIQuestion[];
    try {
      aiQuestions = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw response:", responseText);
      throw new Error("Failed to parse AI response as JSON");
    }

    if (!Array.isArray(aiQuestions)) {
      throw new Error("AI response is not an array");
    }

    return aiQuestions.map((aq: AIQuestion) => {
      const q: Question = {
        id: generateId(),
        type: aq.type,
        question: aq.question || "",
        correctAnswer: aq.correctAnswer || "",
        explanation: aq.explanation,
        points: 1,
        box: 1,
      };

      if (aq.type === "multiple-choice" && aq.options) {
        q.options = aq.options.map((text: string) => ({ id: generateId(), text }));
        const correctIndex = aq.options.findIndex((opt: string) => opt === aq.correctAnswer);
        if (correctIndex >= 0 && q.options[correctIndex]) {
          q.correctAnswer = q.options[correctIndex].id;
        } else {
          const letterIndex = ["A", "B", "C", "D"].indexOf(aq.correctAnswer || "");
          if (letterIndex >= 0 && q.options[letterIndex]) {
            q.correctAnswer = q.options[letterIndex].id;
          }
        }
      }

      if (aq.type === "matching" && aq.matchingPairs) {
        q.matchingPairs = aq.matchingPairs.map((p: { term: string; definition: string }) => ({
          id: generateId(),
          term: p.term,
          definition: p.definition,
        }));
        q.points = aq.matchingPairs.length;
      }

      return q;
    });

  } catch (err) {
    console.error("Generate questions error:", err);
    throw err;
  }
}
