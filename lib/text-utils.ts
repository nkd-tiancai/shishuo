/**
 * 文本工具 —— 句号感知截断，避免中文多字节字符截断。
 *
 * JS String.slice() 基于 UTF-16 code unit，中文在 BMP 内为单 code unit，
 * 不会出现代理对截断。但仍需避免截断在句子中间。
 */

const SENTENCE_END = /[。！？.!?]/g;

/**
 * 在 maxChars 范围内找到最后一个句子终止符处截断。
 * 找不到终止符时退回原始字符截断。
 */
export function truncateToSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const segment = text.slice(0, maxChars);
  // 从后往前找最后一个句子终止符
  let lastEnd = -1;
  let match: RegExpExecArray | null;
  const re = new RegExp(SENTENCE_END.source, "g");
  while ((match = re.exec(segment)) !== null) {
    lastEnd = match.index;
  }

  if (lastEnd >= 0) {
    return text.slice(0, lastEnd + 1);
  }

  // 找不到句子边界，退回原始字符截断
  return segment;
}
