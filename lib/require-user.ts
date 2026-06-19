import { NextResponse } from "next/server";
import { auth } from "./auth";
import { db } from "./db";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();

  // 实时校验禁用状态（非仅依赖 JWT 快照）
  const user = await db.user.findUnique({
    where: { id: session.user.id }, select: { disabledAt: true, role: true },
  });
  if (!user || user.disabledAt) throw new UnauthorizedError();

  return { ...session.user, role: user.role };
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new ForbiddenError();
  }
  return user;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
