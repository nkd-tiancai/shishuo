import fs from "fs/promises";
import path from "path";
import { TUTORING_DIR } from "./types";

export async function readMarkdownFile(relativePath: string): Promise<string> {
  const fullPath = path.join(TUTORING_DIR, relativePath);
  return fs.readFile(fullPath, "utf-8");
}

export async function readAllTeacherFiles(): Promise<Record<string, string>> {
  const teacherDir = path.join(TUTORING_DIR, "teacher");
  const entries = await fs.readdir(teacherDir);
  const mdFiles = entries.filter((f) => f.endsWith(".md"));

  const result: Record<string, string> = {};
  for (const file of mdFiles) {
    const content = await fs.readFile(path.join(teacherDir, file), "utf-8");
    result[file] = content;
  }
  return result;
}

export async function readTextbookChapter(
  fileName: string,
  section?: string
): Promise<string> {
  const content = await readMarkdownFile(`markdown/${fileName}`);
  if (!section) return content;

  const lines = content.split("\n");
  const startMarker = section;
  const nextSectionRE = /^## /;
  let start = -1;
  let end = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (start === -1 && lines[i].trim().startsWith(startMarker)) {
      start = i;
    } else if (
      start !== -1 &&
      nextSectionRE.test(lines[i]) &&
      !lines[i].trim().startsWith(startMarker)
    ) {
      end = i;
      break;
    }
  }

  if (start === -1) return content;
  return lines.slice(start, end).join("\n");
}

export async function appendToMarkdownFile(
  relativePath: string,
  content: string
): Promise<void> {
  const fullPath = path.join(TUTORING_DIR, relativePath);
  await fs.appendFile(fullPath, content, "utf-8");
}

// WARNING: This function uses fs.writeFile which truncates and overwrites
// Use only for files you expect to fully rewrite. For the 辅导/ folder,
// prefer appendToMarkdownFile to stay append-only.
export async function updateFileSection(
  relativePath: string,
  sectionHeader: string,
  newContent: string
): Promise<void> {
  const fullPath = path.join(TUTORING_DIR, relativePath);
  const content = await fs.readFile(fullPath, "utf-8");
  const lines = content.split("\n");

  const sectionIdx = lines.findIndex((l) => l.trim() === sectionHeader);
  if (sectionIdx === -1) {
    await fs.appendFile(fullPath, `\n${sectionHeader}\n${newContent}\n`, "utf-8");
    return;
  }

  const nextSectionIdx = lines.findIndex(
    (l, i) => i > sectionIdx && /^## /.test(l)
  );
  const endIdx = nextSectionIdx === -1 ? lines.length : nextSectionIdx;

  const before = lines.slice(0, sectionIdx + 1);
  const after = lines.slice(endIdx);
  const newLines = [...before, ...newContent.split("\n"), ...after];
  await fs.writeFile(fullPath, newLines.join("\n"), "utf-8");
}
