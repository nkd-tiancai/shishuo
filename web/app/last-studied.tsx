"use client";

import { useEffect, useState } from "react";

interface ConceptOption {
  slug: string;
  title: string;
}

export default function LastStudied() {
  const [info, setInfo] = useState<ConceptOption | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const slug = localStorage.getItem("socratopia-last-studied");
    if (!slug) { setLoaded(true); return; }

    // Try to get the title from the library API
    fetch("/api/library")
      .then((r) => r.json())
      .then((d) => {
        const kbs = d.knowledgeBases || {};
        for (const kb of Object.values(kbs) as Array<{ concepts: ConceptOption[] }>) {
          const found = kb.concepts.find((c) => c.slug === slug);
          if (found) { setInfo(found); break; }
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  return (
    <div id="sidebar-last-studied" style={{ fontSize: "0.72rem", padding: "0 0.25rem", color: "var(--text-muted)" }}>
      <div style={{ marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.6rem" }}>
        上次学习
      </div>
      {info ? (
        <a
          href={`/?concept=${info.slug}`}
          style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600, fontSize: "0.8rem" }}
        >
          {info.title}
        </a>
      ) : (
        <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>暂无记录</span>
      )}
    </div>
  );
}
