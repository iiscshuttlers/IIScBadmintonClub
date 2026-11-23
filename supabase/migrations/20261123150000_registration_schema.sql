-- In-app tournament registration, Migration A: schema (additive only).
-- Plan: happy-gliding-book.md, Phase 2. Nothing here changes today's behaviour:
-- new columns have defaults, new tables are empty, and no trigger is added.
--
-- Rollout: apply this BEFORE deploying the dispatcher that knows the 'sending'
-- status and the retry columns, and before the client that selects the new
-- participant columns (PARTICIPANT_PUBLIC_COLUMNS).

-- ------------------------------------------------------------ tournaments --
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS registration_opens_at timestamptz,
  ADD COLUMN IF NOT EXISTS collect_payment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_events_per_player integer
    CHECK (max_events_per_player IS NULL OR max_events_per_player > 0);

-- ------------------------------------------------- per-category settings --
CREATE TABLE IF NOT EXISTS public.tournament_category_settings (
  tournament_id      uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  category           text NOT NULL,
  opens_at           timestamptz,
  closes_at          timestamptz,
  locked_at          timestamptz,
  locked_by          uuid REFERENCES public.players(id) ON DELETE SET NULL,
  -- null = inherit tournaments.show_participants (old tournaments, trigger-made rows)
  entries_visibility text CHECK (entries_visibility IS NULL OR entries_visibility IN ('as_entered', 'after_close', 'after_draw', 'hidden')),
  max_entries        integer CHECK (max_entries IS NULL OR max_entries > 0),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, category)
);

-- ---------------------------------------------------------- participants --
ALTER TABLE public.tournament_participants
  ADD COLUMN IF NOT EXISTS registered_by uuid REFERENCES public.players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'organiser'
    CHECK (source IN ('app', 'organiser', 'form')),
  ADD COLUMN IF NOT EXISTS looking_for_partner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- No unique key: organiser edits and form imports may still create a shared
-- player; the conflict trigger (Migration C) reports it instead.
CREATE INDEX IF NOT EXISTS tournament_participants_tcat_idx
  ON public.tournament_participants (tournament_id, category);
CREATE INDEX IF NOT EXISTS tournament_participants_tcat_player_idx
  ON public.tournament_participants (tournament_id, category, player_id);
CREATE INDEX IF NOT EXISTS tournament_participants_tcat_partner_idx
  ON public.tournament_participants (tournament_id, category, partner_id);

