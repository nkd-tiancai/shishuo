---
name: socratopia-web-manual
description: Socratopia Web 项目操作手册 — 如何启动、使用、维护、扩展
type: project
originSessionId: 54e8b13d-2370-4534-b624-fe69806ab946
---
# Socratopia Web 操作手册

## 1. 启动

```bash
cd d:\claude code\web
npm run dev
```

浏览器打开 http://localhost:3000

**环境要求**：Node.js v24+，`.env.local` 中配置 `DEEPSEEK_API_KEY` 和 `MINIMAX_API_KEY`

## 2. 项目结构速查

```
web/
  app/
    page.tsx              ← 课堂页面 (/)          — 对话教学
    group-chat/page.tsx    ← 群聊页面 (/group-chat) — 多角色聊天
    library/page.tsx       ← 知识库 (/library)     — 选课+上传
    components/Avatar.tsx  ← 共享头像组件
    last-studied.tsx       ← 侧边栏"上次学习"
    api/chat/route.ts      ← POST /api/chat        — 课堂 AI (DeepSeek)
    api/chat/group/route.ts ← POST /api/chat/group — 群聊 AI (MiniMax)
    api/end-class/route.ts ← POST /api/end-class   — 保存进度
    api/backup/route.ts    ← POST /api/backup      — 备份对话到文件
    api/library/route.ts   ← GET  /api/library     — 知识库数据
    api/library/upload/route.ts ← POST — 上传教材
    api/library/new-kb/route.ts ← POST — 新建子知识库
  lib/
    types.ts               ← 共享类型 + CHARACTERS 常量
    file-reader.ts          ← 读写 辅导/ 文件夹
    context-builder.ts      ← 拼装 AI system prompt
    llm-router.ts           ← DeepSeek/MiniMax 分发
    state-persist.ts        ← 写回 progress/diary
    knowledge-index.ts      ← 知识库查询
  data/
    knowledge-index.json    ← 4 个 KB + 88 节课 + 28 篇论文
```

## 3. 数据流

```
用户操作               后端处理                      持久化
────────              ────────                      ──────
知识库选课  ──→  /api/library (JSON)        ← knowledge-index.json
课堂发消息  ──→  /api/chat → context-builder ← 辅导/teacher/*.md
                                         → llm-router → DeepSeek
                                         → 回复渲染 (KaTeX)
下课       ──→  /api/end-class             → 辅导/teacher/progress.md
                                         → 辅导/teacher/diary.md
群聊发消息  ──→  /api/chat/group           → 辅导/teacher/wechat_group.md
         ──→  /api/backup (自动)           → 辅导/teacher/课堂记录/
拖入教材    ──→  /api/library/upload        → 辅导/markdown/
                                         → knowledge-index.json
```

## 4. 知识库体系（4 个子库，88 节课）

| 子库 | 课数 | 内容 |
|------|------|------|
| AI-ML基础 | 33 | 线性代数→概率论→ESL→模式识别→DL快速预览 |
| AI科学·第一卷 | 26 | 神经网络→反向传播→CNN→RNN→LSTM→Attention→Transformer |
| AI科学·第二卷 | 24 | 预训练→缩放律→GPT系列→RLHF→对齐→推理 |
| AI科学·第三卷 | 21 | VAE/GAN→扩散→多模态→MoE/Mamba→Agent→前沿 |

**教授分工**：马超（数学密集章节）、九雀（ML/DL 章节）。`马超 & 九雀` 联合授课 11 章。

**论文**：28 篇，每篇已关联到对应课程章节。

## 5. 日常使用

- **学新课**：打开 /library → 选子库 → 点课程 → 自动跳转课堂
- **继续上次**：侧边栏"上次学习"自动指向你上次学的课
- **群聊/私信**：/group-chat → 左侧选会话 → 消息自动备份到 wechat_group.md
- **拖入新教材**：/library → 拖 .md/.txt/.pdf 到上传区 → 自动索引
- **新建子知识库**：/library → 点 "+新建" → 填名称 → 拖教材进去

## 6. 常见维护

**添加新课程**：
1. 把教材 md 文件放进 `辅导/markdown/`
2. 编辑 `web/data/knowledge-index.json`，在对应子库的 `concepts` 和 `order` 中添加条目
3. 刷新 /library

**更换 API key**：
编辑 `web/.env.local`，重启 `npm run dev`

**知识索引坏了**：
删除或修复 `web/data/knowledge-index.json` 中对应条目，该文件纯 JSON 可手动编辑

**回到手动模式**：
Web 所有内容都写回了 `辅导/` 文件夹。直接打开 teacher/*.md 和 markdown/*.md，和以前一样粘贴 prompt

## 7. 已知限制

- 刷新页面后 localStorage 聊天记录不丢，但清浏览器缓存会丢（已通过 /api/backup 写入文件作为冗余）
- 课堂概念切换后旧对话保留，但不会自动加载到 AI 上下文中（每节课的 system prompt 是独立的）
- AI Science 教材是英文 EPUB 转换，部分数学公式以 Unicode 呈现而非 KaTeX 渲染
- MiniMax M2.7 偶有回复乱码（群聊场景更常见）
- 上传功能不支持批量，一次一个文件

## 8. 扩展方向（Phase 2 预留）

| 优先级 | 功能 | 难度 |
|--------|------|------|
| 高 | 论文对话模式 | 低 |
| 高 | 知识图谱可视化 | 中 |
| 中 | Graphify 知识拓扑替代 JSON 索引 | 中 |
| 中 | AI 出题自测 | 中 |
| 低 | Electron 打包 | 中 |
| 低 | 系统性错误处理 + Zod 类型验证 | 高 |
