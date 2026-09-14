export async function getAIFeedback({ instructions, submissionText, level }) {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instructions, submissionText, level }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Feedback request failed");
  return data.feedback;
}
