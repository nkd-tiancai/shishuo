"use client";

import { useState, useEffect } from "react";
import type { KnowledgeGraph, GraphNode as IGraphNode } from "@/lib/graph-types";
import KnowledgeGraphView from "@/components/KnowledgeGraph";

export default function GraphPage() {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [status, setStatus] = useState<{ built: boolean; totalNodes?: number; builtAt?: string } | null>(null);
  const [completedSlugs, setCompletedSlugs] = useState<string[]>([]);

  useEffect(() => {
    // Load learned slugs
    try {
      const learned = JSON.parse(localStorage.getItem("socratopia-learned") || "[]");
      setCompletedSlugs(learned as string[]);
    } catch {}

    // Check graph build status
    fetch("/api/graphify")
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => setStatus({ built: false }));

    // Load graph if exists
    fetch("/api/graph")
      .then((r) => r.json())
      .then((d) => {
        if (d.nodes) setGraph(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function buildGraph() {
    setBuilding(true);
    fetch("/api/graphify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ corpus: "markdown", options: { deep: false } }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { alert(d.error); return; }
        return fetch("/api/graph");
      })
      .then((r) => r?.json())
      .then((d) => {
        if (d.nodes) setGraph(d);
        setStatus({ built: true, totalNodes: d.nodes?.length, builtAt: new Date().toISOString() });
      })
      .catch((e) => alert(String(e)))
      .finally(() => setBuilding(false));
  }

  function handleNodeClick(node: IGraphNode) {
    const slug = node.slug || node.id;
    window.history.pushState(null, "", `/?concept=${slug}`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header style={{
        padding: "0.75rem 1.25rem",
        borderBottom: "1px solid var(--border-color)",
        background: "var(--bg-header)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem", fontStyle: "italic" }}>
            知识图谱
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: 1 }}>
            {graph ? `${graph.metadata.totalNodes} 个概念 · ${graph.metadata.totalEdges} 条关系` : "加载中..."}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {status && !status.built && (
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              图谱未构建
            </span>
          )}
          <button
            className="btn-primary"
            onClick={buildGraph}
            disabled={building}
            style={{ fontSize: "0.8rem" }}
          >
            {building ? "构建中..." : "构建图谱"}
          </button>
          <a href="/" style={{ fontSize: "0.8rem", color: "var(--accent)", textDecoration: "none" }}>
            ← 课堂
          </a>
        </div>
      </header>

      <div style={{ flex: 1, overflow: "hidden" }}>
        {loading && (
          <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "5rem" }}>
            加载图谱数据...
          </div>
        )}

        {!loading && !graph && (
          <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "5rem" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontStyle: "italic", marginBottom: "0.5rem", opacity: 0.6 }}>
              图谱
            </div>
            <p style={{ fontSize: "1rem", marginBottom: "0.35rem", color: "var(--text-primary)" }}>
              点击「构建图谱」开始分析知识库拓扑
            </p>
            <p style={{ fontSize: "0.8rem" }}>
              基于 Graphify 对教材文本的语义提取生成概念图谱
            </p>
            <button
              className="btn-primary"
              onClick={buildGraph}
              disabled={building}
              style={{ marginTop: "1.5rem" }}
            >
              {building ? "构建中..." : "构建图谱"}
            </button>
          </div>
        )}

        {!loading && graph && (
          <KnowledgeGraphView
            rawNodes={graph.nodes}
            rawEdges={graph.edges}
            completedSlugs={completedSlugs}
            onNodeClick={handleNodeClick}
          />
        )}
      </div>
    </div>
  );
}
