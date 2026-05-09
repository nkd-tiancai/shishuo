import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { KnowledgeGraph, GraphNode } from "@/lib/graph-types";
import { PATHS } from "@/lib/env";

function loadGraph(): KnowledgeGraph | null {
  const gPath = PATHS.graphJson;
  if (!gPath || !fs.existsSync(gPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(gPath, "utf-8")) as KnowledgeGraph;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const graph = loadGraph();
  if (!graph) {
    return NextResponse.json({ error: "Graph not built yet. POST /api/graphify first." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const nodeId = searchParams.get("node");

  if (nodeId) {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });
    const neighbors = graph.edges
      .filter((e) => e.source === nodeId || e.target === nodeId)
      .map((e) => {
        const other = e.source === nodeId ? e.target : e.source;
        const neighbor = graph.nodes.find((n) => n.id === other);
        return neighbor ? { ...neighbor, relation: e.relation } : null;
      })
      .filter(Boolean) as GraphNode[];
    return NextResponse.json({ node, neighbors });
  }

  return NextResponse.json(graph);
}
