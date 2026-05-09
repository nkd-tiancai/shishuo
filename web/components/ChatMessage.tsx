"use client";

import Avatar from "@/app/components/Avatar";
import Markdown from "@/app/components/Markdown";

interface ChatMessageProps {
  role: string;
  content: string;
  index: number;
  useMarkdown?: boolean;
  compact?: boolean;
}

export default function ChatMessage({ role, content, index, useMarkdown, compact }: ChatMessageProps) {
  const isUser = role === "user";
  const isSystem = role === "system";

  if (isSystem) {
    return (
      <div key={index} style={{ textAlign: "center", color: "#dc2626", fontSize: compact ? "0.72rem" : "0.8rem" }}>
        {content}
      </div>
    );
  }

  return (
    <div
      className="animate-in"
      style={{
        display: "flex", gap: compact ? "0.4rem" : "0.6rem", alignItems: "flex-start",
        flexDirection: isUser ? "row-reverse" : "row",
      }}
    >
      <Avatar name={role} size={compact ? "sm" : undefined} />
      <div style={{ maxWidth: compact ? 360 : 580 }}>
        <div style={{
          fontSize: compact ? "0.65rem" : "0.7rem", color: "var(--text-secondary)", marginBottom: 1,
          textAlign: isUser ? "right" : "left", fontWeight: 600,
        }}>
          {isUser ? "我" : role}
        </div>
        <div
          className="msg-bubble"
          style={{
            background: isUser ? "var(--bg-self-msg)" : "var(--bg-card)",
            borderRadius: isUser ? "6px 0 6px 6px" : "0 6px 6px 6px",
            padding: compact ? "0.4rem 0.65rem" : undefined,
            fontSize: compact ? "0.8rem" : undefined,
          }}
        >
          {useMarkdown ? <Markdown>{content}</Markdown> : content}
        </div>
      </div>
    </div>
  );
}
