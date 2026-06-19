import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import MarkLearnedButton from "../../MarkLearnedButton";
import SocraticChatPanel from "./SocraticChatPanel";
import { auth } from "@/lib/auth";
import { listCharacterCards } from "@/lib/character-store";
import { getLessonStudyDetail } from "@/lib/course-store";
import { buildSocraticScript } from "@/lib/socratic-script";

export const dynamic = "force-dynamic";

interface LessonStudyPageProps {
  params: Promise<{ courseId: string; lessonId: string }>;
}

export default async function LessonStudyPage({ params }: LessonStudyPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { courseId, lessonId } = await params;
  const lesson = await getLessonStudyDetail(session.user.id, lessonId);
  if (!lesson) notFound();
  if (lesson.course.id !== courseId) redirect(`/courses/${lesson.course.id}/lessons/${lesson.id}`);

  const learned = lesson.progress.some((item) => item.status === "learned" || item.status === "mastered");
  const script = buildSocraticScript(lesson.title, lesson.content);
  const characterCards = await listCharacterCards(session.user.id);

  return (
    <main className="shell">
      <section className="panel">
        <div className="row page-head" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow">Socratic Lesson</p>
            <h1>{lesson.title}</h1>
            <p className="muted">{lesson.course.title} · 第 {lesson.orderIndex} 节</p>
          </div>
          <div className="row">
            <Link className="button secondary" href={`/courses/${lesson.course.id}`}>返回课程</Link>
            <MarkLearnedButton lessonId={lesson.id} learned={learned} />
          </div>
        </div>

        <SocraticChatPanel
          characterCards={characterCards.map((item) => ({
            id: item.id,
            role: item.role,
            name: item.name,
            avatar: item.avatar,
            relationship: item.relationshipLine,
            description: item.description,
            personality: item.personality,
            scenario: item.scenario,
            firstMessage: item.firstMessage,
            isTeacher: item.isTeacher,
          }))}
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          script={script}
        />
      </section>
    </main>
  );
}
