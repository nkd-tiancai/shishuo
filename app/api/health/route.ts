import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "socratopia-product",
    ts: Date.now(),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    authConfigured: Boolean(process.env.AUTH_SECRET),
    encryptionConfigured: Boolean(process.env.APP_ENCRYPTION_KEY),
  });
}
