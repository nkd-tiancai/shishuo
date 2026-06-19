import { db } from "./db";
import { chat } from "./llm-client";
import { getProviderForRole } from "./provider-store";

export async function listByLesson(userId: string, lessonId: string) {
  return db.flashcard.findMany({
    where: { userId, lessonId },
    orderBy: { createdAt: "asc" },
  });
}

export async function generateFromLesson(userId: string, lessonId: string) {
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, userId }, select: { title: true, content: true },
  });
  if (!lesson) throw new Error("课时不存在");

  const provider = await getProviderForRole(userId, "default").catch(() => null);
  if (!provider) throw new Error("请先配置 Provider");

  const result = await chat(userId, provider, [
    { role: "system", content: "从以下课程内容提取 5-10 个问答对作为闪卡。返回 JSON 数组 [{question, answer}]。问题是核心概念或关键问题，答案是简洁准确的解释。" },
    { role: "user", content: `# ${lesson.title}\n\n${lesson.content.slice(0, 6000)}` },
  ], { temperature: 0.3, maxTokens: 2048 });

  // 去掉 LLM 可能包裹的 markdown 代码块
  const cleanResult = result.replace(/```(?:json)?\s*\n?/g, "").replace(/```/g, "").trim();

  let pairs: Array<{ question: string; answer: string }>;
  try { pairs = JSON.parse(cleanResult); }
  catch { throw new Error("LLM 返回格式异常，请重试"); }

  if (!Array.isArray(pairs) || pairs.length === 0) throw new Error("未能提取闪卡");

  return db.$transaction(
    pairs.slice(0, 20).map((p) =>
      db.flashcard.create({
        data: {
          userId, lessonId,
          question: String(p.question).slice(0, 500),
          answer: String(p.answer).slice(0, 1000),
        },
      })
    )
  );
}
