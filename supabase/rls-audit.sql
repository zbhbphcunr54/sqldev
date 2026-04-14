-- RLS audit checklist for Supabase projects
-- Run in Supabase SQL Editor.
--
-- Why you may see "empty result":
-- 1) You currently have no app tables in user schemas.
-- 2) Your app tables are not in "public" (for example in "app" schema).
-- 3) You are checking only one schema while data lives elsewhere.

-- 0) Session context
select
  current_user as db_user,
  current_role as db_role,
  current_setting('role', true) as active_role;

-- 1) Baseline: all user tables (non-system schemas)
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname not in ('pg_catalog', 'information_schema')
  and n.nspname not like 'pg_toast%'
  and n.nspname not like 'pg_temp_%'
order by 1, 2;

-- 2) RLS disabled tables in user schemas (should be empty for client-facing tables)
select
  n.nspname as schema_name,
  c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname not in ('pg_catalog', 'information_schema')
  and n.nspname not like 'pg_toast%'
  and n.nspname not like 'pg_temp_%'
  and c.relrowsecurity = false
order by 1, 2;

-- 3) Tables with RLS enabled but no policy
with user_tables as (
  select c.oid, n.nspname as schema_name, c.relname as table_name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r'
    and n.nspname not in ('pg_catalog', 'information_schema')
    and n.nspname not like 'pg_toast%'
    and n.nspname not like 'pg_temp_%'
    and c.relrowsecurity = true
)
select ut.schema_name, ut.table_name
from user_tables ut
left join pg_policies p
  on p.schemaname = ut.schema_name
 and p.tablename = ut.table_name
where p.policyname is null
order by 1, 2;

-- 4) Full policy inventory for manual review
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  coalesce(qual, 'NULL') as using_expr,
  coalesce(with_check, 'NULL') as check_expr
from pg_policies
where schemaname not in ('pg_catalog', 'information_schema')
order by schemaname, tablename, policyname;

-- 5) Storage-specific check (if you use Supabase Storage)
-- storage.objects should have policies for intended read/write behavior.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;

-- 6) Optional: quick count by schema to explain empty outputs
select
  n.nspname as schema_name,
  count(*) as table_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname not in ('pg_catalog', 'information_schema')
  and n.nspname not like 'pg_toast%'
  and n.nspname not like 'pg_temp_%'
group by n.nspname
order by n.nspname;
