import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import type { KnowledgeGraph } from "@/lib/graph-types";
import { PATHS } from "@/lib/env";

function loadGraph(): KnowledgeGraph | null {
  const graphPath = PATHS.graphJson;
  if (!graphPath || !fs.existsSync(graphPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(graphPath, "utf-8")) as KnowledgeGraph;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const graph = loadGraph();
  if (!graph) {
    return NextResponse.json({ error: "Graph not built yet" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").toLowerCase().trim();

  if (!q) {
    return NextResponse.json({ error: "Missing q parameter" }, { status: 400 });
  }

  // BFS-style label matching
  const terms = q.split(/\s+/).filter((t) => t.length > 2);
  const scored = graph.nodes.map((node) => {
    const label = node.label.toLowerCase();
    const concepts = (node.concepts || []).join(" ").toLowerCase();
    const score = terms.reduce((s, term) => {
      return s + (label.includes(term) ? 2 : 0) + (concepts.includes(term) ? 1 : 0);
    }, 0);
    return { node, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const results = scored.filter((s) => s.score > 0).slice(0, 10).map((s) => s.node);

  return NextResponse.json({ query: q, results, total: results.length });
}
