export type AICard = {
  front: string;
  back: string;
};

export async function generateFlashcardsFromText(text: string, count: number = 10): Promise<AICard[]> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }

  const prompt = `Extract ${count} key terms and definitions from this text. Return as JSON array.

Text:
"""
${text.substring(0, 15000)}
"""

Return ONLY a JSON array like this, no other text:
[
  {"front": "Term or question", "back": "Definition or answer"},
  {"front": "Another term", "back": "Another definition"}
]`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    }
  );

  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const data = await res.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Parse JSON from response
  let jsonStr = responseText;
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) jsonStr = codeBlockMatch[1];
  jsonStr = jsonStr.trim();

  if (!jsonStr.startsWith("[")) {
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) jsonStr = arrayMatch[0];
  }

  const cards: AICard[] = JSON.parse(jsonStr);
  return cards;
}