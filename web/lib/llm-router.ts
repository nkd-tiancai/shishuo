import OpenAI from "openai";

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com/v1",
  timeout: 30000,
});

const minimax = new OpenAI({
  apiKey: process.env.MINIMAX_API_KEY,
  baseURL: "https://api.minimaxi.com/v1",
  timeout: 30000,
});

export type LLMType = "deepseek" | "minimax";

export function getClient(type: LLMType): OpenAI {
  return type === "deepseek" ? deepseek : minimax;
}

export function getModel(type: LLMType): string {
  return type === "deepseek" ? "deepseek-chat" : "MiniMax-M2.7";
}

export async function chat(
  type: LLMType,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const client = getClient(type);
  const model = getModel(type);

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: options?.temperature ?? 0.8,
    max_tokens: options?.maxTokens ?? 4096,
  });

  return response.choices[0]?.message?.content ?? "";
}

export function routeForClassroom(): LLMType {
  return "deepseek";
}

export function routeForGroupChat(): LLMType {
  return "minimax";
}
