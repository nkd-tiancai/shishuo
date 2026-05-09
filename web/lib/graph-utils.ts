import type { GraphNode, GraphEdge, GraphCommunity, KnowledgeGraph } from "./graph-types";
import knowledgeData from "@/data/knowledge-index.json";

// Normalize a Graphify node id to match knowledge-index slugs
export function normalizeNodeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
}

// Map a Graphify node to a knowledge-index slug via source_file + label
export function findMatchingSlug(node: GraphNode): string | undefined {
  const allConcepts = getAllLegacyConcepts();
  const sourceFile = node.source_file || "";

  // Try exact match by label
  for (const c of allConcepts) {
    const legacyTitle = (c.title || "").toLowerCase();
    const nodeLabel = node.label.toLowerCase();
    if (legacyTitle === nodeLabel) return c.slug;
    if (
      legacyTitle.includes(nodeLabel) ||
      nodeLabel.includes(legacyTitle)
    ) {
      return c.slug;
    }
  }

  // Try source file match
  for (const c of allConcepts) {
    const file = c.file || "";
    if (file && sourceFile.includes(file.replace(/\\/g, "/"))) {
      return c.slug;
    }
  }

  // Fallback: slug from id
  return normalizeNodeId(node.id);
}

interface LegacyConcept {
  slug: string;
  title: string;
  file: string;
  professor: string;
  difficulty: number;
  concepts: string[];
  prerequisites: string[];
}

function getAllLegacyConcepts(): LegacyConcept[] {
  const result: LegacyConcept[] = [];
  const kbs = knowledgeData.knowledgeBases as Record<string, { concepts: Record<string, LegacyConcept> }>;
  for (const kb of Object.values(kbs)) {
    for (const c of Object.values(kb.concepts)) {
      result.push(c);
    }
  }
  return result;
}

export function getLegacyConcept(slug: string) {
  const kbs = knowledgeData.knowledgeBases as Record<string, { concepts: Record<string, LegacyConcept> }>;
  for (const kb of Object.values(kbs)) {
    if (kb.concepts[slug]) return kb.concepts[slug];
  }
  return undefined;
}

export function getLegacyPrerequisites(slug: string): string[] {
  const c = getLegacyConcept(slug);
  return c?.prerequisites || [];
}

export function allPrerequisitesMet(slug: string, completedSlugs: string[]): boolean {
  const prereqs = getLegacyPrerequisites(slug);
  return prereqs.every((p) => completedSlugs.includes(p));
}

const COMMUNITY_COLORS = [
  "#60a5fa", // blue
  "#34d399", // green
  "#fbbf24", // amber
  "#f87171", // red
  "#a78bfa", // purple
  "#2dd4bf", // teal
  "#fb923c", // orange
  "#e879f9", // pink
  "#94a3b8", // slate
  "#4ade80", // lime
];

export function getCommunityColor(communityId: number): string {
  return COMMUNITY_COLORS[communityId % COMMUNITY_COLORS.length];
}

export function getDifficultySize(difficulty?: number): number {
  if (!difficulty) return 40;
  return 36 + difficulty * 6;
}

export function knowledgeEntryToGraphNode(
  slug: string,
  kbName: string
): GraphNode | null {
  const kbs = knowledgeData.knowledgeBases as Record<
    string,
    { concepts: Record<string, LegacyConcept> }
  >;
  const kb = kbs[kbName];
  if (!kb) return null;
  const c = kb.concepts[slug];
  if (!c) return null;

  return {
    id: slug,
    label: c.title || slug,
    file_type: "document",
    source_file: c.file || "",
    source_location: null,
    confidence: "EXTRACTED",
    community: -1,
    slug: c.slug,
    title: c.title,
    professor: c.professor,
    difficulty: c.difficulty,
    concepts: c.concepts,
  };
}
