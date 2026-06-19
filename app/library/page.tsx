import Link from "next/link";
import { redirect } from "next/navigation";
import GenerateCourseButton from "./GenerateCourseButton";
import { auth } from "@/lib/auth";
import { listDocuments } from "@/lib/document-store";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const documents = await listDocuments(session.user.id);

  return (
    <main className="shell">
      <section className="panel">
        <div className="row page-head" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow">Library</p>
            <h1>个人教材库</h1>
            <p className="muted">上传的教材只属于当前用户。第一版支持 Markdown、TXT 和文本型 PDF 原始文件保存。</p>
          </div>
          <Link className="button secondary" href="/">返回</Link>
        </div>
        <form className="row upload-panel" action="/api/library/upload" method="post" encType="multipart/form-data">
          <input className="file-input" name="file" type="file" accept=".md,.txt,.pdf" required />
          <button className="button" type="submit">上传教材</button>
        </form>
        <div className="card-grid">
          {documents.length ? documents.map((document) => (
            <div className="card" key={document.id}>
              <span className="pill">{document.status}</span>
              <h2 style={{ fontSize: 16 }}>{document.originalName}</h2>
              <p className="muted">{(document.sizeBytes / 1024).toFixed(1)} KB</p>
              <GenerateCourseButton documentId={document.id} />
            </div>
          )) : (
            <div className="card">
              <h2 style={{ fontSize: 16 }}>还没有上传教材</h2>
              <p className="muted">先放一份 Markdown 或 PDF，后续课程生成会从这里开始。</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
