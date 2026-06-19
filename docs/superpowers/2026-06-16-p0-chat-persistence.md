# P0 对话持久化 — 开发记录

> 2026-06-16 | 引擎：brainstorming → writing-plans → subagent-driven-development

## 改动清单

| # | 文件 | 操作 | 行数 |
|---|------|------|------|
| 1 | `lib/chat-store.ts` | CREATE | 31 |
| 2 | `app/api/sessions/route.ts` | CREATE | 36 |
| 3 | `app/api/socratic/respond/route.ts` | MODIFY | +20 |
| 4 | `SocraticChatPanel.tsx` | MODIFY | +33 |

## 关键代码

### chat-store.ts

```ts
import { db } from "./db";

const SESSION_TYPE = "socratic";

export async function createSession(userId: string, lessonId: string, courseId?: string) {
  return db.chatSession.create({ data: { userId, lessonId, courseId, type: SESSION_TYPE } });
}

export async function getSessionByLesson(userId: string, lessonId: string) {
  return db.chatSession.findFirst({
    where: { userId, lessonId, type: SESSION_TYPE }, orderBy: { createdAt: "desc" },
  });
}

export async function addMessages(sessionId: string, userId: string, messages: Array<{ role: string; content: string }>) {
  return db.chatMessage.createMany({
    data: messages.map((m) => ({ userId, sessionId, role: m.role, content: m.content })),
  });
}

export async function getMessages(sessionId: string, userId: string) {
  return db.chatMessage.findMany({ where: { sessionId, userId }, orderBy: { createdAt: "asc" } });
}
```

### sessions API

```ts
// GET /api/sessions?lessonId=xxx → { session, messages }
export async function GET(request: NextRequest) {
  const user = await requireUser();
  const lessonId = new URL(request.url).searchParams.get("lessonId");
  if (!lessonId) return NextResponse.json({ error: "缺少 lessonId" }, { status: 400 });

  const session = await getSessionByLesson(user.id, lessonId);
  if (!session) return NextResponse.json({ session: null, messages: [] });

  const raw = await getMessages(session.id, user.id);
  const messages = raw.map((m) => {
    const idx = m.content.indexOf(": ");
    return idx > 0
      ? { id: m.id, role: m.role, name: m.content.slice(0, idx), content: m.content.slice(idx + 2) }
      : { id: m.id, role: m.role, name: "", content: m.content };
  });
  return NextResponse.json({ session: { id: session.id }, messages });
}
```

### respond/route.ts 持久化逻辑

```ts
// schema 新增
sessionId: z.string().optional(),

// LLM 调用后 → 持久化
let sessionId = parsed.data.sessionId;
if (!sessionId) {
  const existing = await getSessionByLesson(user.id, parsed.data.lessonId);
  sessionId = existing?.id ?? (await createSession(user.id, parsed.data.lessonId, lesson.course?.id)).id;
}
await addMessages(sessionId, user.id, [
  { role: "student", content: `我: ${parsed.data.userMessage}` },
]);
await addMessages(sessionId, user.id,
  messages.map((m) => ({ role: m.role, content: `${m.name}: ${m.content}` })),
);

// NDJSON 首轮注入 sessionId
if (isFirstRound) {
  controller.enqueue(JSON.stringify({ type: "session", sessionId }) + "\n");
}
```

### SocraticChatPanel.tsx

```tsx
// 新增 state
const [sessionId, setSessionId] = useState<string | null>(null);
const [historyLoaded, setHistoryLoaded] = useState(false);

// 进页面恢复历史
useEffect(() => {
  let cancelled = false;
  async function loadHistory() {
    const res = await fetch(`/api/sessions?lessonId=${lessonId}`);
    if (!res.ok || cancelled) return;
    const data = await res.json();
    if (data.session?.id) {
      setSessionId(data.session.id);
      if (data.messages?.length > 0) setMessages(/* restore */);
    }
    if (!cancelled) setHistoryLoaded(true);
  }
  loadHistory();
  return () => { cancelled = true; };
}, [lessonId]);

// 有历史消息时跳过开场白
useEffect(() => {
  if (!historyLoaded || messages.length > 0) return;
  /* show opening */
}, [importedParticipants, script, historyLoaded, messages.length]);

// fetch body 带 sessionId
...(sessionId ? { sessionId } : {}),

// NDJSON reader 处理 sessionId
if (event.type === "session") { setSessionId(event.sessionId); continue; }
```

## 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 消息粒度 | 逐条存 | 匹配 ChatMessage 表结构，createMany 无性能差异 |
| session 创建 | 首条消息时 | 不产生空 session |
| session 粒度 | userId+lessonId 唯一 | 每课一个 session |
| type 值 | "socratic" | 最直白 |
| 存储格式 | "name: content" | 一个字段存完整消息，恢复时按 ": " 拆 |

## 验证

```
✅ tsc --noEmit     — 零错误
✅ vitest run       — 17/17 passed
```

## 数据流

```
进页面 → GET /api/sessions?lessonId=xxx
       → 有 session → 恢复历史消息 → 跳过开场白
       → 无 session → 空白 + 开场白

首消息 → POST（lessonId，sessionId=空）
       → getSessionByLesson → 或 createSession
       → 存用户消息（role="student"）
       → LLM 回复 → 存逐条消息
       → NDJSON 首行 { type:"session", sessionId }
       → 前端 setSessionId

后续   → POST（sessionId 已有）
       → 追加消息，NDJSON 不再发 sessionId
```
