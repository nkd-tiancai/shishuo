# P1 课程生成异步化 — 设计 Spec

> 2026-06-16 | brainstorming 输出

## 目标

课程生成从同步阻塞改为异步，解决大文件 HTTP 超时问题。

## 决策

| 决策 | 选项 | 理由 |
|------|------|------|
| 异步方式 | B — DB Job + 轮询 | GenerationJob 表已有，断电不丢 |
| type 值 | `"course"` | 简洁 |
| input 存法 | 直接存 documentId | 简单，userId 取表字段 |
| PDF | 不做 | 无系统依赖，以后再加 |

## 数据流

```
上传 → POST /api/courses/generate { documentId }
     → createJob(userId, "course", documentId)
     → setImmediate(processJob)
     → 返回 { jobId }

前端 → GET /api/jobs/[id]（每 2s）
    → PENDING   → "等待生成..."
    → RUNNING   → "生成中..."
    → COMPLETED → { courseId, title, lessonCount } → 跳转
    → FAILED    → { error } → 提示重试

后台 → processJob：
      PENDING → RUNNING（更新 status）
      → generateCourseFromDocument(userId, documentId)
      → COMPLETED（写入 output JSON）
      或   → FAILED（写入 error）
```

## 改动清单

| # | 文件 | 操作 | 核心 |
|---|------|------|------|
| 1 | `lib/generation-store.ts` | CREATE | createJob, getJob, processJob, markRunning, markCompleted, markFailed |
| 2 | `app/api/courses/generate/route.ts` | MODIFY | 不再同步调 generateCourseFromDocument，改创建 job + setImmediate |
| 3 | `app/api/jobs/[id]/route.ts` | CREATE | GET → job status + result，userId 校验 |
| 4 | `GenerateCourseButton.tsx` | MODIFY | 生成后轮询 /api/jobs/[id]，显示状态，完成后跳转 |

## 排除

- 不做 PDF 提取
- 不做 job 队列/重试
- 不做 job 列表页
- 不做进度百分比（只有状态机）

## 验收

1. md/txt 上传后点生成 → 不超时
2. 前端显示"生成中" → 完成后自动跳转课程详情
3. 刷新页面后 job 状态不丢
4. 失败时显示错误信息
