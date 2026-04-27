-- Canonical migration:
-- supabase/migrations/202604230001_create_feedback_entries.sql
--
-- This file is kept as a SQL Editor convenience copy for existing deployments.

create extension if not exists pgcrypto;

create table if not exists public.feedback_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category text not null check (category in ('feature', 'ux', 'performance', 'bug', 'other')),
  content text not null check (char_length(content) between 6 and 1200),
  contact text,
  source text,
  scene text,
  page text,
  theme text,
  user_agent text,
  user_id uuid references auth.users(id) on delete set null,
  client_ip text
);

create index if not exists idx_feedback_entries_created_at on public.feedback_entries (created_at desc);
create index if not exists idx_feedback_entries_user_id on public.feedback_entries (user_id);

alter table public.feedback_entries enable row level security;

-- Block direct client read/write; only server-side function with service-role writes this table.
drop policy if exists "feedback_select_none" on public.feedback_entries;
create policy "feedback_select_none"
on public.feedback_entries
for select
to anon, authenticated
using (false);

drop policy if exists "feedback_insert_none" on public.feedback_entries;
create policy "feedback_insert_none"
on public.feedback_entries
for insert
to anon, authenticated
with check (false);

drop policy if exists "feedback_update_none" on public.feedback_entries;
create policy "feedback_update_none"
on public.feedback_entries
for update
to anon, authenticated
using (false)
with check (false);

drop policy if exists "feedback_delete_none" on public.feedback_entries;
create policy "feedback_delete_none"
on public.feedback_entries
for delete
to anon, authenticated
using (false);
