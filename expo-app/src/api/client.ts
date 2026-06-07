const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

export interface Example {
  en: string;
  ko: string;
}

export interface Word {
  id: string;
  word: string;
  meaning_ko: string | null;
  meaning_en: string | null;
  examples: Example[];
  publish_date: string;
}

export interface Post {
  id: string;
  word_id: string;
  content: string;
  created_at: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = Object.assign(new Error((body as { error?: string }).error ?? "Request failed"), { status: res.status });
    throw err;
  }
  return res.json();
}

export function fetchWordByDate(date: string): Promise<Word> {
  return request(`/api/contents/daily?date=${date}`);
}

export async function fetchPostsByWordId(wordId: string): Promise<Post[]> {
  const data = await request<{ posts: Post[] }>(`/api/posts?wordId=${wordId}`);
  return data.posts ?? [];
}

export function createPost(wordId: string, content: string): Promise<Post> {
  return request("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wordId, content }),
  });
}
