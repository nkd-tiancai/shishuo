import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/llm-router";
import { readAllTeacherFiles } from "@/lib/file-reader";
import knowledgeData from "@/data/knowledge-index.json";
import fs from "fs/promises";
import path from "path";
import { pathOrThrow } from "@/lib/env";

const PAPERS_DIR = pathOrThrow("papersDir");

async function findPaperPDF(slug: string): Promise<string | null> {
  const papers = (knowledgeData.papers || []) as Array<Record<string, unknown>>;
  const paper = papers.find((p: Record<string, unknown>) => p.slug === slug);
  if (!paper) return null;

  const author = String(paper.author || "").toLowerCase();
  const year = String(paper.year || "");
  const titleWords = String(paper.title || "").toLowerCase().split(/\s+/).filter(w => w.length > 3);

  const dirs = await fs.readdir(PAPERS_DIR);
  for (const dir of dirs) {
    const dirLower = dir.toLowerCase();
    // Match by year + author or year + title keywords
    const hasYear = year && dirLower.includes(year);
    const hasAuthor = author && dirLower.includes(author);
    const hasTitle = titleWords.some(w => dirLower.includes(w));
    if (!hasYear || (!hasAuthor && !hasTitle)) continue;

    const dirPath = path.join(PAPERS_DIR, dir);
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) continue;

    const files = await fs.readdir(dirPath);
    const pdf = files.find((f: string) => f.endsWith(".pdf"));
    if (pdf) return path.join(dirPath, pdf);
  }
  return null;
}

async function extractPDFText(filePath: string): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await fs.readFile(filePath));
  const doc = await pdfjsLib.getDocument({ data }).promise;

  try {
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 15); i++) {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paperSlug, message = "", history = "" } = body as {
      paperSlug: string;
      message?: string;
      history?: string;
    };

    const papers = knowledgeData.papers as Array<Record<string, unknown>>;
    const paper = papers.find((p: Record<string, unknown>) => p.slug === paperSlug);
    if (!paper) {
      return NextResponse.json({ error: "Paper not found" }, { status: 404 });
    }

    // Extract PDF text
    let paperText = "";
    const pdfPath = await findPaperPDF(paperSlug);
    if (pdfPath) {
      try {
        paperText = await Promise.race([
          extractPDFText(pdfPath),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("PDF extraction timed out")), 30000)
          ),
        ]);
      } catch (e) {
        console.error("PDF extraction failed:", e);
      }
    }

    const teacherFiles = await readAllTeacherFiles();
    const mjProfile = teacherFiles["马超.md"] || "";
    const jqProfile = teacherFiles["九雀.md"] || "";

    const p = paper;
    const systemPrompt = `你是苏格拉底式论文精读导师。

## 论文信息
标题: ${p.title || ""}
作者: ${p.author || ""} (${p.year || ""})
主题: ${Array.isArray(p.topics) ? (p.topics as string[]).join(", ") : ""}

## 论文全文（前15页内容）
${paperText || "（PDF文本提取失败，请基于论文信息讨论）"}

## 导师角色
- 马超（数学/统计视角）：${mjProfile.slice(0, 400)}
- 九雀（ML/概率视角）：${jqProfile.slice(0, 400)}

## 精读规则
1. 用问题引导学生理解论文：动机→方法→实验→结论→局限
2. 引用原文段落（用引号标注具体内容）
3. 数学公式用 KaTeX 格式
4. 追问"为什么这个假设成立？""如果用另一种方法会怎样？"
5. 联系已知知识（如"这和之前学的 SVD 有什么联系？"）

## 对话历史
${history}

## 学生消息
${message || "我想开始精读这篇论文"}`;

    // Build proper role-separated messages
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Parse history into role-separated messages for multi-turn
    const historyLines = history.split("\n").filter(Boolean);
    for (const line of historyLines) {
      const m = line.match(/^\[(.+?)\]:\s*(.+)/);
      if (m) {
        messages.push({
          role: m[1] === "user" ? "user" : "assistant",
          content: m[2],
        });
      }
    }
    messages.push({ role: "user", content: message || "我想开始精读这篇论文" });

    const reply = await chat("deepseek", messages, {
      temperature: 0.7,
      maxTokens: 4096,
    });

    return NextResponse.json({ reply, paper: paperSlug, hasPDF: !!pdfPath });
  } catch (error) {
    console.error("/api/chat/paper error:", error);
    return NextResponse.json(
      { error: "An internal error occurred." },
      { status: 500 }
    );
  }
}
