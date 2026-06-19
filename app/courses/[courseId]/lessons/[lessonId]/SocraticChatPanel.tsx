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

interface SocraticChatPanelProps {
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

function firstChar(value: string) {
  return value.trim().slice(0, 1);
}

function buildDefaultParticipants(): Participant[] {
  return [
    { id: "classmate-a", role: "classmate", name: "阿衡", avatar: "衡", relationship: "认真，但容易提出新问题" },
    { id: "classmate-b", role: "classmate", name: "小夏", avatar: "夏", relationship: "会替用户补充另一种理解" },
    { id: "companion", role: "companion", name: "自定义角色", avatar: "伴", relationship: "和你有情感线，会先接住情绪再回到学习" },
  ];
}

function cardsToParticipants(cards: CharacterCardParticipant[]) {
  const participants = cards
    .filter((card) => card.role === "classmate" || card.role === "companion")
    .map((card) => ({
      id: card.id,
      role: card.role as "classmate" | "companion",
      name: card.name,
      avatar: card.avatar || firstChar(card.name),
      relationship: card.relationship,
      description: card.description,
      personality: card.personality,
      scenario: card.scenario,
      firstMessage: card.firstMessage,
    }));

  return participants.length ? participants : buildDefaultParticipants();
}

function buildOpeningMessages(script: SocraticScript, participants: Participant[]) {
  const firstClassmate = participants.find((item) => item.role === "classmate");
  const messages: ChatMessage[] = [
    {
      id: "opening",
      role: "mentor",
      name: roleName("mentor"),
      avatar: avatarFor("mentor"),
      content: script.opening,
    },
  ];

  if (firstClassmate) {
    messages.push({
      id: "classmate-opening",
      role: "classmate",
      name: firstClassmate.name,
      avatar: firstClassmate.avatar || avatarFor("classmate"),
      content: firstClassmate.firstMessage || "我先试着说一版，不一定对。你也可以从最直觉的地方开始。",
    });
  }

  return messages;
}

function buildScriptedMessages(script: SocraticScript): ChatMessage[] {
  const messages: ChatMessage[] = [];
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
  });
  messages.push({
    id: "summary",
    role: "mentor",
    name: roleName("mentor"),
    avatar: avatarFor("mentor"),
    content: script.summary,
  });
  script.reflection.forEach((item, index) => {
    messages.push({
      id: `reflection-${index}`,
      role: "mentor",
      name: roleName("mentor"),
      avatar: avatarFor("mentor"),
      content: item,
    });
  });
  return messages;
}

function parseCommand(content: string, participants: Participant[]) {
  const normalized = content.trim();
  if (normalized === "正常模式" || normalized.startsWith("回到正常")) {
    return { mode: "classroom" as const };
  }

  const match = normalized.match(/^读取?(.+?)[(（]2[)）]$/);
  const targetName = match?.[1]?.trim();
  if (!targetName) return null;

  const target = participants.find((item) => item.name === targetName);
  if (!target) return null;
  return { mode: "role-private" as const, targetId: target.id };
}

