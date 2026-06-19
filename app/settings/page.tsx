"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface ProviderRow {
  id?: string;
  name: string;
  baseURL: string;
  apiKey?: string;
  model: string;
  role: string;
  hasApiKey?: boolean;
}

const PRESETS: ProviderRow[] = [
  { name: "DeepSeek", baseURL: "https://api.deepseek.com/v1", model: "deepseek-chat", role: "default" },
  { name: "Kimi", baseURL: "https://api.moonshot.cn/v1", model: "kimi-k2-0711-preview", role: "default" },
  { name: "GLM", baseURL: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4.5", role: "default" },
  { name: "OpenAI", baseURL: "https://api.openai.com/v1", model: "gpt-4.1", role: "default" },
  { name: "MiniMax", baseURL: "https://api.minimaxi.com/v1", model: "MiniMax-M2.7", role: "groupchat" },
];

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/providers")
      .then((res) => res.json())
      .then((data) => setProviders(Array.isArray(data) && data.length ? data : [PRESETS[0]]))
      .catch(() => setError("读取 provider 失败"));
  }, []);

  function update(index: number, patch: Partial<ProviderRow>) {
    setProviders((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  const [testResults, setTestResults] = useState<Record<number, { ok?: boolean; error?: string }>>({});

  async function testProvider(index: number) {
    const provider = providers[index];
    setTestResults((prev) => ({ ...prev, [index]: {} }));

    const res = await fetch("/api/providers/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseURL: provider.baseURL,
        apiKey: provider.apiKey || "",
        model: provider.model,
      }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "Network error" }));
    setTestResults((prev) => ({ ...prev, [index]: data }));
  }

  async function save() {
    const overwriting = providers.some((p) => p.hasApiKey && p.apiKey && p.apiKey.trim());
    if (overwriting && !confirm("已配置的 API key 会被新密钥覆盖，确定保存？")) return;

    setBusy(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providers }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(data.error || "保存失败");
      return;
    }
    setMessage("已保存。API key 只会加密存储，不会在前端回显。");
  }

  return (
    <main className="shell">
      <section className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h1>Provider 设置</h1>
            <p className="muted">第一版采用 BYOK：用户自己提供模型 API key。</p>
          </div>
          <Link className="button secondary" href="/">返回</Link>
        </div>

        <div className="stack">
          {providers.map((provider, index) => (
            <div className="card" key={index}>
              <div className="row">
                <div className="field" style={{ flex: "1 1 160px" }}>
                  <label>厂商名</label>
                  <input value={provider.name} onChange={(e) => update(index, { name: e.target.value })} />
                </div>
                <div className="field" style={{ flex: "2 1 260px" }}>
                  <label>Base URL</label>
                  <input value={provider.baseURL} onChange={(e) => update(index, { baseURL: e.target.value })} />
                </div>
                <div className="field" style={{ flex: "1 1 180px" }}>
                  <label>模型</label>
                  <input value={provider.model} onChange={(e) => update(index, { model: e.target.value })} />
                </div>
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <div className="field" style={{ flex: "1 1 160px" }}>
                  <label>用途</label>
                  <select value={provider.role} onChange={(e) => update(index, { role: e.target.value })}>
                    <option value="default">默认</option>
                    <option value="classroom">课堂</option>
                    <option value="mentor-private">导师私聊</option>
                    <option value="role-private">角色私聊</option>
                  </select>
                </div>
                <div className="field" style={{ flex: "2 1 300px" }}>
                  <label>API Key {provider.hasApiKey ? "（已配置，重新输入会覆盖）" : ""}</label>
                  <input type="password" value={provider.apiKey || ""} onChange={(e) => update(index, { apiKey: e.target.value })} />
                </div>
                <button className="button secondary" type="button" onClick={() => setProviders((rows) => rows.filter((_, i) => i !== index))}>
                  删除
                </button>
                <button className="button secondary" type="button" onClick={() => testProvider(index)}>
                  测试
                </button>
              </div>
              {testResults[index] && (
                <p className={testResults[index].ok ? "muted" : "error"} style={{ marginTop: 4 }}>
                  {testResults[index].ok ? "连接成功" : testResults[index].error || "连接失败"}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="row" style={{ marginTop: 18 }}>
          <button className="button secondary" type="button" onClick={() => setProviders((rows) => [...rows, PRESETS[0]])}>
            添加 Provider
          </button>
          <button className="button" type="button" disabled={busy} onClick={save}>
            {busy ? "保存中..." : "保存"}
          </button>
        </div>
        {message && <p className="muted">{message}</p>}
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}
