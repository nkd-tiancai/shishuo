import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import LastStudied from "./last-studied";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Socratopia — 苏格拉底实验室",
  description: "苏格拉底式角色扮演学习平台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={playfair.variable}>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          {/* Sidebar */}
          <aside
            style={{
              width: 210,
              background: "var(--bg-sidebar)",
              borderRight: "1px solid var(--border-color)",
              padding: "1.25rem 1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "1.15rem",
                color: "var(--accent)",
                marginBottom: "1rem",
                letterSpacing: "-0.01em",
                padding: "0 0.25rem",
                fontStyle: "italic",
              }}
            >
              Socrates Lab
            </div>

            <a href="/library" className="nav-link">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
              </svg>
              <span>知识库</span>
            </a>

            <a href="/" className="nav-link">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
                <path d="M8 7h6"/><path d="M8 11h8"/><path d="M8 15h5"/>
              </svg>
              <span>课堂</span>
            </a>

            <a href="/group-chat" className="nav-link">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span>群聊</span>
            </a>

            <a href="/dashboard" className="nav-link">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
              <span>仪表盘</span>
            </a>

            <a href="/graph" className="nav-link">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="2"/>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
              <span>图谱</span>
            </a>

            {/* Divider */}
            <div style={{ height: 1, background: "var(--border-color)", margin: "0.75rem 0.25rem" }} />

            {/* Last studied — client component, no hydration mismatch */}
            <LastStudied />

            {/* Footer */}
            <div
              style={{
                marginTop: "auto",
                fontSize: "0.6rem",
                color: "var(--text-muted)",
                textAlign: "center",
                paddingTop: "1rem",
                borderTop: "1px solid var(--border-light)",
                opacity: 0.7,
              }}
            >
              v0.2 · 苏格拉底实验室
            </div>
          </aside>

          <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
