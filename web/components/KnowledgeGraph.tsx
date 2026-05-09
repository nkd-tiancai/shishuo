"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphNode as IGraphNode, GraphEdge } from "@/lib/graph-types";
import { getCommunityColor, getDifficultySize, allPrerequisitesMet } from "@/lib/graph-utils";
import GraphSidebar from "./GraphSidebar";

interface KnowledgeGraphProps {
  rawNodes: IGraphNode[];
  rawEdges: GraphEdge[];
  completedSlugs: string[];
  onNodeClick?: (node: IGraphNode) => void;
}

function rfNode(
  n: IGraphNode,
  completedSlugs: string[],
  onSelect: (id: string) => void
): Node {
  const communityColor = getCommunityColor(n.community);
  const isCompleted = n.slug ? completedSlugs.includes(n.slug) : false;
  const size = getDifficultySize(n.difficulty);
  const locked = n.slug ? !allPrerequisitesMet(n.slug, completedSlugs) : false;

  return {
    id: n.id,
    position: { x: (Math.random() - 0.5) * 1200, y: (Math.random() - 0.5) * 800 },
    data: {
      label: n.label,
      communityColor,
      isCompleted,
      locked,
      size,
      node: n,
    },
    style: {
      background: locked ? "#1e1e1e" : communityColor,
      border: isCompleted ? "3px solid #4ade80" : "none",
      borderRadius: "50%",
      width: size,
      height: size,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "0.6rem",
      color: "#fff",
      fontWeight: 600,
      cursor: "pointer",
      boxShadow: isCompleted ? "0 0 12px #4ade8066" : "none",
    },
  };
}

function rfEdge(e: GraphEdge): Edge {
  const style: Record<string, string> = {
    stroke: e.confidence === "EXTRACTED" ? "#94a3b8" : e.confidence === "INFERRED" ? "#60a5fa" : "#f87171",
    strokeWidth: "1.5",
    strokeDasharray: e.confidence === "INFERRED" ? "5,5" : e.confidence === "AMBIGUOUS" ? "2,2" : "0",
  };

  return {
    id: `${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    animated: e.confidence === "INFERRED",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: style.stroke,
    },
    style,
    label: e.relation,
    labelStyle: { fontSize: "0.5rem", fill: "#6b7280" },
    labelBgStyle: { fill: "#fff", fillOpacity: 0.7 },
  };
}

export default function KnowledgeGraph({
  rawNodes,
  rawEdges,
  completedSlugs,
  onNodeClick,
}: KnowledgeGraphProps) {
  const [selectedNode, setSelectedNode] = useState<IGraphNode | null>(null);
  const [search, setSearch] = useState("");

  const initialNodes = useMemo(
    () => rawNodes.map((n) => rfNode(n, completedSlugs, (id) => {
      const node = rawNodes.find((x) => x.id === id);
      if (node) { setSelectedNode(node); onNodeClick?.(node); }
    })),
    [rawNodes, completedSlugs, onNodeClick]
  );

  const initialEdges = useMemo(
    () => rawEdges.map(rfEdge),
    [rawEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Highlight search matches
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());

  const handleSearch = useCallback(
    (q: string) => {
      setSearch(q);
      if (!q.trim()) {
        setHighlightedIds(new Set());
        setNodes((nds) =>
          nds.map((nd) => ({ ...nd, style: { ...nd.style, opacity: 1 } }))
        );
        return;
      }
      const terms = q.toLowerCase().split(/\s+/);
      const matched = new Set<string>();
      for (const nd of rawNodes) {
        const label = nd.label.toLowerCase();
        const concepts = (nd.concepts || []).join(" ").toLowerCase();
        if (terms.some((t) => label.includes(t) || concepts.includes(t))) {
          matched.add(nd.id);
        }
      }
      setHighlightedIds(matched);
      setNodes((nds) =>
        nds.map((nd) => ({
          ...nd,
          style: {
            ...nd.style,
            opacity: matched.has(nd.id) ? 1 : 0.2,
          },
        }))
      );
    },
    [rawNodes, setNodes]
  );

  const nodeColor = useCallback((n: Node) => {
    return (n.data as { communityColor: string }).communityColor || "#60a5fa";
  }, []);

  return (
    <div style={{ display: "flex", height: "100%", position: "relative" }}>
      {/* Search bar */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
        }}
      >
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="搜索概念..."
          style={{
            padding: "0.4rem 0.75rem",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-color)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            fontSize: "0.8rem",
            width: 220,
            outline: "none",
          }}
        />
        <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
          {highlightedIds.size > 0 ? `${highlightedIds.size} 个匹配` : ""}
        </span>
      </div>

      <div style={{ flex: 1 }}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            nodesDraggable
          >
            <Background color="#e5e7eb" gap={20} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={nodeColor}
              maskColor="rgba(0,0,0,0.15)"
              style={{ background: "var(--bg-card)" }}
            />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      {selectedNode && (
        <GraphSidebar
          node={selectedNode}
          completedSlugs={completedSlugs}
          allNodes={rawNodes}
          rawEdges={rawEdges}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
