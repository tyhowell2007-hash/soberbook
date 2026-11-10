-- =====================================================================
-- ui_taps — which buttons get tapped. 9 Nov 2026 (Kenny).
--
-- Feeds the Sober Book insights dashboard (kept in Claude): how often
-- members use the Home doors, the say-it tabs, the New here card and the
-- craving tools added on 9 Nov.
--
-- What is stored: who tapped (for distinct counts), a short button name,
-- and when. NEVER any text a member typed.
-- Members can insert their own taps and nothing else: no select, update
-- or delete policy, so no member can read anyone's taps (their own
-- included). Only the dashboard owner, through the SQL editor, reads them.
-- =====================================================================
create table if not exists public.ui_taps (
  id      bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  what    text not null check (what ~ '^[a-z_]{2,40}$'),
  at      timestamptz not null default now()
);
create index if not exists ui_taps_what_at on public.ui_taps (what, at);
alter table public.ui_taps enable row level security;
drop policy if exists ui_taps_insert_own on public.ui_taps;
create policy ui_taps_insert_own on public.ui_taps
  for insert to authenticated with check (user_id = auth.uid());
revoke all on public.ui_taps from anon;
grant insert on public.ui_taps to authenticated;
