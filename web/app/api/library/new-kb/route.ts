import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";

const INDEX_PATH = "d:\\claude code\\web\\data\\knowledge-index.json";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, label, description } = body as {
      key: string;
      label: string;
      description: string;
    };

    if (!key || !label) {
      return NextResponse.json(
        { error: "Missing key or label" },
        { status: 400 }
      );
    }

    const existing = JSON.parse(await fs.readFile(INDEX_PATH, "utf-8"));
    const kbs = existing.knowledgeBases || {};

    if (kbs[key]) {
      return NextResponse.json(
        { error: `Knowledge base "${key}" already exists` },
        { status: 409 }
      );
    }

    kbs[key] = {
      label,
      description: description || "",
      concepts: {},
      order: [],
    };

    existing.knowledgeBases = kbs;
    await fs.writeFile(INDEX_PATH, JSON.stringify(existing, null, 2), "utf-8");

    return NextResponse.json({
      ok: true,
      key,
      message: `已创建知识库 "${label}"`,
    });
  } catch (error) {
    console.error("/api/library/new-kb error:", error);
    return NextResponse.json(
      { error: "Creation failed. Check server logs." },
      { status: 500 }
    );
  }
}
