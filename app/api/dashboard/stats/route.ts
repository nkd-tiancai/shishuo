import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { getProgressSummary, markLessonProgress } from "@/lib/progress-store";

const progressSchema = z.object({
  lessonId: z.string().min(1),
  status: z.enum(["not_started", "studying", "reviewing", "mastered"]).optional().default("studying"),
  confidence: z.number().min(1).max(5).optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(await getProgressSummary(user.id));
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/dashboard/stats GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const parsed = progressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Missing lessonId" }, { status: 400 });
    }
    await markLessonProgress(user.id, parsed.data.lessonId, parsed.data.status, parsed.data.confidence);
    return NextResponse.json({ ok: true, ...(await getProgressSummary(user.id)) });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/dashboard/stats POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Progress update failed" },
      { status: 400 },
    );
  }
}
