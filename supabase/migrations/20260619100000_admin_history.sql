-- Admin history table for undo/redo support
create table if not exists public.admin_history (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  action_type text not null check (action_type in ('create','update','delete','approve','revoke')),
  entity_type text not null,
  entity_id text,
  before_state jsonb,
  after_state jsonb,
  label text not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_history_admin_id_idx
  on public.admin_history (admin_id, created_at desc);

alter table public.admin_history enable row level security;

DROP POLICY IF EXISTS "admins_read_own_history" ON public.admin_history;
create policy "admins_read_own_history" on public.admin_history
  for select using (auth.uid() = admin_id);

DROP POLICY IF EXISTS "admins_insert_history" ON public.admin_history;
create policy "admins_insert_history" on public.admin_history
  for insert with check (auth.uid() = admin_id);

DROP POLICY IF EXISTS "admins_delete_own_history" ON public.admin_history;
create policy "admins_delete_own_history" on public.admin_history
  for delete using (auth.uid() = admin_id);

-- Recycle bin for soft-deleted records (30-day TTL)
create table if not exists public.recycle_bin (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id text not null,
  record_data jsonb not null,
  deleted_by uuid references auth.users(id) on delete set null,
  label text,
  deleted_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists recycle_bin_table_record_idx
  on public.recycle_bin (table_name, record_id);

create index if not exists recycle_bin_expires_idx
  on public.recycle_bin (expires_at);

alter table public.recycle_bin enable row level security;

-- Only admin/master_admin players can manage the recycle bin.
DROP POLICY IF EXISTS "admins_manage_recycle_bin" ON public.recycle_bin;
create policy "admins_manage_recycle_bin" on public.recycle_bin
  for all using (
    exists (
      select 1 from public.players
      where id = auth.uid()
        and role in ('master_admin', 'admin')
    )
  );
