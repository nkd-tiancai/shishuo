import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function keyBuffer(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "APP_ENCRYPTION_KEY 未设置。" +
      "请运行 openssl rand -base64 32 生成密钥并写入 .env"
    );
  }

  const fromBase64 = Buffer.from(raw, "base64");
  if (fromBase64.length !== 32) {
    throw new Error(
      `APP_ENCRYPTION_KEY 解码后为 ${fromBase64.length} 字节，需要恰好 32 字节。` +
      "请运行 openssl rand -base64 32 生成密钥并写入 .env"
    );
  }

  return fromBase64;
}

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64")).join(".");
}

export function decryptSecret(payload: string): string {
  const [ivRaw, tagRaw, encryptedRaw] = payload.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Invalid encrypted secret payload");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    keyBuffer(),
    Buffer.from(ivRaw, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf-8");
}

export function hashToken(value: string): string {
  return crypto.createHash("sha256").update(value, "utf-8").digest("hex");
}
