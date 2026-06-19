import Link from "next/link";
import { redirect } from "next/navigation";
import CharacterCardsClient, { CharacterCardRow } from "./CharacterCardsClient";
import { auth } from "@/lib/auth";
import { listCharacterCards } from "@/lib/character-store";

export const dynamic = "force-dynamic";

export default async function CharactersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const characters = await listCharacterCards(session.user.id);
  const rows: CharacterCardRow[] = characters.map((item) => ({
    id: item.id,
    name: item.name,
    role: item.role as CharacterCardRow["role"],
    description: item.description,
    personality: item.personality,
    scenario: item.scenario,
    firstMessage: item.firstMessage,
    avatar: item.avatar,
    relationshipLine: item.relationshipLine,
    isTeacher: item.isTeacher,
  }));

  return (
    <main className="shell">
      <section className="panel">
        <div className="row page-head" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow">Character Cards</p>
            <h1>人物卡</h1>
            <p className="muted">为课堂群聊、导师私聊和角色私聊准备可复用的人物设定。</p>
          </div>
          <div className="row">
            <Link className="button secondary" href="/">返回首页</Link>
            <Link className="button secondary" href="/courses">进入课程</Link>
          </div>
        </div>

        <CharacterCardsClient initialCharacters={rows} />
      </section>
    </main>
  );
}
