# Socratopia 开发日志

> 从代码审查到全三阶段完成。2026-06-16，一个会话。

---

## 前置：112 Agent 代码审查

基于 `C:\Users\Lenovo\.claude\CLAUDE.md` 7路径框架，6 维度 × 112 代理：
- Find（30 finder）→ Verify（对抗验证，每发现 3 skeptic）→ Judge → Synthesize
- 88 已验证发现（0 critical, 3 high, 28 medium, 57 low）
- HIGH：弱密钥 / 无缓存巨型 prompt / 无流式
- → Top 10 行动项 → [审查报告](../../../Desktop/苏格拉底-代码审查修复计划.md)

---

## 第一阶段：收敛主线 + 安全加固

### 安全加固（5 项）

| 改动 | 文件 | 类型 | 说明 |
|------|------|------|------|
| 环境变量守卫 | `lib/env-guard.ts` | CREATE | 启动校验 AUTH_SECRET/APP_ENCRYPTION_KEY，拒绝弱值，低熵检测 |
| 弱密钥拒绝 | `lib/crypto.ts` | MODIFY | 删除 UTF-8 回退，强制 base64 32 字节 |
| 启动接入 | `app/layout.tsx` | MODIFY | 导入 assertEnv() |
| `.env` 密钥 | `.env` | MODIFY | openssl rand -base64 32 替换默认值 |
| 速率限制 | `lib/rate-limit.ts` | CREATE | 令牌桶：authLimiter(5/min)、llmLimiter(10/min)、configLimiter(20/min) |
| 注册限流 | `api/register/route.ts` | MODIFY | IP 维度 authLimiter |
| 登录限流 | `lib/auth.ts` | MODIFY | email 维度 authLimiter |
| Socratic 限流 | `api/socratic/respond/route.ts` | MODIFY | userId 维度 llmLimiter |
| Provider 限流 | `api/providers/route.ts` | MODIFY | userId 维度 configLimiter |
| 静默 catch | 7 个 API 路由 | MODIFY | GET 全部补 console.error，parseMessages→console.warn |
| participantProfiles bug | `api/socratic/respond/route.ts` | BUGFIX | 人物卡详情未插值→已补 |

### 体验与成本（9 项）

| 改动 | 文件 | 类型 | 说明 |
|------|------|------|------|
| LLM 客户端 | `lib/llm-client.ts` | CREATE | chat/chatStream/LRU cache/testProviderConnection |
| 代码提取 | `lib/socratic-parser.ts` | CREATE | parseMessages + fallbackMessages |
| 代码提取 | `lib/dialogue-engine.ts` | CREATE | speakerInstruction + expansionRoundCount + providerRoleForMode |
| 代码提取 | `lib/participant-formatter.ts` | CREATE | formatParticipantProfiles + formatParticipantsSummary |
| 代码提取 | `lib/socratic-prompts.ts` | CREATE | buildSystemPrompt + buildUserPrompt |
| 代码提取 | `lib/text-utils.ts` | CREATE | truncateToSentence |
| respond/route 重构 | `api/socratic/respond/route.ts` | REFACTOR | 7 种职责→6 模块，190→149 行 |
| NDJSON 流式 | `api/socratic/respond/route.ts` | FEATURE | stream:true→NDJSON, stream:false→JSON |
| 前端流式 | `SocraticChatPanel.tsx` | FEATURE | body.getReader + AbortController + 取消按钮 |
| profileForApi bug | `SocraticChatPanel.tsx` | BUGFIX | relationship 不再发全部字段 |
| prompt 精简 | `lib/socratic-prompts.ts` | OPTIMIZE | 8 行→4 行 |
| 句号截断 | `lib/text-utils.ts` | OPTIMIZE | truncateToSentence(1600) |
| 字段截断 | `lib/participant-formatter.ts` | OPTIMIZE | 每字段 slice(0,300) |

### 旧架构债务（7 项）

