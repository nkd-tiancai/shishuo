import fs from "fs/promises";
import path from "path";
import { db } from "./db";
import { assertInsideUserRoot, getUserPaths } from "./user-paths";
import { chat } from "./llm-client";
import { getProviderForRole } from "./provider-store";

const MAX_LESSONS = 24;
const MIN_SECTION_CHARS = 80;

interface DraftLesson {
  title: string;
  content: string;
}

function extensionOf(filename: string) {
  return path.extname(filename).toLowerCase();
}

function cleanText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function titleFromFilename(filename: string) {
  return path.parse(filename).name.replace(/[-_]+/g, " ").trim() || "未命名课程";
}

function splitMarkdownSections(text: string): DraftLesson[] {
  const sections: DraftLesson[] = [];
  const lines = text.split("\n");
  let currentTitle = "";
  let currentContent: string[] = [];

  function flush() {
    const content = cleanText(currentContent.join("\n"));
    if (currentTitle && content.length >= MIN_SECTION_CHARS) {
      sections.push({ title: currentTitle, content });
    }
    currentContent = [];
  }

  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      currentTitle = heading[2].trim().slice(0, 120);
      continue;
    }
    currentContent.push(line);
  }
  flush();

  return sections.slice(0, MAX_LESSONS);
}

function splitPlainTextSections(text: string): DraftLesson[] {
  const paragraphs = cleanText(text).split(/\n\s*\n/).filter(Boolean);
  const sections: DraftLesson[] = [];
  let buffer: string[] = [];
  let index = 1;

  function flush() {
    const content = cleanText(buffer.join("\n\n"));
    if (content.length >= MIN_SECTION_CHARS) {
      sections.push({ title: `第 ${index} 节`, content });
      index += 1;
    }
    buffer = [];
  }

  for (const paragraph of paragraphs) {
    buffer.push(paragraph);
    if (buffer.join("\n\n").length >= 900) {
      flush();
    }
  }
  flush();

  return sections.slice(0, MAX_LESSONS);
}

function buildLessons(text: string, filename: string): DraftLesson[] {
  const ext = extensionOf(filename);
  const lessons = ext === ".md" ? splitMarkdownSections(text) : splitPlainTextSections(text);
  if (lessons.length) return lessons;

  const fallback = cleanText(text);
  if (!fallback) {
    throw new Error("教材内容为空，无法生成课程");
  }

  return [{ title: "导读", content: fallback.slice(0, 6000) }];
}

export async function listCourses(userId: string) {
  return db.course.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      lessons: {
        select: { id: true },
      },
    },
  });
}

export async function getCourseDetail(userId: string, courseId: string) {
  return db.course.findFirst({
    where: { id: courseId, userId },
    select: {
      id: true,
      title: true,
      status: true,
      visibility: true,
      publishedAt: true,
      createdAt: true,
      lessons: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          title: true,
          content: true,
          orderIndex: true,
          progress: {
            where: { userId },
            select: {
              status: true,
              learnedAt: true,
            },
          },
        },
      },
    },
  });
}

export async function getLessonStudyDetail(userId: string, lessonId: string) {
  return db.lesson.findFirst({
    where: {
      id: lessonId,
      userId,
    },
    select: {
      id: true,
      title: true,
      content: true,
      orderIndex: true,
      course: {
        select: {
          id: true,
          title: true,
        },
      },
      progress: {
        where: { userId },
        select: {
          status: true,
          learnedAt: true,
        },
      },
    },
  });
}

export async function exportCourse(userId: string, courseId: string) {
  const course = await db.course.findFirst({
    where: { id: courseId, userId },
    select: {
      title: true, status: true,
      lessons: { orderBy: { orderIndex: "asc" }, select: { title: true, content: true, orderIndex: true } },
    },
  });
  if (!course) throw new Error("课程不存在");
  return course;
}

export async function updateCourse(userId: string, courseId: string, data: { title?: string; status?: string }) {
  const existing = await db.course.findFirst({ where: { id: courseId, userId }, select: { id: true } });
  if (!existing) return null;
  const patch: { title?: string; status?: string; visibility?: string; publishedAt?: Date | null } = { ...data };
  if (data.status === "PUBLISHED") {
    patch.visibility = "public";
    patch.publishedAt = new Date();
  } else if (data.status === "DRAFT" || data.status === "ARCHIVED") {
    patch.visibility = "private";
    patch.publishedAt = null;
  }
  return db.course.update({ where: { id: courseId }, data: patch });
}

