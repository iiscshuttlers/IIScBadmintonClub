-- #29 Trust & safety: user reports + blocks.

-- ── Reports ──────────────────────────────────────────────────────────────────
create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.players(id) on delete set null,
  reported_player_id uuid references public.players(id) on delete cascade not null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default timezone('utc', now()),
  reviewed_by uuid references public.players(id) on delete set null,
  reviewed_at timestamptz
);

create index if not exists user_reports_status_idx on public.user_reports (status, created_at desc);
create index if not exists user_reports_reported_idx on public.user_reports (reported_player_id);

alter table public.user_reports enable row level security;

-- A signed-in user may file a report as themselves.
drop policy if exists "file own report" on public.user_reports;
create policy "file own report"
  on public.user_reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

-- Reporters can see the reports they filed; admins see everything.
drop policy if exists "read own reports or admin" on public.user_reports;
create policy "read own reports or admin"
  on public.user_reports for select
  to authenticated
  using (
    auth.uid() = reporter_id
    or exists (select 1 from public.players p where p.id = auth.uid() and p.role in ('admin','master_admin'))
  );

-- Only admins may triage (update status / reviewer).
drop policy if exists "admin update reports" on public.user_reports;
create policy "admin update reports"
  on public.user_reports for update
  to authenticated
  using (exists (select 1 from public.players p where p.id = auth.uid() and p.role in ('admin','master_admin')))
  with check (exists (select 1 from public.players p where p.id = auth.uid() and p.role in ('admin','master_admin')));

-- ── Blocks ───────────────────────────────────────────────────────────────────
create table if not exists public.user_blocks (
  blocker_id uuid references public.players(id) on delete cascade not null,
  blocked_id uuid references public.players(id) on delete cascade not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (blocker_id, blocked_id)
);

alter table public.user_blocks enable row level security;

-- A user fully manages (and only sees) their own block list.
drop policy if exists "manage own blocks (select)" on public.user_blocks;
create policy "manage own blocks (select)"
  on public.user_blocks for select
  to authenticated
  using (auth.uid() = blocker_id);

drop policy if exists "manage own blocks (insert)" on public.user_blocks;
create policy "manage own blocks (insert)"
  on public.user_blocks for insert
  to authenticated
  with check (auth.uid() = blocker_id);

drop policy if exists "manage own blocks (delete)" on public.user_blocks;
create policy "manage own blocks (delete)"
  on public.user_blocks for delete
  to authenticated
  using (auth.uid() = blocker_id);
