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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ from: string; to: string }> }
) {
  const graph = loadGraph();
  if (!graph) {
    return NextResponse.json({ error: "Graph not built yet" }, { status: 404 });
  }

  const { from: fromId, to: toId } = await params;

  // BFS shortest path
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  if (!nodeIds.has(fromId) || !nodeIds.has(toId)) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) adjacency.set(node.id, []);
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.push(edge.target);
    adjacency.get(edge.target)?.push(edge.source);
  }

  const queue: [string, string[]][] = [[fromId, [fromId]]];
  const visited = new Set<string>([fromId]);

  while (queue.length > 0) {
    const [current, path] = queue.shift()!;
    if (current === toId) {
      const pathNodes = path.map((id) => {
        const n = graph.nodes.find((g) => g.id === id);
        return n ? { id: n.id, label: n.label } : { id, label: id };
      });
      return NextResponse.json({ path: pathNodes, hops: path.length - 1 });
    }
    for (const neighbor of adjacency.get(current) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, [...path, neighbor]]);
      }
    }
  }

  return NextResponse.json({ path: null, hops: -1 });
}
