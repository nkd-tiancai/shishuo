import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { listDocuments } from "@/lib/document-store";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ documents: await listDocuments(user.id) });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/library GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
