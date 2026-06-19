import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createInviteCode, listInviteCodes } from "@/lib/admin-invites";
import { authErrorResponse, requireAdmin } from "@/lib/require-user";

const createInviteSchema = z.object({
  label: z.string().trim().max(80).optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ invites: await listInviteCodes() });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/admin/invites GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const parsed = createInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "邀请码信息格式不正确" }, { status: 400 });
    }

    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
    const result = await createInviteCode(parsed.data.label, expiresAt);
    return NextResponse.json(result);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/admin/invites error:", error);
    return NextResponse.json({ error: "创建邀请码失败" }, { status: 500 });
  }
}
