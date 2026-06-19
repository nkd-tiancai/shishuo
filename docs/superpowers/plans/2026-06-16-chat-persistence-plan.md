# P0 对话持久化 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 聊天消息从内存-only 改为 Prisma 持久化，刷新恢复

**Architecture:** chat-store.ts 封装 Prisma → respond/route.ts 首消息创 session + 所有消息写库 → sessions API 读历史 → 前端恢复

**Tech Stack:** Prisma (SQLite), Next.js App Router, React, NDJSON streaming

---

## File Map

| # | File | Action | Responsibility |
|---|------|--------|----------------|
| 1 | `lib/chat-store.ts` | CREATE | Data layer: createSession, getSessionByLesson, addMessages, getMessages |
| 2 | `app/api/sessions/route.ts` | CREATE | GET ?lessonId=xxx → { session, messages } |
| 3 | `app/api/socratic/respond/route.ts` | MODIFY | + sessionId in schema, + persistence calls, + sessionId in NDJSON |
| 4 | `SocraticChatPanel.tsx` | MODIFY | + sessionId state, + useEffect recovery, + pass sessionId in fetch |

---

### Task 1: Create chat-store.ts

**Files:** Create `d:/codex/苏格拉底/app/product/lib/chat-store.ts`

- [ ] **Step 1: Write the store**

```ts
import { db } from "./db";

const SESSION_TYPE = "socratic";

export async function createSession(userId: string, lessonId: string, courseId?: string) {
  return db.chatSession.create({
    data: { userId, lessonId, courseId, type: SESSION_TYPE },
  });
}

export async function getSessionByLesson(userId: string, lessonId: string) {
  return db.chatSession.findFirst({
    where: { userId, lessonId, type: SESSION_TYPE },
    orderBy: { createdAt: "desc" },
  });
}

export async function addMessages(
  sessionId: string, userId: string,
  messages: Array<{ role: string; content: string }>,
) {
  return db.chatMessage.createMany({
    data: messages.map((m) => ({ userId, sessionId, role: m.role, content: m.content })),
  });
}

export async function getMessages(sessionId: string, userId: string) {
  return db.chatMessage.findMany({
    where: { sessionId, userId },
    orderBy: { createdAt: "asc" },
  });
}
```

- [ ] **Step 2: Verify types exist**

```bash
cd d:/codex/苏格拉底/app/product && npx prisma generate
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/product/lib/chat-store.ts
git commit -m "feat: add chat-store for session/message persistence"
```

---

### Task 2: Create GET /api/sessions

**Files:** Create `d:/codex/苏格拉底/app/product/app/api/sessions/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { getSessionByLesson, getMessages } from "@/lib/chat-store";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get("lessonId");
    if (!lessonId) {
      return NextResponse.json({ error: "缺少 lessonId" }, { status: 400 });
    }

    const session = await getSessionByLesson(user.id, lessonId);
    if (!session) {
      return NextResponse.json({ session: null, messages: [] });
    }

    const raw = await getMessages(session.id, user.id);
    const messages = raw.map((m) => {
      const idx = m.content.indexOf(": ");
      return idx > 0
        ? { id: m.id, role: m.role, name: m.content.slice(0, idx), content: m.content.slice(idx + 2) }
        : { id: m.id, role: m.role, name: "", content: m.content };
    });

    return NextResponse.json({ session: { id: session.id }, messages });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/sessions GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/product/app/api/sessions/route.ts
git commit -m "feat: add GET /api/sessions for history recovery"
```

---

### Task 3: Modify respond/route.ts

**Files:** Modify `d:/codex/苏格拉底/app/product/app/api/socratic/respond/route.ts`

- [ ] **Step 1: Add sessionId to schema + import chat-store**

Line 7 → add:
```ts
import { createSession, getSessionByLesson, addMessages } from "@/lib/chat-store";
```

Lines 31-38 → add `sessionId`:
```ts
const respondSchema = z.object({
  lessonId: z.string().min(1),
  mode: z.enum(["classroom", "mentor-private", "role-private"]),
  userMessage: z.string().trim().min(1).max(1000),
  participants: z.array(participantSchema).max(8),
  recentMessages: z.array(messageSchema).max(12),
  stream: z.boolean().optional().default(true),
  sessionId: z.string().optional(),
});
```

- [ ] **Step 2: Insert persistence logic after LLM call, before parseMessages**

After line 114 (`{ temperature: 0.7 },`), add:

