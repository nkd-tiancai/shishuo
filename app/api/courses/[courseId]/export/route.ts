import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { exportCourse } from "@/lib/course-store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const user = await requireUser();
    const { courseId } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";

    const course = await exportCourse(user.id, courseId);

    if (format === "md") {
      const md = [
        `# ${course.title}`,
        "",
        ...course.lessons.map((l: any) => `## ${l.title}\n\n${l.content}`),
      ].join("\n\n");
      return new NextResponse(md, {
        headers: {
          "Content-Type": "text/markdown",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(course.title)}.md"`,
        },
      });
    }

    return NextResponse.json(course);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof Error && error.message === "课程不存在") {
      return NextResponse.json({ error: "课程不存在" }, { status: 404 });
    }
    console.error("/api/courses/[courseId]/export error:", error);
    return NextResponse.json({ error: "导出失败" }, { status: 500 });
  }
}
