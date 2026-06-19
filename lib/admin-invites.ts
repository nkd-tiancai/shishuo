import crypto from "crypto";
import { db } from "./db";
import { hashToken } from "./crypto";

export interface InviteListItem {
  id: string;
  label: string | null;
  expiresAt: Date | null;
  usedAt: Date | null;
  usedByUserId: string | null;
  createdAt: Date;
}

export async function listInviteCodes(): Promise<InviteListItem[]> {
  return db.inviteCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      label: true,
      expiresAt: true,
      usedAt: true,
      usedByUserId: true,
      createdAt: true,
    },
  });
}

export async function createInviteCode(label?: string, expiresAt?: Date | null) {
  const code = crypto.randomBytes(18).toString("base64url");
  const invite = await db.inviteCode.create({
    data: {
      label: label?.trim() || null,
      expiresAt: expiresAt || null,
      codeHash: hashToken(code),
    },
    select: {
      id: true,
      label: true,
      expiresAt: true,
      usedAt: true,
      usedByUserId: true,
      createdAt: true,
    },
  });

  return { code, invite };
}
