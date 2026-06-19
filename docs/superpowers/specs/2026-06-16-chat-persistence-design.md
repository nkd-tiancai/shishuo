# P0 对话持久化 — 设计 Spec

> 2026-06-16 | brainstorming 输出

## 目标

聊天消息从内存-only（刷新丢失）改为数据库持久化（刷新恢复）。

## 决策记录

| 决策 | 选项 | 理由 |
|------|------|------|
| 消息粒度 | B — 逐条拆开存 | 匹配 ChatMessage 表结构，createMany 无性能差异，NDJSON 天然对应 |
| session 创建时机 | 首条消息时创建 | 不产生空 session |
| session 粒度 | userId + lessonId 唯一 | 每节课一个 session，覆盖即新对话 |
| type 值 | `"socratic"` | 最直白 |

## 数据流

```
进页面 → GET /api/sessions?lessonId=xxx
        → 有 → 恢复历史消息
        → 无 → 空白

首消息 → POST /api/socratic/respond（lessonId，无 sessionId）
        → createSession → 存用户消息+LLM逐条 → 返回 NDJSON + sessionId

后续   → POST /api/socratic/respond（sessionId）
        → 追加消息 → 返回 NDJSON
```

## 改动清单

| # | 文件 | 操作 | 关键内容 |
|---|------|------|---------|
| 1 | `lib/chat-store.ts` | 新建 | createSession(userId, lessonId, courseId?, type), getSessionByLesson(userId, lessonId), addMessages(sessionId, userId, messages[]), getMessages(sessionId, userId) |
| 2 | `app/api/socratic/respond/route.ts` | 修改 | respondSchema 加 sessionId?；首消息创建 session；存用户+LLM 消息；返回 sessionId |
| 3 | `app/api/sessions/route.ts` | 新建 | GET ?lessonId=xxx，返回 { session, messages } 或 { session: null } |
| 4 | `SocraticChatPanel.tsx` | 修改 | state 加 sessionId；useEffect 进页面 GET /api/sessions；revealNextBatch 发 sessionId；NDJSON 第一行可能含 sessionId |

## 排除

- 不做 session 列表 UI
- 不做"新对话"按钮
- 不修改 NDJSON 消息行格式（仅第一轮多返回 sessionId）

## 验收标准

1. 发消息后刷新页面，消息仍在
2. 离开课堂再回来，上次对话恢复
3. 不同课程/小节的 session 互不干扰
4. 未发消息时不创建 session
5. typecheck + test + build 全通过
