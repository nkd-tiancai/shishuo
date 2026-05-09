import { appendToMarkdownFile } from "./file-reader";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function saveProgress(
  date: string,
  content: string,
  professor: string,
  evaluation: string
): Promise<void> {
  const progressEntry = `\n| ${date} | ${content} | ✅ 完成 |\n`;
  const notesEntry = `
- ${professor}评价：${evaluation}
`;
  await appendToMarkdownFile("teacher/progress.md", progressEntry + notesEntry);
}

export async function saveDiary(
  date: string,
  content: string,
  mood: string
): Promise<void> {
  const entry = `
---

## ${date} - Web 课堂

### 课堂收获
${content}

### 心情
${mood}
`;
  await appendToMarkdownFile("teacher/diary.md", entry);
}

export async function saveGroupChat(messages: string): Promise<void> {
  const entry = `

## ${todayDate()} - Web 群聊

${messages}
`;
  await appendToMarkdownFile("teacher/wechat_group.md", entry);
}

export async function updateCharacterState(
  characterFile: string,
  newState: string
): Promise<void> {
  const block = `
## Web-自动状态 (${todayDate()})
${newState}
`;
  await appendToMarkdownFile(characterFile, block);
}

export async function saveBookNotes(notes: string): Promise<void> {
  const entry = `

## ${todayDate()} - Web 改进建议
${notes}
`;
  await appendToMarkdownFile("teacher/book_revision_notes.md", entry);
}

export async function handleClassEnd(
  conceptSlug: string,
  summary: string,
  professor: string,
  evaluation: string,
  diaryContent: string,
  mood: string
): Promise<void> {
  const date = todayDate();
  await saveProgress(date, `${conceptSlug} - ${summary}`, professor, evaluation);
  await saveDiary(date, diaryContent, mood);
}
