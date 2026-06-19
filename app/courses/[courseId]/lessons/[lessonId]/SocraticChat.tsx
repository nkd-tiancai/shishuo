"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SocraticScript } from "@/lib/socratic-script";

type ChatRole = "mentor" | "student" | "classmate" | "companion" | "system";
type ChatMode = "classroom" | "mentor-private" | "role-private";

interface ChatMessage {
  id: string;
  role: ChatRole;
  name: string;
  avatar: string;
  content: string;
}

interface Participant {
  id: string;
  role: "classmate" | "companion";
  name: string;
  avatar: string;
  relationship: string;
  description?: string;
  personality?: string;
  scenario?: string;
  firstMessage?: string;
}

interface CharacterCardParticipant {
  id: string;
  role: string;
  name: string;
  avatar: string;
  relationship: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  isTeacher: boolean;
}

interface ApiChatMessage {
  role?: unknown;
  name?: unknown;
  content?: unknown;
}

interface SocraticChatProps {
  characterCards: CharacterCardParticipant[];
  lessonId: string;
  lessonTitle: string;
  script: SocraticScript;
}

function roleName(role: ChatRole) {
  if (role === "mentor") return "苏格拉底导师";
  if (role === "classmate") return "同学";
  if (role === "companion") return "角色";
  if (role === "student") return "我";
  return "系统";
}

function avatarFor(role: ChatRole) {
  if (role === "mentor") return "导";
  if (role === "classmate") return "学";
  if (role === "companion") return "伴";
  if (role === "student") return "我";
  return "记";
}

function buildMentorMessages(script: SocraticScript): ChatMessage[] {
  const messages: ChatMessage[] = [
    {
      id: "opening",
      role: "mentor",
      name: roleName("mentor"),
      avatar: avatarFor("mentor"),
      content: script.opening,
    },
    {
      id: "classmate-opening",
      role: "classmate",
      name: "同学",
      avatar: avatarFor("classmate"),
      content: "我会先试着说一版，不一定对。你也可以从最直觉的地方开始。",
    },
  ];

  script.prompts.forEach((prompt, index) => {
    messages.push({
      id: `prompt-${index}-question`,
      role: "mentor",
      name: roleName("mentor"),
      avatar: avatarFor("mentor"),
      content: prompt.question,
    });
    messages.push({
      id: `prompt-${index}-hint`,
      role: "mentor",
      name: roleName("mentor"),
      avatar: avatarFor("mentor"),
      content: prompt.hint,
    });
    if (index === 1 || index === 3) {
      messages.push({
        id: `prompt-${index}-classmate`,
        role: "classmate",
        name: "同学",
        avatar: avatarFor("classmate"),
        content: index === 1
          ? "我有点卡在“前提”这里。是不是要先说它想解决什么问题？"
          : "反例这里挺难的，我会先找一个边界条件试试。",
      });
    }
  });

  messages.push({
    id: "summary",
    role: "mentor",
    name: roleName("mentor"),
    avatar: avatarFor("mentor"),
    content: script.summary,
  });
  for (const [index, item] of script.reflection.entries()) {
    messages.push({
      id: `reflection-${index}`,
      role: "mentor",
      name: roleName("mentor"),
      avatar: avatarFor("mentor"),
      content: item,
    });
  }

  return messages;
}

