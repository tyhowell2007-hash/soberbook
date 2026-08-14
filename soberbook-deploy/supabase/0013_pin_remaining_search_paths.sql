-- =====================================================================
-- 0013 — pin the search_path on the three functions 0005 missed
--
-- APPLIED Aug 10 2026 via the Supabase connector, and verified by
-- reading pg_proc.proconfig back. All five functions now pinned.
--
-- FOUND BY: Supabase's own security advisor, which I could not run
-- until tonight. Worth noting how it surfaced — not by reading the
-- code, but by asking the database what it thinks of itself.
--
-- 0005 pinned assert_handle_allowed and block_author_of_post because
-- they are SECURITY DEFINER. These three are SECURITY INVOKER, which is
-- why they were skipped at the time — an invoker function runs with the
-- caller's own privileges, so ordinarily there is nothing to escalate.
--
-- ⚠️ EXCEPT FOR anon_alias, AND THIS IS THE PART WORTH REMEMBERING.
--
-- anon_alias is called INSIDE feed_posts. feed_posts is a view, and a
-- view executes as its OWNER — postgres. A SECURITY INVOKER function
-- called from inside an owner-executed view therefore also runs as
-- postgres. "Invoker" does not mean "as the member"; it means "as
-- whoever is running right now", and inside a view that is the owner.
--
-- So the single function in this database whose entire job is anonymity
-- was the one reachable in a postgres context with an unpinned
-- search_path. Not exploitable today: Postgres 15+ revokes CREATE on
-- `public` from PUBLIC, so a member cannot plant a shadowing object.
-- But that is a default we happen to benefit from rather than a
-- decision anyone here made — and inherited defaults are exactly what
-- burned us on Aug 4 and Aug 6, in both directions.
--
-- THE LESSON: SECURITY INVOKER is not a property of the function. It's
-- a property of the CALL. Ask who's running, not what it's labelled.
-- =====================================================================

alter function public.current_uid()          set search_path = public, pg_temp;
alter function public.anon_alias(uuid, uuid) set search_path = public, pg_temp;
alter function public.block_audit_mutation() set search_path = public, pg_temp;

-- read it back
select p.proname,
       case when p.prosecdef then 'DEFINER' else 'invoker' end as runs_as,
       coalesce(array_to_string(p.proconfig,' | '),'** NOT PINNED **') as settings
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('current_uid','anon_alias','block_audit_mutation',
                    'assert_handle_allowed','block_author_of_post')
order by p.proname;
