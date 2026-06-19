import { db } from "./db";
import { hashToken } from "./crypto";

export async function claimInviteCode(code: string, userId: string): Promise<void> {
  const codeHash = hashToken(code.trim());
  const invite = await db.inviteCode.findUnique({ where: { codeHash } });

  if (!invite) {
    throw new Error("邀请码无效");
  }
  if (invite.usedAt || invite.usedByUserId) {
    throw new Error("邀请码已被使用");
  }
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    throw new Error("邀请码已过期");
  }

  await db.inviteCode.update({
    where: { id: invite.id },
    data: {
      usedAt: new Date(),
      usedByUserId: userId,
    },
  });
}
