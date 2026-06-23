-- 0001_init.sql
-- GLP-1 weight-management app — full schema + Row Level Security.
--
-- Audit fixes:
--   #1  Backend schema actually exists (tables, columns, constraints, indexes).
--   #5  RLS is enabled and owner-only on every table (defense-in-depth alongside
--       the explicit .eq('user_id', uid) filters the services now apply).
--
-- Design notes:
--   * Owner column is `user_id` everywhere EXCEPT the social tables, which use
--     domain-specific owner columns (author_id / reporter_id / blocker_id) to
--     match socialService.js. Policies reference the correct column per table.
--   * social_posts is PUBLIC-READABLE (community feed) but writable only by the
--     author. All other tables are fully owner-private.
--   * This migration is idempotent: create table if not exists, and every policy
--     is dropped-if-exists before being (re)created.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- handle_new_user() inserts a row with id = auth.users.id, so `id` is the PK and
-- also the owner key. The app also reads/writes via `user_id`, so we keep both in
-- sync (user_id defaults to id) and treat user_id as the RLS owner column.
create table if not exists public.profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  user_id                uuid not null references auth.users(id) on delete cascade,
  name                   text,
  email                  text,
  gender                 text,
  weight                 numeric,
  height                 numeric,
  goal_weight            numeric,
  protein_target         numeric,
  protein_per_kg         numeric,
  protein_target_custom  numeric,
  exercise_days_per_week integer,
  created_at             timestamptz not null default now()
);

-- The app upserts profiles onConflict 'user_id', so user_id must be unique.
create unique index if not exists profiles_user_id_key on public.profiles (user_id);

-- ---------------------------------------------------------------------------
-- weight_logs
-- ---------------------------------------------------------------------------
create table if not exists public.weight_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  weight     numeric,
  date       date not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists weight_logs_user_date_idx on public.weight_logs (user_id, date);

-- ---------------------------------------------------------------------------
-- meal_logs
-- ---------------------------------------------------------------------------
create table if not exists public.meal_logs (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  protein      numeric,
  calories     numeric,
  food_type    text,
  portion_size text,
  image_uri    text,
  date         date not null,
  created_at   timestamptz not null default now()
);
create index if not exists meal_logs_user_date_idx on public.meal_logs (user_id, date);

-- ---------------------------------------------------------------------------
-- medication_profile  (one row per user, upserted onConflict 'user_id')
-- ---------------------------------------------------------------------------
create table if not exists public.medication_profile (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  drug              text,
  dose_mg           numeric,
  dose_unit         text,
  frequency         text,
  injection_weekday integer,
  status            text,
  reminder_hour     integer,
  reminder_minute   integer,
  start_date        date,
  created_at        timestamptz not null default now(),
  unique (user_id)
);

-- ---------------------------------------------------------------------------
-- dose_logs
-- ---------------------------------------------------------------------------
create table if not exists public.dose_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  dose       text,
  date       date not null,
  created_at timestamptz not null default now()
);
create index if not exists dose_logs_user_date_idx on public.dose_logs (user_id, date);

-- ---------------------------------------------------------------------------
-- dose_changes  (titration timeline)
-- ---------------------------------------------------------------------------
create table if not exists public.dose_changes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  dose_mg    numeric,
  date       date not null,
  created_at timestamptz not null default now()
);
create index if not exists dose_changes_user_date_idx on public.dose_changes (user_id, date);

-- ---------------------------------------------------------------------------
-- body_measurements
-- ---------------------------------------------------------------------------
create table if not exists public.body_measurements (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  waist      numeric,
  arm        numeric,
  neck       numeric,
  chest      numeric,
  hip        numeric,
  created_at timestamptz not null default now()
);
create index if not exists body_measurements_user_date_idx on public.body_measurements (user_id, date);

-- ---------------------------------------------------------------------------
-- symptom_logs
-- ---------------------------------------------------------------------------
create table if not exists public.symptom_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  type       text,
  severity   integer,
  created_at timestamptz not null default now()
);
create index if not exists symptom_logs_user_date_idx on public.symptom_logs (user_id, date);

