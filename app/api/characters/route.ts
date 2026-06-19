import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createCharacterCard,
  deleteCharacterCard,
  listCharacterCards,
  updateCharacterCard,
} from "@/lib/character-store";
import { authErrorResponse, requireUser } from "@/lib/require-user";

const characterSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(40),
  role: z.enum(["mentor", "classmate", "companion"]),
  description: z.string().max(1200).optional(),
  personality: z.string().max(1200).optional(),
  scenario: z.string().max(1200).optional(),
  firstMessage: z.string().max(1200).optional(),
  avatar: z.string().max(4).optional(),
  avatarUrl: z.string().optional(),
  relationshipLine: z.string().max(1200).optional(),
  isTeacher: z.boolean().optional(),
  usageMode: z.enum(["classroom", "private", "both"]).optional(),
  visibility: z.enum(["private", "public"]).optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const characters = await listCharacterCards(user.id);
    return NextResponse.json({ characters });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/characters GET error:", error);
    return NextResponse.json({ error: "读取人物卡失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const parsed = characterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "人物卡格式不正确" }, { status: 400 });
    }

    const character = await createCharacterCard(user.id, parsed.data);
    return NextResponse.json({ character });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/characters POST error:", error);
    return NextResponse.json({ error: "保存人物卡失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const parsed = characterSchema.extend({ id: z.string().min(1) }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "人物卡格式不正确" }, { status: 400 });
    }

    const character = await updateCharacterCard(user.id, parsed.data);
    if (!character) {
      return NextResponse.json({ error: "人物卡不存在" }, { status: 404 });
    }
    return NextResponse.json({ character });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/characters PUT error:", error);
    return NextResponse.json({ error: "更新人物卡失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "缺少人物卡 ID" }, { status: 400 });
    }

    const deleted = await deleteCharacterCard(user.id, id);
    if (!deleted) {
      return NextResponse.json({ error: "人物卡不存在" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/characters DELETE error:", error);
    return NextResponse.json({ error: "删除人物卡失败" }, { status: 500 });
  }
}
