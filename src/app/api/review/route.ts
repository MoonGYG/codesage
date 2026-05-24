import { NextResponse } from "next/server";

const MIMO_API_URL = "http://localhost:19911/v1/chat/completions";

export async function POST(request: Request) {
  try {
    const { code, language } = await request.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Code content is required" },
        { status: 400 }
      );
    }

    const systemMessage = {
      role: "system",
      content: `You are CodeSage, an expert code reviewer. Analyze the provided ${language || "code"} and return a JSON array of review findings. Each finding must have:
- "severity": one of "critical", "warning", "info", "success"
- "title": short title (max 60 chars)
- "description": detailed explanation (1-2 sentences)
- "line": approximate line number (or null)
- "suggestion": code fix suggestion (or null)

Return ONLY valid JSON array, no markdown fences. Be thorough but concise. Find 3-8 issues.`,
    };

    const userMessage = {
      role: "user",
      content: `Review this code:\n\n${code}`,
    };

    const response = await fetch(MIMO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mimo-v2.5-pro",
        messages: [systemMessage, userMessage],
        temperature: 0.4,
        max_tokens: 2048,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `API error: ${response.status} — ${errText}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    // Parse the JSON response
    let findings;
    try {
      // Try to extract JSON from possible markdown fences
      let raw = content.trim();
      // Remove markdown code fences if present
      const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (fenceMatch) raw = fenceMatch[1].trim();
      // Find the JSON array
      const arrStart = raw.indexOf("[");
      const arrEnd = raw.lastIndexOf("]");
      if (arrStart !== -1 && arrEnd !== -1) {
        raw = raw.slice(arrStart, arrEnd + 1);
      }
      findings = JSON.parse(raw);
      if (!Array.isArray(findings)) findings = [findings];
    } catch {
      findings = [
        {
          severity: "info",
          title: "Review completed",
          description: content.slice(0, 300),
          line: null,
          suggestion: null,
        },
      ];
    }

    return NextResponse.json({ findings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
