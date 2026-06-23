-- 0002_remove_social.sql
-- Retire the community/social feature. The client UI (SocialScreen) and
-- socialService were removed to avoid App Store Guideline 1.2 (UGC) review
-- overhead before launch. These tables were empty/unused; drop them and the
-- like-count trigger so no public-readable surface remains.
--
-- Idempotent. A fresh `supabase db push` runs 0001 (which creates these) then
-- this file (which drops them), leaving the schema without any social tables.

drop trigger if exists trg_post_likes_count on public.post_likes;
drop function if exists public.sync_post_likes_count();

drop table if exists public.post_likes cascade;
drop table if exists public.post_reports cascade;
drop table if exists public.social_posts cascade;
drop table if exists public.blocked_users cascade;