export default function SocraticChat({ lessonId, lessonTitle, script }: SocraticChatProps) {
  const scriptedMessages = useMemo(() => buildMentorMessages(script), [script]);
  const [mode, setMode] = useState<ChatMode>("classroom");
  const [participants, setParticipants] = useState<Participant[]>([
    { id: "classmate-a", role: "classmate", name: "阿衡", avatar: "衡", relationship: "认真但容易跑出新问题" },
    { id: "classmate-b", role: "classmate", name: "小夏", avatar: "夏", relationship: "会替用户补充另一种理解" },
    { id: "companion", role: "companion", name: "自定义角色", avatar: "伴", relationship: "和你有情感线，会先接住情绪再回到学习" },
  ]);
  const [activeParticipantId, setActiveParticipantId] = useState("companion");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextIndex, setNextIndex] = useState(0);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const classmates = participants.filter((item) => item.role === "classmate");
  const companion = participants.find((item) => item.id === activeParticipantId) || participants.find((item) => item.role === "companion");

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setMessages([scriptedMessages[0]]), 350),
      window.setTimeout(() => {
        setMessages((items) => [...items, scriptedMessages[1]]);
        setNextIndex(2);
      }, 1100),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [scriptedMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  function activeClassmate() {
    const index = Math.max(0, (nextIndex - 2) % Math.max(1, classmates.length));
    return classmates[index] || { id: "classmate-fallback", role: "classmate" as const, name: "同学", avatar: "学", relationship: "参与课堂讨论" };
  }

  function updateParticipant(id: string, patch: Partial<Participant>) {
    setParticipants((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addClassmate() {
    const count = classmates.length + 1;
    const name = `同学 ${count}`;
    setParticipants((items) => [
      ...items,
      {
        id: `classmate-${Date.now()}`,
        role: "classmate",
        name,
        avatar: String(count),
        relationship: "新加入课堂讨论",
      },
    ]);
  }

  function localFallbackBatch(userAnswer: string) {
    const first = scriptedMessages[nextIndex];
    const second = scriptedMessages[nextIndex + 1];
    const trimmed = userAnswer.length > 42 ? `${userAnswer.slice(0, 42)}...` : userAnswer;

    if (mode === "mentor-private") {
      return [
        {
          id: `mentor-ack-${Date.now()}`,
          role: "mentor" as const,
          name: roleName("mentor"),
          avatar: avatarFor("mentor"),
          content: `我先确认你的意思：你现在抓到的是「${trimmed}」。我们只沿着这一点往下追。`,
        },
        first,
        second,
      ].filter(Boolean) as ChatMessage[];
    }

    if (mode === "role-private" && companion) {
      return [
        {
          id: `companion-${Date.now()}`,
          role: "companion" as const,
          name: companion.name,
          avatar: companion.avatar || avatarFor("companion"),
          content: `我听到你在想「${trimmed}」。先别急着答完，我们可以一起把它拆小。`,
        },
        {
          id: `companion-question-${Date.now()}`,
          role: "companion" as const,
          name: companion.name,
          avatar: companion.avatar || avatarFor("companion"),
          content: "如果顺着这个想法多走一步，你最想先确认哪件事？",
        },
        first,
      ].filter(Boolean) as ChatMessage[];
    }

    const classmate = activeClassmate();
    return [
      {
        id: `classmate-answer-${Date.now()}`,
        role: "classmate" as const,
        name: classmate.name,
        avatar: classmate.avatar || avatarFor("classmate"),
        content: `我可以先接一句：你的回答里「${trimmed}」这部分，像是在找它的条件。`,
      },
      {
        id: `classmate-question-${Date.now()}`,
        role: "classmate" as const,
        name: classmate.name,
        avatar: classmate.avatar || avatarFor("classmate"),
        content: "那我想把问题再抛远一点：如果换一个例子，这个条件还成立吗？",
      },
      first,
      second,
    ].filter(Boolean) as ChatMessage[];
  }

  function appendWithDelay(batch: ChatMessage[]) {
    if (!batch.length) {
      setThinking(false);
      return;
    }
    batch.forEach((message, index) => {
      window.setTimeout(() => {
        setMessages((items) => [...items, message]);
        if (index === batch.length - 1) {
          setThinking(false);
        }
      }, 550 + index * 650);
    });
  }

  async function revealNextBatch(userAnswer: string) {
    setThinking(true);
    try {
      const response = await fetch("/api/socratic/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          mode,
          userMessage: userAnswer,
          participants: participants.map(({ name, role, relationship }) => ({ name, role, relationship })),
          recentMessages: messages.slice(-10).map(({ name, role, content }) => ({ name, role, content })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        appendWithDelay([
          {
            id: `provider-error-${Date.now()}`,
            role: "system",
            name: "系统",
            avatar: avatarFor("system"),
            content: data.error || "课堂回应生成失败，请检查 Provider 设置。",
          },
        ]);
        return;
      }

      const apiMessages: ApiChatMessage[] = Array.isArray(data.messages) ? data.messages : [];
      const batch = apiMessages.map((item: ApiChatMessage, index: number) => {
        const role: ChatRole = item.role === "classmate" || item.role === "companion" || item.role === "mentor"
          ? item.role
          : "mentor";
        return {
          id: `api-${Date.now()}-${index}`,
          role,
          name: typeof item.name === "string" ? item.name : roleName(role),
          avatar: avatarFor(role),
          content: typeof item.content === "string" ? item.content : "",
        };
      }).filter((item: ChatMessage) => item.content);

      appendWithDelay(batch.length ? batch : localFallbackBatch(userAnswer));
    } catch {
      appendWithDelay([
        {
          id: `provider-network-${Date.now()}`,
          role: "system",
          name: "系统",
          avatar: avatarFor("system"),
          content: "无法连接课堂回应 API。请检查本地服务或 Provider 配置。",
        },
      ]);
    }
  }

  function switchMode(nextMode: ChatMode) {
    setMode(nextMode);
    const modeName =
      nextMode === "classroom" ? "课堂群聊" : nextMode === "mentor-private" ? "导师私聊" : "角色私聊";
    setMessages((items) => [
      ...items,
      {
        id: `mode-${Date.now()}`,
        role: "system",
        name: "系统",
        avatar: avatarFor("system"),
        content: `已切换到${modeName}。老师仍会在合适的时候把讨论拉回本节内容。`,
      }
    ]);
  }

  function sendMessage() {
    const content = input.trim();
    if (!content) return;
    setMessages((items) => [
      ...items,
      {
        id: `student-${Date.now()}`,
        role: "student",
        name: roleName("student"),
        avatar: avatarFor("student"),
        content,
      },
    ]);
    setInput("");
    void revealNextBatch(content);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  const finished = nextIndex >= scriptedMessages.length;

  return (
    <div className="chat-study">
      <div className="chat-study-header">
        <div>
          <p className="eyebrow">Dialogue Mode</p>
          <h2>{lessonTitle}</h2>
        </div>
        <div className="chat-mode-tabs" aria-label="聊天模式">
          <button className={mode === "classroom" ? "active" : ""} type="button" onClick={() => switchMode("classroom")}>课堂群聊</button>
          <button className={mode === "mentor-private" ? "active" : ""} type="button" onClick={() => switchMode("mentor-private")}>导师私聊</button>
          <button className={mode === "role-private" ? "active" : ""} type="button" onClick={() => switchMode("role-private")}>角色私聊</button>
        </div>
      </div>

      <div className="chat-roster">
        <div className="roster-section">
          <span className="pill">同学</span>
          {classmates.map((participant) => (
            <label className="roster-chip" key={participant.id}>
              <span className="chat-avatar small">{participant.avatar}</span>
              <input
                value={participant.name}
                onChange={(event) => updateParticipant(participant.id, { name: event.target.value })}
                aria-label="同学名称"
              />
            </label>
          ))}
          <button className="button secondary compact-button" type="button" onClick={addClassmate}>添加同学</button>
        </div>
        {companion && (
          <div className="roster-section">
            <span className="pill">我的角色</span>
            <label className="roster-chip">
              <span className="chat-avatar small companion">{companion.avatar}</span>
              <input
                value={companion.name}
                onChange={(event) => updateParticipant(companion.id, { name: event.target.value })}
                aria-label="角色名称"
              />
            </label>
            <input
              className="relationship-input"
              value={companion.relationship}
              onChange={(event) => updateParticipant(companion.id, { relationship: event.target.value })}
              aria-label="角色关系"
            />
          </div>
        )}
      </div>

      <div className="chat-transcript" aria-live="polite">
        {messages.map((message) => (
          <div className={`chat-row ${message.role}`} key={message.id}>
            {message.role === "system" ? null : (
              <div className="chat-avatar" aria-hidden="true">{message.avatar}</div>
            )}
            <div className="chat-message-block">
              {message.role !== "system" && <div className="chat-name">{message.name}</div>}
              <div className="chat-bubble">{message.content}</div>
            </div>
          </div>
        ))}
        {thinking && (
          <div className="chat-row mentor">
            <div className="chat-avatar" aria-hidden="true">导</div>
            <div className="chat-message-block">
              <div className="chat-name">苏格拉底导师</div>
              <div className="chat-bubble typing-bubble">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="chat-composer">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={finished ? "这一轮已经结束，可以写下你的复盘。" : "用自己的话回答导师的问题..."}
          rows={1}
        />
        <button className="button" disabled={!input.trim()} type="button" onClick={sendMessage}>
          发送
        </button>
      </div>
    </div>
  );
}
