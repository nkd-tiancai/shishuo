import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const courses = await db.course.findMany({
      where: { visibility: "public", status: "PUBLISHED" },
      select: { id: true, title: true, createdAt: true, _count: { select: { lessons: true } } },
      orderBy: { publishedAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ courses });
  } catch (error) {
    console.error("/api/courses/public error:", error);
    return NextResponse.json({ error: "加载失败" }, { status: 500 });
  }
}
