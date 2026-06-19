import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { configLimiter } from "@/lib/rate-limit";
import { testProviderConnection } from "@/lib/llm-client";

const testSchema = z.object({
  baseURL: z.string().trim().url(),
  apiKey: z.string().trim().min(1),
  model: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    if (!await configLimiter.check(user.id)) {
      return NextResponse.json({ error: "请求过于频繁" }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = testSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "参数格式不正确" }, { status: 400 });
    }

    const result = await testProviderConnection({
      baseURL: parsed.data.baseURL,
      apiKey: parsed.data.apiKey,
      model: parsed.data.model,
    });

    return NextResponse.json(result);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/providers/test error:", error);
    return NextResponse.json({ ok: false, error: "测试连接失败" }, { status: 500 });
  }
}
