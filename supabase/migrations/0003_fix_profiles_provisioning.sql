-- 0003_fix_profiles_provisioning.sql
-- Hotfix applied to the live project: an earlier (pre-migration) profiles table
-- was keyed on user_id with no `id` column, so the original handle_new_user()
-- (which inserted `id`) failed with "column id of relation profiles does not
-- exist" → every signup returned 500 "Database error saving new user" and no one
-- could log in. This realigns the trigger to the real schema (user_id) and makes
-- it never block auth signup. Idempotent; safe on a fresh DB too.

create unique index if not exists profiles_user_id_key on public.profiles (user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
exception when others then
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
