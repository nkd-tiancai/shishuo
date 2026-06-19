# P1 课程生成异步化 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development

**Goal:** 课程生成从同步阻塞改为 DB Job + 轮询

**Architecture:** generation-store 封装 Job CRUD + processJob → API 建 job 后 setImmediate 触发 → 前端轮询状态

**Tech Stack:** Prisma, Next.js App Router, React

---

### Task 1: generation-store.ts

**Files:** Create `d:/codex/苏格拉底/app/product/lib/generation-store.ts`

```ts
import { db } from "./db";
import { generateCourseFromDocument } from "./course-store";

export async function createJob(userId: string, type: string, documentId: string) {
  return db.generationJob.create({
    data: { userId, type, input: documentId, status: "PENDING" },
  });
}

export async function getJob(jobId: string, userId: string) {
  return db.generationJob.findFirst({
    where: { id: jobId, userId },
    select: { id: true, type: true, status: true, output: true, error: true, createdAt: true },
  });
}

async function markRunning(jobId: string) {
  return db.generationJob.update({ where: { id: jobId }, data: { status: "RUNNING" } });
}

async function markCompleted(jobId: string, output: string) {
  return db.generationJob.update({ where: { id: jobId }, data: { status: "COMPLETED", output } });
}

async function markFailed(jobId: string, error: string) {
  return db.generationJob.update({ where: { id: jobId }, data: { status: "FAILED", error } });
}

export async function processJob(jobId: string, userId: string) {
  try {
    await markRunning(jobId);
    const course = await generateCourseFromDocument(userId, await getDocumentId(jobId, userId));
    await markCompleted(jobId, JSON.stringify({
      courseId: course.id, title: course.title, lessonCount: course.lessonCount,
    }));
  } catch (e) {
    await markFailed(jobId, e instanceof Error ? e.message : "课程生成失败");
  }
}

async function getDocumentId(jobId: string, userId: string) {
  const job = await db.generationJob.findFirst({ where: { id: jobId, userId }, select: { input: true } });
  if (!job) throw new Error("Job not found");
  return job.input;
}
```

---

### Task 2: courses/generate/route.ts

**Files:** Modify `d:/codex/苏格拉底/app/product/app/api/courses/generate/route.ts`

Replace the whole POST handler: 移除 `generateCourseFromDocument` 导入，改为 `createJob` + `setImmediate(processJob)`：

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { createJob, processJob } from "@/lib/generation-store";

const generateSchema = z.object({ documentId: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "缺少教材 ID" }, { status: 400 });
    }

    const job = await createJob(user.id, "course", parsed.data.documentId);
    setImmediate(() => { processJob(job.id, user.id); });

    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/courses/generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成课程失败" },
      { status: 400 },
    );
  }
}
```

---

### Task 3: jobs/[id]/route.ts

**Files:** Create `d:/codex/苏格拉底/app/product/app/api/jobs/[id]/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { getJob } from "@/lib/generation-store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const job = await getJob(id, user.id);

    if (!job) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    const result: Record<string, unknown> = {
      status: job.status,
      createdAt: job.createdAt,
    };

    if (job.output) result.output = JSON.parse(job.output);
    if (job.error) result.error = job.error;

    return NextResponse.json(result);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/jobs/[id] GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

---

### Task 4: GenerateCourseButton.tsx

**Files:** Modify `d:/codex/苏格拉底/app/product/app/library/GenerateCourseButton.tsx`

改为：点生成 → 得 jobId → 轮询 GET /api/jobs/[id] → 完成跳转：

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";

export default function GenerateCourseButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  async function pollJob(jobId: string) {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) return;
    const data = await res.json();

    if (data.status === "COMPLETED") {
      stopPolling();
      setBusy(false);
      if (data.output?.courseId) {
        router.push(`/courses/${data.output.courseId}`);
        router.refresh();
      }
    } else if (data.status === "FAILED") {
      stopPolling();
      setBusy(false);
      setError(data.error || "生成失败");
    } else {
      setStatus(data.status === "RUNNING" ? "生成中..." : "等待生成...");
    }
  }

  async function generate() {
    setBusy(true);
    setError("");
    setStatus("等待生成...");

    const response = await fetch("/api/courses/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setBusy(false);
      setError(data.error || "生成失败");
      return;
    }

    timerRef.current = setInterval(() => { pollJob(data.jobId); }, 2000);
    pollJob(data.jobId);
  }

  return (
    <div className="stack">
      <button className="button secondary" disabled={busy} type="button" onClick={generate}>
        {busy ? status || "生成中..." : "生成课程"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

---

### Task 5: Verification

```bash
cd d:/codex/苏格拉底/app/product
npm run typecheck   # Expected: 0 errors
npm test            # Expected: 17 passed
npm run build       # Expected: success
```
