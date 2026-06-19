"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "等待生成...",
  RUNNING: "生成中...",
};

function statusLabel(status: string) {
  return STATUS_LABELS[status] || status;
}

export default function GenerateCourseButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function finish(jobId: string, error?: string) {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setBusy(false);
    if (error) setError(error);
  }

  async function pollJob(jobId: string) {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.status === "COMPLETED") {
        finish(jobId);
        if (data.output?.courseId) {
          router.push(`/courses/${data.output.courseId}`);
          router.refresh();
        }
      } else if (data.status === "FAILED") {
        finish(jobId, data.error || "生成失败");
      } else {
        setStatus(statusLabel(data.status));
      }
    } catch {
      // 网络错误忽略，等下一轮轮询
    }
  }

  async function generate() {
    setBusy(true);
    setError("");
    setStatus(statusLabel("PENDING"));

    const response = await fetch("/api/courses/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setBusy(false);
      setError(data.error || "生成失败");
      return;
    }

    const jobId = data.jobId;
    pollJob(jobId);
    timerRef.current = setInterval(() => { pollJob(jobId); }, 2000);
  }

  return (
    <div className="stack">
      <button className="button secondary" disabled={busy} type="button" onClick={generate}>
        {busy ? status || "生成中..." : "生成课程"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
