# D. 真流式改造 — Spec

## 目标
chat() → chatStream()，token 级流式，LLM 输出 NDJSON 逐行 emit。

## 决策
- LLM 输出 NDJSON（逐行 JSON），不要外层数组
- 不完整行留 buffer，不下发
- parseStreamLine 失败静默跳过，流结束无消息→fallback parseMessages

## 改动（3 文件，前端零改动）
1. socratic-prompts: JSON 数组指令 → NDJSON 指令
2. socratic-parser: 新增 parseStreamLine()
3. respond/route: chat→chatStream，增量 buffer + emit
