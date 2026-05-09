import { NextRequest, NextResponse } from "next/server";
import { handleClassEnd } from "@/lib/state-persist";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      conceptSlug,
      summary,
      professor,
      evaluation,
      diaryContent,
      mood,
    } = body as {
      conceptSlug: string;
      summary: string;
      professor: string;
      evaluation: string;
      diaryContent: string;
      mood: string;
    };

    if (!conceptSlug || !summary) {
      return NextResponse.json(
        { error: "Missing conceptSlug or summary" },
        { status: 400 }
      );
    }

    const p = professor || "马超";
    const e = evaluation || "本节课完成";
    const d = diaryContent || summary;
    const m = mood || "充实";

    await handleClassEnd(conceptSlug, summary, p, e, d, m);

    return NextResponse.json({
      ok: true,
      message: `已保存：progress.md + diary.md 已更新 (${conceptSlug})`,
    });
  } catch (error) {
    console.error("/api/end-class error:", error);
    return NextResponse.json(
      { error: "An internal error occurred. Check server logs." },
      { status: 500 }
    );
  }
}