export async function updateLesson(userId: string, lessonId: string, data: { title?: string; content?: string }) {
  const existing = await db.lesson.findFirst({ where: { id: lessonId, userId }, select: { id: true } });
  if (!existing) return null;
  return db.lesson.update({ where: { id: lessonId }, data });
}

export async function deleteCourse(userId: string, courseId: string) {
  const existing = await db.course.findFirst({ where: { id: courseId, userId }, select: { id: true } });
  if (!existing) return false;
  await db.course.delete({ where: { id: courseId } });
  return true;
}

export async function deleteLesson(userId: string, lessonId: string) {
  const existing = await db.lesson.findFirst({ where: { id: lessonId, userId }, select: { id: true } });
  if (!existing) return false;
  await db.lesson.delete({ where: { id: lessonId } });
  return true;
}

export async function analyzeDocumentStructure(
  userId: string,
  content: string,
  filename: string,
): Promise<DraftLesson[]> {
  const provider = await getProviderForRole(userId, "default").catch(() => null);
  if (provider) {
    try {
      const llmResult = await chat(userId, provider, [
        { role: "system", content: "你将教材文本拆分为课程章节。返回 JSON 数组 [{title, content}]，title 是章节标题，content 是该章节的完整原文（不要截断）。最多 24 节。" },
        { role: "user", content: content.slice(0, 16000) },
      ], { temperature: 0.3, maxTokens: 4096 });
      const parsed = JSON.parse(llmResult);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 24).map((s: any) => ({
          title: String(s.title || "章节").slice(0, 120),
          content: String(s.content || ""),
        }));
      }
    } catch { /* fallback */ }
  }
  return buildLessons(content, filename);
}

export async function publishCourse(userId: string, courseId: string) {
  const course = await db.course.findFirst({ where: { id: courseId, userId }, select: { id: true } });
  if (!course) throw new Error("课程不存在");
  return db.course.update({
    where: { id: courseId },
    data: { status: "PUBLISHED", visibility: "public", publishedAt: new Date() },
  });
}

export async function generateCourseFromDocument(userId: string, documentId: string) {
  const document = await db.sourceDocument.findFirst({
    where: { id: documentId, userId },
    select: {
      id: true,
      originalName: true,
      filename: true,
      sourcePath: true,
    },
  });
  if (!document) {
    throw new Error("教材不存在");
  }

  const ext = extensionOf(document.originalName || document.filename);
  const paths = getUserPaths(userId);
  assertInsideUserRoot(paths.root, document.sourcePath);

  let raw: string;
  if (ext === ".pdf") {
    try {
      // pdf-parse ESM compatibility
      const pdfModule: any = await import("pdf-parse");
      const pdfParse = pdfModule.default || pdfModule;
      const buffer = await fs.readFile(document.sourcePath);
      const pdfData = await pdfParse(buffer);
      raw = pdfData.text;
      if (!raw.trim()) throw new Error("PDF 文本为空");
    } catch (e) {
      throw new Error(`PDF 解析失败: ${e instanceof Error ? e.message : "未知错误"}`);
    }
  } else if ([".md", ".txt"].includes(ext)) {
    raw = await fs.readFile(document.sourcePath, "utf-8");
  } else {
    throw new Error("不支持的格式，请上传 MD、TXT 或 PDF 文件");
  }

  const lessons = await analyzeDocumentStructure(userId, raw, document.originalName);
  const title = titleFromFilename(document.originalName);

  return db.$transaction(async (tx: any) => {
    const course = await tx.course.create({
      data: {
        userId,
        title,
        status: "DRAFT",
        lessons: {
          create: lessons.map((lesson, index) => ({
            userId,
            title: lesson.title,
            content: lesson.content,
            orderIndex: index + 1,
            sourceRefs: JSON.stringify([{ documentId: document.id, originalName: document.originalName }]),
          })),
        },
      },
      select: {
        id: true,
        title: true,
        lessons: {
          select: { id: true },
        },
      },
    });

    return {
      id: course.id,
      title: course.title,
      lessonCount: course.lessons.length,
    };
  });
}
