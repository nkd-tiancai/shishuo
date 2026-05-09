"use client";

import { useState, useEffect, useRef } from "react";
import Avatar from "../components/Avatar";
import type { KnowledgeGraph } from "@/lib/graph-types";
import dynamic from "next/dynamic";

const KnowledgeGraph = dynamic(() => import("@/components/KnowledgeGraph"), { ssr: false });

interface ConceptItem {
  slug: string;
  title: string;
  file: string;
  concepts: string[];
  prerequisites: string[];
  professor: string;
  difficulty: number;
}

interface PaperItem {
  slug: string;
  title: string;
  author: string;
  year: number;
  topics: string[];
  linkedChapter?: string;
  linkedChapterTitle?: string;
  linkedKB?: string;
}

interface KBInfo {
  label: string;
  description: string;
  concepts: ConceptItem[];
  order: string[];
}

function DiffStars({ level }: { level: number }) {
  return (
    <span style={{ color: level <= 2 ? "#7aaf8c" : level === 3 ? "#d4a574" : "#e8937b", fontSize: "0.75rem" }}>
      {"★".repeat(level)}{"☆".repeat(5 - level)}
    </span>
  );
}

// localStorage helpers
function getLearned(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("socratopia-learned") || "[]");
  } catch { return []; }
}

function toggleLearned(slug: string): string[] {
  const learned = getLearned();
  const idx = learned.indexOf(slug);
  if (idx >= 0) learned.splice(idx, 1);
  else learned.push(slug);
  localStorage.setItem("socratopia-learned", JSON.stringify(learned));
  return learned;
}

function getLastStudied(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("socratopia-last-studied");
}

function setLastStudied(slug: string) {
  localStorage.setItem("socratopia-last-studied", slug);
}

