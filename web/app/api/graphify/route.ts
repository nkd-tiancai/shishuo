import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { KnowledgeGraph, GraphNode, GraphEdge } from "@/lib/graph-types";
import { chat } from "@/lib/llm-router";

const MARKDOWN_DIR = "d:/claude code/辅导/markdown";
const OUTPUT_PATH = "d:/claude code/web/data/graph.json";

interface ExtractionNode {
  id: string;
  label: string;
  concepts: string[];
  difficulty: number;
  professor: string;
  kb: string;
}

interface ExtractionEdge {
  source: string;
  target: string;
  relation: "prerequisite_of" | "relates_to" | "extends";
}

interface ExtractionResult {
  nodes: ExtractionNode[];
  edges: ExtractionEdge[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9一-鿿]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

function readMarkdownFiles(dir: string): Array<{ filename: string; content: string }> {
  const files: Array<{ filename: string; content: string }> = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".txt"))) {
      const filePath = path.join(dir, entry.name);
      const content = fs.readFileSync(filePath, "utf-8");
      files.push({ filename: entry.name, content });
    }
  }
  return files;
}

function buildPrompt(files: Array<{ filename: string; content: string }>): string {
  const contentChunks: string[] = [];
  for (const f of files) {
    // Truncate each file to first 3000 chars to stay within token budget
    const truncated = f.content.slice(0, 3000);
    contentChunks.push(`=== ${f.filename} ===\n${truncated}`);
  }
  const text = contentChunks.join("\n\n");

  return `你是一个知识图谱提取专家。从以下教材文本中提取所有关键概念及其关系。

输出严格 JSON 格式，无任何其他文字：
{
  "nodes": [
    {"id": "slug格式唯一标识", "label": "完整标题", "concepts": ["关键词1","关键词2"], "difficulty": 1-5整数, "professor": "马超或九雀", "kb": "所属知识库简称"}
  ],
  "edges": [
    {"source": "slug1", "target": "slug2", "relation": "prerequisite_of表示前置依赖,relates_to表示同领域相关,extends表示递进深化"}
  ]
}

规则：
- difficulty: 1=入门, 2=基础, 3=中等, 4=进阶, 5=困难
- professor: 涉及数学/统计内容选"马超"，涉及ML/概率/深度学习选"九雀"
- kb: AI科学·第一卷 / AI科学·第二卷 / AI科学·第三卷 / AI-ML基础
- 只输出 JSON，不要任何前缀或解释文字

教材文本：
${text}`;
}

async function extractFromChunk(
  files: Array<{ filename: string; content: string }>,
  attempt = 1
): Promise<ExtractionResult> {
  const prompt = buildPrompt(files);
  const reply = await chat("deepseek", [
    {
      role: "user",
      content: prompt,
    },
  ], {
    temperature: 0.2,
    maxTokens: 8192,
  });

  // Try to extract JSON from the response
  let jsonStr = reply.trim();
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) jsonStr = jsonMatch[0];

  try {
    const parsed = JSON.parse(jsonStr) as ExtractionResult;
    if (!parsed.nodes || !parsed.edges) {
      throw new Error("Missing nodes or edges");
    }
    return parsed;
  } catch (e) {
    if (attempt < 2) {
      // Retry with a cleaner prompt
      return extractFromChunk(files, attempt + 1);
    }
    return { nodes: [], edges: [] };
  }
}

function assignCommunities(nodes: GraphNode[]): GraphNode[] {
  const KB_COMMUNITY_MAP: Record<string, number> = {
    "AI科学·第一卷": 0,
    "AI科学·第二卷": 1,
    "AI科学·第三卷": 2,
    "AI-ML基础": 3,
  };

  return nodes.map((n) => {
    const kb = (n as { kb?: string }).kb;
    return {
      ...n,
      community: kb !== undefined ? (KB_COMMUNITY_MAP[kb] ?? -1) : n.community,
    };
  });
}

function toGraphNode(en: ExtractionNode): GraphNode {
  return {
    id: slugify(en.label),
    label: en.label,
    file_type: "document",
    source_file: en.kb,
    source_location: null,
    confidence: "EXTRACTED",
    community: -1,
    slug: slugify(en.label),
    title: en.label,
    professor: en.professor,
    difficulty: en.difficulty,
    concepts: en.concepts,
  };
}

function toGraphEdge(ee: ExtractionEdge): GraphEdge {
  return {
    source: slugify(ee.source),
    target: slugify(ee.target),
    relation: ee.relation,
    confidence: "EXTRACTED",
    confidence_score: 1.0,
    weight: 1.0,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const corpus = body.corpus || "markdown";

    // Read all markdown files
    const files = readMarkdownFiles(MARKDOWN_DIR);
    if (files.length === 0) {
      return NextResponse.json({ error: "No markdown files found" }, { status: 400 });
    }

    // Process files in batches to stay within token limits
    // Group by rough size: ~3 files per batch (each ~3KB = ~9KB total)
    const BATCH_SIZE = 3;
    const batches: Array<typeof files> = [];
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      batches.push(files.slice(i, i + BATCH_SIZE));
    }

    const allNodes: GraphNode[] = [];
    const allEdges: GraphEdge[] = [];

    for (const batch of batches) {
      const result = await extractFromChunk(batch);
      for (const n of result.nodes) {
        allNodes.push(toGraphNode(n));
      }
      for (const e of result.edges) {
        allEdges.push(toGraphEdge(e));
      }
    }

    // Deduplicate nodes by id
    const seen = new Map<string, GraphNode>();
    for (const n of allNodes) {
      if (!seen.has(n.id)) seen.set(n.id, n);
    }
    const nodes = assignCommunities(Array.from(seen.values()));

    // Deduplicate edges
    const edgeSet = new Set<string>();
    const edges: GraphEdge[] = [];
    for (const e of allEdges) {
      const key = `${e.source}->${e.target}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push(e);
      }
    }

    // Build communities
    const communityMap = new Map<number, string[]>();
    for (const node of nodes) {
      if (!communityMap.has(node.community)) communityMap.set(node.community, []);
      communityMap.get(node.community)!.push(node.id);
    }
    const communities = Array.from(communityMap.entries()).map(([id, nodeIds]) => ({
      id,
      label: `Community ${id}`,
      cohesion: 0.5,
      nodeIds,
    }));

    const graph: KnowledgeGraph = {
      nodes,
      edges,
      communities,
      metadata: {
        corpus,
        builtAt: new Date().toISOString(),
        totalNodes: nodes.length,
        totalEdges: edges.length,
        totalCommunities: communities.length,
      },
    };

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(graph, null, 2));

    return NextResponse.json({
      ok: true,
      corpus,
      totalNodes: graph.metadata.totalNodes,
      totalEdges: graph.metadata.totalEdges,
      totalCommunities: graph.metadata.totalCommunities,
      builtAt: graph.metadata.builtAt,
      batches: batches.length,
    });
  } catch (error) {
    console.error("/api/graphify error:", error);
    return NextResponse.json(
      { error: "An internal error occurred." },
      { status: 500 }
    );
  }
}

export async function GET() {
  const graphPath = OUTPUT_PATH;
  if (!fs.existsSync(graphPath)) {
    return NextResponse.json({ built: false });
  }
  const graph = JSON.parse(fs.readFileSync(graphPath, "utf-8")) as KnowledgeGraph;
  return NextResponse.json({
    built: true,
    totalNodes: graph.metadata.totalNodes,
    totalEdges: graph.metadata.totalEdges,
    totalCommunities: graph.metadata.totalCommunities,
    builtAt: graph.metadata.builtAt,
    corpus: graph.metadata.corpus,
  });
}
