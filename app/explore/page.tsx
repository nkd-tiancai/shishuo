import Link from "next/link";
import { db } from "@/lib/db";

export default async function ExplorePage() {
  let courses: Array<{ id: string; title: string; lessonCount: number }> = [];
  let characters: Array<{
    id: string;
    name: string;
    role: string;
    description: string | null;
    avatar: string | null;
    avatarUrl: string | null;
  }> = [];
  let error = "";

  try {
    const [result, publicCharacters] = await Promise.all([
      db.course.findMany({
        where: { visibility: "public", status: "PUBLISHED" },
        select: { id: true, title: true, _count: { select: { lessons: true } } },
        orderBy: { publishedAt: "desc" },
        take: 100,
      }),
      db.characterCard.findMany({
        where: { visibility: "public" },
        select: { id: true, name: true, role: true, description: true, avatar: true, avatarUrl: true },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
    ]);
    courses = result.map((c) => ({ id: c.id, title: c.title, lessonCount: c._count.lessons }));
    characters = publicCharacters;
  } catch (e) {
    console.error("/explore error:", e);
    error = "加载失败，请稍后重试";
  }

  return (
    <main className="shell">
      <section className="panel">
        <h1>社区广场</h1>
        <p className="muted">浏览社区公开课程和人物卡</p>
        {error && <p className="error">{error}</p>}
        <h2 style={{ marginTop: 24 }}>公开课程</h2>
        <div className="stack" style={{ marginTop: 16 }}>
          {courses.map((c) => (
            <Link key={c.id} href={`/explore/${c.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
              <strong>{c.title}</strong>
              <small className="muted">{c.lessonCount} 节课</small>
            </Link>
          ))}
          {!courses.length && !error && <p className="muted">暂无公开课程</p>}
        </div>

        <h2 style={{ marginTop: 32 }}>公开人物卡</h2>
        <div className="stack" style={{ marginTop: 16 }}>
          {characters.map((character) => (
            <article className="card" key={character.id}>
              <div className="row" style={{ alignItems: "center" }}>
                {character.avatarUrl ? (
                  <img
                    src={character.avatarUrl}
                    alt=""
                    style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }}
                  />
                ) : (
                  <span className="chat-avatar">{character.avatar || character.name.slice(0, 1)}</span>
                )}
                <div>
                  <strong>{character.name}</strong>
                  <p className="muted">{character.role}</p>
                </div>
              </div>
              {character.description && <p className="muted">{character.description}</p>}
            </article>
          ))}
          {!characters.length && !error && <p className="muted">暂无公开人物卡</p>}
        </div>
      </section>
    </main>
  );
}
