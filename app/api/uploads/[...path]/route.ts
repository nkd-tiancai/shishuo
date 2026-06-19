import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/require-user";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: segments } = await params;
    const ownerId = segments[0];
    const storageRoot = process.env.PRODUCT_STORAGE_ROOT || "./storage";
    const filePath = path.join(storageRoot, "users", ...segments);

    // 防止路径穿越
    const resolved = path.resolve(filePath);
    const root = path.resolve(path.join(storageRoot, "users"));
    if (!resolved.startsWith(root)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let viewerId = "";
    try {
      const user = await requireUser();
      viewerId = user.id;
    } catch {
      viewerId = "";
    }

    const uploadUrl = `/api/uploads/${segments.join("/")}`;
    const publicAvatar = await db.characterCard.findFirst({
      where: { userId: ownerId, visibility: "public", avatarUrl: uploadUrl },
      select: { id: true },
    });
    if (ownerId !== viewerId && !publicAvatar) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const buffer = await fs.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
      ".webp": "image/webp", ".gif": "image/gif",
    };
    return new NextResponse(buffer, {
      headers: { "Content-Type": mimeTypes[ext] || "application/octet-stream" },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