-- Guest partner phone: private (participant rows, including email, are public).
CREATE TABLE IF NOT EXISTS public.tournament_entry_contacts (
  participant_id      uuid PRIMARY KEY REFERENCES public.tournament_participants(id) ON DELETE CASCADE,
  partner_guest_phone text,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------- partner requests --
CREATE TABLE IF NOT EXISTS public.tournament_partner_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id  uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  category       text NOT NULL,
  from_player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  to_player_id   uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'declined', 'stale', 'expired')),
  stale_reason   text,
  -- Snapshot at request time, so accepting can tell whether things changed.
  to_partner_id_at_request uuid,
  from_had_entry boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  responded_at   timestamptz,
  CHECK (from_player_id <> to_player_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS tournament_partner_requests_one_pending
  ON public.tournament_partner_requests (tournament_id, category, from_player_id, to_player_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS tournament_partner_requests_to_idx
  ON public.tournament_partner_requests (to_player_id) WHERE status = 'pending';

-- -------------------------------------------------------------- event log --
-- Who did what; ids and names only, never phones or e-mail addresses.
CREATE TABLE IF NOT EXISTS public.tournament_entry_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id  uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  category       text,
  participant_id uuid,               -- no FK: the row may be deleted later
  actor_id       uuid REFERENCES public.players(id) ON DELETE SET NULL,
  action         text NOT NULL,      -- entered | changed | left | withdrawn | ... | reminder_sent
  player_ids     uuid[] NOT NULL DEFAULT '{}',
  before         jsonb,
  after          jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tournament_entry_events_t_idx
  ON public.tournament_entry_events (tournament_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS tournament_entry_events_players_idx
  ON public.tournament_entry_events USING gin (player_ids);

-- Backup copy to the club inbox (REGISTRATION_BACKUP_EMAIL, a function secret).
-- Organisers and the service role only: SMTP errors can contain the address.
CREATE TABLE IF NOT EXISTS public.tournament_backup_outbox (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL UNIQUE REFERENCES public.tournament_entry_events(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz,
  attempts      integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  last_error    text
);
CREATE INDEX IF NOT EXISTS tournament_backup_outbox_due_idx
  ON public.tournament_backup_outbox (created_at) WHERE sent_at IS NULL;

-- One daily CSV digest of the day's entry changes to the same club inbox,
-- queued by cron at 20:05 IST and sent by the dispatcher (with retries).
CREATE TABLE IF NOT EXISTS public.tournament_backup_digests (
  digest_date     date PRIMARY KEY,          -- IST day
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  attempts        integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  last_error      text
);

-- --------------------------------------------------------------- waitlist --
CREATE TABLE IF NOT EXISTS public.tournament_waitlist (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  category      text NOT NULL,
  player_id     uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  partner_id    uuid REFERENCES public.players(id) ON DELETE SET NULL,
  registered_by uuid REFERENCES public.players(id) ON DELETE SET NULL,
  -- clock_timestamp: join order must be exact even inside one transaction.
  created_at    timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS tournament_waitlist_tcat_idx
  ON public.tournament_waitlist (tournament_id, category, created_at);

-- ---------------------------------------------------- late withdrawals --
CREATE TABLE IF NOT EXISTS public.tournament_withdrawal_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id  uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  category       text NOT NULL,
  participant_id uuid REFERENCES public.tournament_participants(id) ON DELETE SET NULL,
  requested_by   uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  player_ids     uuid[] NOT NULL DEFAULT '{}',   -- the pair at request time
  reason         text CHECK (reason IS NULL OR length(reason) <= 500),
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'waiting_opponent', 'removed', 'walkover', 'dismissed')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz,
  resolved_by    uuid REFERENCES public.players(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS tournament_withdrawal_requests_t_idx
  ON public.tournament_withdrawal_requests (tournament_id, status);

-- ------------------------------------------------- duplicate conflicts --
CREATE TABLE IF NOT EXISTS public.tournament_registration_conflicts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id    uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  category         text NOT NULL,
  shared_player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS tournament_registration_conflicts_open_uidx
  ON public.tournament_registration_conflicts (tournament_id, category, shared_player_id)
  WHERE resolved_at IS NULL;

-- ------------------------------------------------ scheduled_notifications --
ALTER TABLE public.scheduled_notifications
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_channels text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.scheduled_notifications DROP CONSTRAINT IF EXISTS scheduled_notifications_event_type_valid;
ALTER TABLE public.scheduled_notifications ADD CONSTRAINT scheduled_notifications_event_type_valid
  CHECK (event_type IS NULL OR event_type = ANY (ARRAY['match_call', 'schedule_change', 'result', 'gallery_photos', 'registration']));

ALTER TABLE public.scheduled_notifications DROP CONSTRAINT IF EXISTS scheduled_notifications_status_check;
ALTER TABLE public.scheduled_notifications ADD CONSTRAINT scheduled_notifications_status_check
  CHECK (status = ANY (ARRAY['pending', 'sending', 'sent', 'cancelled', 'failed']));

-- The dispatcher's claim query: due pending rows by retry time.
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_retry_due
  ON public.scheduled_notifications ((coalesce(next_attempt_at, scheduled_at))) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_sending
  ON public.scheduled_notifications (sent_at) WHERE status = 'sending';

-- ------------------------------------------------------------------- RLS --
ALTER TABLE public.tournament_category_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_entry_contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_partner_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_entry_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_backup_outbox          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_backup_digests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_waitlist               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_withdrawal_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_registration_conflicts ENABLE ROW LEVEL SECURITY;

-- Every write goes through SECURITY DEFINER RPCs; clients only read.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.tournament_category_settings, public.tournament_entry_contacts,
  public.tournament_partner_requests, public.tournament_entry_events,
  public.tournament_backup_outbox, public.tournament_waitlist,
  public.tournament_withdrawal_requests, public.tournament_registration_conflicts
  FROM anon, authenticated;
-- The digest log is service-role only (no policies, no client grants).
REVOKE ALL ON public.tournament_backup_digests FROM anon, authenticated;
REVOKE SELECT ON
  public.tournament_entry_contacts, public.tournament_partner_requests,
  public.tournament_entry_events, public.tournament_backup_outbox,
  public.tournament_waitlist, public.tournament_withdrawal_requests,
  public.tournament_registration_conflicts
  FROM anon;

-- Category settings: readable by anyone who can read the tournament.
DROP POLICY IF EXISTS tcs_read ON public.tournament_category_settings;
CREATE POLICY tcs_read ON public.tournament_category_settings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_category_settings.tournament_id));

-- Guest-partner phones: the registrant and the tournament's organisers.
DROP POLICY IF EXISTS tec_read ON public.tournament_entry_contacts;
CREATE POLICY tec_read ON public.tournament_entry_contacts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tournament_participants p
     WHERE p.id = tournament_entry_contacts.participant_id
       AND (p.registered_by = (SELECT public.resolve_my_player_id())
            OR public.is_tournament_official(p.tournament_id, 'ORGANIZER'))));

DROP POLICY IF EXISTS tpr_read ON public.tournament_partner_requests;
CREATE POLICY tpr_read ON public.tournament_partner_requests FOR SELECT TO authenticated
  USING (from_player_id = (SELECT public.resolve_my_player_id())
         OR to_player_id = (SELECT public.resolve_my_player_id())
         OR public.is_tournament_official(tournament_id, 'ORGANIZER'));

DROP POLICY IF EXISTS tee_read ON public.tournament_entry_events;
CREATE POLICY tee_read ON public.tournament_entry_events FOR SELECT TO authenticated
  USING ((SELECT public.resolve_my_player_id()) = ANY (player_ids)
         OR public.is_tournament_official(tournament_id, 'ORGANIZER'));

DROP POLICY IF EXISTS tbo_read ON public.tournament_backup_outbox;
CREATE POLICY tbo_read ON public.tournament_backup_outbox FOR SELECT TO authenticated
  USING (public.is_tournament_official(tournament_id, 'ORGANIZER'));

DROP POLICY IF EXISTS twl_read ON public.tournament_waitlist;
CREATE POLICY twl_read ON public.tournament_waitlist FOR SELECT TO authenticated
  USING (player_id = (SELECT public.resolve_my_player_id())
         OR partner_id = (SELECT public.resolve_my_player_id())
         OR public.is_tournament_official(tournament_id, 'ORGANIZER'));

DROP POLICY IF EXISTS twr_read ON public.tournament_withdrawal_requests;
CREATE POLICY twr_read ON public.tournament_withdrawal_requests FOR SELECT TO authenticated
  USING ((SELECT public.resolve_my_player_id()) = ANY (player_ids)
         OR public.is_tournament_official(tournament_id, 'ORGANIZER'));

DROP POLICY IF EXISTS trc_read ON public.tournament_registration_conflicts;
CREATE POLICY trc_read ON public.tournament_registration_conflicts FOR SELECT TO authenticated
  USING (public.is_tournament_official(tournament_id, 'ORGANIZER'));
