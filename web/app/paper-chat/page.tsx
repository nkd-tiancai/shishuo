"use client";

import { useState, useEffect, useRef } from "react";
import Avatar from "../components/Avatar";
import Markdown from "../components/Markdown";
import type { ChatMessage as Message } from "@/lib/types";

export default function PaperChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [paperSlug, setPaperSlug] = useState("");
  const [paperInfo, setPaperInfo] = useState<Record<string,unknown>|null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");
    if (slug) {
      setPaperSlug(slug);
      fetch("/api/library").then(r => r.json()).then(d => {
        const p = (d.papers||[]).find((x: {slug:string}) => x.slug === slug);
        if (p) setPaperInfo(p);
      }).catch((err) => { console.warn("Paper info fetch failed:", err); });
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (loading || !input.trim() || !paperSlug) return;
    setLoading(true);
    const userMsg: Message = { role: "user", content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    try {
      const history = [...messages, userMsg].map(m => `[${m.role}]: ${m.content}`).join("\n");
      const res = await fetch("/api/chat/paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperSlug, message: userMsg.content, history }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const updatedMessages = [...messages, userMsg, { role: "马超 & 九雀", content: data.reply, timestamp: Date.now() }];
      setMessages(updatedMessages);

      // Backup paper chat transcript
      fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "classroom",
          conceptTitle: `论文-${(paperInfo as Record<string,string>|null)?.title || paperSlug}`,
          messages: updatedMessages,
        }),
      }).catch((err) => { console.warn("Backup failed:", err); });
    } catch (err) {
      setMessages(prev => [...prev, { role: "system", content: `错误: ${err instanceof Error ? err.message : "未知错误"}`, timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    // Shift+Enter for newline
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header style={{
        padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--border-color)",
        background: "var(--bg-header)", display: "flex", alignItems: "center",
        justifyContent: "space-between", flexShrink: 0,
      }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem", fontStyle: "italic" }}>
            论文精读
          </div>
          {paperInfo && (
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: 2 }}>
              {(paperInfo as Record<string,string>).title} · {(paperInfo as Record<string,string>).author} ({(paperInfo as Record<string,number>).year})
            </div>
          )}
        </div>
        <a href="/library" style={{ fontSize: "0.8rem", color: "var(--accent)", textDecoration: "none" }}>← 知识库</a>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "5rem" }}>
            <div style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>📄</div>
            <p style={{ fontSize: "1rem", marginBottom: "0.35rem", color: "var(--text-primary)" }}>苏格拉底式论文精读</p>
            <p style={{ fontSize: "0.8rem" }}>马超和九雀会从数学和 ML 两个视角，用追问带你拆解这篇论文</p>
          </div>
        )}
        {messages.map((msg, i) => {
          if (msg.role === "system") return <div key={i} style={{ textAlign: "center", color: "#dc2626", fontSize: "0.8rem" }}>{msg.content}</div>;
          const isUser = msg.role === "user";
          return (
            <div key={i} className="animate-in" style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", flexDirection: isUser ? "row-reverse" : "row" }}>
              <Avatar name={msg.role} />
              <div style={{ maxWidth: 580 }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginBottom: 2, fontWeight: 600 }}>{isUser ? "我" : msg.role}</div>
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
            <div><div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginBottom: 2, fontWeight: 600 }}>思考中</div>
              <div className="msg-bubble other" style={{ padding: "0.5rem 0.85rem" }}><div className="typing-dots"><span /><span /><span /></div></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid var(--border-color)", background: "var(--bg-header)", display: "flex", gap: "0.5rem" }}>
        <textarea className="chat-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="问论文相关的问题..." disabled={loading || !paperSlug} rows={1}
          style={{ resize: "none", minHeight: 38, maxHeight: 120 }} />
        <button className="btn-primary" onClick={sendMessage} disabled={loading || !input.trim()}>发送</button>
      </div>
    </div>
  );
}
