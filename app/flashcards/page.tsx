"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface Flashcard {
  id: string;
  question: string;
  answer: string;
}

export default function FlashcardReviewPage() {
  return (
    <Suspense fallback={<FlashcardShell message="加载中..." />}>
      <FlashcardReviewClient />
    </Suspense>
  );
}

function FlashcardReviewClient() {
  const searchParams = useSearchParams();
  const lessonId = searchParams.get("lessonId") || "";
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function loadCards(signal?: AbortSignal) {
    const response = await fetch(`/api/flashcards?lessonId=${encodeURIComponent(lessonId)}`, { signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "加载闪卡失败");
    setCards(data.flashcards || []);
    setIndex(0);
    setFlipped(false);
  }

  useEffect(() => {
    if (!lessonId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");

    loadCards(controller.signal)
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message || "加载闪卡失败");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [lessonId]);

  async function generate() {
    if (!lessonId) {
      setError("请先从课程小节进入闪卡复习。");
      return;
    }

    setGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.error || "生成失败");
        return;
      }

      if (Array.isArray(data.flashcards)) {
        setCards(data.flashcards);
        setIndex(0);
        setFlipped(false);
      } else {
        await loadCards();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setGenerating(false);
    }
  }

  async function rate(confidence: number) {
    const currentCard = cards[index];
    if (!currentCard) return;

    setFlipped(false);
    setIndex((current) => (current < cards.length - 1 ? current + 1 : 0));

    try {
      const response = await fetch("/api/flashcards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentCard.id, confidence }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "评分保存失败");
      }
    } catch {
      setError("评分保存失败");
    }
  }

  if (loading) return <FlashcardShell message="加载中..." />;

  const card = cards[index];

  return (
    <main className="shell">
      <section className="panel">
        <h1>闪卡复习</h1>
        <div className="row" style={{ gap: 12 }}>
          {cards.length > 0 && (
            <p className="muted">
              {index + 1} / {cards.length}
            </p>
          )}
          <button className="button secondary compact-button" disabled={generating} onClick={generate}>
            {generating ? "生成中..." : cards.length ? "重新生成" : "从课程生成闪卡"}
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {card && (
          <button
            type="button"
            className="card"
            style={{ cursor: "pointer", minHeight: 200, padding: 32, marginTop: 16, textAlign: "left", width: "100%" }}
            onClick={() => setFlipped((value) => !value)}
          >
            <h2 style={{ fontSize: 18 }}>{flipped ? "答案" : "问题"}</h2>
            <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.6 }}>
              {flipped ? card.answer : card.question}
            </p>
          </button>
        )}

        {flipped && (
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            {[1, 2, 3, 4, 5].map((score) => (
              <button key={score} className="button secondary compact-button" onClick={() => rate(score)}>
                {score === 1 ? "完全不会" : score === 3 ? "一般" : score === 5 ? "已掌握" : ""} {score}
              </button>
            ))}
          </div>
        )}

        {!card && !error && (
          <p className="muted" style={{ marginTop: 16 }}>
            暂无闪卡，点击“生成”从课程内容自动提取。
          </p>
        )}
      </section>
    </main>
  );
}

function FlashcardShell({ message }: { message: string }) {
  return (
    <main className="shell">
      <section className="panel">
        <p className="muted">{message}</p>
      </section>
    </main>
  );
}
