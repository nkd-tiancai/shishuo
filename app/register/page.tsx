"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, inviteCode }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(data.error || "注册失败");
      return;
    }
    router.push("/login");
  }

  return (
    <main className="shell">
      <section className="panel narrow">
        <p className="eyebrow">Invite Only</p>
        <h1>邀请码注册</h1>
        <p className="muted">当前阶段只开放给持有一次性邀请码的用户；邮箱不会自动通过，邀请码用过就失效。</p>
        <form className="stack" onSubmit={submit}>
          <div className="field">
            <label htmlFor="name">昵称</label>
            <input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="email">邮箱</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">密码，至少 8 位，包含字母和数字</label>
            <input id="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="inviteCode">邀请码</label>
            <input id="inviteCode" autoComplete="off" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required />
          </div>
          {error && <div className="error">{error}</div>}
          <button className="button" disabled={busy} type="submit">
            {busy ? "注册中..." : "注册"}
          </button>
        </form>
        <p className="muted">
          已有账号？ <Link href="/login">去登录</Link>
        </p>
      </section>
    </main>
  );
}
