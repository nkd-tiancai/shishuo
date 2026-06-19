export interface SocraticPrompt {
  label: string;
  question: string;
  hint: string;
}

export interface SocraticScript {
  opening: string;
  prompts: SocraticPrompt[];
  summary: string;
  reflection: string[];
}

function sentenceCandidates(content: string) {
  return content
    .replace(/\s+/g, " ")
    .split(/(?<=[。！？.!?])\s*/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 18)
    .slice(0, 6);
}

function keywordCandidates(title: string, content: string) {
  const text = `${title} ${content}`
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text.split(" ").filter((word) => word.length >= 2 && word.length <= 16);
  return Array.from(new Set(words)).slice(0, 5);
}

function compact(value: string, max = 120) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function buildSocraticScript(title: string, content: string): SocraticScript {
  const sentences = sentenceCandidates(content);
  const keywords = keywordCandidates(title, content);
  const anchor = sentences[0] || compact(content, 120) || title;
  const second = sentences[1] || anchor;
  const third = sentences[2] || second;
  const keyword = keywords[0] || title;

  return {
    opening: `我们先不急着记住「${title}」。先用一个问题进入：如果只能向别人解释这一节最重要的一点，你会怎么说？`,
    prompts: [
      {
        label: "定位核心",
        question: `这段内容里，哪一句最像核心判断？为什么不是别的句子？`,
        hint: `可以先看这句：${compact(anchor)}`,
      },
      {
        label: "拆开概念",
        question: `如果把「${keyword}」讲给一个完全没接触过的人，你需要先解释哪两个前提？`,
        hint: "不要直接给定义，先找它依赖的条件、目标或问题背景。",
      },
      {
        label: "追问理由",
        question: `作者为什么会得出「${compact(second, 80)}」这样的说法？它解决了什么困惑？`,
        hint: "试着把理由写成“因为...所以...”的句子。",
      },
      {
        label: "举反例",
        question: `有没有一种情况会让这节内容的结论不再成立，或者至少需要补充条件？`,
        hint: `可以从这句开始挑战：${compact(third)}`,
      },
      {
        label: "迁移应用",
        question: "如果把这一节用于你自己的学习任务，下一步最小行动是什么？",
        hint: "把行动写小一点，最好是今天可以完成的一步。",
      },
    ],
    summary: `这一节的学习目标不是背下「${title}」，而是能说清它的核心判断、成立条件、可能例外，以及你能把它用到哪里。`,
    reflection: [
      "我现在能不能用自己的话讲出这一节的核心问题？",
      "我有没有找到至少一个成立条件或反例？",
      "我下一次复习时，最应该重新追问哪一点？",
    ],
  };
}
