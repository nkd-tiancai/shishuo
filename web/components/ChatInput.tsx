"use client";

import { ReactNode } from "react";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** Extra buttons rendered after the send button */
  children?: ReactNode;
}

export default function ChatInput({ value, onChange, onSend, disabled, placeholder, children }: ChatInputProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div style={{
      padding: "0.75rem 1.25rem", borderTop: "1px solid var(--border-color)",
      background: "var(--bg-header)", display: "flex", gap: "0.5rem", flexShrink: 0,
    }}>
      <textarea
        className="chat-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "输入消息..."}
        disabled={disabled}
        rows={1}
        style={{ resize: "none", minHeight: 38, maxHeight: 120 }}
      />
      <button className="btn-primary" onClick={onSend} disabled={disabled || !value.trim()}>
        发送
      </button>
      {children}
    </div>
  );
}
