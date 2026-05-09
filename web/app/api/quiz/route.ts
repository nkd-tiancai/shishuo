import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/llm-router";
import { readTextbookChapter } from "@/lib/file-reader";
import knowledgeData from "@/data/knowledge-index.json";
import fs from "fs/promises";
import path from "path";
import { pathOrThrow } from "@/lib/env";

function findConceptAnyKB(slug: string) {
  const kbs = knowledgeData.knowledgeBases as Record<string, { concepts: Record<string, unknown> }>;
  for (const kb of Object.values(kbs)) {
    if (kb.concepts[slug]) return kb.concepts[slug] as Record<string, unknown>;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conceptSlug, action = "generate", userAnswers, history = "" } = body as {
      conceptSlug: string;
      action?: "generate" | "grade";
      userAnswers?: string;
      history?: string;
    };

    const concept = findConceptAnyKB(conceptSlug);
    if (!concept) {
      return NextResponse.json({ error: "Concept not found" }, { status: 404 });
    }

    const chapterContent = await readTextbookChapter(concept.file as string);
    // Extract exercise section if exists
    const exerciseMatch = chapterContent.match(/##?\s*Exercises?[\s\S]{100,}/i);
    const exerciseContent = exerciseMatch ? exerciseMatch[0].slice(0, 3000) : chapterContent.slice(-3000);

    if (action === "generate") {
      const prompt = `你是苏格拉底式教学的出题官。基于以下教材内容生成3道习题。

## 教材内容
${exerciseContent}

## 要求
1. 3道题由易到难：基础概念题、推导计算题、开放思考题
2. 用中文出题，数学公式用 KaTeX 格式
3. 每题后标注分值（基础3分、推导4分、思考3分，共10分）
4. 格式：
**第1题 (3分)** [题目描述]
**第2题 (4分)** [题目描述]
**第3题 (3分)** [题目描述]

## 之前的出题历史
${history}`;

      const reply = await chat("deepseek", [{ role: "system", content: prompt }], { temperature: 0.8, maxTokens: 2048 });
      return NextResponse.json({ questions: reply });
    }

    if (action === "grade") {
      const prompt = `你是苏格拉底式教学的批卷官。请批改以下答案。

## 参考答案依据
${exerciseContent}

## 学生答案
${userAnswers}

## 要求
1. 每题给出得分和简要批语
2. 总分/10
3. 指出最需要加强的知识点
4. 语气鼓励但不敷衍`;

      const reply = await chat("deepseek", [{ role: "system", content: prompt }], { temperature: 0.3, maxTokens: 1024 });

      // Save quiz result to 辅导/teacher/quiz/
      try {
        const dateStr = new Date().toISOString().slice(0, 10);
        const timeStr = new Date().toLocaleString("zh-CN", { hour12: false });
        const quizDir = path.join(pathOrThrow("teacherDir"), "quiz");
        await fs.mkdir(quizDir, { recursive: true });
        const entry = `# 自测 — ${concept.title || conceptSlug}
日期: ${dateStr} ${timeStr}

## 题目&解答
${userAnswers}

## 批改结果
${reply}

---
`;
        const filename = `${dateStr}-${conceptSlug}.md`;
        await fs.appendFile(path.join(quizDir, filename), entry, "utf-8");
      } catch (e) {
        console.warn("Quiz backup failed:", e);
      }

      return NextResponse.json({ feedback: reply });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("/api/quiz error:", error);
    return NextResponse.json({ error: "Quiz failed." }, { status: 500 });
  }
}
