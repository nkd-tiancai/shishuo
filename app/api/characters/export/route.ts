import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { exportCharacterCard, exportAllCharacterCards } from "@/lib/character-store";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    const data = id
      ? await exportCharacterCard(user.id, id)
      : await exportAllCharacterCards(user.id);

    if (id && !data) {
      return NextResponse.json({ error: "人物卡不存在" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/characters/export error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
