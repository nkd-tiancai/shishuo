import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProgressSummary } from "@/lib/progress-store";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const stats = await getProgressSummary(session.user.id);

  return (
    <main className="shell">
      <section className="panel">
        <div className="row page-head" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1>学习仪表盘</h1>
            <p className="muted">这里只展示当前用户自己的学习进度。</p>
          </div>
          <Link className="button secondary" href="/">返回</Link>
        </div>
        <div className="card-grid">
          <div className="card stat-card">
            <h2>{stats.learnedCount}</h2>
            <p className="muted">已完成课程节</p>
          </div>
          <div className="card stat-card">
            <h2>{stats.totalLessons}</h2>
            <p className="muted">总课程节</p>
          </div>
          <div className="card stat-card">
            <h2>{stats.lastLearnedAt ? new Date(stats.lastLearnedAt).toLocaleDateString("zh-CN") : "-"}</h2>
            <p className="muted">最近学习</p>
          </div>
        </div>
        {!stats.totalLessons && (
          <p className="notice">课程生成完成后，这里会显示你的个人进度、最近学习时间和闪卡复习入口。</p>
        )}
      </section>
    </main>
  );
}
