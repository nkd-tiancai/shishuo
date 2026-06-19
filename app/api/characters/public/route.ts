import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const characters = await db.characterCard.findMany({
      where: { visibility: "public" },
      select: { id: true, name: true, role: true, description: true, personality: true, avatar: true, avatarUrl: true, usageMode: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ characters });
  } catch (error) {
    console.error("/api/characters/public error:", error);
    return NextResponse.json({ error: "加载失败" }, { status: 500 });
  }
}
