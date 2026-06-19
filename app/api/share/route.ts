import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { configLimiter } from "@/lib/rate-limit";
import { db } from "@/lib/db";

const shareSchema = z.object({
  resourceType: z.enum(["course", "character"]),
  resourceId: z.string().min(1),
  email: z.string().email(),
});

async function verifyOwnership(userId: string, resourceType: string, resourceId: string): Promise<boolean> {
  if (resourceType === "course") {
    const course = await db.course.findFirst({ where: { id: resourceId, userId }, select: { id: true } });
    return !!course;
  }
  const card = await db.characterCard.findFirst({ where: { id: resourceId, userId }, select: { id: true } });
  return !!card;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    if (!await configLimiter.check(user.id)) {
      return NextResponse.json({ error: "请求过于频繁" }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = shareSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 });

    if (!await verifyOwnership(user.id, parsed.data.resourceType, parsed.data.resourceId)) {
      return NextResponse.json({ error: "资源不存在" }, { status: 404 });
    }

    const invited = await db.user.findUnique({ where: { email: parsed.data.email } });
    const share = await db.sharedAccess.create({
      data: {
        resourceType: parsed.data.resourceType,
        resourceId: parsed.data.resourceId,
        ownerUserId: user.id,
        invitedEmail: parsed.data.email,
        invitedUserId: invited?.id ?? null,
        role: "viewer",
      },
    });
    return NextResponse.json({ share });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/share error:", error);
    return NextResponse.json({ error: "分享失败" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const direction = searchParams.get("direction") || "incoming";

    const where = direction === "outgoing"
      ? { ownerUserId: user.id }
      : { invitedUserId: user.id };

    const shares = await db.sharedAccess.findMany({
      where, orderBy: { createdAt: "desc" }, take: 100,
    });
    return NextResponse.json({ shares });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