| 改动 | 文件 | 类型 | 说明 |
|------|------|------|------|
| web 文件缓存 | `web/lib/data-adapter.ts` | MODIFY | readAllTeacherFiles 30s TTL |
| sql.js 防抖 | `app/database.js` | MODIFY | markDirty 500ms + 原子写入 + flushSync |
| 定时器清理 | `app/main.js` | MODIFY | spawnWithRetry cleanup + before-quit flush |
| 日记写入锁 | `web/lib/state-persist.ts` | MODIFY | withLock + atomicWrite |
| Electron API key | `app/database.js` | MODIFY | AES-256-GCM 加密 deepseek/minimax |
| bcrypt | `app/database.js` | MODIFY | cost 10→12 |
| Vitest | `vitest.config.ts` + `__tests__/` | CREATE | crypto(12) + rate-limit(5)，17/17 passed |

### P0-P3：产品迭代（4 项）

**P0 对话持久化**：
| 改动 | 文件 | 类型 |
|------|------|------|
| chat-store | `lib/chat-store.ts` | CREATE |
| sessions API | `api/sessions/route.ts` | CREATE |
| respond/route | `api/socratic/respond/route.ts` | MODIFY（session 持久化） |
| SocraticChatPanel | `SocraticChatPanel.tsx` | MODIFY（历史恢复） |

> 设计：逐条存 ChatMessage，"name: content" 格式，首消息创 session，NDJSON 首轮 注入 sessionId

**P1 课程生成异步化**：
| 改动 | 文件 | 类型 |
|------|------|------|
| generation-store | `lib/generation-store.ts` | CREATE |
| courses/generate | `api/courses/generate/route.ts` | REFACTOR（同步→异步 Job） |
| jobs API | `api/jobs/[id]/route.ts` | CREATE |
| 前端轮询 | `GenerateCourseButton.tsx` | MODIFY（2s 轮询 + 跳转） |

**P2 Provider 测试**：
| 改动 | 文件 | 类型 |
|------|------|------|
| test API | `api/providers/test/route.ts` | CREATE |
| 测试按钮 | `settings/page.tsx` | MODIFY（绿色成功/红色失败） |

**P3 基础稳定性**：
| 改动 | 文件 | 类型 |
|------|------|------|
| model 必填 | `lib/provider-store.ts` | MODIFY |
| API key 覆盖确认 | `settings/page.tsx` | MODIFY |

### 第一阶段统计

| 维度 | 数值 |
|------|------|
| 新建文件 | ~18 |
| 修改文件 | ~22 |
| Bug 修复 | 3 (participantProfiles / profileForApi / body 重复) |
| 测试 | 17 passed |
| Typecheck | ✅ |

---

## 第二阶段：产品能力

### A. 人物卡系统

| 子系统 | 改动 | 文件 |
|--------|------|------|
| A1 头像 | avatarUrl 字段 + 上传 API + 图片服务 + 前端预览 | `prisma` + `api/characters/avatar` + `api/uploads/[...path]` + `CharacterCardsClient.tsx` |
| A2 导入/导出 | export/import store + API + 前端按钮 | `lib/character-store.ts` + `api/characters/export` + `api/characters/import` |
| A3 区分 | usageMode（classroom/private/both） | `prisma` + `lib/character-store.ts` + API + 前端下拉框 |
| A4 关联 | ChatSession.characterCardId | `prisma` |

### B. 课程闭环

| 子系统 | 改动 | 文件 |
|--------|------|------|
| B1 LLM 拆解 | analyzeDocumentStructure() → fallback 规则引擎 | `lib/course-store.ts` |
| B2 编辑 | PATCH/DELETE 课程 + 课时 API | `api/courses/[courseId]` + `api/lessons/[lessonId]` |
| B3 进度 | 4 态 + confidence + nextReviewAt + markLessonProgress | `prisma` + `lib/progress-store.ts` + `api/dashboard/stats` + 前端兼容 |
| B4 导出 | GET ?format=md\|json → 下载 | `api/courses/[courseId]/export` |

### C. Provider 清理

清理 settings 下拉框无用 role（groupchat/flashcard/summary）

### D. 真流式

| 改动 | 说明 |
|------|------|
| `lib/socratic-prompts.ts` | JSON 数组→"逐行输出 JSON，不要外层数组不要逗号" |
| `lib/socratic-parser.ts` | 新增 parseStreamLine() |
| `api/socratic/respond/route.ts` | chat→chatStream + buffer \n 切分 + emit + fallback |
| 前端 | 零改动（已支持 NDJSON） |

