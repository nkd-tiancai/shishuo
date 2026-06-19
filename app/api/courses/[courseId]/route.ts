import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { deleteCourse, getCourseDetail, updateCourse } from "@/lib/course-store";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const user = await requireUser();
    const { courseId } = await params;
    const course = await getCourseDetail(user.id, courseId);
    if (!course) return NextResponse.json({ error: "课程不存在" }, { status: 404 });
    return NextResponse.json(course);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/courses/[courseId] GET error:", error);
    return NextResponse.json({ error: "读取失败" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const user = await requireUser();
    const { courseId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "参数格式不正确" }, { status: 400 });
    }
    const course = await updateCourse(user.id, courseId, parsed.data);
    if (!course) return NextResponse.json({ error: "课程不存在" }, { status: 404 });
    return NextResponse.json({ course });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/courses/[courseId] PATCH error:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const user = await requireUser();
    const { courseId } = await params;
    const ok = await deleteCourse(user.id, courseId);
    if (!ok) return NextResponse.json({ error: "课程不存在" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/courses/[courseId] DELETE error:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
