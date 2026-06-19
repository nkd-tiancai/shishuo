/**
 * 人物卡格式化 —— 参与者摘要与详情。
 * 从 respond/route.ts 第 58-67 行及第 145-147 行提取。
 */

export interface ParticipantInfo {
  name: string;
  role: "classmate" | "companion";
  relationship?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  firstMessage?: string;
}

const FIELD_MAX = 300; // 每个字段最大字符数，8 人满载约 12K 字符

export function formatParticipantProfiles(participants: ParticipantInfo[]): string {
  return participants
    .map((item) =>
      [
        `${item.name} (${item.role === "classmate" ? "同学" : "私聊角色"})`,
        item.relationship ? `关系线：${item.relationship.slice(0, FIELD_MAX)}` : "",
        item.description ? `简介：${item.description.slice(0, FIELD_MAX)}` : "",
        item.personality ? `性格：${item.personality.slice(0, FIELD_MAX)}` : "",
        item.scenario ? `场景：${item.scenario.slice(0, FIELD_MAX)}` : "",
        item.firstMessage ? `开场白：${item.firstMessage.slice(0, FIELD_MAX)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

export function formatParticipantsSummary(participants: ParticipantInfo[]): string {
  return participants.map((item) => `${item.name}(${item.role})`).join("；");
}
