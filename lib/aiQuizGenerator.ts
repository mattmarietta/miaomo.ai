import { Question, generateId } from "./firebase/quizStore";

// AI response format before conversion to our Question type
type AIQuestion = {
  type: "multiple-choice" | "true-false" | "written" | "matching";
  question: string;
  options?: string[];
  correctAnswer?: string;
  matchingPairs?: { term: string; definition: string }[];
  explanation?: string;
};

/**
 * Generates quiz questions from text using Gemini AI
 * @param text - Study material to generate questions from
 * @param count - Number of questions to generate
 * @param types - Array of question types to include
 */
export async function generateQuestionsFromText(
  text: string,
  count: number = 10,
  types: string[] = ["multiple-choice", "true-false", "written", "matching"]
): Promise<Question[]> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }

  // Build instructions for each question type
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

  // Prompt for AI to generate questions
  const prompt = `Create exactly ${count} quiz questions from this study material. 
Use ONLY these question types: ${types.join(", ")}

Rules for each type:
${typeInstructions}

Study material:
"""
${text.substring(0, 15000)}
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

  // Call Gemini API
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
    throw new Error(`API request failed: ${res.status}`);
  }

  const data = await res.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!responseText) {
    throw new Error("Empty response from API");
  }

  // Extract JSON from response (may be wrapped in markdown code blocks)
  let jsonStr = responseText;
  
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  }
  
  jsonStr = jsonStr.trim();
  
  // Find array if not at start of string
  if (!jsonStr.startsWith("[")) {
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }
  }

  let aiQuestions: AIQuestion[];
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      throw new Error("Invalid response format");
    }
    aiQuestions = parsed;
  } catch {
    throw new Error("Failed to parse AI response. Please try again.");
  }

  // Convert AI response to our Question format
  return aiQuestions.map((aq: AIQuestion) => {
    const q: Question = {
      id: generateId(),
      type: aq.type,
      question: aq.question || "",
      correctAnswer: aq.correctAnswer || "",
      points: 1,
      box: 1,
    };

    // Only add explanation if it exists (Firebase doesn't accept undefined)
    if (aq.explanation) {
      q.explanation = aq.explanation;
    }

    // Handle multiple choice options
    if (aq.type === "multiple-choice" && aq.options) {
      q.options = aq.options.map((text: string) => ({ id: generateId(), text }));
      
      // Find correct answer by matching text or letter (A, B, C, D)
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

    // Handle matching pairs
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
}