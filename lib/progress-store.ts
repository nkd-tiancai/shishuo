import { db } from "./db";

export const PROGRESS_STATUSES = ["not_started", "studying", "reviewing", "mastered"] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

export async function getProgressSummary(userId: string) {
  const counts = await db.learningProgress.groupBy({
    by: ["status"],
    where: { userId },
    _count: true,
  });
  const totalLessons = await db.lesson.count({ where: { userId } });

  const statusMap: Record<string, number> = {};
  for (const c of counts) statusMap[c.status] = c._count;

  const recent = await db.learningProgress.findFirst({
    where: { userId, learnedAt: { not: null } },
    orderBy: { learnedAt: "desc" },
    select: { learnedAt: true },
  });

  return {
    learnedCount: (statusMap["learned"] || 0) + (statusMap["mastered"] || 0),
    totalLessons,
    lastLearnedAt: recent?.learnedAt?.getTime() || 0,
    breakdown: statusMap,
  };
}

export async function markLessonProgress(
  userId: string,
  lessonId: string,
  status: ProgressStatus,
  confidence?: number,
) {
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, userId }, select: { id: true },
  });
  if (!lesson) throw new Error("Lesson not found");

  const now = new Date();
  const isCompleted = status === "mastered";
  const isReviewing = status === "reviewing";

  return db.learningProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: {
      userId, lessonId, status,
      confidence: confidence ?? null,
      learnedAt: isCompleted ? now : null,
      nextReviewAt: isCompleted ? new Date(now.getTime() + 7 * 864e5)
        : isReviewing ? new Date(now.getTime() + 1 * 864e5) : null,
    },
    update: {
      status,
      confidence: confidence ?? undefined,
      learnedAt: isCompleted ? now : undefined,
      nextReviewAt: isCompleted ? new Date(now.getTime() + 7 * 864e5)
        : isReviewing ? new Date(now.getTime() + 1 * 864e5) : null,
    },
  });
}
