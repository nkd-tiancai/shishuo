/**
 * LLM 响应解析 —— 将 LLM 返回的 JSON 数组解析为结构化消息。
 */

export interface ParsedMessage {
  role: "mentor" | "classmate" | "companion";
  name: string;
  content: string;
}

export function fallbackMessages(
  mode: "classroom" | "mentor-private" | "role-private",
): ParsedMessage[] {
  if (mode === "role-private") {
    return [
      { role: "companion", name: "自定义角色", content: "我先接住你的想法。这个问题可以慢慢拆，不用急着一次说完。" },
      { role: "companion", name: "自定义角色", content: "如果你愿意，我们可以先沿着这个想法多走一步。" },
    ];
  }
  if (mode === "classroom") {
    return [
      { role: "classmate", name: "同学", content: "我觉得可以先从你的回答里挑一个关键词继续问。" },
      { role: "classmate", name: "同学", content: "那我想追问：这个关键词有没有可能在别的场景里变成另一个意思？" },
    ];
  }
  return [
    { role: "mentor", name: "苏格拉底导师", content: "我先给一个追问：你这个回答成立，需要依赖哪个前提？" },
  ];
}

export function parseMessages(
  raw: string,
  mode: "classroom" | "mentor-private" | "role-private",
): ParsedMessage[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return fallbackMessages(mode);
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const value = item as { role?: unknown; name?: unknown; content?: unknown };
        if (typeof value.content !== "string") return null;
        const role =
          value.role === "classmate" || value.role === "companion" || value.role === "mentor"
            ? value.role
            : "mentor";
        return {
          role,
          name:
            typeof value.name === "string"
              ? value.name.slice(0, 40)
              : role === "mentor"
                ? "苏格拉底导师"
                : "同学",
          content: value.content.slice(0, 700),
        };
      })
      .filter(Boolean)
      .slice(0, 8) as ParsedMessage[];
  } catch (e) {
    console.warn("parseMessages: LLM returned non-JSON, using fallback messages.", e);
    return fallbackMessages(mode);
  }
}

/** 流式解析单行 NDJSON。失败返回 null（静默跳过，等待下一行完整 JSON）。 */
export function parseStreamLine(line: string): ParsedMessage | null {
  try {
    const value = JSON.parse(line);
    if (!value || typeof value !== "object" || typeof value.content !== "string") return null;
    const role =
      value.role === "classmate" || value.role === "companion" || value.role === "mentor"
        ? value.role
        : "mentor";
    return {
      role,
      name: typeof value.name === "string" ? value.name.slice(0, 40) : role === "mentor" ? "苏格拉底导师" : "同学",
      content: value.content.slice(0, 700),
    };
  } catch {
    return null;
  }
}
