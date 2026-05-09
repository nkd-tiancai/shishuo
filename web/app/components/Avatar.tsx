"use client";

import { CHARACTERS } from "@/lib/types";

export default function Avatar({ name, size }: { name: string; size?: "sm" }) {
  if (name === "user") {
    return (
      <div className={size === "sm" ? "avatar avatar-sm" : "avatar"}
        style={{ background: "var(--accent)" }}>
        我
      </div>
    );
  }
  // Handle multi-professor names like "马超 & 九雀"
  const lookupName = name.includes("&") ? name.split("&")[0].trim() : name;
  const char = CHARACTERS.find((c) => c.name === lookupName);
  return (
    <div className={size === "sm" ? "avatar avatar-sm" : "avatar"}
      style={{ background: char?.color ?? "#ccc" }}>
      {char?.initial ?? "?"}
    </div>
  );
}
