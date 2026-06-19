/**
 * LLM 客户端抽象 —— 为 product 版提供统一的 chat/chatStream 接口。
 *
 * 与 web/lib/llm-router.ts 的关系：
 *   - 借鉴其 LRU 动态客户端缓存模式，但不直接引用
 *   - product 版全是 BYOK 动态 provider，不走静态 LLMType 双轨
 *   - 通过 ProviderConfig 接口与 provider-store 解耦
 */

import OpenAI from "openai";

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export interface ProviderConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** 覆盖 config.model */
  model?: string;
}

export interface ChatStreamOptions extends ChatOptions {
  /** 是否在流末尾包含 usage 统计（需 provider 支持） */
  includeUsage?: boolean;
}

export interface ConnectionTestResult {
  ok: boolean;
  model?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Provider presets — 已知厂商的默认 model
// ═══════════════════════════════════════════════════════════════════════

interface ProviderPreset {
  defaultModel: string;
  match: (baseURL: string) => boolean;
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  { defaultModel: "deepseek-chat",  match: (u) => /deepseek/i.test(u) },
  { defaultModel: "gpt-4o-mini",    match: (u) => /openai/i.test(u) },
  { defaultModel: "MiniMax-M2.7",   match: (u) => /minimax/i.test(u) },
  { defaultModel: "moonshot-v1-8k", match: (u) => /moonshot/i.test(u) },
  { defaultModel: "glm-4-flash",    match: (u) => /zhipu/i.test(u) },
];

// ═══════════════════════════════════════════════════════════════════════
// Model normalization
// ═══════════════════════════════════════════════════════════════════════

/**
 * 规范化 model 名。如果 config.model 为空，尝试从已知厂商 preset 推断默认 model。
 * 匹配不到时抛出明确错误，而非静默 fallback 到不正确的 model。
 */
export function normalizeProviderModel(baseURL: string, model?: string | null): string {
  const trimmed = model?.trim();
  if (trimmed) return trimmed;
  const preset = PROVIDER_PRESETS.find((p) => p.match(baseURL));
  if (preset) return preset.defaultModel;
  throw new Error(
    `无法确定 provider "${baseURL}" 的默认模型，请在 Provider 设置中明确指定 model`
  );
}

// ═══════════════════════════════════════════════════════════════════════
// LRU client cache
// ═══════════════════════════════════════════════════════════════════════

const MAX_DYNAMIC_CLIENTS = 10;
const dynamicClients = new Map<string, OpenAI>();
const clientAccessOrder: string[] = [];

/**
 * 获取或创建缓存的 OpenAI 客户端实例。
 * cacheKey 包含 userId 确保多用户隔离。
 */
export function getDynamicClient(userId: string, config: ProviderConfig): OpenAI {
  if (!config.apiKey) throw new Error("API key 未配置");

  const cacheKey = `${userId}||${config.baseURL}||${config.apiKey}`;
  const existing = dynamicClients.get(cacheKey);
  if (existing) {
    // LRU: 移到访问顺序末尾
    const idx = clientAccessOrder.indexOf(cacheKey);
    if (idx >= 0) clientAccessOrder.splice(idx, 1);
    clientAccessOrder.push(cacheKey);
    return existing;
  }

  // 驱逐最旧的客户端
  if (dynamicClients.size >= MAX_DYNAMIC_CLIENTS) {
    const oldest = clientAccessOrder.shift();
    if (oldest) dynamicClients.delete(oldest);
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    timeout: 120_000,
  });
  dynamicClients.set(cacheKey, client);
  clientAccessOrder.push(cacheKey);
  return client;
}

// ═══════════════════════════════════════════════════════════════════════
// Non-streaming chat
// ═══════════════════════════════════════════════════════════════════════

export async function chat(
  userId: string,
  config: ProviderConfig,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options?: ChatOptions,
): Promise<string> {
  const client = getDynamicClient(userId, config);
  const model = options?.model || normalizeProviderModel(config.baseURL, config.model);
  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 4096,
  });
  return response.choices[0]?.message?.content ?? "";
}

// ═══════════════════════════════════════════════════════════════════════
// Streaming chat
// ═══════════════════════════════════════════════════════════════════════

export async function* chatStream(
  userId: string,
  config: ProviderConfig,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options?: ChatStreamOptions,
): AsyncGenerator<string, void, undefined> {
  const client = getDynamicClient(userId, config);
  const model = options?.model || normalizeProviderModel(config.baseURL, config.model);
  const stream = await client.chat.completions.create({
    model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 4096,
    stream: true,
    stream_options: options?.includeUsage ? { include_usage: true } : undefined,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Connection test — 供 provider CRUD 页面使用
// ═══════════════════════════════════════════════════════════════════════

export async function testProviderConnection(
  config: ProviderConfig,
  timeoutMs = 10_000,
): Promise<ConnectionTestResult> {
  if (!config.apiKey) return { ok: false, error: "API key 为空" };

  try {
    const res = await fetch(`${config.baseURL}/v1/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (res.status === 401 || /incorrect|invalid|unauthorized|wrong/i.test(errText)) {
        return { ok: false, error: "API Key 无效（401 Unauthorized）" };
      }
      if (res.status === 403) return { ok: false, error: "API Key 无权限（403 Forbidden）" };
      return { ok: false, error: `服务器返回 ${res.status}: ${errText.slice(0, 120)}` };
    }

    return { ok: true, model: config.model };
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === "TimeoutError") {
      return { ok: false, error: `连接超时（${timeoutMs / 1000}s）` };
    }
    const err = e as { name?: string; message?: string };
    if (err.name === "TimeoutError") {
      return { ok: false, error: `连接超时（${timeoutMs / 1000}s）` };
    }
    return { ok: false, error: `网络错误: ${err?.message || String(e)}` };
  }
}
