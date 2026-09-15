export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { level } = req.body || {};
  if (!level) {
    res.status(400).json({ error: "Missing level" });
    return;
  }

  const prompt = `You are an experienced Spanish teacher building a syllabus for the CEFR level ${level}.

List the 8 to 10 most important topics/content items a student should cover at this level, in a sensible teaching order. Keep each one short (a few words), like a syllabus line item — not a full sentence.

Respond with ONLY a JSON object, no other text before or after, in exactly this shape:
{"items": ["<topic 1>", "<topic 2>", "..."]}`;

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
        max_tokens: 500,
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
    if (!parsed || !Array.isArray(parsed.items)) {
      res.status(500).json({ error: "Could not understand the AI response" });
      return;
    }
    res.status(200).json({ items: parsed.items.filter((x) => typeof x === "string" && x.trim()) });
  } catch (e) {
    res.status(500).json({ error: "Server error contacting Anthropic" });
  }
}
