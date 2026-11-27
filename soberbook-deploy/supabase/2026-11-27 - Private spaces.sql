-- =====================================================================
-- PRIVATE SPACES — 27 Nov 2026 (Kenny, drop 3b; Ty OK'd the join + mod rules)
-- Two members-only rooms: Women's Room and the LGBTQ+ Room.
--   • Anyone can opt in from For You → Private spaces. No proof asked.
--   • Only members who joined can see the room or read/write in it.
--   • Anonymous by default (handles hidden, room alias shown).
--   • Moderation is the existing report button + Ty and Kenny.
-- Safe to run twice.
-- =====================================================================

alter table public.rooms add column if not exists members_only boolean not null default false;

create table if not exists public.room_members (
  room_id   uuid not null references public.rooms(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, member_id)
);
alter table public.room_members enable row level security;
revoke all on public.room_members from anon, authenticated;
grant select on public.room_members to authenticated;
drop policy if exists room_members_own on public.room_members;
create policy room_members_own on public.room_members
  for select to authenticated using (member_id = current_uid());

-- Can the signed-in member be in this room?
create or replace function public.room_open_to_me(p_room uuid)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  select exists (
    select 1 from rooms r
    where r.id = p_room and r.active
      and (not r.members_only
           or exists (select 1 from room_members m where m.room_id = r.id and m.member_id = current_uid()))
  );
$$;
grant execute on function public.room_open_to_me(uuid) to authenticated;

-- The room list (Rooms tab) only shows a private room to its members.
drop policy if exists rooms_readable on public.rooms;
create policy rooms_readable on public.rooms
  for select using (active and (not members_only or room_open_to_me(id)));

-- Only members can post in a private room.
drop policy if exists room_messages_insert_own on public.room_messages;
create policy room_messages_insert_own on public.room_messages
  for insert with check (author_id = current_uid() and room_open_to_me(room_id));

-- room_wall: same view as before, plus "private rooms only for members".
create or replace view public.room_wall as
 SELECT m.id, m.room_id, r.slug AS room_slug, m.body, m.created_at,
    (m.author_id = current_uid()) AS is_mine,
    CASE WHEN r.anonymous THEN NULL::text ELSE p.handle END AS handle,
    CASE WHEN r.anonymous THEN COALESCE(ra.alias, 'someone here'::text)
         WHEN (p.privacy_mode = 'anonymous'::text) THEN p.handle
         ELSE COALESCE(p.display_name, p.handle) END AS display_name,
    CASE WHEN (r.anonymous OR (p.privacy_mode = 'anonymous'::text) OR (p.avatar_kind <> 'emoji'::text)) THEN NULL::text ELSE p.avatar END AS display_avatar,
    CASE WHEN (r.anonymous OR (p.privacy_mode = 'anonymous'::text) OR (p.avatar_kind <> 'photo'::text)) THEN NULL::text ELSE p.avatar_photo END AS display_avatar_photo,
    m.photo_urls, m.edited_at,
    ( SELECT (count(*))::integer AS count FROM room_message_likes l WHERE (l.message_id = m.id)) AS likes,
    (EXISTS ( SELECT 1 FROM room_message_likes l WHERE ((l.message_id = m.id) AND (l.user_id = current_uid())))) AS i_liked,
    m.video_url, m.stream_uid,
    COALESCE(( SELECT jsonb_object_agg(z.k, z.n) AS jsonb_object_agg
               FROM ( SELECT COALESCE(l.emoji, '❤️'::text) AS k, (count(*))::integer AS n
                      FROM room_message_likes l WHERE (l.message_id = m.id)
                      GROUP BY COALESCE(l.emoji, '❤️'::text)) z), '{}'::jsonb) AS reactions,
    ( SELECT COALESCE(l.emoji, '❤️'::text) AS "coalesce" FROM room_message_likes l
      WHERE ((l.message_id = m.id) AND (l.user_id = current_uid()))) AS my_reaction
   FROM (((room_messages m
     JOIN rooms r ON (((r.id = m.room_id) AND r.active)))
     JOIN profiles p ON ((p.id = m.author_id)))
     LEFT JOIN room_aliases ra ON (((ra.room_id = m.room_id) AND (ra.member_id = m.author_id))))
  WHERE ((m.deleted_at IS NULL) AND (p.suspended_at IS NULL) AND (p.deleted_at IS NULL)
    AND (NOT r.members_only OR EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = r.id AND rm.member_id = current_uid()))
    AND (NOT (EXISTS ( SELECT 1 FROM blocks b
         WHERE (((b.blocker_id = current_uid()) AND (b.blocked_id = m.author_id))
             OR ((b.blocked_id = current_uid()) AND (b.blocker_id = m.author_id)))))));

