import { db } from "./db";

const SESSION_TYPE = "socratic";

export async function createSession(userId: string, lessonId: string, courseId?: string) {
  return db.chatSession.create({
    data: { userId, lessonId, courseId, type: SESSION_TYPE },
  });
}

export async function getSessionByLesson(userId: string, lessonId: string) {
  return db.chatSession.findFirst({
    where: { userId, lessonId, type: SESSION_TYPE },
    orderBy: { createdAt: "desc" },
  });
}

export async function addMessages(
  sessionId: string, userId: string,
  messages: Array<{ role: string; content: string }>,
) {
  return db.chatMessage.createMany({
    data: messages.map((m) => ({ userId, sessionId, role: m.role, content: m.content })),
  });
}

export async function getMessages(sessionId: string, userId: string) {
  return db.chatMessage.findMany({
    where: { sessionId, userId },
    orderBy: { createdAt: "asc" },
  });
}
