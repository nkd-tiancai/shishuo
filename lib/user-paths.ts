import path from "path";
import fs from "fs/promises";

export interface UserPaths {
  root: string;
  uploads: string;
  markdown: string;
  generated: string;
  teacher: string;
  flashcards: string;
  exports: string;
  logs: string;
}

function storageRoot(): string {
  return path.resolve(process.env.PRODUCT_STORAGE_ROOT || "./storage");
}

export function getUserPaths(userId: string): UserPaths {
  const root = path.join(storageRoot(), "users", userId);
  return {
    root,
    uploads: path.join(root, "uploads"),
    markdown: path.join(root, "markdown"),
    generated: path.join(root, "generated"),
    teacher: path.join(root, "teacher"),
    flashcards: path.join(root, "flashcards"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
}

export function assertInsideUserRoot(userRoot: string, candidatePath: string): void {
  const root = path.resolve(userRoot);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path escapes user storage root");
  }
}

export async function ensureUserDirs(userId: string): Promise<UserPaths> {
  const paths = getUserPaths(userId);
  await Promise.all(
    Object.values(paths).map((dir) => fs.mkdir(dir, { recursive: true })),
  );
  return paths;
}
