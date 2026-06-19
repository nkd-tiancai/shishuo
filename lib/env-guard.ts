/**
 * 集中式环境变量校验 —— 启动时调用一次，拒绝部署时误用弱默认值。
 *
 * 校验内容：
 *   AUTH_SECRET        — 至少 32 字符，拒绝已知弱值
 *   APP_ENCRYPTION_KEY — 必须是 base64 编码的 32 字节密钥
 *   DATABASE_URL       — 必须存在
 *
 * 用法：在 instrumentation.ts 或 layout.tsx 顶部 import 即可触发校验。
 */

// ═══════════════════════════════════════════════════════════════════════
// 已知弱密钥黑名单（公开示例 / 文档默认值 / 极易猜测的模式）
// ═══════════════════════════════════════════════════════════════════════

const KNOWN_WEAK_SECRETS = new Set([
  "local-dev-auth-secret-change-before-deploy",
  "changeme",
  "secret",
  "dev-secret",
  "00000000000000000000000000000000",
]);

const KNOWN_WEAK_ENCRYPTION_KEYS = new Set([
  "0123456789abcdef0123456789abcdef",          // 重复 hex 模式
  "00000000000000000000000000000000",          // 全零
  "abcdefghijklmnopqrstuvwxyz012345",          // 顺序字母
  "local-dev-encryption-key-change-me",
]);

// ═══════════════════════════════════════════════════════════════════════
// 校验函数
// ═══════════════════════════════════════════════════════════════════════

function validateAuthSecret(): void {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error(
      "AUTH_SECRET 未设置。请运行 openssl rand -base64 32 生成密钥并写入 .env"
    );
  }

  if (KNOWN_WEAK_SECRETS.has(secret)) {
    throw new Error(
      `AUTH_SECRET 是已知弱密钥（"${secret.slice(0, 8)}..."），存在 JWT 伪造风险。\n` +
      "请运行 openssl rand -base64 32 生成新的安全密钥并写入 .env"
    );
  }

  if (secret.length < 32) {
    throw new Error(
      `AUTH_SECRET 长度不足（${secret.length} 字符），至少需要 32 字符。\n` +
      "请运行 openssl rand -base64 32 生成新的安全密钥并写入 .env"
    );
  }
}

function validateEncryptionKey(): void {
  const raw = process.env.APP_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error(
      "APP_ENCRYPTION_KEY 未设置。请运行 openssl rand -base64 32 生成密钥并写入 .env"
    );
  }

  if (KNOWN_WEAK_ENCRYPTION_KEYS.has(raw)) {
    throw new Error(
      `APP_ENCRYPTION_KEY 是已知弱密钥（"${raw.slice(0, 8)}..."），所有已存储的 API 密钥可能被解密。\n` +
      "请运行 openssl rand -base64 32 生成新的安全密钥并写入 .env"
    );
  }

  // 必须能被解析为 32 字节的 base64
  let buf: Buffer;
  try {
    buf = Buffer.from(raw, "base64");
  } catch {
    throw new Error(
      "APP_ENCRYPTION_KEY 无效。必须是 base64 编码的 32 字节密钥。\n" +
      "请运行 openssl rand -base64 32 生成并将完整输出写入 .env"
    );
  }

  if (buf.length !== 32) {
    throw new Error(
      `APP_ENCRYPTION_KEY base64 解码后为 ${buf.length} 字节，需要恰好 32 字节。\n` +
      "请运行 openssl rand -base64 32 生成并将完整输出写入 .env"
    );
  }

  // 拒绝极低熵密钥（字节种类 ≤ 4 种 → 高度重复）
  const uniqueBytes = new Set(buf).size;
  if (uniqueBytes <= 4) {
    throw new Error(
      "APP_ENCRYPTION_KEY 熵值过低（高度重复模式），不符合加密安全要求。\n" +
      "请运行 openssl rand -base64 32 重新生成"
    );
  }
}

function validateDatabaseUrl(): void {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL 未设置。请在 .env 中指定 SQLite 数据库路径，例如 file:./dev.db");
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 统一入口 —— 启动时调用
// ═══════════════════════════════════════════════════════════════════════

let validated = false;

export function assertEnv(): void {
  if (validated) return;
  validated = true;

  validateAuthSecret();
  validateEncryptionKey();
  validateDatabaseUrl();
}
