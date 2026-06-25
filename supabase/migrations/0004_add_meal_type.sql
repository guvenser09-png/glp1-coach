-- 0004_add_meal_type.sql
-- Optional meal-time category so users can log meals as breakfast/lunch/dinner/
-- snack in the daily log. Nullable text; existing rows stay valid. Idempotent.

alter table public.meal_logs add column if not exists meal_type text;
