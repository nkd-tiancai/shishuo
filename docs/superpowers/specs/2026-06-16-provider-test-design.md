# P2 Provider 可用性保障 — Spec

> 2026-06-16 | 轻量 spec

## 目标
Provider 配置后能测试连接是否可用，不用进课堂试。

## 现状
`lib/llm-client.ts` 已有 `testProviderConnection`，但无 API，前端无法调用。

## 改动

| # | 文件 | 操作 |
|---|------|------|
| 1 | `api/providers/test/route.ts` | CREATE — POST { baseURL, apiKey, model } → testProviderConnection |
| 2 | `settings/page.tsx` | MODIFY — 每个 provider card 加"测试连接"按钮 |

## 验收
- 填好 provider 信息 → 点测试 → 显示绿色"连接成功"或红色错误
- 测试失败不影响保存
