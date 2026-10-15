-- Certificate registry: stores issued certificates for public verification.
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  recipient text not null,
  placement text not null check (placement in ('winner','runnerUp','third','fourth','participation','official')),
  category text not null,
  achievement text,
  tournament_name text not null,
  event_date text,
  issued_at timestamptz not null default now()
);

create index idx_certificates_code on public.certificates(code);
create index idx_certificates_user on public.certificates(user_id);
create index idx_certificates_tournament on public.certificates(tournament_id);

-- Anyone can verify (read by code). Only authenticated users can insert their own.
alter table public.certificates enable row level security;

create policy "Anyone can verify certificates"
  on public.certificates for select using (true);

create policy "Authenticated users can issue their own certificates"
  on public.certificates for insert
  with check (auth.uid() = user_id);

-- Generate a short unique code: IISC-XXXXXX (6 alphanumeric chars).
create or replace function public.generate_certificate_code()
returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  i int;
begin
  loop
    result := 'IISC-';
    for i in 1..6 loop
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from public.certificates where code = result);
  end loop;
  return result;
end;
$$;

-- RPC to issue a certificate: idempotent (returns existing if same user+tournament+category+placement).
create or replace function public.issue_certificate(
  p_tournament_id uuid,
  p_recipient text,
  p_placement text,
  p_category text,
  p_achievement text default null,
  p_tournament_name text default '',
  p_event_date text default null
)
returns table(id uuid, code text) language plpgsql security definer as $$
declare
  v_id uuid;
  v_code text;
  v_uid uuid := auth.uid();
begin
  -- Check for existing certificate (idempotent)
  select c.id, c.code into v_id, v_code
  from public.certificates c
  where c.user_id = v_uid
    and c.tournament_id = p_tournament_id
    and c.placement = p_placement
    and c.category = p_category;

  if found then
    return query select v_id, v_code;
    return;
  end if;

  v_code := public.generate_certificate_code();

  insert into public.certificates (code, tournament_id, user_id, recipient, placement, category, achievement, tournament_name, event_date)
  values (v_code, p_tournament_id, v_uid, p_recipient, p_placement, p_category, p_achievement, p_tournament_name, p_event_date)
  returning certificates.id into v_id;

  return query select v_id, v_code;
end;
$$;
