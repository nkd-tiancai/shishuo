"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setBusy(false);
    if (result?.error) {
      setError("邮箱或密码不正确");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="shell">
      <section className="panel narrow">
        <h1>登录</h1>
        <form className="stack" onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">邮箱</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">密码</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="error">{error}</div>}
          <button className="button" disabled={busy} type="submit">
            {busy ? "登录中..." : "登录"}
          </button>
        </form>
        <p className="muted">
          没有账号？ <Link href="/register">使用邀请码注册</Link>
        </p>
      </section>
    </main>
  );
}
