-- Paste this and run it AFTER step 1. Every answer must be "yes" or a
-- number greater than zero. If any line comes back no / 0, step 1 did
-- not take -- tell Claude which line.

select
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='profiles'
      and column_name='gallery')                      as column_exists_want_1,
  (select count(*) from information_schema.column_privileges
    where grantee='authenticated' and table_schema='public'
      and table_name='profiles' and column_name='gallery')
                                                      as grants_want_2,
  (select count(*) from pg_constraint
    where conname='profiles_gallery_sane')            as constraint_want_1,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='public_profiles'
      and column_name='gallery')                      as view_column_want_1,
  (select count(*) from storage.buckets
    where id='profile-photos')                        as bucket_want_1;
