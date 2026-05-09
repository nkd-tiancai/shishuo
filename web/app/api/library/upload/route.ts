import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { chat } from "@/lib/llm-router";

const MARKDOWN_DIR = "d:\\claude code\\辅导\\markdown";
const INDEX_PATH = "d:\\claude code\\web\\data\\knowledge-index.json";

async function extractPDFText(filePath: string): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await fs.readFile(filePath));
  const doc = await pdfjsLib.getDocument({ data }).promise;

  try {
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 10); i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      pages.push(text);
    }
    return pages.join("\n\n");
  } finally {
    doc.destroy();
  }
}

async function extractConceptsFromText(text: string): Promise<{
  title: string;
  concepts: string[];
  professor: string;
  difficulty: number;
}> {
  const prompt = `你是一个知识库索引专家。从以下论文/教材文本中提取结构化信息。

输出严格 JSON 格式，无任何其他文字：
{
  "title": "论文/章节标题（中文，50字以内）",
  "concepts": ["核心关键词1","核心关键词2","核心关键词3","核心关键词4","核心关键词5"],
  "professor": "马超（数学/统计视角）或 九雀（ML/概率/深度学习视角）",
  "difficulty": 1-5整数（1=入门级概念，5=前沿/高难度）
}

规则：
- difficulty: 1=入门基础概念，2=基础但需理解，3=中等难度，4=进阶，5=前沿/复杂
- professor: 论文涉及数学公式/统计理论选"马超"，涉及机器学习/概率/深度学习/大模型选"九雀"
- concepts: 从文本中提取5-10个核心技术概念/方法/模型的关键词
- 只输出 JSON

文本内容：
${text.slice(0, 8000)}`;

  const reply = await chat("deepseek", [{ role: "user", content: prompt }], {
    temperature: 0.2,
    maxTokens: 1024,
  });

  const jsonMatch = reply.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { title: "", concepts: [], professor: "九雀", difficulty: 1 };

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      title: parsed.title || "",
      concepts: Array.isArray(parsed.concepts) ? parsed.concepts.slice(0, 10) : [],
      professor: parsed.professor === "马超" ? "马超" : "九雀",
      difficulty: Math.min(5, Math.max(1, parseInt(parsed.difficulty) || 2)),
    };
  } catch {
    return { title: "", concepts: [], professor: "九雀", difficulty: 1 };
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const kbName = (formData.get("kbName") as string) || "AI-ML基础";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const filename = path.basename(file.name);
    const isPDF = /\.pdf$/i.test(filename);

    // Sanitize filename — prevent path traversal
    if (!filename || (!isPDF && !/\.(md|txt)$/i.test(filename))) {
      return NextResponse.json({ error: "Invalid file type. Only .md / .txt / .pdf allowed." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const destPath = path.join(MARKDOWN_DIR, filename);
    await fs.writeFile(destPath, buffer);

    const slug = filename
      .replace(/\.(md|txt|pdf)$/i, "")
      .replace(/[^a-zA-Z0-9一-鿿\-_]/g, "-")
      .toLowerCase();

    let extractedInfo: {
      title: string;
      concepts: string[];
      professor: string;
      difficulty: number;
    } = {
      title: filename.replace(/\.(md|txt|pdf)$/i, ""),
      concepts: [],
      professor: "九雀",
      difficulty: 2,
    };

    if (isPDF) {
      // For PDFs: extract text → DeepSeek extract concepts
      try {
        const text = await Promise.race([
          extractPDFText(destPath),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("PDF extraction timed out")), 30000)
          ),
        ]);
        if (text.trim()) {
          extractedInfo = await extractConceptsFromText(text);
        }
      } catch (e) {
        console.warn("PDF extraction failed:", e);
      }
    } else {
      // For markdown/text: extract first 200 lines → DeepSeek extract concepts
      const content = buffer.toString("utf-8");
      const lines = content.split("\n").slice(0, 200);
      const firstHeading = lines.find((l) => /^#+\s/.test(l));
      const bodyText = lines.join("\n");

      if (firstHeading) {
        extractedInfo.title = firstHeading.replace(/^#+\s*/, "").trim().slice(0, 80);
      }

      if (bodyText.trim()) {
        extractedInfo = await extractConceptsFromText(bodyText);
        if (!extractedInfo.title && firstHeading) {
          extractedInfo.title = firstHeading.replace(/^#+\s*/, "").trim().slice(0, 80);
        }
      }
    }

    // Read existing index
    const existingIndex = JSON.parse(await fs.readFile(INDEX_PATH, "utf-8"));
    const kbs = existingIndex.knowledgeBases || {};
    const kb = kbs[kbName];
    if (!kb) {
      return NextResponse.json({ error: `Knowledge base "${kbName}" not found` }, { status: 400 });
    }

    kb.concepts = kb.concepts || {};
    if (!kb.concepts[slug]) {
      kb.concepts[slug] = {
        slug,
        title: extractedInfo.title || filename.replace(/\.(md|txt|pdf)$/i, ""),
        file: filename,
        concepts: extractedInfo.concepts,
        prerequisites: [],
        professor: extractedInfo.professor,
        difficulty: extractedInfo.difficulty,
      };
      kb.order = kb.order || [];
      kb.order.push(slug);
      await fs.writeFile(INDEX_PATH, JSON.stringify(existingIndex, null, 2), "utf-8");
    }

    return NextResponse.json({
      ok: true,
      filename,
      slug,
      kbName,
      extracted: extractedInfo,
    });
  } catch (error) {
    console.error("/api/library/upload error:", error);
    return NextResponse.json(
      { error: "Upload failed. Check server logs." },
      { status: 500 }
    );
  }
}
