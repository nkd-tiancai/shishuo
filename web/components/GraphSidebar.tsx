"use client";

import type { GraphNode as IGraphNode, GraphEdge } from "@/lib/graph-types";
import { getLegacyPrerequisites } from "@/lib/graph-utils";
import Link from "next/link";

interface GraphSidebarProps {
  node: IGraphNode;
  completedSlugs: string[];
  allNodes: IGraphNode[];
  rawEdges: GraphEdge[];
  onClose: () => void;
}

function getNeighbors(nodeId: string, edges: GraphEdge[], nodes: IGraphNode[]) {
  const neighborIds = new Set<string>();
  for (const e of edges) {
    if (e.source === nodeId) neighborIds.add(e.target);
    if (e.target === nodeId) neighborIds.add(e.source);
  }
  return nodes.filter((n) => neighborIds.has(n.id));
}

function DifficultyStars({ level }: { level?: number }) {
  if (!level) return null;
  return (
    <span style={{ color: level >= 4 ? "#ef4444" : level >= 3 ? "#f59e0b" : "#22c55e" }}>
      {"★".repeat(level)}{"☆".repeat(5 - level)}
    </span>
  );
}

export default function GraphSidebar({
  node,
  completedSlugs,
  allNodes,
  rawEdges,
  onClose,
}: GraphSidebarProps) {
  const neighbors = getNeighbors(node.id, rawEdges, allNodes);
  const legacyPrereqs = node.slug ? getLegacyPrerequisites(node.slug) : [];
  const isCompleted = node.slug ? completedSlugs.includes(node.slug) : false;

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        borderLeft: "1px solid var(--border-color)",
        background: "var(--bg-card)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "0.75rem 1rem",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "var(--accent)",
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
            }}
          >
            {node.label}
          </div>
          {node.slug && (
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: 2 }}>
              {node.slug}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-secondary)",
            fontSize: "1rem",
            padding: "0 0 0 0.5rem",
          }}
        >
          ✕
        </button>
      </div>

      {/* Status */}
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border-light)" }}>
        {isCompleted ? (
          <span style={{ color: "#4ade80", fontSize: "0.75rem", fontWeight: 600 }}>✓ 已学习</span>
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>未学习</span>
        )}
        {node.difficulty && (
          <span style={{ marginLeft: "0.75rem", fontSize: "0.7rem" }}>
            <DifficultyStars level={node.difficulty} />
          </span>
        )}
        {node.professor && (
          <span style={{ marginLeft: "0.75rem", fontSize: "0.7rem", color: "var(--text-secondary)" }}>
            {node.professor}
          </span>
        )}
      </div>

      {/* Concepts */}
      {node.concepts && node.concepts.length > 0 && (
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border-light)" }}>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: 4 }}>关键词</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {node.concepts.map((c) => (
              <span
                key={c}
                style={{
                  padding: "2px 6px",
                  background: "var(--bg-header)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.6rem",
                  color: "var(--text-secondary)",
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Prerequisites */}
      {legacyPrereqs.length > 0 && (
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border-light)" }}>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: 4 }}>
            前置依赖
          </div>
          {legacyPrereqs.map((p) => {
            const done = completedSlugs.includes(p);
            return (
              <div
                key={p}
                style={{
                  fontSize: "0.7rem",
                  color: done ? "#4ade80" : "var(--text-secondary)",
                  marginBottom: 2,
                }}
              >
                {done ? "✓ " : "○ "}
                {p}
              </div>
            );
          })}
        </div>
      )}

      {/* Neighbors */}
      {neighbors.length > 0 && (
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border-light)", flex: 1, overflowY: "auto" }}>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: 6 }}>
            相关概念 ({neighbors.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {neighbors.slice(0, 12).map((n) => (
              <div
                key={n.id}
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-primary)",
                  padding: "4px 6px",
                  background: "var(--bg-header)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                {n.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source file */}
      {node.source_file && (
        <div style={{ padding: "0.5rem 1rem", borderTop: "1px solid var(--border-light)" }}>
          <div style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>
            源: {node.source_file}
          </div>
        </div>
      )}

      {/* Actions */}
      {node.slug && (
        <div style={{ padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <Link
            href={`/?concept=${node.slug}`}
            style={{
              display: "block",
              textAlign: "center",
              padding: "0.4rem",
              background: "var(--accent)",
              color: "#fff",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.75rem",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            进入课堂
          </Link>
          <Link
            href={`/quiz?concept=${node.slug}`}
            style={{
              display: "block",
              textAlign: "center",
              padding: "0.4rem",
              background: "var(--bg-header)",
              color: "var(--text-primary)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.75rem",
              textDecoration: "none",
            }}
          >
            自测
          </Link>
        </div>
      )}
    </div>
  );
}
