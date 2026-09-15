export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { instructions, submissionText, level } = req.body || {};
  if (!submissionText || !submissionText.trim()) {
    res.status(400).json({ error: "Missing submission text" });
    return;
  }

  const prompt = `You are a friendly, expert Spanish teacher correcting a ${level || "A1"}-level student's homework. The student's first language is English, so write your feedback in English — only the actual Spanish corrections themselves should be in Spanish.

Task instructions:
${instructions || "(no specific instructions, correct the text in general)"}

Student's answer:
"""
${submissionText}
"""

Give a short, clear response in English, in exactly this format:
1. A line "Score: " followed by one of: Excellent / Good / Okay / Needs work.
2. A short list of the 2-4 most important errors (grammar, vocabulary, or spelling), explained in English, with the Spanish correction in parentheses.
3. A brief, warm closing line of encouragement, in English.

Don't repeat the student's whole answer, just the parts with mistakes.`;

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
        max_tokens: 700,
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
      .filter(Boolean)
      .join("\n");
    res.status(200).json({ feedback: text || "Couldn't generate feedback." });
  } catch (e) {
    res.status(500).json({ error: "Server error contacting Anthropic" });
  }
}
