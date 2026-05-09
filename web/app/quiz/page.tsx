"use client";

import { useState, useEffect } from "react";
import Markdown from "../components/Markdown";

export default function QuizPage() {
  const [conceptSlug, setConceptSlug] = useState("");
  const [conceptTitle, setConceptTitle] = useState("");
  const [questions, setQuestions] = useState("");
  const [answers, setAnswers] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("concept");
    if (slug) {
      setConceptSlug(slug);
      // Get title
      fetch("/api/library").then(r => r.json()).then(d => {
        for (const kb of Object.values(d.knowledgeBases || {}) as Array<{ concepts: Array<{slug:string;title:string}> }>) {
          const c = kb.concepts.find(x => x.slug === slug);
          if (c) { setConceptTitle(c.title); break; }
        }
      }).catch(() => {});
      // Auto-generate quiz
      generateQuiz(slug);
    }
  }, []);

  async function generateQuiz(slug: string) {
    setLoading(true);
    setFeedback("");
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptSlug: slug, action: "generate" }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setQuestions(data.questions);
    } catch (err) {
      setQuestions(`生成失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswers() {
    if (!answers.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptSlug, action: "grade", userAnswers: answers, history: questions }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFeedback(data.feedback);
    } catch (err) {
      setFeedback(`批改失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ height: "100vh", overflowY: "auto", background: "var(--bg-main)" }}>
      <header style={{
        padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--border-color)",
        background: "var(--bg-header)", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem", fontStyle: "italic" }}>自测</div>
          {conceptTitle && <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: 2 }}>{conceptTitle}</div>}
        </div>
        <a href={`/?concept=${conceptSlug}`} style={{ fontSize: "0.8rem", color: "var(--accent)", textDecoration: "none" }}>← 回课堂</a>
      </header>

      <div style={{ padding: "1.5rem", maxWidth: 700 }}>
        {loading && !questions && (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>生成习题中...</div>
        )}

        {questions && (
          <div style={{
            background: "var(--bg-card)", padding: "1.25rem", borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-light)", marginBottom: "1.5rem",
          }}>
            <div className="msg-bubble other" style={{ border: "none", boxShadow: "none", background: "transparent" }}>
              <Markdown>{questions}</Markdown>
            </div>
          </div>
        )}

        {questions && (
          <>
            <textarea
              value={answers}
              onChange={e => setAnswers(e.target.value)}
              placeholder="在这里输入你的答案..."
              style={{
                width: "100%", minHeight: 150, padding: "0.75rem",
                background: "var(--bg-card)", border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-sm)", color: "var(--text-primary)",
                fontSize: "0.85rem", fontFamily: "var(--font-body)", resize: "vertical",
                marginBottom: "1rem",
              }}
            />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn-primary" onClick={submitAnswers} disabled={loading || !answers.trim()}>
                {loading ? "批改中..." : "提交答案"}
              </button>
              <button className="btn-ghost" onClick={() => generateQuiz(conceptSlug)} disabled={loading}>
                换一组题
              </button>
            </div>
          </>
        )}

        {feedback && (
          <div style={{
            background: "var(--bg-card)", padding: "1.25rem", borderRadius: "var(--radius-md)",
            border: "2px solid var(--accent)", marginTop: "1.5rem",
          }}>
            <Markdown>{feedback}</Markdown>
          </div>
        )}

        {!conceptSlug && (
          <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "5rem" }}>
            <p>从知识库选择一个已学课程开始自测。</p>
            <a href="/library" style={{ color: "var(--accent)", fontWeight: 600 }}>去知识库 →</a>
          </div>
        )}
      </div>
    </div>
  );
}
