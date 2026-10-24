-- Run this after step 1. Every number should be 1 except where noted.
-- If any comes back 0, step 1 did not take -- tell Claude which line.

select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='team_updates')       as table_want_1,
  (select count(*) from information_schema.views
    where table_schema='public' and table_name='live_team_update')   as view_want_1,
  (select count(*) from information_schema.role_table_grants
    where grantee='authenticated' and table_name='live_team_update'
      and privilege_type='SELECT')                                   as member_can_read_want_1,
  (select count(*) from information_schema.role_table_grants
    where grantee='authenticated' and table_name='team_updates')     as member_table_access_want_0,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='post_team_update')       as post_fn_want_1,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='clear_team_update')      as clear_fn_want_1;
