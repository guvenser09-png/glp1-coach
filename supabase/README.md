# Supabase backend (GLP-1 app)

This directory holds the database schema and Row Level Security (RLS) policies for
the app's Supabase backend (Postgres + Auth + RLS).

## Applying the migration

The schema lives in `migrations/0001_init.sql`. Apply it one of two ways:

### Option A — Supabase CLI (recommended)

```bash
# from the repo root, with the project linked (supabase link --project-ref <ref>)
supabase db push
```

`supabase db push` applies every file in `migrations/` in order. The migration is
**idempotent** (`create table if not exists`, `drop policy if exists` before each
`create policy`), so re-running it is safe.

### Option B — Dashboard SQL editor

1. Open the Supabase dashboard → your project → **SQL Editor**.
2. Paste the full contents of `migrations/0001_init.sql`.
3. Run it.

## Security model

- **RLS is enabled on every table and is owner-only.** A signed-in user can only
  read/write their own rows. Owner-only policies use
  `using (auth.uid() = <owner_col>) with check (auth.uid() = <owner_col>)`.
  - Owner column is `user_id` on all health/medication/profile tables.
  - Social tables use domain owner columns: `social_posts.author_id`,
    `post_likes.user_id`, `post_reports.reporter_id`, `blocked_users.blocker_id`.
- **`social_posts` is the one public-readable table** — anyone signed in can
  `select` the community feed (`using (true)`), but `insert`/`update`/`delete`
  remain restricted to the post's author. `post_likes` is also select-readable by
  any authenticated user so like counts/state render for every post.
- The app code **also filters owner-scoped reads by `user_id` explicitly**
  (defense-in-depth), so a misconfigured policy can't leak another user's data.
- A `handle_new_user()` trigger on `auth.users` auto-creates a `profiles` row when
  a user signs up.
- A trigger keeps `social_posts.likes` in sync with the `post_likes` join table.

## API keys

- The **anon / publishable** key is safe to ship in the mobile app. It only ever
  acts through RLS as the signed-in user, so it cannot bypass the policies above.
- The **`service_role` key bypasses RLS entirely.** Never bundle it in the app or
  commit it. Keep it server-side only (Edge Functions, secured backend env vars).
