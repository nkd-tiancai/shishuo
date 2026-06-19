import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { listKnowledgeBases, createKnowledgeBase, deleteKnowledgeBase } from "@/lib/kb-store";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(500).optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ knowledgeBases: await listKnowledgeBases(user.id) });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 });
    const kb = await createKnowledgeBase(user.id, parsed.data.title, parsed.data.description);
    return NextResponse.json({ knowledgeBase: kb });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    const ok = await deleteKnowledgeBase(user.id, id);
    if (!ok) return NextResponse.json({ error: "知识库不存在" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
