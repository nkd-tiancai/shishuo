import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { importCharacterCards } from "@/lib/character-store";

const cardSchema = z.object({
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

const importSchema = z.object({
  cards: z.array(cardSchema).max(50),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const parsed = importSchema.safeParse(body);

    if (!parsed.success) {
      // Also accept a single card object
      const single = cardSchema.safeParse(body);
      if (!single.success) {
        return NextResponse.json({ error: "导入数据格式不正确" }, { status: 400 });
      }
      const result = await importCharacterCards(user.id, [single.data]);
      return NextResponse.json({ ok: true, count: result.length, cards: result });
    }

    const result = await importCharacterCards(user.id, parsed.data.cards);
    return NextResponse.json({ ok: true, count: result.length, cards: result });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/characters/import error:", error);
    return NextResponse.json({ error: "导入失败" }, { status: 500 });
  }
}
