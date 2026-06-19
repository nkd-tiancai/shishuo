import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { getJob } from "@/lib/generation-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const job = await getJob(id, user.id);

    if (!job) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    const result: Record<string, unknown> = {
      status: job.status,
      createdAt: job.createdAt,
    };

    if (job.output) result.output = JSON.parse(job.output);
    if (job.error) result.error = job.error;

    return NextResponse.json(result);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/jobs/[id] GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
