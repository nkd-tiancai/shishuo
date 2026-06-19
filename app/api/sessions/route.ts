import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { getSessionByLesson, getMessages } from "@/lib/chat-store";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get("lessonId");
    if (!lessonId) {
      return NextResponse.json({ error: "缺少 lessonId" }, { status: 400 });
    }

    const session = await getSessionByLesson(user.id, lessonId);
    if (!session) {
      return NextResponse.json({ session: null, messages: [] });
    }

    const raw = await getMessages(session.id, user.id);
    const messages = raw.map((m) => {
      const idx = m.content.indexOf(": ");
      return idx > 0
        ? { id: m.id, role: m.role, name: m.content.slice(0, idx), content: m.content.slice(idx + 2) }
        : { id: m.id, role: m.role, name: "", content: m.content };
    });

    return NextResponse.json({ session: { id: session.id }, messages });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/sessions GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