### E. 关系线

| 改动 | 文件 |
|------|------|
| CharacterRelationship 模型 | `prisma/schema.prisma` |
| Store | `lib/character-store.ts`（add/remove/list） |
| API | `api/characters/relationships/route.ts` |

### F. 闪卡

| 改动 | 文件 |
|------|------|
| flashcard-store | `lib/flashcard-store.ts`（generateFromLesson + listByLesson） |
| API | `api/flashcards/route.ts`（POST 生成 + GET 列表） |
| 复习页 | `app/flashcards/page.tsx`（翻转 + 自评 1-5） |

### 第二阶段统计

28 files · typecheck ✅ · test 17/17 ✅

---

## 第三阶段：多人与社区

### A. 速率限制持久化

| 改动 | 文件 | 说明 |
|------|------|------|
| RateLimitBucket 模型 | `prisma/schema.prisma` | key/tokens/lastRefill |
| PersistentRateLimiter | `lib/rate-limit.ts` | SQLite 实现，`RATE_LIMIT_STORE` 环境变量切换 memory/sqlite |

### B. 公共分享

| 改动 | 文件 | 说明 |
|------|------|------|
| Course 字段 | `prisma/schema.prisma` | +visibility +publishedAt |
| SharedAccess 模型 | `prisma/schema.prisma` | 邀请制分享 |
| 公开角色卡 | `api/characters/public/route.ts` | 无需登录，过滤 visibility=public |
| 公开课程 | `api/courses/public/route.ts` | status=PUBLISHED + visibility=public |
| 分享 API | `api/share/route.ts` | POST 邀请 + GET 列表 |
| 课程广场 | `app/explore/page.tsx` | 公开课程浏览 |
| publishCourse | `lib/course-store.ts` | 一键发布+公开 |

### C. 审计与权限

| 改动 | 文件 | 说明 |
|------|------|------|
| AuditLog 模型 | `prisma/schema.prisma` | userId/action/resourceType/resourceId/json/ip |
| audit-store | `lib/audit-store.ts` | logAudit() |
| JWT 禁用实时校验 | `lib/require-user.ts` | requireUser 查 user.disabledAt DB 级 |

### D. 知识库

| 改动 | 文件 | 说明 |
|------|------|------|
| kb-store | `lib/kb-store.ts` | list/create/delete |
| KB API | `api/knowledge-bases/route.ts` | GET/POST/DELETE |

### 第三阶段统计

11 files · typecheck ✅ · test 17/17 ✅

---

## 2026-06-18 — 收口补充

| # | 文件 | 修复 |
|---|------|------|
| 1 | `api/share/route.ts:26` | 补 `await configLimiter.check()` |
| 2 | `lib/provider-store.ts:88` | OR 单次查→两次查：精确 role 优先，default 兜底 |
| 3 | `prisma/schema.prisma` | Flashcard +confidence +nextReviewAt |
| 4 | `api/flashcards/route.ts` | +PATCH 评分端点 |
| 5 | `app/flashcards/page.tsx` | rate() 调用 PATCH API |
| 6 | `scripts/init-sqlite.mjs` | +Flashcard 新列迁移 |
| 7 | `web/lib/llm-router.ts` | DEEPSEEK_DEFAULT_MODEL "v4 flash"→"deepseek-v4-flash" |
| 8 | DB 迁移验证 | 新库+旧库均通过 |

| 9 | `lib/course-store.ts` | PDF 提取（pdf-parse），支持 .md/.txt/.pdf |
| 10 | `app/explore/[courseId]/page.tsx` | 公开课程只读详情页，无需登录 |
| 11 | `proxy.ts` | +/api/courses/public 路径 |
| 12 | `app/explore/page.tsx` | 链接指向公开详情页 |
| 13 | `scripts/smoke-test-flashcards.sh` | curl E2E 烟雾测试（生成→评分→刷新→覆盖） |
| 14 | `lib/__tests__/flashcard-e2e.test.ts` | Vitest 集成测试（5 步完整链路） |
| 15 | `scripts/test-lesson.md` | 测试用样例教材 |
| 16 | `vitest.config.ts` | 限制 include 避免捡到 node_modules |

