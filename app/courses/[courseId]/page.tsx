import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import MarkLearnedButton from "./MarkLearnedButton";
import PublishCourseButton from "./PublishCourseButton";
import { auth } from "@/lib/auth";
import { getCourseDetail } from "@/lib/course-store";

export const dynamic = "force-dynamic";

interface CourseDetailPageProps {
  params: Promise<{ courseId: string }>;
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { courseId } = await params;
  const course = await getCourseDetail(session.user.id, courseId);
  if (!course) notFound();

  return (
    <main className="shell">
      <section className="panel">
        <div className="row page-head" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow">Course Draft</p>
            <h1>{course.title}</h1>
            <p className="muted">
              {course.lessons.length} 节课 · {course.status}
              {course.visibility === "public" ? " · 公开" : " · 私有"}
            </p>
          </div>
          <div className="row">
            <PublishCourseButton courseId={course.id} status={course.status} />
            <Link className="button secondary" href="/courses">返回课程</Link>
          </div>
        </div>

        <div className="stack">
          {course.lessons.map((lesson) => {
            const learned = lesson.progress.some((item) => item.status === "learned" || item.status === "mastered");
            const learnedAt = lesson.progress.find((item) => item.learnedAt)?.learnedAt;

            return (
            <article className="card lesson-card" key={lesson.id}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span className="pill">{learned ? "已完成" : `第 ${lesson.orderIndex} 节`}</span>
                  <h2>{lesson.title}</h2>
                  {learnedAt && <p className="quiet">完成于 {new Date(learnedAt).toLocaleString("zh-CN")}</p>}
                </div>
                <div className="row">
                  <Link className="button secondary" href={`/courses/${course.id}/lessons/${lesson.id}`}>开始学习</Link>
                  <MarkLearnedButton lessonId={lesson.id} learned={learned} />
                </div>
              </div>
              <p className="muted lesson-body">{lesson.content}</p>
            </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
