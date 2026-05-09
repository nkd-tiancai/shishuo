"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage as ChatMsgType } from "@/lib/types";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";

export default function GroupChatPage() {
  const storageKey = "socratopia-groupchat-messages";
  const [allMessages, setAllMessages] = useState<Record<string, ChatMsgType[]>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { return {}; }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeChat, setActiveChat] = useState<
    "group" | "private-laoshi" | "private-xiaohua"
  >("group");
  const messages = allMessages[activeChat] || [];
  const activeChatRef = useRef(activeChat);
  activeChatRef.current = activeChat;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function setMessages(next: ChatMsgType[] | ((prev: ChatMsgType[]) => ChatMsgType[])) {
    setAllMessages((all) => {
      const current = all[activeChat] || [];
      const updated = { ...all, [activeChat]: typeof next === "function" ? next(current) : next };
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Display messages one character at a time with delay
  async function displaySequentially(lines: string[]) {
    for (const line of lines) {
      const match = line.match(/^\[(.+?)\]:\s*(.+)/);
      if (!match) continue;
      setMessages((prev) => [
        ...prev,
        { role: match[1], content: match[2], timestamp: Date.now() },
      ]);
      await new Promise((r) => setTimeout(r, 700));
    }
  }

  async function sendGroupMessage() {
    if (!input.trim()) return;
    setLoading(true);

    const userMsg: ChatMsgType = {
      role: "user",
      content: input,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      const history = [...messages, userMsg]
        .map((m) => `[${m.role}]: ${m.content}`)
        .join("\n");

      // Determine mode and target character
      const mode = activeChat.startsWith("private") ? "private" : "group";
      let targetCharacter = "";
      if (activeChat === "private-laoshi") targetCharacter = "牢施";
      else if (activeChat === "private-xiaohua") targetCharacter = "小华";

      const res = await fetch("/api/chat/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.content,
          history,
          mode,
          targetCharacter,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const lines = data.reply.split("\n").filter(Boolean);
      // Sequential display — one character at a time, then backup
      displaySequentially(lines).then(() => {
        setAllMessages((all) => {
          const msgs = all[activeChatRef.current] || [];
          const backupType = "groupchat";
          const target = activeChatRef.current === "private-laoshi" ? "牢施"
            : activeChatRef.current === "private-xiaohua" ? "小华" : "";
          fetch("/api/backup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: backupType, messages: msgs, targetCharacter: target }),
          }).catch((err) => { console.warn("Backup failed:", err); });
          return all;
        });
      });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: `错误: ${err instanceof Error ? err.message : "未知错误"}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const chatLabels: Record<string, string> = {
    group: "群聊 · 苏格拉底实验室",
    "private-laoshi": "私信 · 牢施",
    "private-xiaohua": "私信 · 小华",
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Chat list sidebar */}
      <div
        style={{
          width: 190,
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-color)",
          padding: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.2rem",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "0.85rem",
            color: "var(--accent)",
            marginBottom: "0.5rem",
            padding: "0.25rem 0.5rem",
            fontStyle: "italic",
          }}
        >
          消息
        </div>
        {Object.entries(chatLabels).map(([key, label]) => (
          <div
            key={key}
            className={`chat-list-item ${activeChat === key ? "active" : ""}`}
            onClick={() => setActiveChat(key as typeof activeChat)}
            style={{ opacity: activeChat === key ? 1 : 0.55 }}
          >
            {label}
          </div>
        ))}
        <div style={{ marginTop: "auto", fontSize: "0.6rem", color: "var(--text-muted)", textAlign: "center", paddingTop: "0.5rem", borderTop: "1px solid var(--border-light)", opacity: 0.7 }}>
          MiniMax M2.7
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-main)" }}>
        {/* Header */}
        <header
          style={{
            padding: "0.75rem 1.25rem",
            borderBottom: "1px solid var(--border-color)",
            background: "var(--bg-header)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexShrink: 0,
          }}
        >
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem", fontStyle: "italic" }}>
            {chatLabels[activeChat]}
          </span>
          {activeChat === "group" ? (
            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", background: "var(--bg-hover)", padding: "0.15rem 0.5rem", borderRadius: 99 }}>
              4人
            </span>
          ) : (
            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", background: "var(--bg-hover)", padding: "0.15rem 0.5rem", borderRadius: 99 }}>
              私密
            </span>
          )}
        </header>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {messages.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "4rem", fontSize: "0.85rem" }}>
              {activeChat.startsWith("private")
                ? `和${activeChat === "private-laoshi" ? "牢施" : "小华"}的私密对话 — 只有你们两个人能看到`
                : "课后群聊 — 和大家聊聊今天的课吧"}
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatMessage key={i} role={msg.role} content={msg.content} index={i} compact />
          ))}

          {loading && (
            <div className="animate-in" style={{ display: "flex", gap: "0.4rem", alignItems: "flex-start" }}>
              <div>
                <div className="msg-bubble other" style={{ padding: "0.35rem 0.65rem" }}>
                  <div className="typing-dots"><span /><span /><span /></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <ChatInput value={input} onChange={setInput} onSend={sendGroupMessage}
          disabled={loading} placeholder={activeChat.startsWith("private") ? "私密消息..." : "输入消息..."} />
      </div>
    </div>
  );
}