-- The private spaces, and whether I'm in each. For the /spaces page.
create or replace function public.my_spaces()
returns table (slug text, emoji text, name text, blurb text, joined boolean)
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select r.slug, r.emoji, r.name, r.blurb,
         exists (select 1 from room_members m where m.room_id = r.id and m.member_id = current_uid())
  from rooms r where r.active and r.members_only and current_uid() is not null
  order by r.sort, r.created_at;
$$;
grant execute on function public.my_spaces() to authenticated;

create or replace function public.join_space(p_slug text)
returns boolean language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare me uuid := current_uid(); rid uuid;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select id into rid from rooms where slug = p_slug and active and members_only;
  if rid is null then return false; end if;
  insert into room_members (room_id, member_id) values (rid, me) on conflict do nothing;
  return true;
end $$;
grant execute on function public.join_space(text) to authenticated;

create or replace function public.leave_space(p_slug text)
returns boolean language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare me uuid := current_uid();
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  delete from room_members m using rooms r
   where r.id = m.room_id and r.slug = p_slug and r.members_only and m.member_id = me;
  return true;
end $$;
grant execute on function public.leave_space(text) to authenticated;

-- A mention inside a private room only notifies people who are in it.
-- Same function as before plus one line (marked 27 Nov).
create or replace function public.notify_mention_in(p_kind text, p_id uuid, p_handles text[])
returns integer language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  me uuid := current_uid(); v_body text; v_author uuid; v_anon boolean; v_post uuid;
  v_room uuid; v_aud text; v_mo boolean := false; t record; n_sent integer := 0;
begin
  if me is null or p_id is null or p_handles is null then return 0; end if;
  if p_kind not in ('comment','room') then return 0; end if;
  if p_kind = 'comment' then
    select c.body, c.author_id, c.is_anonymous, c.post_id, p.audience
      into v_body, v_author, v_anon, v_post, v_aud
      from comments c join posts p on p.id = c.post_id where c.id = p_id;
    if v_aud is distinct from 'open' then return 0; end if;
  else
    select m.body, m.author_id, r.anonymous, m.room_id, r.members_only
      into v_body, v_author, v_anon, v_room, v_mo
      from room_messages m join rooms r on r.id = m.room_id
     where m.id = p_id and m.deleted_at is null and r.active;
  end if;
  if v_body is null then return 0; end if;
  if v_author is distinct from me then return 0; end if;
  for t in select pr.id, pr.handle, pr.display_name from profiles pr
            where lower(pr.handle) = any (select lower(x) from unnest(p_handles) x)
              and pr.deleted_at is null and pr.suspended_at is null and pr.id <> me
  loop
    if not (v_body ilike '%@' || t.handle || '%'
            or (t.display_name is not null and v_body ilike '%@' || t.display_name || '%')) then continue; end if;
    if exists (select 1 from blocks where (blocker_id = t.id and blocked_id = me) or (blocker_id = me and blocked_id = t.id)) then continue; end if;
    /* 27 Nov — a private room never tells an outsider it exists. */
    if v_mo and not exists (select 1 from room_members rm where rm.room_id = v_room and rm.member_id = t.id) then continue; end if;
    insert into notifications (user_id, kind, actor_id, actor_anon, post_id, talk_room_id)
    values (t.id, 'mention', me, coalesce(v_anon, false), v_post, v_room);
    n_sent := n_sent + 1;
  end loop;
  return n_sent;
end $function$;

-- The two rooms. Anonymous, members only, after the existing rooms.
insert into public.rooms (slug, emoji, name, blurb, sort, active, anonymous, members_only)
select 'women', '🌸', 'Women''s Room', 'From women, for women. Only members who join can see this room.', 50, true, true, true
where not exists (select 1 from public.rooms where slug = 'women');
insert into public.rooms (slug, emoji, name, blurb, sort, active, anonymous, members_only)
select 'lgbtq', '🏳️‍🌈', 'LGBTQ+ Room', 'For LGBTQ+ people in recovery. Only members who join can see this room.', 51, true, true, true
where not exists (select 1 from public.rooms where slug = 'lgbtq');

-- Check: should list both rooms with members_only = true.
select slug, name, anonymous, members_only from public.rooms order by sort;
