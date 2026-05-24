"use client";

import { useState, useRef } from "react";

interface Finding {
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  description: string;
  line: number | null;
  suggestion: string | null;
}

const SAMPLE_FILES = [
  {
    name: "auth.ts",
    language: "typescript",
    code: `import { createHash } from "crypto";
import jwt from "jsonwebtoken";

const SECRET = "hardcoded-secret-key-123";

export function hashPassword(password: string): string {
  return createHash("md5").update(password).digest("hex");
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, SECRET, { expiresIn: "365d" });
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

export async function login(username: string, password: string) {
  const hashed = hashPassword(password);
  const query = \`SELECT * FROM users WHERE username = '\${username}' AND password = '\${hashed}'\`;
  const user = await db.query(query);
  if (!user) throw new Error("Invalid credentials");
  return generateToken(user.id);
}`,
  },
  {
    name: "api.ts",
    language: "typescript",
    code: `import express from "express";

const app = express();

app.get("/users/:id", async (req, res) => {
  const user = await db.findUser(req.params.id);
  res.json(user);
});

app.post("/users", async (req, res) => {
  const { name, email, role } = req.body;
  const user = await db.createUser({ name, email, role });
  res.status(201).json(user);
});

app.delete("/users/:id", async (req, res) => {
  await db.deleteUser(req.params.id);
  res.status(204).send();
});

app.listen(3000);`,
  },
  {
    name: "utils.ts",
    language: "typescript",
    code: `export function debounce(fn: Function, delay: number) {
  let timer: any;
  return function (...args: any[]) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function deepClone(obj: any): any {
  return JSON.parse(JSON.stringify(obj));
}

export function formatCurrency(amount: number): string {
  return "$" + amount.toFixed(2);
}

export function parseEnvInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (!val) return fallback;
  return parseInt(val);
}

export async function retry<T>(
  fn: () => Promise<T>,
  attempts: number = 3
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
  throw new Error("Unreachable");
}`,
  },
];

