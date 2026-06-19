import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLessonStudyDetail } from "@/lib/course-store";
import { getProviderForRole } from "@/lib/provider-store";
import { authErrorResponse, requireUser } from "@/lib/require-user";
import { llmLimiter } from "@/lib/rate-limit";
import { chatStream } from "@/lib/llm-client";
import { parseMessages, parseStreamLine } from "@/lib/socratic-parser";
import { providerRoleForMode, expansionRoundCount } from "@/lib/dialogue-engine";
import { formatParticipantProfiles, formatParticipantsSummary } from "@/lib/participant-formatter";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/socratic-prompts";
import { createSession, getSessionByLesson, addMessages } from "@/lib/chat-store";

// ═══ 请求校验 schema ═══

const participantSchema = z.object({
  name: z.string().trim().min(1).max(40),
  role: z.enum(["classmate", "companion"]),
  relationship: z.string().trim().max(1200).optional(),
  description: z.string().trim().max(1200).optional(),
  personality: z.string().trim().max(1200).optional(),
  scenario: z.string().trim().max(1200).optional(),
  firstMessage: z.string().trim().max(1200).optional(),
});

const messageSchema = z.object({
  name: z.string().trim().max(40),
  role: z.string().trim().max(40),
  content: z.string().trim().max(1000),
});

const respondSchema = z.object({
  lessonId: z.string().min(1),
  mode: z.enum(["classroom", "mentor-private", "role-private"]),
  userMessage: z.string().trim().min(1).max(1000),
  participants: z.array(participantSchema).max(8),
  recentMessages: z.array(messageSchema).max(12),
  stream: z.boolean().optional().default(true),
  sessionId: z.string().optional(),
});

// ═══ POST ═══

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    // ── 速率限制 ──
    if (!await llmLimiter.check(user.id)) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = respondSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "对话信息格式不正确" }, { status: 400 });
    }

    const lesson = await getLessonStudyDetail(user.id, parsed.data.lessonId);
    if (!lesson) {
      return NextResponse.json({ error: "课程小节不存在" }, { status: 404 });
    }

    const provider = await getProviderForRole(user.id, providerRoleForMode(parsed.data.mode));
    if (!provider) {
      return NextResponse.json(
        { error: "请先在 Provider 设置中配置默认、课堂或私聊用途的 API key" },
        { status: 409 },
      );
    }

    // ── 构建 prompt ──
    const participantsSummary = formatParticipantsSummary(parsed.data.participants);
    const participantProfiles = formatParticipantProfiles(parsed.data.participants);
    const recent = parsed.data.recentMessages
      .map((item) => `${item.name}: ${item.content}`)
      .join("\n");
    const rounds = expansionRoundCount(parsed.data.recentMessages);

    const systemPrompt = buildSystemPrompt({
      mode: parsed.data.mode,
      courseTitle: lesson.course.title,
      lessonTitle: lesson.title,
      lessonContent: lesson.content,
      participantsSummary,
      participantProfiles,
      recentMessages: recent,
      userMessage: parsed.data.userMessage,
      expansionRounds: rounds,
    });

    const userPrompt = buildUserPrompt({
      mode: parsed.data.mode,
      courseTitle: lesson.course.title,
      lessonTitle: lesson.title,
      lessonContent: lesson.content,
      participantsSummary,
      participantProfiles,
      recentMessages: recent,
      userMessage: parsed.data.userMessage,
      expansionRounds: rounds,
    });

    // ── 持久化 session ──
    let sessionId = parsed.data.sessionId;
    if (sessionId) {
      // 校验前端传来的 sessionId 属于当前用户
      const owned = await getSessionByLesson(user.id, parsed.data.lessonId);
      if (!owned || owned.id !== sessionId) sessionId = undefined;
    }
    if (!sessionId) {
      const existing = await getSessionByLesson(user.id, parsed.data.lessonId);
      sessionId = existing?.id ?? (await createSession(user.id, parsed.data.lessonId, lesson.course?.id)).id;
    }

    await addMessages(sessionId, user.id, [
      { role: "student", content: `我: ${parsed.data.userMessage}` },
    ]);

    // ── 非流式：chat() + parseMessages ──
    if (!parsed.data.stream) {
      const { chat } = await import("@/lib/llm-client");
      const content = await chat(
        user.id,
        { baseURL: provider.baseURL, apiKey: provider.apiKey, model: provider.model },
        [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        { temperature: 0.7 },
      );
      const messages = parseMessages(content, parsed.data.mode);
      await addMessages(sessionId, user.id,
        messages.map((m) => ({ role: m.role, content: `${m.name}: ${m.content}` })),
      );
      return NextResponse.json({ messages, sessionId });
    }

    // ── 真流式：chatStream + 增量 buffer + emit ──
    const encoder = new TextEncoder();
    const isFirstRound = !parsed.data.sessionId;
    const collectedMessages: ReturnType<typeof parseStreamLine>[] = [];
    let fullBuffer = "";

    const stream = new ReadableStream({
      async start(controller) {
        if (isFirstRound) {
          controller.enqueue(encoder.encode(
            JSON.stringify({ type: "session", sessionId }) + "\n",
          ));
        }

        try {
          let lineBuffer = "";
          for await (const delta of chatStream(
            user.id,
            { baseURL: provider.baseURL, apiKey: provider.apiKey, model: provider.model },
            [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            { temperature: 0.7 },
          )) {
            fullBuffer += delta;
            lineBuffer += delta;

            // 按 \n 切分，完整行即时 emit
            const lines = lineBuffer.split("\n");
            lineBuffer = lines.pop() || ""; // 保留不完整行

            for (const line of lines) {
              if (!line.trim()) continue;
              const msg = parseStreamLine(line.trim());
              if (msg) {
                collectedMessages.push(msg);
                controller.enqueue(encoder.encode(
                  JSON.stringify({ type: "message", role: msg.role, name: msg.name, content: msg.content }) + "\n",
                ));
              }
            }
          }

          // 流结束：处理剩余 buffer
          if (lineBuffer.trim()) {
            const msg = parseStreamLine(lineBuffer.trim());
            if (msg) collectedMessages.push(msg);
          }

          // fallback: NDJSON 解析无结果 → 用旧 parseMessages 兜底
          if (collectedMessages.length === 0) {
            const fallback = parseMessages(fullBuffer, parsed.data.mode);
            collectedMessages.push(...fallback);
            for (const msg of fallback) {
              controller.enqueue(encoder.encode(
                JSON.stringify({ type: "message", role: msg.role, name: msg.name, content: msg.content }) + "\n",
              ));
            }
          }
        } catch (e) {
          controller.enqueue(encoder.encode(
            JSON.stringify({ type: "error", error: "生成课堂回应失败" }) + "\n",
          ));
        }

        // 持久化收集到的消息
        if (collectedMessages.length > 0) {
          addMessages(sessionId, user.id,
            collectedMessages.map((m) =>
              m ? { role: m.role, content: `${m.name}: ${m.content}` } : { role: "mentor", content: "..." },
            ).filter(Boolean),
          ).catch((err) => console.error("persist stream messages failed:", err));
        }

        controller.enqueue(encoder.encode(JSON.stringify({ type: "done" }) + "\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("/api/socratic/respond error:", error);
    return NextResponse.json({ error: "生成课堂回应失败" }, { status: 500 });
  }
}
