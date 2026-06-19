/**
 * 闪卡端到端集成测试
 *
 * 覆盖：生成→持久化→评分→刷新验证→覆盖评分
 *
 * 前置条件：
 *   1. dev server 运行在 localhost:3100
 *   2. 已注册 test@test.com / test1234
 *   3. Provider 已配置 deepseek key
 *
 * 运行：npx vitest run lib/__tests__/flashcard-e2e.test.ts
 *
 * 注意：此测试依赖真实 LLM 调用，耗时 5-30 秒。
 *       仅应在部署前验证，不包含在常规 CI 中。
 */

import { describe, it, expect, beforeAll } from "vitest";

const BASE = "http://localhost:3100";
const EMAIL = "test@test.com";
const PASSWORD = "test1234";

let cookie = "";

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...opts.headers, Cookie: cookie },
  });
  const data = await res.json();
  return { res, data };
}

describe("Flashcard E2E", () => {
  beforeAll(async () => {
    // 登录获取 session cookie
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
    const { csrfToken } = await csrfRes.json() as { csrfToken: string };

    const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `csrfToken=${encodeURIComponent(csrfToken)}&email=${encodeURIComponent(EMAIL)}&password=${encodeURIComponent(PASSWORD)}`,
      redirect: "manual",
    });
    cookie = loginRes.headers.get("set-cookie") || "";
    expect(cookie).toBeTruthy();
  }, 10000);

  let lessonId: string;
  let cardId: string;

  it("step 1: 上传教材并生成课程", async () => {
    // 上传测试 md
    const form = new FormData();
    const blob = new Blob([`# 测试\n\n## 第一章\n\n测试内容。\n\n## 第二章\n\n更多测试内容。`], { type: "text/markdown" });
    form.append("file", blob, "test.md");
    const { data: doc } = await api("/api/library/upload", { method: "POST", body: form });
    expect(doc.document?.id).toBeTruthy();

    // 生成课程
    const { data: job } = await api("/api/courses/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: doc.document.id }),
    });
    expect(job.jobId).toBeTruthy();

    // 轮询等待
    let courseId = "";
    for (let i = 0; i < 30; i++) {
      const { data: status } = await api(`/api/jobs/${job.jobId}`);
      if (status.status === "COMPLETED") { courseId = status.output.courseId; break; }
      if (status.status === "FAILED") break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    expect(courseId).toBeTruthy();

    // 获取 lesson
    const { data: course } = await api(`/api/courses/${courseId}`);
    lessonId = course.lessons?.[0]?.id;
    expect(lessonId).toBeTruthy();
  }, 120000);

  it("step 2: 生成闪卡", async () => {
    const { data, res } = await api("/api/flashcards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId }),
    });
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.count).toBeGreaterThan(0);
    expect(data.flashcards).toBeInstanceOf(Array);
    cardId = data.flashcards[0].id;
    expect(cardId).toBeTruthy();
  }, 60000);

  it("step 3: 评分", async () => {
    const { res } = await api("/api/flashcards", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cardId, confidence: 5 }),
    });
    expect(res.status).toBe(200);
    const { data } = await res.json() as any;
    expect(data.ok).toBe(true);
  });

  it("step 4: 刷新验证评分持久化", async () => {
    const { data } = await api(`/api/flashcards?lessonId=${lessonId}`);
    const card = data.flashcards.find((c: any) => c.id === cardId);
    expect(card).toBeTruthy();
    expect(card.confidence).toBe(5);
    expect(card.nextReviewAt).toBeTruthy();
  });

  it("step 5: 覆盖评分并验证", async () => {
    await api("/api/flashcards", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cardId, confidence: 2 }),
    });

    const { data } = await api(`/api/flashcards?lessonId=${lessonId}`);
    const card = data.flashcards.find((c: any) => c.id === cardId);
    expect(card.confidence).toBe(2);
  });
});
