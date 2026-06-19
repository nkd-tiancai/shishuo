import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { updateLesson, deleteLesson } from "@/lib/course-store";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  try {
    const user = await requireUser();
    const { lessonId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "参数格式不正确" }, { status: 400 });
    }
    const lesson = await updateLesson(user.id, lessonId, parsed.data);
    if (!lesson) return NextResponse.json({ error: "课时不存在" }, { status: 404 });
    return NextResponse.json({ lesson });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/lessons/[lessonId] PATCH error:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  try {
    const user = await requireUser();
    const { lessonId } = await params;
    const ok = await deleteLesson(user.id, lessonId);
    if (!ok) return NextResponse.json({ error: "课时不存在" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/lessons/[lessonId] DELETE error:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
