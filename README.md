# 师说

AI 苏格拉底式教学平台 — 基于大语言模型的知识图谱驱动互动学习系统。

## 功能

- **苏格拉底式对话教学** — LLM 以追问方式引导学生，不直接给答案
- **知识图谱可视化** — React Flow 渲染概念节点 + 前置依赖边，支持搜索和社区着色
- **自动图谱生成** — DeepSeek 从教材文本提取概念关系，生成知识图谱
- **PDF/Markdown 上传解析** — pdfjs-dist 提取文本，LLM 自动打标入库
- **多角色群聊** — LLM 驱动多个角色自然对话，支持私信
- **对话自动备份** — 课堂、群聊、私信实时落盘为 Markdown
- **自测系统** — LLM 出题 + 批改，成绩存档

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Next.js 16 App Router + React 19 + TypeScript |
| 样式 | Tailwind CSS 4 + CSS 变量 |
| 图谱 | @xyflow/react (React Flow) |
| 数学 | KaTeX |
| PDF | pdfjs-dist |
| LLM | DeepSeek V4 Pro / MiniMax M2.7 |

## 项目结构

```
web/
├── app/
│   ├── page.tsx              # 课堂主页
│   ├── api/
│   │   ├── chat/             # 教学对话 API
│   │   ├── chat/group/       # 群聊 API
│   │   ├── chat/paper/       # 论文精读 API
│   │   ├── quiz/             # 自测出题/批改 API
│   │   ├── graphify/         # DeepSeek 图谱生成 API
│   │   ├── graph/            # 图谱查询 API
│   │   ├── library/          # 知识库 CRUD API
│   │   └── backup/           # 对话备份 API
│   ├── dashboard/            # 学习仪表盘
│   ├── library/              # 知识库管理
│   ├── group-chat/           # 群聊/私信
│   ├── paper-chat/           # 论文精读
│   ├── quiz/                 # 自测
│   └── graph/                # 图谱全屏页
├── components/
│   ├── KnowledgeGraph.tsx    # React Flow 图谱组件
│   └── GraphSidebar.tsx      # 节点详情侧边栏
└── lib/
    ├── llm-router.ts         # LLM 路由分发
    ├── context-builder.ts    # 教学上下文构建
    ├── graph-types.ts        # 图谱类型定义
    └── knowledge-index.ts    # 知识库索引
```

## 快速启动

**Windows 用户**：双击 `web/初始化.bat` 一键安装，然后双击 `web/启动.bat` 启动服务。

**命令行**：
```bash
cd web
cp .env.example .env.local   # 编辑填入 CONTENT_ROOT 和 API Keys
npm install
npm run dev
```
打开 http://localhost:3000

> **注意**：本项目不包含教材内容和角色数据。你需要自行准备 markdown 教材文件并配置 `知识库索引` 和 `图谱数据`。

## 致谢

本项目灵感来源于**吴乐旻**先生的知乎文章及其教育产品设计理念，在此深表感谢。

## 声明

本项目部分代码由 AI（Claude Code）辅助生成。

## License

MIT