```ts
    // ── 持久化 ──
    let sessionId = parsed.data.sessionId;
    if (!sessionId) {
      const existing = await getSessionByLesson(user.id, parsed.data.lessonId);
      sessionId = existing?.id ?? (await createSession(user.id, parsed.data.lessonId, lesson.course?.id)).id;
    }

    await addMessages(sessionId, user.id, [
      { role: "student", content: `我: ${parsed.data.userMessage}` },
    ]);
```

- [ ] **Step 3: Persist LLM messages + inject sessionId into NDJSON first line**

Replace lines 124-135 (the ReadableStream):

```ts
    // ── 持久化 LLM 回复 ──
    await addMessages(sessionId, user.id,
      messages.map((m) => ({ role: m.role, content: `${m.name}: ${m.content}` })),
    );

    // ── 流式：NDJSON 逐条 emit ──
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // 首轮返回 sessionId
        if (!parsed.data.sessionId) {
          controller.enqueue(encoder.encode(
            JSON.stringify({ type: "session", sessionId }) + "\n",
          ));
        }
        for (const msg of messages) {
          controller.enqueue(encoder.encode(
            JSON.stringify({ type: "message", role: msg.role, name: msg.name, content: msg.content }) + "\n",
          ));
        }
        controller.enqueue(encoder.encode(JSON.stringify({ type: "done" }) + "\n"));
        controller.close();
      },
    });
```

- [ ] **Step 4: Commit**

```bash
git add app/product/app/api/socratic/respond/route.ts
git commit -m "feat: persist messages to ChatSession/ChatMessage, return sessionId"
```

---

### Task 4: Modify SocraticChatPanel.tsx

**Files:** Modify `d:/codex/苏格拉底/app/product/app/courses/[courseId]/lessons/[lessonId]/SocraticChatPanel.tsx`

- [ ] **Step 1: Add sessionId state**

After line 189 (`const [thinking, setThinking] = useState(false);`):

```ts
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
```

- [ ] **Step 2: Add history recovery useEffect**

After the abort cleanup useEffect (lines 188-192):

```ts
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
        // 网络错误，忽略
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    }

    loadHistory();
    return () => { cancelled = true; };
  }, [lessonId]);
```

- [ ] **Step 3: Add sessionId to fetch body + handle sessionId from NDJSON**

In `revealNextBatch`, in the fetch body add sessionId:
```ts
          stream: true,
          ...(sessionId ? { sessionId } : {}),
```

And in the NDJSON reader loop, add a handler for `type: "session"` before the `type: "message"` check:
```ts
          if (event.type === "session") {
            setSessionId(event.sessionId);
            continue;
          }
```

- [ ] **Step 4: Don't show opening messages if history exists**

Modify the opening messages useEffect (line 204-210) to only fire when no history:
```ts
  useEffect(() => {
    if (!historyLoaded || messages.length > 0) return;
    const opening = buildOpeningMessages(script, importedParticipants);
    const timers = opening.map((message, index) => window.setTimeout(() => {
      setMessages((items) => [...items, message]);
    }, 350 + index * 700));
    return () => timers.forEach(window.clearTimeout);
  }, [importedParticipants, script, historyLoaded, messages.length]);
```

- [ ] **Step 5: Commit**

```bash
git add app/product/app/courses/\[courseId\]/lessons/\[lessonId\]/SocraticChatPanel.tsx
git commit -m "feat: sessionId state + history recovery + opening skip when restored"
```

---

### Task 5: Final verification

- [ ] **Step 1: Typecheck**

```bash
cd d:/codex/苏格拉底/app/product && npm run typecheck
```
Expected: no errors

- [ ] **Step 2: Tests**

```bash
cd d:/codex/苏格拉底/app/product && npm test
```
Expected: 17 passed

- [ ] **Step 3: Build**

```bash
cd d:/codex/苏格拉底/app/product && npm run build
```
Expected: successful

- [ ] **Step 4: Smoke test (with running dev server)**

```bash
# Start dev server: npm run dev
# Open browser → login → enter classroom → send message
# Refresh page → messages should still be there
# Different lesson → should have its own session
```
Expected: messages persist across page refresh

---

## Self-Review

- [x] Spec coverage: all 4 files covered, session creation/retrieval/message persistence/recovery all mapped
- [x] Placeholder scan: no TBD/TODO/fill-in-later
- [x] Type consistency: sessionId is string | null across all files; ChatRole used consistently
- [x] Message format: "name: content" stored in DB, split on read for recovery
