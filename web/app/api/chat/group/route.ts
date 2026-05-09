import { NextRequest, NextResponse } from "next/server";
import { buildGroupChatContext } from "@/lib/context-builder";
import { chat, routeForGroupChat } from "@/lib/llm-router";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      message,
      history = "",
      mode = "group",
      targetCharacter = "",
    } = body as {
      message: string;
      history?: string;
      mode?: "group" | "private";
      targetCharacter?: string;
    };

    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const context = await buildGroupChatContext(message, history, mode, targetCharacter);
    const llmType = routeForGroupChat();

    const reply = await chat(llmType, context.messages, {
      temperature: 0.9,
      maxTokens: mode === "private" ? 1024 : 2048,
    });

    return NextResponse.json({ reply, model: llmType, mode });
  } catch (error) {
    console.error("/api/chat/group error:", error);
    return NextResponse.json(
      { error: "An internal error occurred. Check server logs." },
      { status: 500 }
    );
  }
}
