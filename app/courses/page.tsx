import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listCourses } from "@/lib/course-store";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const courses = await listCourses(session.user.id);

  return (
    <main className="shell">
      <section className="panel">
        <div className="row page-head" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow">Courses</p>
            <h1>课程草稿</h1>
            <p className="muted">从个人教材库生成的课程会先放在这里，默认只对你可见。</p>
          </div>
          <Link className="button secondary" href="/">返回</Link>
        </div>

        <div className="card-grid">
          {courses.map((course) => (
            <div className="card" key={course.id}>
              <span className="pill">{course.status}</span>
              <h2 style={{ fontSize: 17 }}>{course.title}</h2>
              <p className="muted">{course.lessons.length} 节课</p>
              <Link className="button secondary" href={`/courses/${course.id}`}>查看课程</Link>
            </div>
          ))}
          {!courses.length && (
            <div className="card">
              <h2 style={{ fontSize: 16 }}>还没有课程</h2>
              <p className="muted">先到教材库上传 Markdown 或 TXT，再生成课程草稿。</p>
              <Link className="button" href="/library">去教材库</Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
