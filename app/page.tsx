import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <main className="shell">
      <section className="panel">
        <div className="row page-head" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow">多人个人版</p>
            <h1 style={{ margin: 0 }}>Socratopia 多人个人版</h1>
            <p className="muted">当前用户：{session.user.email}</p>
          </div>
          <div className="row">
            {session.user.role === "ADMIN" && (
              <Link className="button secondary" href="/admin/invites">邀请码</Link>
            )}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="button secondary" type="submit">退出</button>
            </form>
          </div>
        </div>

        <div className="card-grid">
          <div className="card">
            <span className="pill">BYOK</span>
            <h2>Provider</h2>
            <p className="muted">保存你自己的 DeepSeek、Kimi、GLM、GPT 或 MiniMax API。</p>
            <Link className="button" href="/settings">配置 API</Link>
          </div>
          <div className="card">
            <span className="pill">Private</span>
            <h2>教材库</h2>
            <p className="muted">上传 Markdown、TXT 或 PDF 原始文件，先进入个人私有资料库。</p>
            <Link className="button secondary" href="/library">查看教材</Link>
          </div>
          <div className="card">
            <span className="pill">Progress</span>
            <h2>仪表盘</h2>
            <p className="muted">查看当前用户自己的学习进度。</p>
            <Link className="button secondary" href="/dashboard">查看进度</Link>
          </div>
          <div className="card">
            <span className="pill">Draft</span>
            <h2>课程草稿</h2>
            <p className="muted">把 Markdown 或 TXT 教材拆成可学习的小节。</p>
            <Link className="button secondary" href="/courses">查看课程</Link>
          </div>
          <div className="card">
            <span className="pill">Roles</span>
            <h2>人物卡</h2>
            <p className="muted">管理导师、同学和私聊角色，课堂会按你的设定调用他们。</p>
            <Link className="button secondary" href="/characters">管理人物</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
