import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { db } from "./db";
import { assertInsideUserRoot, ensureUserDirs } from "./user-paths";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".md", ".txt", ".pdf"]);

export interface UploadDocumentInput {
  userId: string;
  file: File;
}

function safeFileName(name: string): string {
  const parsed = path.parse(path.basename(name));
  const ext = parsed.ext.toLowerCase();
  const base = parsed.name
    .replace(/[\/:*?"<>|\\]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

  if (!base || !ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error("Only .md, .txt, and .pdf files are supported");
  }

  return `${base}${ext}`;
}

function hashBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function listDocuments(userId: string) {
  return db.sourceDocument.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      status: true,
      createdAt: true,
    },
  });
}

export async function saveUploadedDocument({ userId, file }: UploadDocumentInput) {
  if (file.size <= 0) {
    throw new Error("Empty files are not supported");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File too large. Max size is 20MB.");
  }

  const filename = safeFileName(file.name);
  const paths = await ensureUserDirs(userId);
  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = hashBuffer(buffer);
  const storedName = `${Date.now()}-${hash.slice(0, 12)}-${filename}`;
  const sourcePath = path.join(paths.uploads, storedName);
  assertInsideUserRoot(paths.root, sourcePath);

  await fs.writeFile(sourcePath, buffer);

  return db.sourceDocument.create({
    data: {
      userId,
      filename: storedName,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      hash,
      sourcePath,
      status: "UPLOADED",
    },
    select: {
      id: true,
      filename: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      status: true,
      createdAt: true,
    },
  });
}
