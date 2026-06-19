import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { ensureUserDirs } from "@/lib/user-paths";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请上传图片文件" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "文件为空" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "图片不能超过 2MB" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "仅支持 PNG/JPEG/WebP/GIF" }, { status: 400 });
    }

    const paths = await ensureUserDirs(user.id);
    const ext = path.extname(file.name) || ".png";
    const storedName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const avatarPath = path.join(paths.uploads, "avatars", storedName);

    await fs.mkdir(path.dirname(avatarPath), { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(avatarPath, buffer);

    const avatarUrl = `/api/uploads/${user.id}/avatars/${storedName}`;
    return NextResponse.json({ ok: true, avatarUrl });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/characters/avatar error:", error);
    return NextResponse.json({ error: "上传失败" }, { status: 500 });
  }
}
