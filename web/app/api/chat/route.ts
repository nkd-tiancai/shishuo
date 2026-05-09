import { NextRequest, NextResponse } from "next/server";
import { buildClassroomContext } from "@/lib/context-builder";
import { chat, routeForClassroom } from "@/lib/llm-router";
import { getProfessorForConcept, getAllConcepts } from "@/lib/knowledge-index";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      conceptSlug,
      message,
      history = "",
      action,
    } = body as {
      conceptSlug: string;
      message: string;
      history?: string;
      action?: "teach" | "end-class";
    };

    if (!conceptSlug || !message) {
      return NextResponse.json(
        { error: "Missing conceptSlug or message" },
        { status: 400 }
      );
    }

    const validSlugs = getAllConcepts().map((c) => c.slug);
    if (!validSlugs.includes(conceptSlug)) {
      return NextResponse.json(
        { error: `Unknown concept: ${conceptSlug}. Valid: ${validSlugs.join(", ")}` },
        { status: 400 }
      );
    }

    if (action === "end-class") {
      return NextResponse.json({
        reply: "今天的课结束了。请告诉我：1) 今天学到了什么？ 2) 心情如何？这些会记录到你的 progress.md 和 diary.md。",
        action: "collect-summary",
      });
    }

    const professor = getProfessorForConcept(conceptSlug);
    const context = await buildClassroomContext(conceptSlug, message, history);
    const llmType = routeForClassroom();

    const reply = await chat(llmType, context.messages, {
      temperature: 0.7,
      maxTokens: 4096,
    });

    return NextResponse.json({ reply, professor, model: llmType });
  } catch (error) {
    console.error("/api/chat error:", error);
    return NextResponse.json(
      { error: "An internal error occurred. Check server logs." },
      { status: 500 }
    );
  }
}
