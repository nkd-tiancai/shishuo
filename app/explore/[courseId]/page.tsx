import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";

export default async function PublicCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;

  const course = await db.course.findFirst({
    where: { id: courseId, visibility: "public", status: "PUBLISHED" },
    select: {
      title: true,
      lessons: { orderBy: { orderIndex: "asc" }, select: { title: true, content: true } },
    },
  });

  if (!course) notFound();

  return (
    <main className="shell">
      <section className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <Link href="/explore" className="muted">← 课程广场</Link>
            <h1>{course.title}</h1>
          </div>
        </div>
        <p className="muted">{course.lessons.length} 节课</p>

        <div className="stack" style={{ marginTop: 24 }}>
          {course.lessons.map((lesson, i) => (
            <details key={i} className="card" style={{ textAlign: "left" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                {i + 1}. {lesson.title}
              </summary>
              <div style={{ marginTop: 12, whiteSpace: "pre-wrap", lineHeight: 1.7, color: "var(--text-secondary)" }}>
                {lesson.content.slice(0, 2000)}
                {lesson.content.length > 2000 && "\n\n…"}
              </div>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
