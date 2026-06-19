"use client";

import { useMemo, useState } from "react";

export interface CharacterCardRow {
  id?: string;
  name: string;
  role: "mentor" | "classmate" | "companion";
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  avatar: string;
  avatarUrl?: string;
  relationshipLine: string;
  usageMode?: "classroom" | "private" | "both";
  visibility?: "private" | "public";
  isTeacher: boolean;
}

const emptyCharacter: CharacterCardRow = {
  name: "",
  role: "classmate",
  description: "",
  personality: "",
  scenario: "",
  firstMessage: "",
  avatar: "",
  avatarUrl: "",
  relationshipLine: "",
  isTeacher: false,
  usageMode: "both" as const,
  visibility: "private" as const,
};

const roleLabels: Record<CharacterCardRow["role"], string> = {
  mentor: "导师",
  classmate: "同学",
  companion: "私聊角色",
};

function firstChar(value: string) {
  return value.trim().slice(0, 1);
}

function extractSection(text: string, labels: string[]) {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(`(?:^|\\n)\\s*(?:#{1,4}\\s*)?(?:${escaped})\\s*[:：]?\\s*\\n?([\\s\\S]*?)(?=\\n\\s*(?:#{1,4}\\s*)?(?:名字|名称|简介|背景|性格|人设|场景设定|开场白|第一句话|关系线|情感线)\\s*[:：]?|$)`, "i");
  return text.match(pattern)?.[1]?.trim() || "";
}

function parseImportText(text: string): Partial<CharacterCardRow> {
  const trimmed = text.trim();
  if (!trimmed) return {};

  try {
    const parsed = JSON.parse(trimmed) as Partial<CharacterCardRow>;
    return parsed;
  } catch {
    const title = trimmed.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const name = extractSection(trimmed, ["名字", "名称"]) || title || "";
    return {
      name,
      description: extractSection(trimmed, ["简介", "背景"]),
      personality: extractSection(trimmed, ["性格", "人设"]),
      scenario: extractSection(trimmed, ["场景设定"]),
      firstMessage: extractSection(trimmed, ["开场白", "第一句话"]),
      relationshipLine: extractSection(trimmed, ["关系线", "情感线"]),
    };
  }
}