export default function LibraryPage() {
  const [data, setData] = useState<Record<string, KBInfo> | null>(null);
  const [kbOrder, setKbOrder] = useState<string[]>([]);
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [activeKB, setActiveKB] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"concepts" | "papers" | "graph">("concepts");
  const [learned, setLearned] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [showNewKB, setShowNewKB] = useState(false);
  const [newKBKey, setNewKBKey] = useState("");
  const [newKBLabel, setNewKBLabel] = useState("");
  const [newKBDesc, setNewKBDesc] = useState("");
  const [kbCreating, setKbCreating] = useState(false);
  const [graphData, setGraphData] = useState<KnowledgeGraph | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/library")
      .then((r) => r.json())
      .then((d) => {
        setData(d.knowledgeBases);
        setPapers(d.papers || []);
        setKbOrder(d.kbOrder || Object.keys(d.knowledgeBases || {}));
        const keys = d.kbOrder || Object.keys(d.knowledgeBases || {});
        if (keys.length > 0) setActiveKB(keys[0]);
      })
      .catch(() => {});
    setLearned(getLearned());
  }, []);

  // Load graph data when tab is opened
  useEffect(() => {
    if (activeTab === "graph" && !graphData) {
      fetch("/api/graph")
        .then((r) => r.json())
        .then((d) => { if (d.nodes) setGraphData(d); })
        .catch(() => {});
    }
  }, [activeTab]);

  async function handleCreateKB() {
    if (!newKBKey.trim() || !newKBLabel.trim()) return;
    setKbCreating(true);
    try {
      const res = await fetch("/api/library/new-kb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: newKBKey.trim(),
          label: newKBLabel.trim(),
          description: newKBDesc.trim() || "新建知识库",
        }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      // Refresh data and switch to new KB
      const refresh = await fetch("/api/library").then((r) => r.json());
      setData(refresh.knowledgeBases);
      setKbOrder(refresh.kbOrder || Object.keys(refresh.knowledgeBases || {}));
      setPapers(refresh.papers || []);
      setActiveKB(newKBKey.trim());
      setShowNewKB(false);
      setNewKBKey("");
      setNewKBLabel("");
      setNewKBDesc("");
    } catch (err) {
      alert(`创建失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setKbCreating(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadMsg("");
    const form = new FormData();
    form.append("file", file);
    form.append("kbName", activeKB);
    try {
      const res = await fetch("/api/library/upload", { method: "POST", body: form });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setUploadMsg(`✅ ${result.filename} 已添加`);
      const refresh = await fetch("/api/library").then((r) => r.json());
      setData(refresh.knowledgeBases);
      setKbOrder(refresh.kbOrder || Object.keys(refresh.knowledgeBases || {}));
      setPapers(refresh.papers || []);
    } catch (err) {
      setUploadMsg(`❌ ${err instanceof Error ? err.message : "上传失败"}`);
    } finally {
      setUploading(false);
      setDragOver(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && /\.(md|txt|pdf)$/i.test(file.name)) {
      handleUpload(file);
    } else {
      setUploadMsg("❌ 只支持 .md / .txt / .pdf");
    }
  }

  function startStudy(slug: string) {
    setLastStudied(slug);
    window.location.href = `/?concept=${slug}`;
  }

  function handleToggleLearned(slug: string, e: React.MouseEvent) {
    e.stopPropagation();
    setLearned(toggleLearned(slug));
  }

  if (!data || !activeKB) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--text-muted)" }}>
        加载中...
      </div>
    );
  }

  const kb = data[activeKB];
  if (!kb) return null;

  const concepts = (kb.order || [])
    .map((slug) => kb.concepts.find((c) => c.slug === slug))
    .filter(Boolean) as ConceptItem[];

  const learnedConcepts = concepts.filter((c) => learned.includes(c.slug));
  const unlearnedConcepts = concepts.filter((c) => !learned.includes(c.slug));
  const lastStudied = getLastStudied();

  return (
    <div style={{ height: "100vh", overflowY: "auto", background: "var(--bg-main)" }}>
      {/* Header */}
      <header style={{
        padding: "1rem 1.5rem",
        borderBottom: "1px solid var(--border-color)",
        background: "var(--bg-header)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem", fontStyle: "italic" }}>
            知识库
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: 2 }}>
            {concepts.length} 节课 · {papers.length} 篇论文 · {learned.length}/{concepts.length} 已学
          </div>
        </div>
        <a href="/" style={{
          padding: "0.4rem 0.85rem",
          borderRadius: "var(--radius-sm)",
          background: "var(--accent)",
          color: "#fff",
          textDecoration: "none",
          fontSize: "0.8rem",
          fontWeight: 600,
        }}>
          回课堂
        </a>
      </header>

      <div style={{ padding: "1.5rem", maxWidth: 1000 }}>
        {/* Knowledge base tabs — ordered learning path */}
        <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          {(kbOrder.length > 0 ? kbOrder : Object.keys(data)).filter(k => data[k]).map((key, idx) => (
            <button
              key={key}
              onClick={() => setActiveKB(key)}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: 99,
                border: activeKB === key ? "2px solid var(--accent)" : "1px solid var(--border-color)",
                background: activeKB === key ? "var(--accent-light)" : "var(--bg-card)",
                color: activeKB === key ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: activeKB === key ? 700 : 400,
                fontSize: "0.8rem",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {idx + 1}. {data[key].label}
            </button>
          ))}
          <button
            onClick={() => setShowNewKB(true)}
            style={{
              padding: "0.4rem 0.85rem",
              borderRadius: 99,
              border: "1px dashed var(--border-color)",
              background: "transparent",
              color: "var(--text-muted)",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            + 新建
          </button>
        </div>

        {/* KB description */}
        <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
          {kb.description}
        </p>

        {/* New KB Modal */}
        {showNewKB && (
          <div
            onClick={() => setShowNewKB(false)}
            style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(61,46,30,0.3)", zIndex: 100,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "var(--bg-card)", borderRadius: "var(--radius-md)",
                padding: "1.5rem", width: 380, maxWidth: "90vw",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <h3 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", marginTop: 0, marginBottom: "1rem" }}>
                新建知识库
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "0.2rem" }}>
                    标识 Key <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(英文)</span>
                  </label>
                  <input className="chat-input" value={newKBKey}
                    onChange={(e) => setNewKBKey(e.target.value)}
                    placeholder="e.g. physics-basics" />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "0.2rem" }}>
                    名称
                  </label>
                  <input className="chat-input" value={newKBLabel}
                    onChange={(e) => setNewKBLabel(e.target.value)}
                    placeholder="e.g. 物理基础" />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "0.2rem" }}>
                    描述
                  </label>
                  <input className="chat-input" value={newKBDesc}
                    onChange={(e) => setNewKBDesc(e.target.value)}
                    placeholder="简短描述这个知识库的内容" />
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem", justifyContent: "flex-end" }}>
                <button className="btn-ghost" onClick={() => setShowNewKB(false)}>取消</button>
                <button className="btn-primary" onClick={handleCreateKB}
                  disabled={kbCreating || !newKBKey.trim() || !newKBLabel.trim()}>
                  {kbCreating ? "创建中..." : "创建"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab toggle: concepts / papers / graph */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <button onClick={() => setActiveTab("concepts")} style={{
            padding: "0.35rem 0.75rem", borderRadius: 6, border: "none",
            background: activeTab === "concepts" ? "var(--accent)" : "var(--bg-hover)",
            color: activeTab === "concepts" ? "#fff" : "var(--text-secondary)",
            fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
          }}>
            课程 ({concepts.length})
          </button>
          <button onClick={() => setActiveTab("papers")} style={{
            padding: "0.35rem 0.75rem", borderRadius: 6, border: "none",
            background: activeTab === "papers" ? "var(--accent)" : "var(--bg-hover)",
            color: activeTab === "papers" ? "#fff" : "var(--text-secondary)",
            fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
          }}>
            论文 ({papers.length})
          </button>
          <button onClick={() => setActiveTab("graph")} style={{
            padding: "0.35rem 0.75rem", borderRadius: 6, border: "none",
            background: activeTab === "graph" ? "var(--accent)" : "var(--bg-hover)",
            color: activeTab === "graph" ? "#fff" : "var(--text-secondary)",
            fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
          }}>
            图谱
          </button>
        </div>

        {/* Last studied hint */}
        {lastStudied && (
          <div style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "var(--radius-sm)",
            background: "var(--accent-light)",
            marginBottom: "1rem",
            fontSize: "0.78rem",
            display: "flex", alignItems: "center", gap: "0.5rem",
          }}>
            <span>📍</span>
            <span>上次学到: <strong>{concepts.find(c => c.slug === lastStudied)?.title || lastStudied}</strong></span>
            <button onClick={() => startStudy(lastStudied)} style={{
              marginLeft: "auto", padding: "0.2rem 0.6rem",
              borderRadius: 4, border: "none",
              background: "var(--accent)", color: "#fff",
              fontSize: "0.7rem", cursor: "pointer",
            }}>
              继续学习
            </button>
          </div>
        )}

        {/* Upload zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border-color)"}`,
            borderRadius: "var(--radius-md)",
            padding: "1.2rem",
            textAlign: "center",
            cursor: "pointer",
            background: dragOver ? "var(--bg-hover)" : "var(--bg-card)",
            marginBottom: "1.25rem",
            transition: "all 0.2s ease",
          }}
        >
          {uploading ? <span style={{ color: "var(--text-secondary)" }}>上传中...</span> : (
            <>📂 拖入教材文件 (.md/.txt/.pdf) 自动添加到当前知识库</>
          )}
          <input ref={fileInputRef} type="file" accept=".md,.txt,.pdf" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
        </div>
        {uploadMsg && (
          <div style={{
            padding: "0.45rem 0.75rem", borderRadius: "var(--radius-sm)",
            background: uploadMsg.startsWith("✅") ? "#ecfdf5" : "#fef2f2",
            color: uploadMsg.startsWith("✅") ? "#065f46" : "#991b1b",
            fontSize: "0.78rem", marginBottom: "1rem",
          }}>{uploadMsg}</div>
        )}

        {/* Concepts list */}
        {activeTab === "concepts" && (
          <>
            {unlearnedConcepts.length > 0 && (
              <>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", marginBottom: "0.5rem", opacity: 0.8 }}>
                  待学习 ({unlearnedConcepts.length})
                </h3>
                <ConceptList
                  concepts={unlearnedConcepts}
                  learned={learned}
                  allConcepts={concepts}
                  onStudy={startStudy}
                  onToggle={handleToggleLearned}
                />
              </>
            )}

            {learnedConcepts.length > 0 && (
              <>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", margin: "1.5rem 0 0.5rem", opacity: 0.6 }}>
                  已学习 ({learnedConcepts.length})
                </h3>
                <ConceptList
                  concepts={learnedConcepts}
                  learned={learned}
                  allConcepts={concepts}
                  onStudy={startStudy}
                  onToggle={handleToggleLearned}
                  dimmed
                />
              </>
            )}
          </>
        )}

        {/* Graph tab */}
        {activeTab === "graph" && (
          <div style={{ height: "calc(100vh - 280px)", borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-color)" }}>
            {graphData ? (
              <KnowledgeGraph
                rawNodes={graphData.nodes}
                rawEdges={graphData.edges}
                completedSlugs={learned}
                onNodeClick={(node) => {
                  if (node.slug) startStudy(node.slug);
                }}
              />
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "4rem" }}>
                <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
                  图谱未构建，请先在
                  <a href="/graph" style={{ color: "var(--accent)", textDecoration: "none" }}> 图谱页面</a>
                  点击「构建图谱」
                </p>
                <a href="/graph" className="btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>
                  前往构建
                </a>
              </div>
            )}
          </div>
        )}

        {/* Papers */}
        {activeTab === "papers" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {papers.map((p) => (
              <div key={p.slug}
                title={`${p.author} (${p.year})\n${p.topics.join(", ")}`}
                onClick={() => { window.location.href = `/paper-chat?slug=${p.slug}`; }}
                style={{
                  padding: "0.45rem 0.75rem",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.78rem",
                  maxWidth: 340,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 600 }}>{p.title}</div>
                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: 2 }}>
                  {p.author} · {p.year}
                </div>
                {p.linkedChapterTitle && (
                  <div style={{
                    fontSize: "0.62rem", color: "var(--accent)", marginTop: 3,
                    background: "var(--accent-light)", padding: "0.1rem 0.4rem",
                    borderRadius: 4, display: "inline-block",
                  }}>
                    → {p.linkedChapterTitle}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConceptList({
  concepts, learned, allConcepts, onStudy, onToggle, dimmed,
}: {
  concepts: ConceptItem[];
  learned: string[];
  allConcepts: ConceptItem[];
  onStudy: (slug: string) => void;
  onToggle: (slug: string, e: React.MouseEvent) => void;
  dimmed?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {concepts.map((c, i) => {
        const isLearned = learned.includes(c.slug);
        const preqsMet = c.prerequisites.every((p) => learned.includes(p));
        return (
          <div key={c.slug}
            onClick={() => onStudy(c.slug)}
            style={{
              display: "flex", alignItems: "center", gap: "0.6rem",
              padding: "0.6rem 0.85rem",
              background: "var(--bg-card)",
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${isLearned ? "#7aaf8c" : "var(--border-light)"}`,
              opacity: dimmed ? 0.6 : 1,
              cursor: "pointer",
              transition: "all 0.12s ease",
            }}
            title={!preqsMet ? `前置未完成: ${c.prerequisites.map(p => allConcepts.find(x => x.slug === p)?.title || p).join(", ")}` : ""}
          >
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              background: isLearned ? "#7aaf8c" : "var(--bg-hover)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.7rem", fontWeight: 700,
              color: isLearned ? "#fff" : "var(--text-secondary)",
              flexShrink: 0,
            }}>
              {isLearned ? "✓" : (i + 1)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                {c.title}
                {!preqsMet && <span style={{ fontSize: "0.65rem", color: "#e8937b", marginLeft: "0.4rem" }}>🔒 前置未完成</span>}
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 1 }}>
                {c.concepts.slice(0, 4).join(" · ")}
              </div>
            </div>
            <Avatar name={c.professor} size="sm" />
            <DiffStars level={c.difficulty} />
            <button
              onClick={(e) => onToggle(c.slug, e)}
              style={{
                padding: "0.2rem 0.45rem",
                borderRadius: 4,
                border: "none",
                background: isLearned ? "#ecfdf5" : "var(--bg-hover)",
                color: isLearned ? "#065f46" : "var(--text-muted)",
                fontSize: "0.65rem",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {isLearned ? "已学" : "标记"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