export default function SocraticChatPanel({ characterCards, lessonId, lessonTitle, script }: SocraticChatPanelProps) {
  const importedParticipants = useMemo(() => cardsToParticipants(characterCards), [characterCards]);
  const scriptedMessages = useMemo(() => buildScriptedMessages(script), [script]);
  const [mode, setMode] = useState<ChatMode>("classroom");
  const [participants, setParticipants] = useState<Participant[]>(importedParticipants);
  const [activeParticipantId, setActiveParticipantId] = useState(
    importedParticipants.find((item) => item.role === "companion")?.id || importedParticipants[0]?.id || "",
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextIndex, setNextIndex] = useState(0);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 组件卸载时取消进行中的流式请求
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // 进页面时恢复历史消息
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const res = await fetch(`/api/sessions?lessonId=${lessonId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.session?.id) {
          setSessionId(data.session.id);
          if (data.messages?.length > 0) {
            const restored: ChatMessage[] = data.messages.map((m: any) => ({
              id: m.id,
              role: m.role as ChatRole,
              name: m.name || roleName(m.role as ChatRole),
              avatar: avatarFor(m.role as ChatRole),
              content: m.content,
            }));
            setMessages(restored);
          }
        }
      } catch {
        // 网络错误忽略
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    }

    loadHistory();
    return () => { cancelled = true; };
  }, [lessonId]);

  const classmates = participants.filter((item) => item.role === "classmate");
  const privateTargets = participants.filter((item) => item.role === "companion" || item.role === "classmate");
  const companion = privateTargets.find((item) => item.id === activeParticipantId) || privateTargets[0];

  useEffect(() => {
    setParticipants(importedParticipants);
    const nextActive = importedParticipants.find((item) => item.role === "companion")?.id || importedParticipants[0]?.id || "";
    setActiveParticipantId(nextActive);
  }, [importedParticipants]);

  useEffect(() => {
    if (!historyLoaded || messages.length > 0) return;
    const opening = buildOpeningMessages(script, importedParticipants);
    const timers = opening.map((message, index) => window.setTimeout(() => {
      setMessages((items) => [...items, message]);
    }, 350 + index * 700));
    return () => timers.forEach(window.clearTimeout);
  }, [importedParticipants, script, historyLoaded, messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  function updateParticipant(id: string, patch: Partial<Participant>) {
    setParticipants((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addClassmate() {
    const count = classmates.length + 1;
    setParticipants((items) => [
      ...items,
      {
        id: `classmate-${Date.now()}`,
        role: "classmate",
        name: `同学 ${count}`,
        avatar: String(count),
        relationship: "新加入课堂讨论",
      },
    ]);
  }

  function activeClassmate() {
    const index = Math.max(0, nextIndex % Math.max(1, classmates.length));
    return classmates[index] || { id: "classmate-fallback", role: "classmate" as const, name: "同学", avatar: "学", relationship: "参与课堂讨论" };
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
          content: `我先确认你的意思：你现在抓到的是“${trimmed}”。我们只沿着这一点往下追。`,
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
          content: `我听到你在想“${trimmed}”。先别急着答完，我们可以一起把它拆小。`,
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
        content: `我先接一句：你的回答里“${trimmed}”这部分，像是在找它成立的条件。`,
      },
      {
        id: `classmate-question-${Date.now()}`,
        role: "classmate" as const,
        name: classmate.name,
        avatar: classmate.avatar || avatarFor("classmate"),
        content: "那我想把问题抛远一点：如果换一个例子，这个条件还成立吗？",
      },
      first,
      second,
    ].filter(Boolean) as ChatMessage[];
  }

  function appendMessage(message: ChatMessage) {
    setMessages((items) => [...items, message]);
  }

  async function revealNextBatch(userAnswer: string) {
    setThinking(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/socratic/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          mode,
          userMessage: userAnswer,
          participants: participants.map((item) => ({
            name: item.name,
            role: item.role,
            relationship: item.relationship,
            description: item.description,
            personality: item.personality,
            scenario: item.scenario,
            firstMessage: item.firstMessage,
          })),
          recentMessages: messages.slice(-10).map(({ name, role, content }) => ({ name, role, content })),
          ...(sessionId ? { sessionId } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        appendMessage({
          id: `provider-error-${Date.now()}`,
          role: "system",
          name: roleName("system"),
          avatar: avatarFor("system"),
          content: data.error || "课堂回应生成失败，请检查 Provider 设置。",
        });
        setThinking(false);
        return;
      }

      // ── 流式读取 NDJSON ──
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let hasMessages = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // 保留未完成的行

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "session") {
              setSessionId(event.sessionId);
              continue;
            }
            if (event.type === "message") {
              hasMessages = true;
              const role: ChatRole =
                event.role === "classmate" || event.role === "companion" || event.role === "mentor"
                  ? event.role
                  : "mentor";
              const matched = participants.find((p) => p.name === event.name);
              appendMessage({
                id: `api-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                role,
                name: typeof event.name === "string" ? event.name : roleName(role),
                avatar: matched?.avatar || avatarFor(role),
                content: typeof event.content === "string" ? event.content : "",
              });
            } else if (event.type === "error") {
              appendMessage({
                id: `stream-error-${Date.now()}`,
                role: "system",
                name: roleName("system"),
                avatar: avatarFor("system"),
                content: event.error || "生成课堂回应失败",
              });
            }
            // type === "done" — 忽略
          } catch {
            // 单行 JSON 解析失败，跳过
          }
        }
      }

      if (!hasMessages) {
        const fallback = localFallbackBatch(userAnswer);
        fallback.forEach((msg) => appendMessage(msg));
      }

      setNextIndex((index) => Math.min(index + 2, scriptedMessages.length));
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        appendMessage({
          id: `abort-${Date.now()}`,
          role: "system",
          name: roleName("system"),
          avatar: avatarFor("system"),
          content: "已取消本次请求。",
        });
      } else {
        appendMessage({
          id: `provider-network-${Date.now()}`,
          role: "system",
          name: roleName("system"),
          avatar: avatarFor("system"),
          content: "无法连接课堂回应 API。请检查本地服务或 Provider 配置。",
        });
      }
    } finally {
      setThinking(false);
      abortRef.current = null;
    }
  }

  function switchMode(nextMode: ChatMode, targetId?: string) {
    setMode(nextMode);
    if (targetId) setActiveParticipantId(targetId);
    const modeName = nextMode === "classroom" ? "课堂群聊" : nextMode === "mentor-private" ? "导师私聊" : "角色私聊";
    setMessages((items) => [
      ...items,
      {
        id: `mode-${Date.now()}`,
        role: "system",
        name: roleName("system"),
        avatar: avatarFor("system"),
        content: `已切换到${modeName}。`,
      },
    ]);
  }

  function sendMessage() {
    const content = input.trim();
    if (!content || thinking) return;

    const command = parseCommand(content, participants);
    if (command) {
      setInput("");
      switchMode(command.mode, command.targetId);
      return;
    }

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
                aria-label="同学名称"
                value={participant.name}
                onChange={(event) => updateParticipant(participant.id, { name: event.target.value })}
              />
            </label>
          ))}
          <button className="button secondary compact-button" type="button" onClick={addClassmate}>添加同学</button>
        </div>
        {companion && (
          <div className="roster-section">
            <span className="pill">私聊对象</span>
            <label className="roster-chip">
              <span className="chat-avatar small companion">{companion.avatar}</span>
              <select
                aria-label="私聊对象"
                value={companion.id}
                onChange={(event) => setActiveParticipantId(event.target.value)}
              >
                {privateTargets.map((target) => (
                  <option key={target.id} value={target.id}>{target.name}</option>
                ))}
              </select>
            </label>
            <input
              aria-label="角色关系"
              className="relationship-input"
              value={companion.relationship}
              onChange={(event) => updateParticipant(companion.id, { relationship: event.target.value })}
            />
          </div>
        )}
      </div>

      <div className="chat-transcript" aria-live="polite">
        {messages.map((message) => (
          <div className={`chat-row ${message.role}`} key={message.id}>
            {message.role !== "system" && <div className="chat-avatar" aria-hidden="true">{message.avatar}</div>}
            <div className="chat-message-block">
              {message.role !== "system" && <div className="chat-name">{message.name}</div>}
              <div className="chat-bubble">{message.content}</div>
            </div>
          </div>
        ))}
        {thinking && (
          <>
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
            <div className="cancel-row">
              <button
                className="button secondary compact-button"
                type="button"
                onClick={() => abortRef.current?.abort()}
              >
                取消回复
              </button>
            </div>
          </>
        )}
        <div ref={endRef} />
      </div>

      <div className="chat-composer">
        <textarea
          rows={1}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={finished ? "这一轮已经结束，可以写下你的复盘。" : "用自己的话回应课堂..."}
        />
        <button className="button" disabled={!input.trim() || thinking} type="button" onClick={sendMessage}>
          发送
        </button>
      </div>
    </div>
  );
}