-- ---------------------------------------------------------------------------
-- social_posts  (PUBLIC feed; owner column = author_id)
-- ---------------------------------------------------------------------------
create table if not exists public.social_posts (
  id             bigint generated always as identity primary key,
  author_id      uuid not null references auth.users(id) on delete cascade,
  author_name    text,
  type           text not null default 'general',
  text           text,
  meal_photo_uri text,
  protein        numeric,
  likes          integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists social_posts_created_at_idx on public.social_posts (created_at desc);
create index if not exists social_posts_author_idx on public.social_posts (author_id);

-- ---------------------------------------------------------------------------
-- post_likes  (join table; the like count = count of rows for a post)
-- ---------------------------------------------------------------------------
create table if not exists public.post_likes (
  post_id    bigint not null references public.social_posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_user_idx on public.post_likes (user_id);
create index if not exists post_likes_post_idx on public.post_likes (post_id);

-- ---------------------------------------------------------------------------
-- post_reports  (owner column = reporter_id)
-- ---------------------------------------------------------------------------
create table if not exists public.post_reports (
  id          bigint generated always as identity primary key,
  post_id     bigint not null references public.social_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists post_reports_reporter_idx on public.post_reports (reporter_id);

-- ---------------------------------------------------------------------------
-- blocked_users  (owner column = blocker_id)
-- ---------------------------------------------------------------------------
create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================

alter table public.profiles          enable row level security;
alter table public.weight_logs       enable row level security;
alter table public.meal_logs         enable row level security;
alter table public.medication_profile enable row level security;
alter table public.dose_logs         enable row level security;
alter table public.dose_changes      enable row level security;
alter table public.body_measurements enable row level security;
alter table public.symptom_logs      enable row level security;
alter table public.social_posts      enable row level security;
alter table public.post_likes        enable row level security;
alter table public.post_reports      enable row level security;
alter table public.blocked_users     enable row level security;

-- ── profiles (owner-only, keyed on user_id) ─────────────────────────────────
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.uid() = user_id);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (auth.uid() = user_id);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete using (auth.uid() = user_id);

-- ── weight_logs ─────────────────────────────────────────────────────────────
drop policy if exists weight_logs_select on public.weight_logs;
create policy weight_logs_select on public.weight_logs
  for select using (auth.uid() = user_id);
drop policy if exists weight_logs_insert on public.weight_logs;
create policy weight_logs_insert on public.weight_logs
  for insert with check (auth.uid() = user_id);
drop policy if exists weight_logs_update on public.weight_logs;
create policy weight_logs_update on public.weight_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists weight_logs_delete on public.weight_logs;
create policy weight_logs_delete on public.weight_logs
  for delete using (auth.uid() = user_id);

-- ── meal_logs ───────────────────────────────────────────────────────────────
drop policy if exists meal_logs_select on public.meal_logs;
create policy meal_logs_select on public.meal_logs
  for select using (auth.uid() = user_id);
drop policy if exists meal_logs_insert on public.meal_logs;
create policy meal_logs_insert on public.meal_logs
  for insert with check (auth.uid() = user_id);
drop policy if exists meal_logs_update on public.meal_logs;
create policy meal_logs_update on public.meal_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists meal_logs_delete on public.meal_logs;
create policy meal_logs_delete on public.meal_logs
  for delete using (auth.uid() = user_id);

-- ── medication_profile ──────────────────────────────────────────────────────
drop policy if exists medication_profile_select on public.medication_profile;
create policy medication_profile_select on public.medication_profile
  for select using (auth.uid() = user_id);
drop policy if exists medication_profile_insert on public.medication_profile;
create policy medication_profile_insert on public.medication_profile
  for insert with check (auth.uid() = user_id);
drop policy if exists medication_profile_update on public.medication_profile;
create policy medication_profile_update on public.medication_profile
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists medication_profile_delete on public.medication_profile;
create policy medication_profile_delete on public.medication_profile
  for delete using (auth.uid() = user_id);

-- ── dose_logs ───────────────────────────────────────────────────────────────
drop policy if exists dose_logs_select on public.dose_logs;
create policy dose_logs_select on public.dose_logs
  for select using (auth.uid() = user_id);
drop policy if exists dose_logs_insert on public.dose_logs;
create policy dose_logs_insert on public.dose_logs
  for insert with check (auth.uid() = user_id);
drop policy if exists dose_logs_update on public.dose_logs;
create policy dose_logs_update on public.dose_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists dose_logs_delete on public.dose_logs;
create policy dose_logs_delete on public.dose_logs
  for delete using (auth.uid() = user_id);

-- ── dose_changes ────────────────────────────────────────────────────────────
drop policy if exists dose_changes_select on public.dose_changes;
create policy dose_changes_select on public.dose_changes
  for select using (auth.uid() = user_id);
drop policy if exists dose_changes_insert on public.dose_changes;
create policy dose_changes_insert on public.dose_changes
  for insert with check (auth.uid() = user_id);
drop policy if exists dose_changes_update on public.dose_changes;
create policy dose_changes_update on public.dose_changes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists dose_changes_delete on public.dose_changes;
create policy dose_changes_delete on public.dose_changes
  for delete using (auth.uid() = user_id);

-- ── body_measurements ───────────────────────────────────────────────────────
drop policy if exists body_measurements_select on public.body_measurements;
create policy body_measurements_select on public.body_measurements
  for select using (auth.uid() = user_id);
drop policy if exists body_measurements_insert on public.body_measurements;
create policy body_measurements_insert on public.body_measurements
  for insert with check (auth.uid() = user_id);
drop policy if exists body_measurements_update on public.body_measurements;
create policy body_measurements_update on public.body_measurements
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists body_measurements_delete on public.body_measurements;
create policy body_measurements_delete on public.body_measurements
  for delete using (auth.uid() = user_id);

-- ── symptom_logs ────────────────────────────────────────────────────────────
drop policy if exists symptom_logs_select on public.symptom_logs;
create policy symptom_logs_select on public.symptom_logs
  for select using (auth.uid() = user_id);
drop policy if exists symptom_logs_insert on public.symptom_logs;
create policy symptom_logs_insert on public.symptom_logs
  for insert with check (auth.uid() = user_id);
drop policy if exists symptom_logs_update on public.symptom_logs;
create policy symptom_logs_update on public.symptom_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists symptom_logs_delete on public.symptom_logs;
create policy symptom_logs_delete on public.symptom_logs
  for delete using (auth.uid() = user_id);

-- ── social_posts (PUBLIC readable; write owner-only via author_id) ───────────
drop policy if exists social_posts_select_public on public.social_posts;
create policy social_posts_select_public on public.social_posts
  for select using (true);
drop policy if exists social_posts_insert on public.social_posts;
create policy social_posts_insert on public.social_posts
  for insert with check (auth.uid() = author_id);
drop policy if exists social_posts_update on public.social_posts;
create policy social_posts_update on public.social_posts
  for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
drop policy if exists social_posts_delete on public.social_posts;
create policy social_posts_delete on public.social_posts
  for delete using (auth.uid() = author_id);

-- ── post_likes (owner = user_id) ────────────────────────────────────────────
-- SELECT is open to authenticated users so like state/counts can be read for any
-- post in the public feed; writes are restricted to the liking user.
drop policy if exists post_likes_select on public.post_likes;
create policy post_likes_select on public.post_likes
  for select using (auth.uid() is not null);
drop policy if exists post_likes_insert on public.post_likes;
create policy post_likes_insert on public.post_likes
  for insert with check (auth.uid() = user_id);
drop policy if exists post_likes_delete on public.post_likes;
create policy post_likes_delete on public.post_likes
  for delete using (auth.uid() = user_id);

-- ── post_reports (owner = reporter_id) ──────────────────────────────────────
drop policy if exists post_reports_select on public.post_reports;
create policy post_reports_select on public.post_reports
  for select using (auth.uid() = reporter_id);
drop policy if exists post_reports_insert on public.post_reports;
create policy post_reports_insert on public.post_reports
  for insert with check (auth.uid() = reporter_id);
drop policy if exists post_reports_delete on public.post_reports;
create policy post_reports_delete on public.post_reports
  for delete using (auth.uid() = reporter_id);

-- ── blocked_users (owner = blocker_id) ──────────────────────────────────────
drop policy if exists blocked_users_select on public.blocked_users;
create policy blocked_users_select on public.blocked_users
  for select using (auth.uid() = blocker_id);
drop policy if exists blocked_users_insert on public.blocked_users;
create policy blocked_users_insert on public.blocked_users
  for insert with check (auth.uid() = blocker_id);
drop policy if exists blocked_users_delete on public.blocked_users;
create policy blocked_users_delete on public.blocked_users
  for delete using (auth.uid() = blocker_id);

-- ===========================================================================
-- Keep social_posts.likes in sync with post_likes via trigger.
-- toggleLike() also writes the count directly, but the author may not be the
-- liker — so for non-owners that UPDATE is blocked by RLS. This trigger keeps the
-- denormalized count authoritative regardless of who likes/unlikes.
-- ===========================================================================
create or replace function public.sync_post_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post bigint;
begin
  target_post := coalesce(new.post_id, old.post_id);
  update public.social_posts
     set likes = (select count(*) from public.post_likes where post_id = target_post)
   where id = target_post;
  return null;
end;
$$;

drop trigger if exists trg_post_likes_count on public.post_likes;
create trigger trg_post_likes_count
  after insert or delete on public.post_likes
  for each row execute function public.sync_post_likes_count();

-- ===========================================================================
-- Auto-provision a profile row when a new auth user is created.
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, user_id, email)
  values (new.id, new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- Harden SECURITY DEFINER functions: they are triggers, not RPC. Revoke EXECUTE
-- so they cannot be called via PostgREST (/rest/v1/rpc/...). Trigger execution
-- does not require an EXECUTE grant, so the triggers above keep working.
-- ===========================================================================
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_post_likes_count() from public, anon, authenticated;
