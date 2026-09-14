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

  const prompt = `Eres un profesor de español experto y amable, corrigiendo la tarea de un/a estudiante de nivel ${level || "A1"}.

Instrucciones de la tarea:
${instructions || "(sin instrucciones específicas, corrige el texto en general)"}

Respuesta del estudiante:
"""
${submissionText}
"""

Da una respuesta breve y clara en español, con este formato exacto:
1. Una línea "Valoración: " seguida de una de estas palabras: Excelente / Muy bien / Bien / A mejorar.
2. Una lista corta de los 2-4 errores más importantes (gramática, vocabulario u ortografía), cada uno con la corrección entre paréntesis.
3. Una línea final de ánimo, breve, en tono cercano.

No repitas todo el texto del estudiante, solo las partes con error.`;

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
    res.status(200).json({ feedback: text || "No se pudo generar feedback." });
  } catch (e) {
    res.status(500).json({ error: "Server error contacting Anthropic" });
  }
}
