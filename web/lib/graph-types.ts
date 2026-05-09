export interface GraphNode {
  id: string;
  label: string;
  file_type: "code" | "document" | "paper" | "image" | "rationale";
  source_file: string;
  source_location: string | null;
  confidence: "EXTRACTED" | "INFERRED" | "AMBIGUOUS";
  community: number;
  // Compatible with existing knowledge-index.json
  slug?: string;
  title?: string;
  professor?: string;
  difficulty?: number;
  concepts?: string[];
  completed?: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  confidence: "EXTRACTED" | "INFERRED" | "AMBIGUOUS";
  confidence_score: number;
  weight: number;
}

export interface GraphCommunity {
  id: number;
  label: string;
  cohesion: number;
  nodeIds: string[];
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  communities: GraphCommunity[];
  metadata: {
    corpus: string;
    builtAt: string;
    totalNodes: number;
    totalEdges: number;
    totalCommunities: number;
  };
}
