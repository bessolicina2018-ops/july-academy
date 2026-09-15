export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { word, level, category } = req.body || {};
  if (!word || !word.trim()) {
    res.status(400).json({ error: "Missing word" });
    return;
  }

  let prompt;
  if (category === "verb") {
    prompt = `You are a Spanish teacher creating a verb-conjugation flashcard for a ${level || "A1"}-level student.

Verb (infinitive): "${word}"

Respond with ONLY a JSON object, no other text before or after, in exactly this shape:
{"translation": "<short English meaning of the infinitive>", "example": "<a markdown table using | pipes, exactly two columns headed Pronoun and Present tense, one row each for yo, tú, él/ella, nosotros, vosotros, ellos/ellas, showing the present-tense conjugation>"}

The "example" value must be a single string containing newline characters (\\n) between table rows, valid markdown table syntax.`;
  } else if (category === "phrase") {
    prompt = `You are a Spanish teacher creating a flashcard for a common useful phrase or expression, for a ${level || "A1"}-level student.

Phrase or expression: "${word}"

Respond with ONLY a JSON object, no other text before or after, in exactly this shape:
{"translation": "<short natural English translation>", "example": "<one short example situation or sentence in Spanish showing how it's used, suitable for ${level || "A1"} level>"}`;
  } else {
    prompt = `You are a Spanish teacher creating a vocabulary flashcard for a ${level || "A1"}-level student.

Word or expression: "${word}"

Respond with ONLY a JSON object, no other text before or after, in exactly this shape:
{"translation": "<short English translation>", "example": "<one natural, appropriately simple example sentence in Spanish using the word, suitable for ${level || "A1"} level>"}`;
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      res.status(500).json({ error: data?.error?.message || "Anthropic API error" });
      return;
    }
    const text = (data.content || [])
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch (e2) { parsed = null; }
      }
    }
    if (!parsed) {
      res.status(500).json({ error: "Could not understand the AI response" });
      return;
    }
    res.status(200).json({ translation: parsed.translation || "", example: parsed.example || "" });
  } catch (e) {
    res.status(500).json({ error: "Server error contacting Anthropic" });
  }
}
