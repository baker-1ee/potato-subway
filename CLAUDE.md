# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Potato on the Subway** is a daily English vocabulary learning service built around a subway-riding potato character. Each weekday, one English word is shown with a Korean meaning, up to 3 example sentences, and an anonymous comment section where anyone can write using the word.

The codebase has two active directories:
- `nextjs-app/` — Next.js fullstack app (web UI + API backend), deployed on Vercel with Supabase (PostgreSQL)
- `expo-app/` — React Native (Expo) mobile app, shares the same API backend

The mobile app (`expo-app/`) is the primary client. The web app serves the same content and shares all API routes.

## Commands

**Next.js (web + API)** — run from `nextjs-app/`:
```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run ESLint
```

**Expo (mobile app)** — run from `expo-app/`:
```bash
npm run start    # Start Expo dev server
npm run android  # Run on Android
```

**Android APK CI** — push to `main` with changes under `expo-app/` triggers GitHub Actions build. APK available in Actions → Artifacts.

There are no tests configured in this project.

## Architecture

### Directory: `nextjs-app/`

Next.js 16 App Router, TypeScript, Tailwind CSS v4, shadcn/ui components.

**App Router pages:**
- `app/page.tsx` — Main client page (the full UI: word, examples, comments)
- `app/admin/page.tsx` — Admin page for importing content from Notion

**API Routes (`app/api/`):**
| Route | Method | Description |
|---|---|---|
| `/api/contents/daily` | GET | Fetch today's word by `?date=YYYY-MM-DD` |
| `/api/contents` | POST | Create a word entry (admin) |
| `/api/contents/batch` | POST | Bulk create word entries (admin) |
| `/api/contents/[id]` | GET | Single word by ID |
| `/api/contents/month/[monthKey]` | GET | All words for a month (e.g. `2025-05`) |
| `/api/posts` | GET/POST | Fetch/create anonymous comments by `?wordId=` |
| `/api/admin` | GET | Returns `NOTION_DATABASE_URL` for the admin UI |
| `/api/admin/import-notion` | POST | Full sync from Notion → Supabase |

**Lib modules (`lib/`):**
- `db.ts` — `postgres` client singleton connected to Supabase via `DATABASE_URL`
- `auth.ts` — `requireUploadSecret()` checks `Authorization: Bearer <token>` or `x-upload-secret` header against `CONTENT_UPLOAD_SECRET`
- `ipHash.ts` — SHA-256 hashes client IP (from `x-forwarded-for`) with `IP_HASH_SALT` for anonymous attribution
- `notionImport.ts` — Fetches all pages from a Notion database, parses them into `NotionRow` objects; handles pagination and case-insensitive column name matching

### Database Schema

Two tables in Supabase (PostgreSQL). Migration SQL: `supabase/migrations/001_init.sql`.

**`contents`** — Daily vocabulary words
- `publish_date DATE` — The date the word is shown (indexed)
- `examples JSONB` — Array of `{en, ko}` objects (max 3)
- `month_key TEXT` — `YYYY-MM` format, used with `order` for Notion import ordering
- `is_active BOOLEAN` — Controls visibility; only active rows are served

**`posts`** — Anonymous user comments
- `word_id UUID` → FK to `contents.id` (CASCADE delete)
- `ip_hash TEXT` — Hashed IP, never stored raw
- `content TEXT` — Max 2,000 characters (enforced in DB and API)

RLS is enabled: anon role has SELECT only; writes require the service role key (used server-side via `DATABASE_URL`).

### Notion Import Flow

Admin page (`/admin`) → POST `/api/admin/import-notion` → `fetchNotionRows()` in `lib/notionImport.ts` → full sync transaction in Supabase.

The import is a **destructive full sync**: it deletes any `contents` rows whose `publish_date` is not present in the Notion database, then upserts the rest. The `UNIQUE(month_key, order)` constraint requires a two-step update (bump order by +1,000,000 then set real value) to avoid conflicts.

Expected Notion database columns: `date`, `word`, `word_ko`, `example_1`, `example_1_ko`, `example_2`, `example_2_ko`, `example_3`, `example_3_ko`. Column name matching is case-insensitive.

### Admin Authentication

All write API routes (contents creation, Notion import) require either:
- `Authorization: Bearer <CONTENT_UPLOAD_SECRET>`, or
- `x-upload-secret: <CONTENT_UPLOAD_SECRET>` header

The admin UI page itself (`/admin`) has no authentication — it's security by obscurity.

## Environment Variables

Copy `.env.example` to `.env.local` inside `nextjs-app/`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase transaction pooler connection string (port 6543) |
| `DIRECT_URL` | Supabase direct/session connection (port 5432, for migrations) |
| `CONTENT_UPLOAD_SECRET` | Secret token for admin API routes |
| `IP_HASH_SALT` | Salt for HMAC-style IP hashing |
| `NOTION_TOKEN` | Notion integration token (`secret_...`) |
| `NOTION_DATABASE_URL` | URL of the Notion database to import from |

## Key Conventions

- **Date handling**: dates are always computed client-side using `localDateKey()` in `app/page.tsx`, which formats `new Date()` as `YYYY-MM-DD`. No timezone normalization — the displayed date matches the user's local clock.
- **Comment input**: Korean characters are blocked client-side via Unicode range regex in `hasKorean()` — present in both web (`app/page.tsx`) and app (`expo-app/app/index.tsx`). Max length is 80 chars in the UI (the DB/API allow 2,000). Comments are sorted newest-first in both clients.
- **Hero images**: 6 weekday hero images (`hero_weekday*.png`) are randomly selected on each word load in both web and app. Weekend/no-content shows `hero_weekend.png`. Images live in `nextjs-app/public/heroes/` and `expo-app/assets/heroes/`.
- **Styling**: All main-page styles are in `app/globals.css` using plain CSS class names (`.app`, `.card`, `.comment-item`, etc.). The admin page uses Tailwind utility classes directly. shadcn/ui components in `components/ui/` are available but the main page doesn't use them.
- **Analytics**: Google Analytics (`G-HNGFHYP53D`) is loaded in `app/layout.tsx`. Key events are tracked via `window.gtag` calls in `app/page.tsx`: `example_swipe`, `comment_submit`.
