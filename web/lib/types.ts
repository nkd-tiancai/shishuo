export interface Character {
  name: string;
  role: "professor" | "classmate";
  file: string;
  color: string;
  initial: string;
  subject: string[];
}

export interface KnowledgeEntry {
  slug: string;
  title: string;
  file: string;
  section?: string;
  concepts: string[];
  prerequisites: string[];
  professor: string;
  difficulty: number;
  completed?: boolean;
}

export interface ChatMessage {
  role: string;
  content: string;
  timestamp: number;
}

export const CHARACTERS: Character[] = [
  {
    name: "马超",
    role: "professor",
    file: "teacher/马超.md",
    color: "#d4a574",
    initial: "马",
    subject: ["math", "statistics"],
  },
  {
    name: "九雀",
    role: "professor",
    file: "teacher/九雀.md",
    color: "#9b7ec4",
    initial: "九",
    subject: ["probability", "ml-theory"],
  },
  {
    name: "牢施",
    role: "classmate",
    file: "teacher/牢施.md",
    color: "#e8937b",
    initial: "施",
    subject: [],
  },
  {
    name: "小华",
    role: "classmate",
    file: "teacher/小华.md",
    color: "#7aaf8c",
    initial: "华",
    subject: [],
  },
];

export const TUTORING_DIR = "d:\\claude code\\辅导";
