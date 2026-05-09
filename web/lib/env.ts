// Central path configuration — all paths derived from env vars
// Set CONTENT_ROOT in .env.local to your project root (e.g. d:/claude code)

const ROOT = process.env.CONTENT_ROOT || "";

function resolve(sub: string): string {
  return ROOT ? `${ROOT.replace(/\\/g, "/").replace(/\/$/, "")}/${sub}` : "";
}

export const PATHS = {
  tutoringRoot: resolve("辅导"),
  markdownDir: resolve("辅导/markdown"),
  teacherDir: resolve("辅导/teacher"),
  papersDir: resolve("辅导/机器学习论文"),
  webDataDir: resolve("web/data"),
  graphJson: resolve("web/data/graph.json"),
  knowledgeIndex: resolve("web/data/knowledge-index.json"),
} as const;

export function pathOrThrow(key: keyof typeof PATHS): string {
  const p = PATHS[key];
  if (!p) throw new Error(`CONTENT_ROOT not set — cannot resolve ${key}. Create .env.local with CONTENT_ROOT=...`);
  return p;
}
