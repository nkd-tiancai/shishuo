import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { createJob, processJob } from "@/lib/generation-store";

const generateSchema = z.object({
  documentId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "缺少教材 ID" }, { status: 400 });
    }

    const job = await createJob(user.id, "course", parsed.data.documentId);
    processJob(job.id, user.id).catch((err) => console.error("processJob failed:", err));

    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/courses/generate error:", error);
    const isClientError = error instanceof SyntaxError;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成课程失败" },
      { status: isClientError ? 400 : 500 },
    );
  }
}
