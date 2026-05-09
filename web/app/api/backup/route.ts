import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { pathOrThrow } from "@/lib/env";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function now(): string {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
      conceptTitle,
      messages,
      targetCharacter,
    } = body as {
      type: "classroom" | "groupchat" | "private";
      conceptTitle?: string;
      messages: Array<{ role: string; content: string; timestamp: number }>;
      targetCharacter?: string;
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ ok: false, error: "No messages" }, { status: 400 });
    }

    const date = today();
    const time = now();
    const transcript = messages
      .map((m) => `**[${m.role}]** (${time})\n${m.content}\n`)
      .join("\n");

    if (type === "classroom" && conceptTitle) {
      // Save to 课堂记录/YYYY-MM-DD-concept.md
      const dir = path.join(pathOrThrow("teacherDir"), "课堂记录");
      await fs.mkdir(dir, { recursive: true });
      const filename = `${date}-${conceptTitle.replace(/[\/:*?"<>|]/g, "-")}.md`;
      const filepath = path.join(dir, filename);

      const entry = `# ${conceptTitle}\n日期: ${date}\n\n${transcript}\n---\n`;
      await fs.writeFile(filepath, entry, "utf-8");

      return NextResponse.json({ ok: true, file: `teacher/课堂记录/${filename}` });
    }

    if (type === "groupchat") {
      const entry = `\n## ${date} ${time} — Web群聊\n\n${transcript}\n`;
      await fs.appendFile(
        path.join(pathOrThrow("teacherDir"), "wechat_group.md"),
        entry,
        "utf-8"
      );
      return NextResponse.json({ ok: true, file: "teacher/wechat_group.md" });
    }

    if (type === "private" && targetCharacter) {
      const filename = `private_${targetCharacter}.md`;
      const filepath = path.join(pathOrThrow("teacherDir"), filename);
      const entry = `\n## ${date} ${time}\n\n${transcript}\n`;
      await fs.appendFile(filepath, entry, "utf-8");
      return NextResponse.json({ ok: true, file: `teacher/${filename}` });
    }

    return NextResponse.json({ ok: false, error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("/api/backup error:", error);
    return NextResponse.json(
      { error: "Backup failed" },
      { status: 500 }
    );
  }
}
