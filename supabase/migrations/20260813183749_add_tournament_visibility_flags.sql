alter table public.tournaments
  add column if not exists show_brackets boolean default true,
  add column if not exists show_participants boolean default true;
