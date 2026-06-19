import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { hashPassword } from "@/lib/password";
import { ensureUserDirs } from "@/lib/user-paths";
import { authLimiter } from "@/lib/rate-limit";

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Za-z]/)
    .regex(/[0-9]/),
  name: z.string().trim().max(80).optional(),
  inviteCode: z.string().trim().min(8),
});

const INVITE_ALREADY_USED = "INVITE_ALREADY_USED";

function clientKey(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")
    || request.headers.get("x-real-ip")
    || "local";
}

export async function POST(request: NextRequest) {
  try {
    // ── 速率限制 ──
    if (!await authLimiter.check(clientKey(request))) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "注册信息不完整或格式不正确" }, { status: 400 });
    }

    const email = parsed.data.email;
    const codeHash = hashToken(parsed.data.inviteCode);
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
    }

    const invite = await db.inviteCode.findUnique({ where: { codeHash } });
    if (!invite || invite.usedAt || invite.usedByUserId) {
      return NextResponse.json({ error: "邀请码无效或已被使用" }, { status: 400 });
    }
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "邀请码已过期" }, { status: 400 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await db.$transaction(async (tx: any) => {
      const created = await tx.user.create({
        data: {
          email,
          name: parsed.data.name || null,
          passwordHash,
          workspace: {
            create: { name: "我的自学空间" },
          },
        },
      });
      const claimed = await tx.inviteCode.updateMany({
        where: {
          id: invite.id,
          usedAt: null,
          usedByUserId: null,
        },
        data: { usedAt: new Date(), usedByUserId: created.id },
      });
      if (claimed.count !== 1) {
        throw new Error(INVITE_ALREADY_USED);
      }
      return created;
    });

    await ensureUserDirs(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === INVITE_ALREADY_USED) {
      return NextResponse.json({ error: "邀请码已被使用" }, { status: 400 });
    }
    console.error("/api/register error:", error);
    return NextResponse.json({ error: "注册失败" }, { status: 500 });
  }
}
