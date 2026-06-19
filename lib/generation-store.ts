import { db } from "./db";
import { generateCourseFromDocument } from "./course-store";

export async function createJob(userId: string, type: string, documentId: string) {
  return db.generationJob.create({
    data: { userId, type, input: documentId, status: "PENDING" },
  });
}

export async function getJob(jobId: string, userId: string) {
  return db.generationJob.findFirst({
    where: { id: jobId, userId },
    select: { id: true, type: true, status: true, output: true, error: true, createdAt: true },
  });
}

async function updateJob(jobId: string, status: string, extra?: Record<string, string>) {
  return db.generationJob.update({ where: { id: jobId }, data: { status, ...extra } });
}

export async function processJob(jobId: string, userId: string) {
  try {
    await updateJob(jobId, "RUNNING");
    const job = await db.generationJob.findFirst({
      where: { id: jobId, userId },
      select: { input: true },
    });
    if (!job) throw new Error("Job not found");
    const course = await generateCourseFromDocument(userId, job.input);
    await updateJob(jobId, "COMPLETED", {
      output: JSON.stringify({ courseId: course.id, title: course.title, lessonCount: course.lessonCount }),
    });
  } catch (e) {
    await updateJob(jobId, "FAILED", { error: e instanceof Error ? e.message : "课程生成失败" });
  }
}
