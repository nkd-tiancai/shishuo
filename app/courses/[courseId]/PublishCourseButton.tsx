"use client";

import { useState } from "react";

export default function PublishCourseButton({
  courseId,
  status,
}: {
  courseId: string;
  status: string;
}) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const published = currentStatus === "PUBLISHED";

  async function togglePublished() {
    setSaving(true);
    setMessage("");
    const nextStatus = published ? "DRAFT" : "PUBLISHED";
    const response = await fetch(`/api/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok || !data.course) {
      setMessage(data.error || "更新失败");
      return;
    }

    setCurrentStatus(data.course.status);
    setMessage(nextStatus === "PUBLISHED" ? "已公开到课程广场" : "已改回私有草稿");
  }

  return (
    <div className="row" style={{ justifyContent: "flex-end" }}>
      <button className="button secondary" disabled={saving} type="button" onClick={togglePublished}>
        {saving ? "更新中..." : published ? "取消公开" : "公开到广场"}
      </button>
      {message && <span className="muted">{message}</span>}
    </div>
  );
}
