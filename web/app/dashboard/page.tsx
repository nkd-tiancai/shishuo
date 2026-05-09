"use client";

import { useState, useEffect } from "react";
import type { KnowledgeGraph, GraphNode } from "@/lib/graph-types";

interface KBInfo {
  label: string;
  concepts: Array<{ slug: string; title: string }>;
  order: string[];
}

export default function DashboardPage() {
  const [learned, setLearned] = useState<string[]>([]);
  const [lastStudied, setLastStudied] = useState<string>("");
  const [totalConcepts, setTotalConcepts] = useState(0);
  const [kbs, setKbs] = useState<Record<string, KBInfo>>({});
  const [streak, setStreak] = useState(0);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [nextRecommend, setNextRecommend] = useState<GraphNode | null>(null);

  useEffect(() => {
    try {
      setLearned(JSON.parse(localStorage.getItem("socratopia-learned") || "[]"));
      setLastStudied(localStorage.getItem("socratopia-last-studied") || "");
      const streakData = JSON.parse(localStorage.getItem("socratopia-streak") || "{}");
      setStreak(streakData.days || 0);
    } catch {}

    fetch("/api/library").then(r => r.json()).then(d => {
      setKbs(d.knowledgeBases || {});
      let total = 0;
      for (const kb of Object.values(d.knowledgeBases || {}) as KBInfo[]) {
        total += kb.concepts.length;
      }
      setTotalConcepts(total);
    }).catch(() => {});

    // Load graph data for enriched progress view
    fetch("/api/graph").then(r => r.json()).then(d => {
      if (d.nodes) {
        setGraphNodes(d.nodes);
        // Find next recommended concept: first unlearned with all prereqs met
        const gNodes = d.nodes as GraphNode[];
        const learnedList: string[] = JSON.parse(localStorage.getItem("socratopia-learned") || "[]");
        for (const n of gNodes) {
          if (n.slug && !learnedList.includes(n.slug)) {
            setNextRecommend(n);
            break;
          }
        }
      }
    }).catch(() => {});
  }, []);

  const learnedCount = learned.length;
  const pct = totalConcepts > 0 ? Math.round((learnedCount / totalConcepts) * 100) : 0;

  // Map KB name to graph nodes
  function getGraphNodesForKB(kbLabel: string): GraphNode[] {
    return graphNodes.filter((n) => n.source_file?.includes(kbLabel));
  }

  return (
    <div style={{ height: "100vh", overflowY: "auto", background: "var(--bg-main)" }}>
      <header style={{
        padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-color)",
        background: "var(--bg-header)", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem", fontStyle: "italic" }}>学习仪表盘</div>
        <a href="/library" style={{ fontSize: "0.8rem", color: "var(--accent)", textDecoration: "none" }}>← 知识库</a>
      </header>

      <div style={{ padding: "1.5rem", maxWidth: 800 }}>
        {/* Stats cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
          <StatCard label="已学课程" value={`${learnedCount}`} sub={`/ ${totalConcepts}`} color="#7aaf8c" />
          <StatCard label="学习进度" value={`${pct}%`} sub={pct >= 50 ? "过半！" : "加油"} color="#d4a574" />
          <StatCard label="连续学习" value={`${streak}`} sub="天" color="#e8937b" />
        </div>

        {/* Graph recommendation */}
        {nextRecommend && (
          <div style={{
            padding: "0.85rem 1rem",
            background: "var(--bg-card)",
            borderRadius: "var(--radius-md)",
            border: "2px solid var(--accent)",
            marginBottom: "1.5rem",
            display: "flex", alignItems: "center", gap: "0.75rem",
            boxShadow: "var(--shadow-sm)",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--accent)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1rem", fontWeight: 700, flexShrink: 0,
            }}>
              →
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>图谱推荐下一步</div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                {nextRecommend.title || nextRecommend.label}
                {nextRecommend.difficulty && (
                  <span style={{
                    marginLeft: "0.4rem", fontSize: "0.65rem", fontWeight: 400,
                    color: nextRecommend.difficulty <= 2 ? "#7aaf8c" : nextRecommend.difficulty === 3 ? "#d4a574" : "#e8937b",
                  }}>
                    L{nextRecommend.difficulty}
                  </span>
                )}
              </div>
              {nextRecommend.concepts && nextRecommend.concepts.length > 0 && (
                <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)", marginTop: 2 }}>
                  {nextRecommend.concepts.slice(0, 5).join(" · ")}
                </div>
              )}
            </div>
            <a href={`/?concept=${nextRecommend.slug || nextRecommend.id}`}
              className="btn-primary"
              style={{ textDecoration: "none", fontSize: "0.75rem", padding: "0.4rem 0.8rem", flexShrink: 0 }}>
              开始学习
            </a>
          </div>
        )}

        {/* Concept list per KB */}
        {Object.entries(kbs).map(([key, kb]) => {
          const concepts = (kb.order || []).map(s => kb.concepts.find(c => c.slug === s)).filter(Boolean) as Array<{slug:string;title:string}>;
          if (concepts.length === 0) return null;
          const kbLearned = concepts.filter(c => learned.includes(c.slug));
          const kbPct = Math.round((kbLearned.length / concepts.length) * 100);

          // Graph-enriched: find nodes for this KB
          const kbGraphNodes = getGraphNodesForKB(kb.label);
          const kbGraphLearned = kbGraphNodes.filter(n => n.slug && learned.includes(n.slug));

          return (
            <div key={key} style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", fontStyle: "italic", margin: 0 }}>
                  {kb.label}
                </h3>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  {kbLearned.length}/{concepts.length} ({kbPct}%)
                  {kbGraphNodes.length > 0 && (
                    <span style={{ marginLeft: "0.3rem", color: "var(--accent)" }}>
                      · 图谱 {kbGraphLearned.length}/{kbGraphNodes.length}
                    </span>
                  )}
                </span>
              </div>
              {/* Progress bar */}
              <div style={{ height: 6, background: "var(--border-light)", borderRadius: 3, overflow: "hidden", marginBottom: "0.75rem" }}>
                <div style={{ height: "100%", width: `${kbPct}%`, background: "var(--accent)", borderRadius: 3, transition: "width 0.5s ease" }} />
              </div>
            </div>
          );
        })}

        {/* Last studied — outside loop */}
        {lastStudied && (
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", padding: "0.75rem", background: "var(--bg-card)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>
            上次学习: {
              (() => {
                for (const kb of Object.values(kbs)) {
                  const c = kb.concepts.find(x => x.slug === lastStudied);
                  if (c) return c.title;
                }
                return lastStudied;
              })()
            }
            <a href={`/?concept=${lastStudied}`} style={{ marginLeft: "0.5rem", color: "var(--accent)", fontSize: "0.72rem", fontWeight: 600 }}>继续学习 →</a>
          </div>
        )}

        {/* Link to start */}
        {learnedCount === 0 && (
          <div style={{ textAlign: "center", marginTop: "3rem", color: "var(--text-muted)" }}>
            <p>还没开始学习。</p>
            <a href="/library" style={{ color: "var(--accent)", fontWeight: 600 }}>去知识库选课 →</a>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      padding: "1rem 1.25rem", background: "var(--bg-card)",
      borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)",
      boxShadow: "var(--shadow-sm)", textAlign: "center",
    }}>
      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.3rem" }}>{label}</div>
      <div style={{ fontSize: "1.8rem", fontWeight: 700, color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{sub}</div>
    </div>
  );
}