验证：typecheck ✅ · test 17/17 ✅ · E2E: `npm run test:e2e`

## 2026-06-17 — 安全收口（8 项修复）

| # | 严重度 | 文件 | 问题 | 修复 |
|---|--------|------|------|------|
| 1 | 🔴 | `scripts/init-sqlite.mjs` | Schema 改了5次，初始化脚本没更新 | +4新表, +7新列, ALTER TABLE try/catch |
| 2 | 🔴 | `lib/rate-limit.ts` + 6调用处 | SQLite限流返回Promise未await，限流失效 | check()→async, 全部+await |
| 3 | 🔴 | `api/uploads/[...path]/route.ts` | 无用户归属校验 | segments[0] !== user.id → 403 |
| 4 | 🔴 | `api/characters/relationships/route.ts` | 无卡片所有权校验 | +verifyOwnership() |
| 5 | 🔴 | `api/socratic/respond/route.ts` | sessionId可跨用户污染 | getSessionByLesson校验归属 |
| 6 | 🔴 | `proxy.ts` | 公开API不在白名单 | +/api/courses/public, +/api/characters/public, +/explore |
| 7 | 🟡 | `lib/provider-store.ts` | role排序bug | 去掉role:asc |
| 8 | 🟡 | `lib/course-store.ts` | LLM拆课未接入 | buildLessons→analyzeDocumentStructure |

验证：typecheck ✅ · test 17/17 ✅ · build ✅

## 🎉 全三阶段完成

```
第一阶段  18+ files   安全+体验+债务加固+P0-P3产品迭代
第二阶段  28 files    人物卡+课程闭环+真流式+关系线+闪卡
第三阶段  11 files    限流持久化+公共分享+审计+知识库
─────────────────────────────────────────────────────
总计     ~65 files    typecheck ✅  test 17/17 ✅
```

## 验证命令

```bash
cd app/product
npm run dev          # localhost:3100
npm run typecheck    # tsc --noEmit
npm test             # vitest run
```

### Review + Simplify 修复

| 严重度 | 文件 | 问题 | 修复 |
|--------|------|------|------|
| 🔴 HIGH | `api/share/route.ts` | 无资源所有权校验，可分享他人资源 | +verifyOwnership() |
| 🔴 HIGH | `api/courses/public/route.ts` | N+1 查询（每课单独查 lessons） | `_count: { select: { lessons: true } }` |
| 🔴 HIGH | `app/explore/page.tsx` | RSC 内自 fetch 自身 API（增加延迟） | 直接调用 `db.course.findMany` |
| 🟡 MED | `api/share/route.ts` | 无限流 | +configLimiter |
| 🟡 MED | `api/courses/public/route.ts` | 无 try/catch | +错误处理 |
| 🟡 MED | `api/characters/public/route.ts` | 无 try/catch | +错误处理 |
| 🟡 MED | `lib/flashcard-store.ts` | LLM JSON 可能包裹 markdown 代码块 | +strip ``` fences |
| 🟡 MED | `lib/audit-store.ts` | JSON.stringify 可能抛异常 | +try/catch fallback |
| 🟡 MED | `lib/audit-store.ts` | DB 失败阻断主操作 | +try/catch fail-open |
| 🟡 MED | `app/flashcards/page.tsx` | 无错误状态、无 AbortController | +error state + abort |

## 文档索引

| 文档 | 路径 |
|------|------|
| P0 Spec | `docs/superpowers/specs/2026-06-16-chat-persistence-design.md` |
| P0 Plan | `docs/superpowers/plans/2026-06-16-chat-persistence-plan.md` |
| P1 Spec | `docs/superpowers/specs/2026-06-16-async-course-generation-design.md` |
| P1 Plan | `docs/superpowers/plans/2026-06-16-async-course-generation-plan.md` |
| D. Streaming Spec | `docs/superpowers/specs/2026-06-16-true-streaming-design.md` |
| P0 Dev Record | `docs/superpowers/2026-06-16-p0-chat-persistence.md` |
