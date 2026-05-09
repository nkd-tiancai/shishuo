import knowledgeData from "@/data/knowledge-index.json";
import type { KnowledgeGraph } from "./graph-types";
import { KnowledgeEntry } from "./types";
import fs from "fs";

export interface PaperEntry {
  slug: string;
  title: string;
  author: string;
  year: number;
  topics: string[];
}

interface KBConcept {
  slug: string;
  title: string;
  file: string;
  concepts: string[];
  prerequisites: string[];
  professor: string;
  difficulty: number;
}

interface KnowledgeBase {
  label: string;
  description: string;
  concepts: Record<string, KBConcept>;
  order: string[];
}

function defaultKB(): KnowledgeBase | undefined {
  const kbs = knowledgeData.knowledgeBases as Record<string, KnowledgeBase>;
  const key = Object.keys(kbs)[0];
  return key ? kbs[key] : undefined;
}

function getKB(name: string): KnowledgeBase | undefined {
  const kbs = knowledgeData.knowledgeBases as Record<string, KnowledgeBase>;
  return kbs[name];
}

let _cachedGraph: KnowledgeGraph | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 30_000; // invalidate after 30s

function getGraph(): KnowledgeGraph | null {
  const now = Date.now();
  if (_cachedGraph && now - _cacheTime < CACHE_TTL_MS) return _cachedGraph;
  try {
    const path = "d:/claude code/web/data/graph.json";
    if (fs.existsSync(path)) {
      _cachedGraph = JSON.parse(fs.readFileSync(path, "utf-8")) as KnowledgeGraph;
      _cacheTime = now;
    }
  } catch {}
  return _cachedGraph;
}

export function getGraphAwareConcept(slug: string, kbName?: string): KnowledgeEntry | undefined {
  const graph = getGraph();
  if (graph) {
    const node = graph.nodes.find((n) => n.slug === slug || n.id === slug);
    if (node) {
      return {
        slug: node.slug || node.id,
        title: node.title || node.label,
        file: node.source_file || "",
        concepts: node.concepts || [],
        prerequisites: [], // graph edges used separately
        professor: node.professor || "马超",
        difficulty: node.difficulty || 3,
        completed: node.completed ?? false,
      };
    }
  }
  return getConcept(slug, kbName);
}

export function getConcept(slug: string, kbName?: string): KnowledgeEntry | undefined {
  const kb = kbName ? getKB(kbName) : defaultKB();
  if (!kb) return undefined;
  const entry = kb.concepts[slug];
  if (!entry) return undefined;
  return { ...entry, completed: false };
}

export function getAllConcepts(kbName?: string): KnowledgeEntry[] {
  const kb = kbName ? getKB(kbName) : defaultKB();
  if (!kb) return [];
  return Object.values(kb.concepts).map((e) => ({
    ...e,
    completed: false,
  }));
}

export function getNextConcept(completedSlugs: string[], kbName?: string): KnowledgeEntry | null {
  const kb = kbName ? getKB(kbName) : defaultKB();
  if (!kb) return null;
  for (const slug of kb.order) {
    if (completedSlugs.includes(slug)) continue;
    const entry = kb.concepts[slug];
    if (!entry) continue;
    const prereqsMet = entry.prerequisites.every((p: string) => completedSlugs.includes(p));
    if (prereqsMet) return { ...entry, completed: false };
  }
  return null;
}

export function getPrerequisites(slug: string, kbName?: string): KnowledgeEntry[] {
  const entry = getConcept(slug, kbName);
  if (!entry) return [];
  return entry.prerequisites
    .map((p) => getConcept(p, kbName))
    .filter(Boolean) as KnowledgeEntry[];
}

export function getProfessorForConcept(slug: string, kbName?: string): string {
  return getConcept(slug, kbName)?.professor ?? "马超";
}

export function getAllPapers(): PaperEntry[] {
  return (knowledgeData.papers || []) as PaperEntry[];
}

export function getPaper(slug: string): PaperEntry | undefined {
  return getAllPapers().find((p) => p.slug === slug);
}

export function listKnowledgeBases(): { key: string; label: string; description: string }[] {
  const kbs = knowledgeData.knowledgeBases as Record<string, KnowledgeBase>;
  return Object.entries(kbs).map(([key, kb]) => ({
    key,
    label: kb.label,
    description: kb.description,
  }));
}
