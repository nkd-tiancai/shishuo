import { db } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";

export interface ProviderInput {
  id?: string;
  name: string;
  baseURL: string;
  apiKey?: string;
  model: string;
  role: string;
}

export interface ProviderView {
  id: string;
  name: string;
  baseURL: string;
  model: string;
  role: string;
  hasApiKey: boolean;
}

function normalizeBaseURL(baseURL: string): string {
  const url = new URL(baseURL);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Provider URL must be http or https");
  }
  return url.toString().replace(/\/$/, "");
}

export async function listProviders(userId: string): Promise<ProviderView[]> {
  const providers = await db.apiCredential.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    baseURL: provider.baseURL,
    model: provider.model,
    role: provider.role,
    hasApiKey: Boolean(provider.encryptedApiKey),
  }));
}

export async function replaceProviders(userId: string, providers: ProviderInput[]): Promise<void> {
  const existing = await db.apiCredential.findMany({ where: { userId } });
  const existingById = new Map(existing.map((provider) => [provider.id, provider]));
  const incomingIds = providers.map((provider) => provider.id).filter(Boolean) as string[];

  await db.$transaction(async (tx) => {
    await tx.apiCredential.deleteMany({
      where: {
        userId,
        id: { notIn: incomingIds.length ? incomingIds : [""] },
      },
    });

    for (const provider of providers) {
      const model = provider.model.trim();
      if (!model) {
        throw new Error(`Provider "${provider.name}" 缺少模型名称，请在设置中填写。`);
      }
      const apiKey = provider.apiKey?.trim();
      const existingProvider = provider.id ? existingById.get(provider.id) : null;
      const data = {
        name: provider.name.trim(),
        baseURL: normalizeBaseURL(provider.baseURL.trim()),
        encryptedApiKey: apiKey ? encryptSecret(apiKey) : existingProvider?.encryptedApiKey || "",
        model,
        role: provider.role.trim() || "default",
      };

      if (provider.id && existingProvider) {
        await tx.apiCredential.update({
          where: { id: provider.id },
          data,
        });
      } else {
        await tx.apiCredential.create({
          data: { userId, ...data },
        });
      }
    }
  });
}

export async function getProviderForRole(userId: string, role: string) {
  // 优先精确匹配 role，没有再 fallback 到 default
  let provider = await db.apiCredential.findFirst({
    where: { userId, role },
    orderBy: { createdAt: "asc" },
  });
  if (!provider) {
    provider = await db.apiCredential.findFirst({
      where: { userId, role: "default" },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!provider || !provider.encryptedApiKey) return null;
  return {
    baseURL: provider.baseURL,
    apiKey: decryptSecret(provider.encryptedApiKey),
    model: provider.model,
  };
}
