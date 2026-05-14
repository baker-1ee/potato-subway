"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";

interface Example { en: string; ko: string }
interface Word {
  id: string;
  word: string;
  meaning_ko: string | null;
  examples: Example[];
}
interface Post {
  id: string;
  content: string;
  created_at: string;
}

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatHeaderDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d);
  const w = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()];
  return `${isoDate} (${w})`;
}

function displayWord(w: string) {
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : "";
}

function hasKorean(s: string) {
  return /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/.test(s);
}

function formatCommentTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

async function fetchWordByDate(date: string): Promise<Word> {
  const res = await fetch(`/api/contents/daily?date=${date}`);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw Object.assign(new Error((e as { error?: string }).error ?? "Error"), { status: res.status });
  }
  return res.json();
}

async function fetchPostsByWordId(wordId: string): Promise<Post[]> {
  const res = await fetch(`/api/posts?wordId=${wordId}`);
  if (!res.ok) throw new Error("Failed to load comments");
  const data = await res.json();
  return data.posts ?? [];
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function trackEvent(name: string, params?: Record<string, unknown>) {
  window.gtag?.("event", name, params);
}

async function createPost(wordId: string, content: string): Promise<void> {
  const res = await fetch("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wordId, content }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { error?: string }).error ?? "Failed to post"); }
}

export default function HomePage() {
  const [date] = useState(() => localDateKey());
  const [word, setWord] = useState<Word | null>(null);
  const [loading, setLoading] = useState(true);
  const [noContent, setNoContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (publishDate: string) => {
    setLoading(true);
    setError(null);
    setNoContent(false);
    setWord(null);
    try {
      setWord(await fetchWordByDate(publishDate));
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      if (err.status === 404) setNoContent(true);
      else setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(date); }, [date, load]);
  useEffect(() => { setExampleIndex(0); }, [word?.id]);
  useEffect(() => { setFormError(null); setCommentText(""); }, [word?.id]);

  useEffect(() => {
    const id = word?.id;
    if (!id) { setPosts([]); setPostsError(null); return; }
    let cancelled = false;
    (async () => {
      setPostsLoading(true);
      setPostsError(null);
      try {
        const list = await fetchPostsByWordId(id);
        if (!cancelled) setPosts(list);
      } catch (e: unknown) {
        if (!cancelled) setPostsError((e as Error).message || "Could not load comments.");
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [word?.id]);

  const examples = word?.examples ?? [];
  const currentExample = examples[exampleIndex] ?? null;

  function goToExample(nextIndex: number, dir: "left" | "right") {
    setSwipeDir(dir);
    setAnimKey((k) => k + 1);
    setExampleIndex(nextIndex);
    trackEvent("example_swipe", { direction: dir, word: word?.word });
  }

  function handleTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || examples.length <= 1) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) goToExample(Math.min(exampleIndex + 1, examples.length - 1), "left");
    else goToExample(Math.max(exampleIndex - 1, 0), "right");
  }

  const sortedPosts = useMemo(() =>
    [...posts].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [posts]
  );

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = word?.id;
    const text = commentText.trim();
    if (!id || !text || submitting) return;
    if (hasKorean(text)) { setFormError("한글은 입력할 수 없어요. Please write in English."); return; }
    setFormError(null);
    setSubmitting(true);
    try {
      await createPost(id, text);
      trackEvent("comment_submit", { word: word?.word });
      setCommentText("");
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2000);
      setPosts(await fetchPostsByWordId(id));
    } catch (err: unknown) {
      setFormError((err as Error).message || "Could not post.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app">
      <LoadingScreen visible={loading} />
      <div className="app-inner">

        <header className="app-header">
          <h1 className="app-title">Potato on the Subway</h1>
          <div className="app-date-label">
            <span>{formatHeaderDate(date)}</span>
          </div>
          {!noContent && !loading && !error && (
            <div className="app-hero">
              <img src="/heroes/hero_weekday.png" alt="" decoding="async" />
            </div>
          )}
        </header>

        {!loading && error && <div className="error-box"><p>{error}</p></div>}

        {!loading && noContent && (
          <div className="weekend-content">
            <p className="weekend-message">{"Why are you here?\nIt's the weekend. Go rest."}</p>
            <div className="weekend-hero">
              <img src="/heroes/hero_weekend.png" alt="" decoding="async" />
            </div>
          </div>
        )}

        {!loading && !error && !noContent && word && (
          <main className="main-content">
            <section className="section">
              <div className="section-label-row">
                <p className="section-label">Today&apos;s word</p>
              </div>
              <div className="card">
                <h2 className="word-text">{displayWord(word.word)}</h2>
                <p className="word-meaning">{word.meaning_ko}</p>
              </div>
            </section>

            <section className="section">
              <div className="section-label-row">
                <p className="section-label">How it&apos;s used</p>
                {examples.length > 1 && (
                  <div className="dots">
                    {examples.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`dot${i === exampleIndex ? " dot--active" : ""}`}
                        onClick={() => goToExample(i, i > exampleIndex ? "left" : "right")}
                        aria-label={`Example ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="card card--examples" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                <div key={animKey} className={swipeDir === "left" ? "slide-in-right" : "slide-in-left"}>
                  {currentExample ? (
                    <>
                      <p className="example-en">{currentExample.en}</p>
                      <p className="example-ko">{currentExample.ko}</p>
                    </>
                  ) : (
                    <p className="empty-text">No examples for this word.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="section">
              <div className="section-label-row">
                <p className="section-label">Leave a note</p>
              </div>
              <form className="note-form" onSubmit={handleCommentSubmit}>
                <div className="note-input-row">
                  <input
                    type="text"
                    className="note-input"
                    maxLength={80}
                    placeholder="Try today's word"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    disabled={submitting}
                    autoComplete="off"
                    aria-label="Comment in English"
                  />
                  <button
                    type="submit"
                    className={`note-submit${submitted ? " note-submit--dropped" : ""}`}
                    disabled={submitting || !commentText.trim()}
                  >
                    {submitted ? "Dropped ✓" : "Drop It"}
                  </button>
                </div>
                {commentText.length > 0 && <p className="note-char-count">{commentText.length}/80</p>}
                {formError && <p className="form-error">{formError}</p>}
              </form>
              <div className="comments">
                {postsLoading && <p className="comment-empty">Loading comments…</p>}
                {postsError && !postsLoading && <p className="comment-error">{postsError}</p>}
                {!postsLoading && !postsError && sortedPosts.length === 0 && (
                  <p className="comment-empty">Be the first to drop a note.</p>
                )}
                {!postsLoading && !postsError && sortedPosts.length > 0 && (
                  <ul className="comment-list">
                    {sortedPosts.map((p) => (
                      <li key={p.id} className="comment-item">
                        <span className="comment-text">{p.content}</span>
                        <time className="comment-time" dateTime={p.created_at}>{formatCommentTime(p.created_at)}</time>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </main>
        )}

        <footer className="app-footer">
          <p>Potato on the Subway · Every weekday morning</p>
        </footer>

      </div>
    </div>
  );
}
