import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { listProviders, replaceProviders } from "@/lib/provider-store";
import { configLimiter } from "@/lib/rate-limit";

const providerSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(80),
  baseURL: z.string().trim().url(),
  apiKey: z.string().optional(),
  model: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(40).default("default"),
});

const providersSchema = z.object({
  providers: z.array(providerSchema).max(20),
});

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(await listProviders(user.id));
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/providers GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    // ── 速率限制（配置写入） ──
    if (!await configLimiter.check(user.id)) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = providersSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid providers" }, { status: 400 });
    }
    await replaceProviders(user.id, parsed.data.providers);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/providers error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
