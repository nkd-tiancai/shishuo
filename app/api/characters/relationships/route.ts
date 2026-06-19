import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { db } from "@/lib/db";
import { addRelationship, removeRelationship, listRelationships } from "@/lib/character-store";

const createSchema = z.object({
  sourceCardId: z.string().min(1),
  targetCardId: z.string().min(1),
  relationType: z.string().max(80).optional(),
  description: z.string().max(500).optional(),
});

async function verifyOwnership(userId: string, cardId: string): Promise<boolean> {
  const card = await db.characterCard.findFirst({ where: { id: cardId, userId }, select: { id: true } });
  return !!card;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "参数格式不正确" }, { status: 400 });

    if (!await verifyOwnership(user.id, parsed.data.sourceCardId) || !await verifyOwnership(user.id, parsed.data.targetCardId)) {
      return NextResponse.json({ error: "人物卡不存在" }, { status: 404 });
    }

    const rel = await addRelationship(parsed.data.sourceCardId, parsed.data.targetCardId, parsed.data.relationType, parsed.data.description);
    return NextResponse.json({ relationship: rel });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/characters/relationships POST error:", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

    // 查关系，确认 sourceCard 属于当前用户
    const rel = await db.characterRelationship.findUnique({ where: { id }, include: { source: { select: { userId: true } } } });
    if (!rel || rel.source.userId !== user.id) {
      return NextResponse.json({ error: "关系不存在" }, { status: 404 });
    }

    const ok = await removeRelationship(id);
    return NextResponse.json({ ok });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/characters/relationships DELETE error:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const cardId = new URL(request.url).searchParams.get("cardId");
    if (!cardId) return NextResponse.json({ error: "缺少 cardId" }, { status: 400 });
    if (!await verifyOwnership(user.id, cardId)) {
      return NextResponse.json({ error: "人物卡不存在" }, { status: 404 });
    }
    return NextResponse.json({ relationships: await listRelationships(cardId) });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/characters/relationships GET error:", error);
    return NextResponse.json({ error: "读取失败" }, { status: 500 });
  }
}
