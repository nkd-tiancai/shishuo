"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MarkLearnedButton({
  lessonId,
  learned,
}: {
  lessonId: string;
  learned: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function markLearned() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/dashboard/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(data.error || "更新进度失败");
      return;
    }

    router.refresh();
  }

  return (
    <div className="stack">
      <button className="button secondary" disabled={busy || learned} type="button" onClick={markLearned}>
        {learned ? "已学会" : busy ? "记录中..." : "标记已学会"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
