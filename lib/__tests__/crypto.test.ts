import { describe, it, expect, beforeAll } from "vitest";

// Set the encryption key before importing crypto module (keyBuffer reads it at call time)
beforeAll(() => {
  // base64 of 32 'a' bytes → 44 chars with padding
process.env.APP_ENCRYPTION_KEY = "YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=";
});

// Dynamic import so the env var is set before module init
const { encryptSecret, decryptSecret, hashToken } = await import("../crypto");

describe("crypto", () => {
  describe("encryptSecret / decryptSecret roundtrip", () => {
    it("encrypts and decrypts plain text", () => {
      const plain = "sk-abc123def456ghi789";
      const encrypted = encryptSecret(plain);
      const decrypted = decryptSecret(encrypted);
      expect(decrypted).toBe(plain);
    });

    it("encrypts single character", () => {
      const encrypted = encryptSecret("x");
      expect(decryptSecret(encrypted)).toBe("x");
    });

    it("encrypts Unicode text", () => {
      const plain = "密钥-测试-key-123";
      const encrypted = encryptSecret(plain);
      expect(decryptSecret(encrypted)).toBe(plain);
    });

    it("produces different ciphertext for same plaintext (random IV)", () => {
      const plain = "same-plaintext";
      const a = encryptSecret(plain);
      const b = encryptSecret(plain);
      expect(a).not.toBe(b);
      // Both should decrypt to the same plaintext
      expect(decryptSecret(a)).toBe(plain);
      expect(decryptSecret(b)).toBe(plain);
    });

    it("payload format: iv.tag.ciphertext (base64)", () => {
      const encrypted = encryptSecret("test");
      const parts = encrypted.split(".");
      expect(parts).toHaveLength(3);
      // Each part should be valid base64
      for (const part of parts) {
        expect(() => Buffer.from(part, "base64")).not.toThrow();
      }
    });
  });

  describe("decryptSecret error handling", () => {
    it("throws on empty string", () => {
      expect(() => decryptSecret("")).toThrow();
    });

    it("throws on malformed payload (missing parts)", () => {
      expect(() => decryptSecret("abc.def")).toThrow("Invalid encrypted secret payload");
    });

    it("throws on payload with insufficient parts", () => {
      // Only 2 dots → split yields 3 parts, but parts are too short for valid decryption
      expect(() => decryptSecret("ab.cd")).toThrow("Invalid encrypted secret payload");
    });

    it("throws on tampered payload", () => {
      const encrypted = encryptSecret("original");
      const parts = encrypted.split(".");
      // Tamper with the ciphertext part
      const tampered = [parts[0], parts[1], "AAAA" + parts[2].slice(4)].join(".");
      expect(() => decryptSecret(tampered)).toThrow();
    });
  });

  describe("hashToken", () => {
    it("produces consistent output", () => {
      const a = hashToken("my-invite-code");
      const b = hashToken("my-invite-code");
      expect(a).toBe(b);
    });

    it("produces different output for different inputs", () => {
      const a = hashToken("code-a");
      const b = hashToken("code-b");
      expect(a).not.toBe(b);
    });

    it("returns hex string of correct length (sha256 = 64 hex chars)", () => {
      const hash = hashToken("test");
      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });
  });
});
