import { db } from "./db";

export async function listKnowledgeBases(userId: string) {
  return db.knowledgeBase.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function createKnowledgeBase(userId: string, title: string, description?: string) {
  return db.knowledgeBase.create({ data: { userId, title, description: description || "" } });
}

export async function deleteKnowledgeBase(userId: string, id: string) {
  const kb = await db.knowledgeBase.findFirst({ where: { id, userId }, select: { id: true } });
  if (!kb) return false;
  await db.knowledgeBase.delete({ where: { id } });
  return true;
}
