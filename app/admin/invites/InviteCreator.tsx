"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function InviteCreator() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createInvite(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setCreatedCode("");

    const response = await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(data.error || "创建失败");
      return;
    }

    setCreatedCode(data.code || "");
    setLabel("");
    setExpiresAt("");
    router.refresh();
  }

  return (
    <form className="card stack" onSubmit={createInvite}>
      <div className="row">
        <div className="field" style={{ flex: "1 1 180px" }}>
          <label htmlFor="invite-label">标签</label>
          <input id="invite-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="例如：朋友内测" />
        </div>
        <div className="field" style={{ flex: "1 1 180px" }}>
          <label htmlFor="invite-expires">过期时间</label>
          <input id="invite-expires" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        </div>
      </div>
      <button className="button" disabled={busy} type="submit">
        {busy ? "创建中..." : "创建邀请码"}
      </button>
      {createdCode && (
        <div className="notice">
          <strong>新邀请码：</strong>
          <code>{createdCode}</code>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </form>
  );
}
