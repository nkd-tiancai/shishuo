import Link from "next/link";
import { redirect } from "next/navigation";
import InviteCreator from "./InviteCreator";
import { listInviteCodes } from "@/lib/admin-invites";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
}

export default async function AdminInvitesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const invites = await listInviteCodes();

  return (
    <main className="shell">
      <section className="panel">
        <div className="row page-head" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow">Admin</p>
            <h1>邀请码管理</h1>
            <p className="muted">邀请码只在创建时显示一次；列表里只保留状态，不回显原码。</p>
          </div>
          <Link className="button secondary" href="/">返回</Link>
        </div>

        <InviteCreator />

        <div className="card-grid">
          {invites.map((invite) => (
            <div className="card" key={invite.id}>
              <span className="pill">{invite.usedAt ? "USED" : "OPEN"}</span>
              <h2 style={{ fontSize: 16 }}>{invite.label || "未命名邀请码"}</h2>
              <p className="muted">创建：{formatDate(invite.createdAt)}</p>
              <p className="muted">过期：{formatDate(invite.expiresAt)}</p>
              <p className="muted">使用：{formatDate(invite.usedAt)}</p>
            </div>
          ))}
          {!invites.length && (
            <div className="card">
              <h2 style={{ fontSize: 16 }}>还没有邀请码</h2>
              <p className="muted">创建一个邀请码，再发给想邀请的测试用户。</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
