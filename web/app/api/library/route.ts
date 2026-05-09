import { NextResponse } from "next/server";
import knowledgeData from "@/data/knowledge-index.json";

export async function GET() {
  const kbs: Record<string, unknown> = {};
  for (const [key, kb] of Object.entries(knowledgeData.knowledgeBases)) {
    const k = kb as { label: string; description: string; concepts: Record<string, unknown>; order: string[] };
    kbs[key] = {
      label: k.label,
      description: k.description,
      concepts: Object.values(k.concepts),
      order: k.order,
    };
  }

  return NextResponse.json({
    knowledgeBases: kbs,
    kbOrder: knowledgeData.kbOrder || Object.keys(kbs),
    papers: knowledgeData.papers || [],
  });
}