export default function CharacterCardsClient({ initialCharacters }: { initialCharacters: CharacterCardRow[] }) {
  const [characters, setCharacters] = useState(initialCharacters);
  const [draft, setDraft] = useState<CharacterCardRow>(emptyCharacter);
  const [importText, setImportText] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const sortedCharacters = useMemo(() => {
    const order = { mentor: 0, classmate: 1, companion: 2 };
    return [...characters].sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name));
  }, [characters]);

  function update(patch: Partial<CharacterCardRow>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (patch.name && !current.avatar) {
        next.avatar = firstChar(patch.name);
      }
      if (patch.role === "mentor") {
        next.isTeacher = true;
      }
      return next;
    });
  }

  function resetForm() {
    setDraft(emptyCharacter);
    setStatus("");
  }

  function applyImport() {
    const parsed = parseImportText(importText);
    setDraft((current) => ({
      ...current,
      ...parsed,
      role: parsed.role === "mentor" || parsed.role === "companion" || parsed.role === "classmate" ? parsed.role : current.role,
      avatar: parsed.avatar || current.avatar || firstChar(parsed.name || current.name),
      isTeacher: parsed.isTeacher ?? current.isTeacher,
    }));
    setStatus("已读取导入文本");
  }

  async function saveCharacter() {
    const name = draft.name.trim();
    if (!name) {
      setStatus("请先填写名字");
      return;
    }

    setSaving(true);
    setStatus("");
    const method = draft.id ? "PUT" : "POST";
    const response = await fetch("/api/characters", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...draft,
        name,
        avatar: draft.avatar || firstChar(name),
        avatarUrl: draft.avatarUrl || undefined,
        usageMode: draft.usageMode || "both",
        isTeacher: draft.role === "mentor" || draft.isTeacher,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok || !data.character) {
      setStatus(data.error || "保存失败");
      return;
    }

    const saved = data.character as CharacterCardRow;
    setCharacters((items) => {
      const others = items.filter((item) => item.id !== saved.id);
      return [...others, saved];
    });
    setDraft(emptyCharacter);
    setImportText("");
    setStatus("已保存人物卡");
  }

  async function removeCharacter(character: CharacterCardRow) {
    if (!character.id) return;
    setSaving(true);
    const response = await fetch(`/api/characters?id=${encodeURIComponent(character.id)}`, { method: "DELETE" });
    setSaving(false);
    if (!response.ok) {
      setStatus("删除失败");
      return;
    }
    setCharacters((items) => items.filter((item) => item.id !== character.id));
    if (draft.id === character.id) resetForm();
    setStatus("已删除人物卡");
  }

  return (
    <div className="character-workbench">
      <aside className="character-list" aria-label="人物卡列表">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>卡片</h2>
          <button className="button secondary compact-button" type="button" onClick={resetForm}>新建</button>
          <button className="button secondary compact-button" type="button" onClick={async () => {
            const res = await fetch("/api/characters/export");
            const data = await res.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = "characters.json"; a.click();
            URL.revokeObjectURL(url);
          }}>导出全部</button>
          <label className="button secondary compact-button" style={{ cursor: "pointer" }}>
            导入
            <input type="file" accept=".json" hidden onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              try {
                const parsed = JSON.parse(text);
                const body = Array.isArray(parsed) ? { cards: parsed } : parsed;
                const res = await fetch("/api/characters/import", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.ok) {
                  setStatus(`导入 ${data.count} 张人物卡`);
                  window.location.reload();
                } else {
                  setStatus(data.error || "导入失败");
                }
              } catch {
                setStatus("JSON 解析失败");
              }
            }} />
          </label>
        </div>
        <div className="stack">
          {sortedCharacters.map((character) => (
            <button
              className={`character-card-button ${draft.id === character.id ? "active" : ""}`}
              key={character.id}
              type="button"
              onClick={() => setDraft(character)}
            >
              <span className={`chat-avatar ${character.role === "companion" ? "companion" : ""}`}>
                {character.avatar || firstChar(character.name)}
              </span>
              <span>
                <strong>{character.name}</strong>
                <small>{roleLabels[character.role]} · {character.visibility === "public" ? "公开" : "私有"}</small>
              </span>
            </button>
          ))}
          {!sortedCharacters.length && (
            <div className="notice">还没有人物卡。</div>
          )}
        </div>
      </aside>

      <section className="character-editor">
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <span className="pill">{draft.id ? "编辑" : "新建"}</span>
              <h2>人物设定</h2>
            </div>
            {draft.id && (
              <>
                <button className="button secondary compact-button" type="button" onClick={async () => {
                  const res = await fetch(`/api/characters/export?id=${draft.id}`);
                  const data = await res.json();
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = `${draft.name}.json`; a.click();
                  URL.revokeObjectURL(url);
                }}>导出</button>
                <button className="button secondary compact-button" disabled={saving} type="button" onClick={() => removeCharacter(draft)}>
                  删除
                </button>
              </>
            )}
          </div>

          <div className="form-grid">
            <label className="field">
              <span>名字</span>
              <input value={draft.name} onChange={(event) => update({ name: event.target.value })} />
            </label>
            <label className="field">
              <span>课堂身份</span>
              <select value={draft.role} onChange={(event) => update({ role: event.target.value as CharacterCardRow["role"] })}>
                <option value="mentor">导师</option>
                <option value="classmate">同学</option>
                <option value="companion">私聊角色</option>
              </select>
            </label>
            <label className="field">
              <span>适用场景</span>
              <select value={draft.usageMode || "both"} onChange={(e) => update({ usageMode: e.target.value as "classroom" | "private" | "both" })}>
                <option value="both">通用</option>
                <option value="classroom">课堂群聊</option>
                <option value="private">私聊</option>
              </select>
            </label>
            <label className="field">
              <span>分享状态</span>
              <select value={draft.visibility || "private"} onChange={(e) => update({ visibility: e.target.value as "private" | "public" })}>
                <option value="private">仅自己可见</option>
                <option value="public">公开到广场</option>
              </select>
            </label>
            <label className="field">
              <span>头像</span>
              {draft.avatarUrl && <img src={draft.avatarUrl} alt="" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const formData = new FormData();
                formData.append("file", file);
                const res = await fetch("/api/characters/avatar", { method: "POST", body: formData });
                const data = await res.json().catch(() => ({}));
                if (data.avatarUrl) update({ avatarUrl: data.avatarUrl });
                else setStatus(data.error || "上传失败");
              }} />
            </label>
            <label className="field">
              <span>头像字（回退）</span>
              <input maxLength={4} value={draft.avatar} onChange={(event) => update({ avatar: event.target.value })} />
            </label>
            <label className="field checkbox-field">
              <input checked={draft.isTeacher} type="checkbox" onChange={(event) => update({ isTeacher: event.target.checked })} />
              <span>优先作为课堂引导者</span>
            </label>
          </div>

          <div className="stack">
            <label className="field">
              <span>简介</span>
              <textarea value={draft.description} onChange={(event) => update({ description: event.target.value })} rows={3} />
            </label>
            <label className="field">
              <span>性格</span>
              <textarea value={draft.personality} onChange={(event) => update({ personality: event.target.value })} rows={3} />
            </label>
            <label className="field">
              <span>场景设定</span>
              <textarea value={draft.scenario} onChange={(event) => update({ scenario: event.target.value })} rows={3} />
            </label>
            <label className="field">
              <span>开场白</span>
              <textarea value={draft.firstMessage} onChange={(event) => update({ firstMessage: event.target.value })} rows={2} />
            </label>
            <label className="field">
              <span>关系线</span>
              <textarea value={draft.relationshipLine} onChange={(event) => update({ relationshipLine: event.target.value })} rows={3} />
            </label>
          </div>

          <div className="row editor-actions">
            <button className="button" disabled={saving} type="button" onClick={saveCharacter}>
              {saving ? "保存中" : "保存人物卡"}
            </button>
            <button className="button secondary" disabled={saving} type="button" onClick={resetForm}>清空</button>
            {status && <span className="muted">{status}</span>}
          </div>
        </div>

        <div className="card">
          <span className="pill">Import</span>
          <h2>导入文本</h2>
          <label className="field">
            <span>Markdown 或 JSON</span>
            <textarea value={importText} onChange={(event) => setImportText(event.target.value)} rows={8} />
          </label>
          <button className="button secondary compact-button" disabled={!importText.trim()} type="button" onClick={applyImport}>
            读取到表单
          </button>
        </div>
      </section>
    </div>
  );
}
