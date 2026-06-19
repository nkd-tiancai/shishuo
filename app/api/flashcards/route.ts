import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { db } from "@/lib/db";
import { listByLesson, generateFromLesson } from "@/lib/flashcard-store";

const generateSchema = z.object({ lessonId: z.string().min(1) });

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const lessonId = new URL(request.url).searchParams.get("lessonId");
    if (!lessonId) return NextResponse.json({ error: "缺少 lessonId" }, { status: 400 });
    return NextResponse.json({ flashcards: await listByLesson(user.id, lessonId) });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/flashcards GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "缺少 lessonId" }, { status: 400 });

    const cards = await generateFromLesson(user.id, parsed.data.lessonId);
    return NextResponse.json({ ok: true, count: cards.length, flashcards: cards });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/flashcards POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成失败" },
      { status: 400 },
    );
  }
}

const rateSchema = z.object({ id: z.string().min(1), confidence: z.number().min(1).max(5) });

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const parsed = rateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 });

    const card = await db.flashcard.findFirst({ where: { id: parsed.data.id, userId: user.id }, select: { id: true } });
    if (!card) return NextResponse.json({ error: "闪卡不存在" }, { status: 404 });

    const nextReview = parsed.data.confidence >= 4
      ? new Date(Date.now() + 7 * 864e5)
      : new Date(Date.now() + 1 * 864e5);

    await db.flashcard.update({
      where: { id: parsed.data.id },
      data: { confidence: parsed.data.confidence, nextReviewAt: nextReview },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ error: "评分失败" }, { status: 500 });
  }
}