export default function Home() {
  const [selectedFile, setSelectedFile] = useState(0);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentFile = SAMPLE_FILES[selectedFile];
  const codeLines = (showCustom ? customCode : currentFile.code).split("\n");

  const severityOrder: Record<string, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    success: 3,
  };

  const severityCounts = findings.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  async function runReview() {
    setLoading(true);
    setFindings([]);
    setReviewed(false);
    try {
      const code = showCustom ? customCode : currentFile.code;
      const lang = showCustom ? "code" : currentFile.language;
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language: lang }),
      });
      const data = await res.json();
      if (data.error) {
        setFindings([
          {
            severity: "critical",
            title: "Review Error",
            description: data.error,
            line: null,
            suggestion: null,
          },
        ]);
      } else {
        setFindings(
          data.findings.sort(
            (a: Finding, b: Finding) =>
              severityOrder[a.severity] - severityOrder[b.severity]
          )
        );
      }
      setReviewed(true);
    } catch (err) {
      setFindings([
        {
          severity: "critical",
          title: "Connection Error",
          description: err instanceof Error ? err.message : "Failed to connect",
          line: null,
          suggestion: null,
        },
      ]);
    }
    setLoading(false);
  }

  function severityIcon(s: string) {
    switch (s) {
      case "critical":
        return "🔴";
      case "warning":
        return "🟠";
      case "info":
        return "🔵";
      case "success":
        return "🟢";
      default:
        return "⚪";
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar — File Tree */}
      <aside
        style={{
          width: 260,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          borderRight: "1px solid rgba(0,0,0,0.06)",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div
            className="neu-convex"
            style={{
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
            }}
          >
            🔍
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "var(--accent)" }}>
              CodeSage
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              AI Code Review
            </div>
          </div>
        </div>

        {/* File list */}
        <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginTop: 8 }}>
          Sample Files
        </div>
        {SAMPLE_FILES.map((f, i) => (
          <button
            key={i}
            className={selectedFile === i && !showCustom ? "neu-pressed" : "neu-btn"}
            onClick={() => {
              setSelectedFile(i);
              setShowCustom(false);
              setReviewed(false);
              setFindings([]);
            }}
            style={{
              padding: "10px 14px",
              textAlign: "left",
              fontSize: 13,
              fontWeight: selectedFile === i && !showCustom ? 600 : 400,
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: selectedFile === i && !showCustom ? "var(--accent)" : "var(--text)",
            }}
          >
            <span style={{ fontSize: 14 }}>📄</span>
            {f.name}
            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                color: "var(--text-muted)",
                background: "rgba(0,0,0,0.04)",
                padding: "2px 6px",
                borderRadius: 6,
              }}
            >
              {f.language}
            </span>
          </button>
        ))}

        <div style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "4px 0" }} />

        <button
          className={showCustom ? "neu-pressed" : "neu-btn"}
          onClick={() => {
            setShowCustom(true);
            setReviewed(false);
            setFindings([]);
          }}
          style={{
            padding: "10px 14px",
            textAlign: "left",
            fontSize: 13,
            fontWeight: showCustom ? 600 : 400,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: showCustom ? "var(--accent)" : "var(--text)",
          }}
        >
          <span style={{ fontSize: 14 }}>✏️</span>
          Paste Your Code
        </button>

        {/* Powered by */}
        <div style={{ marginTop: "auto", textAlign: "center", fontSize: 11, color: "var(--text-muted)" }}>
          Powered by MiMo v2.5 Pro
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <header
          className="neu-flat"
          style={{
            margin: "16px 20px 0",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>📁</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {showCustom ? "Your Code" : currentFile.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {codeLines.length} lines • {showCustom ? "custom" : currentFile.language}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Stats */}
            {reviewed && findings.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginRight: 8 }}>
                {(["critical", "warning", "info", "success"] as const).map((s) =>
                  severityCounts[s] ? (
                    <span
                      key={s}
                      className={`badge-${s}`}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "3px 8px",
                        borderRadius: 8,
                      }}
                    >
                      {severityCounts[s]} {s}
                    </span>
                  ) : null
                )}
              </div>
            )}

            <button
              className="neu-btn-accent neu-btn"
              onClick={runReview}
              disabled={loading || (showCustom && !customCode.trim())}
              style={{
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 600,
                opacity: loading || (showCustom && !customCode.trim()) ? 0.6 : 1,
              }}
            >
              {loading ? (
                <span className="pulse">Analyzing...</span>
              ) : (
                "✨ Review Code"
              )}
            </button>
          </div>
        </header>

        {/* Content Area — Code + Findings */}
        <div style={{ flex: 1, display: "flex", gap: 20, padding: "16px 20px", overflow: "hidden" }}>
          {/* Code Panel */}
          <div
            className="neu-pressed"
            style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}
          >
            {showCustom ? (
              <textarea
                ref={textareaRef}
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                placeholder="Paste your code here..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: 13,
                  lineHeight: 1.7,
                  padding: 16,
                  color: "var(--text)",
                }}
              />
            ) : (
              <div style={{ padding: 16 }}>
                {codeLines.map((line, i) => {
                  const lineNum = i + 1;
                  const isHighlighted = findings.some((f) => f.line === lineNum);
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        fontSize: 13,
                        lineHeight: 1.7,
                        background: isHighlighted
                          ? "rgba(108, 92, 231, 0.08)"
                          : "transparent",
                        borderLeft: isHighlighted
                          ? "3px solid var(--accent)"
                          : "3px solid transparent",
                        paddingLeft: 8,
                      }}
                    >
                      <span
                        style={{
                          width: 36,
                          textAlign: "right",
                          color: isHighlighted
                            ? "var(--accent)"
                            : "var(--text-muted)",
                          marginRight: 12,
                          userSelect: "none",
                          fontWeight: isHighlighted ? 600 : 400,
                          flexShrink: 0,
                        }}
                      >
                        {lineNum}
                      </span>
                      <span style={{ whiteSpace: "pre" }}>{line}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Findings Panel */}
          <div style={{ width: 380, display: "flex", flexDirection: "column", gap: 12, overflow: "auto" }}>
            {!reviewed && !loading && (
              <div
                className="neu-flat"
                style={{
                  padding: 32,
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 48, opacity: 0.6 }}>🔍</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Ready to Review</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 240 }}>
                  Select a sample file or paste your own code, then hit{" "}
                  <strong>Review Code</strong> to get AI-powered findings.
                </div>
              </div>
            )}

            {loading && (
              <div
                className="neu-flat"
                style={{
                  padding: 32,
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div className="pulse" style={{ fontSize: 48 }}>⚙️</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Analyzing Code...</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  MiMo is scanning for issues
                </div>
                <div
                  className="neu-pressed"
                  style={{ width: "100%", height: 8, borderRadius: 4, overflow: "hidden" }}
                >
                  <div
                    style={{
                      width: "60%",
                      height: "100%",
                      background: "linear-gradient(90deg, var(--accent), var(--accent-light))",
                      borderRadius: 4,
                      animation: "pulse-soft 1.5s ease-in-out infinite",
                    }}
                  />
                </div>
              </div>
            )}

            {reviewed &&
              findings.map((f, i) => (
                <div
                  key={i}
                  className="neu-flat animate-fade-in"
                  style={{
                    padding: 16,
                    animationDelay: `${i * 0.08}s`,
                    animationFillMode: "backwards",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{severityIcon(f.severity)}</span>
                    <span
                      className={`badge-${f.severity}`}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 6,
                        textTransform: "uppercase",
                      }}
                    >
                      {f.severity}
                    </span>
                    {f.line && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginLeft: "auto",
                        }}
                      >
                        Line {f.line}
                      </span>
                    )}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                    {f.title}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {f.description}
                  </div>
                  {f.suggestion && (
                    <div
                      className="neu-pressed"
                      style={{
                        marginTop: 10,
                        padding: 10,
                        fontSize: 12,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: "var(--accent)",
                        lineHeight: 1.5,
                      }}
                    >
                      💡 {f.suggestion}
                    </div>
                  )}
                </div>
              ))}

            {reviewed && findings.length > 0 && (
              <div
                className="neu-flat"
                style={{
                  padding: 16,
                  textAlign: "center",
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                Found <strong>{findings.length}</strong> findings •{" "}
                {severityCounts.critical || 0} critical •{" "}
                {severityCounts.warning || 0} warnings
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer
          style={{
            textAlign: "center",
            padding: "8px 0 12px",
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          Reviewed by MiMo v2.5 Pro
        </footer>
      </main>
    </div>
  );
}
