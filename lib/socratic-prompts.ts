/**
 * Socratic prompt 构建 —— system prompt + user prompt。
 * 从 respond/route.ts 第 154-171 行提取。
 */

import { truncateToSentence } from "./text-utils";
import { speakerInstruction } from "./dialogue-engine";
import type { ChatMode } from "./dialogue-engine";

export interface PromptContext {
  mode: ChatMode;
  courseTitle: string;
  lessonTitle: string;
  lessonContent: string;
  participantsSummary: string;
  participantProfiles: string;
  recentMessages: string;
  userMessage: string;
  expansionRounds: number;
}

export function buildSystemPrompt(ctx: PromptContext): string {
  return [
    "苏格拉底课堂。每条消息最多两句话，最多 8 条。逐行输出 JSON，每行一条消息，不要外层数组不要逗号：\n{\"role\":\"mentor|classmate|companion\",\"name\":\"显示名\",\"content\":\"内容\"}",
    speakerInstruction(ctx.mode),
    `拓展轮次上限 5 轮，达到后导师拉回教材。（当前 ${ctx.expansionRounds}/5）`,
    ctx.participantProfiles ? `人物卡详情：\n${ctx.participantProfiles}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildUserPrompt(ctx: PromptContext): string {
  return [
    `课程：${ctx.courseTitle}`,
    `小节：${ctx.lessonTitle}`,
    `教材内容：${truncateToSentence(ctx.lessonContent, 1600)}`,
    `参与者：${ctx.participantsSummary || "苏格拉底导师和用户"}`,
    `最近对话：\n${ctx.recentMessages || "暂无"}`,
    `用户刚才说：${ctx.userMessage}`,
  ].join("\n\n");
}
