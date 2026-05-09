"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage as Message } from "@/lib/types";
import Avatar from "./components/Avatar";
import Markdown from "./components/Markdown";

interface ConceptOption {
  slug: string;
  title: string;
  professor: string;
}

export default function ClassroomPage() {
  const storageKey = "socratopia-classroom-messages";
  const [allMessages, setAllMessages] = useState<Record<string, Message[]>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { return {}; }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conceptSlug, setConceptSlug] = useState("");
  const [concepts, setConcepts] = useState<ConceptOption[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = allMessages[conceptSlug] || [];

  function setMessages(next: Message[] | ((prev: Message[]) => Message[])) {
    setAllMessages((all) => {
      const current = all[conceptSlug] || [];
      const updated = { ...all, [conceptSlug]: typeof next === "function" ? next(current) : next };
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  }

  // Load concept list from API, then set initial slug from URL or first concept
  useEffect(() => {
    fetch("/api/library")
      .then((r) => r.json())
      .then((d) => {
        const kbs = d.knowledgeBases || {};
        const all: ConceptOption[] = [];
        for (const kb of Object.values(kbs) as Array<{ concepts: ConceptOption[] }>) {
          for (const c of kb.concepts) {
            all.push({ slug: c.slug, title: c.title, professor: c.professor });
          }
        }
        setConcepts(all);

        // Use URL param if present, else localStorage last-studied, else first concept
        const params = new URLSearchParams(window.location.search);
        const urlConcept = params.get("concept");
        if (urlConcept && all.find((c) => c.slug === urlConcept)) {
          setConceptSlug(urlConcept);
        } else {
          const last = localStorage.getItem("socratopia-last-studied");
          if (last && all.find((c) => c.slug === last)) {
            setConceptSlug(last);
          } else if (all.length > 0) {
            setConceptSlug(all[0].slug);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(action?: string) {
    if (!input.trim() && !action) return;
    if (!conceptSlug) return;
    setLoading(true);

    const userMsg: Message = { role: "user", content: input, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Persist last studied
    localStorage.setItem("socratopia-last-studied", conceptSlug);

    try {
      const history = [...messages, userMsg].map((m) => `[${m.role}]: ${m.content}`).join("\n");
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptSlug, message: userMsg.content, history, action }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Handle end-class summary collection
      if (data.action === "collect-summary" || action === "end-class") {
        fetch("/api/end-class", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conceptSlug,
            summary: userMsg.content,
            professor: data.professor || "马超",
            evaluation: "Web课堂自动记录",
            diaryContent: messages.slice(-6).map((m: Message) => `[${m.role}]: ${m.content}`).join("\n"),
            mood: "充实",
          }),
        }).catch((err) => { console.warn("Backup failed:", err); });

        setMessages((prev) => [
          ...prev,
          { role: "system", content: "✅ 课堂已结束，进度和日记已保存到 辅导/teacher/", timestamp: Date.now() },
        ]);
        return;
      }

      // Parse multi-character dialogue: "角色名：内容" → separate messages
      const charNames = ["马超", "九雀", "小华", "牢施"];
      const charSplitRE = new RegExp(`\\n(?=\\*{0,2}(${charNames.join("|")})\\*{0,2}[：:])`);
      const charPrefixRE = new RegExp(`^\\*{0,2}(${charNames.join("|")})\\*{0,2}[：:]\\s*`);
      const segments = data.reply.split(charSplitRE);
      const newMsgs: Message[] = [];

      for (const seg of segments) {
        const trimmed = seg.trim();
        if (!trimmed) continue;
        const m = trimmed.match(charPrefixRE);
        newMsgs.push({
          role: m ? m[1] : (data.professor || "马超"),
          content: m ? trimmed.slice(m[0].length).trim() || trimmed : trimmed,
          timestamp: Date.now(),
        });
      }

      setMessages((prev) => {
        const updated = [...prev, ...(newMsgs.length > 0 ? newMsgs : [{ role: data.professor || "马超", content: data.reply, timestamp: Date.now() }])];
        backupTranscript(conceptSlug, updated);
        return updated;
      });
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: "system",
        content: `错误: ${err instanceof Error ? err.message : "未知错误"}`,
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  function backupTranscript(slug: string, msgs: Message[]) {
    const concept = concepts.find((c) => c.slug === slug);
    fetch("/api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "classroom",
        conceptTitle: concept?.title || slug,
        messages: msgs,
      }),
    }).catch((err) => { console.warn("Backup failed:", err); });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const currentConcept = concepts.find((c) => c.slug === conceptSlug);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header style={{
        padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--border-color)",
        background: "var(--bg-header)", display: "flex", alignItems: "center",
        justifyContent: "space-between", flexShrink: 0,
      }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem", fontStyle: "italic" }}>
            {currentConcept?.title || "选择课程"}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: 1 }}>
            苏格拉底式教学 · DeepSeek V4 Pro
          </div>
        </div>
        <select
          className="chapter-select"
          value={conceptSlug}
          onChange={(e) => {
            setConceptSlug(e.target.value);
          }}
        >
          {concepts.length === 0 && <option value="">加载中...</option>}
          {concepts.map((c) => (
            <option key={c.slug} value={c.slug}>{c.title} ({c.professor})</option>
          ))}
        </select>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "5rem" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontStyle: "italic", color: "var(--accent)", marginBottom: "0.5rem", opacity: 0.6 }}>
              Socrates Lab
            </div>
            <p style={{ fontSize: "1rem", marginBottom: "0.35rem", color: "var(--text-primary)" }}>
              开始你的苏格拉底式学习之旅
            </p>
            <p style={{ fontSize: "0.8rem" }}>
              从知识库选择课程，或使用上方下拉框切换章节
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          const isSystem = msg.role === "system";
          if (isSystem) {
            return <div key={i} style={{ textAlign: "center", color: "#dc2626", fontSize: "0.8rem", padding: "0.5rem" }}>{msg.content}</div>;
          }
          return (
            <div key={i} className="animate-in" style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", flexDirection: isUser ? "row-reverse" : "row" }}>
              <Avatar name={msg.role} />
              <div style={{ maxWidth: 580 }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginBottom: 2, textAlign: isUser ? "right" : "left", fontWeight: 600 }}>
                  {isUser ? "我" : msg.role}
                </div>
                <div className={`msg-bubble ${isUser ? "self" : "other"}`}>
                  <Markdown>{msg.content}</Markdown>
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="animate-in" style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
            <Avatar name="马超" />
            <div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginBottom: 2, fontWeight: 600 }}>思考中</div>
              <div className="msg-bubble other" style={{ padding: "0.5rem 0.85rem" }}>
                <div className="typing-dots"><span /><span /><span /></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid var(--border-color)", background: "var(--bg-header)", display: "flex", gap: "0.5rem", flexShrink: 0 }}>
        <textarea className="chat-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="输入你的回答或问题..." disabled={loading} rows={1}
          style={{ resize: "none", minHeight: 38, maxHeight: 120 }} />
        <button className="btn-primary" onClick={() => sendMessage()} disabled={loading || !input.trim()}>发送</button>
        <button className="btn-ghost" onClick={() => sendMessage("end-class")} disabled={loading}>下课</button>
        <a href={`/quiz?concept=${conceptSlug}`} className="btn-ghost" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>自测</a>
      </div>
    </div>
  );
}
