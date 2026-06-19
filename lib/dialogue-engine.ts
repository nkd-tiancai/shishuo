/**
 * 对话引擎 —— 发言者指令 + 拓展轮数追踪。
 * 从 respond/route.ts 第 33-56 行提取。
 */

export type ChatMode = "classroom" | "mentor-private" | "role-private";

export function providerRoleForMode(mode: ChatMode) {
  if (mode === "mentor-private") return "mentor-private";
  if (mode === "role-private") return "role-private";
  return "classroom";
}

export function speakerInstruction(mode: ChatMode): string {
  if (mode === "mentor-private") {
    return "只让苏格拉底导师回复。可以简短评价用户回答，再追问 1 到 2 个问题。";
  }
  if (mode === "role-private") {
    return "让用户的私聊角色先接住情绪或关系线；如果已经连续拓展约 5 轮，再由苏格拉底导师把对话拉回课堂内容。";
  }
  return "允许同学回答用户问题，也允许同学跑出新问题；可以围绕新问题拓展约 5 轮，达到后再由苏格拉底导师把讨论拉回本节课程。";
}

/**
 * 从消息历史末尾向前统计已拓展轮数。
 * 遇到导师"拉回"类发言时归零，否则累计同学/同伴发言。
 */
export function expansionRoundCount(messages: { role: string; content: string }[]): number {
  let count = 0;
  for (const message of [...messages].reverse()) {
    if (message.role === "mentor" && /回到|拉回|教材|本节|课堂/.test(message.content)) break;
    if (message.role === "classmate" || message.role === "companion") count += 1;
  }
  return Math.min(count, 5);
}
