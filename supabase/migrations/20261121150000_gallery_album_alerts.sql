-- Gallery album alerts
--
-- Before this, the gallery's album bell and the admin megaphone never sent
-- anything: the bell lived only in browser localStorage, and nothing read the
-- megaphone's site_data.gallery_default_subscriptions list.
--
-- New model: photo alerts are ON by default for every album, including albums
-- created later.
--   * players.pref_notify_gallery: the member's switch ("New gallery photos" in
--     Notification settings). Default true.
--   * gallery_album_subscriptions: per-member, per-album override. No row means
--     "follow the default". subscribed = false mutes that album for the member;
--     subscribed = true keeps it on even when an admin mutes it for everyone.
--   * site_data.gallery_muted_albums: JSON array of albums an admin turned off
--     for everyone (the megaphone). Absent or empty, so new albums alert.
--
-- When site_data.gallery_images gains photos (admin upload or
-- scripts/sync_cloudinary.mjs), a trigger queues one scheduled_notifications
-- row per album. Uploads a few minutes apart fold into the same pending row
-- (group_key), so a 40-photo batch sends one alert, not 40.
-- dispatch-scheduled-notifications (pg_cron, every 2 min) delivers it in-app
-- and by push.
--
-- Additive and idempotent: safe to apply before the new client ships. The old
-- client ignores the new column, table and site_data key.

-- 1. Member switch ----------------------------------------------------------
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS pref_notify_gallery boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.players.pref_notify_gallery IS
  'New gallery photo alerts (in-app and push). Per-album overrides: gallery_album_subscriptions.';

-- 2. Per-album overrides ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gallery_album_subscriptions (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  album      text NOT NULL CHECK (char_length(btrim(album)) BETWEEN 1 AND 200),
  subscribed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, album)
);

COMMENT ON TABLE public.gallery_album_subscriptions IS
  'Per-member gallery album alert overrides. No row = default (on unless the album is in site_data.gallery_muted_albums).';

CREATE INDEX IF NOT EXISTS gallery_album_subscriptions_album_idx
  ON public.gallery_album_subscriptions (album);

ALTER TABLE public.gallery_album_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gallery_album_subscriptions_own ON public.gallery_album_subscriptions;
CREATE POLICY gallery_album_subscriptions_own ON public.gallery_album_subscriptions
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.gallery_album_subscriptions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_album_subscriptions TO authenticated;

-- 3. Queue support for folded alerts ---------------------------------------
ALTER TABLE public.scheduled_notifications
  ADD COLUMN IF NOT EXISTS group_key text,
  ADD COLUMN IF NOT EXISTS payload jsonb;

COMMENT ON COLUMN public.scheduled_notifications.group_key IS
  'Folding key for batched events (gallery:<album>). At most one pending row per key.';
COMMENT ON COLUMN public.scheduled_notifications.payload IS
  'Event details for the dispatcher. gallery_photos: {album, category, count, image}.';

CREATE UNIQUE INDEX IF NOT EXISTS scheduled_notifications_pending_group_uidx
  ON public.scheduled_notifications (group_key)
  WHERE status = 'pending' AND group_key IS NOT NULL;

ALTER TABLE public.scheduled_notifications
  DROP CONSTRAINT IF EXISTS scheduled_notifications_event_type_valid;
ALTER TABLE public.scheduled_notifications
  ADD CONSTRAINT scheduled_notifications_event_type_valid
  CHECK (event_type IS NULL OR event_type = ANY (ARRAY['match_call', 'schedule_change', 'result', 'gallery_photos']));

-- 4. Text helpers -----------------------------------------------------------
-- Same cleanup the gallery applies to folder names: "BPL-2024" -> "BPL 2024".
CREATE OR REPLACE FUNCTION public.gallery_album_label(p_album text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT btrim(regexp_replace(regexp_replace(coalesce(p_album, ''), '[-_]+', ' ', 'g'), '\s+', ' ', 'g'))
$$;

-- Percent-encodes one URL query value (RFC 3986 unreserved characters kept).
CREATE OR REPLACE FUNCTION public.gallery_url_encode(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT coalesce(string_agg(
           CASE WHEN ch ~ '^[A-Za-z0-9._~-]$' THEN ch
                ELSE regexp_replace(upper(encode(convert_to(ch, 'UTF8'), 'hex')), '(..)', '%\1', 'g')
           END, '' ORDER BY ord), '')
    FROM regexp_split_to_table(coalesce(p_value, ''), '') WITH ORDINALITY AS t(ch, ord)
$$;

-- "12 new photos were added to the BPL 2024 album in Tournaments. Tap to see them."
CREATE OR REPLACE FUNCTION public.gallery_photo_alert_body(p_album text, p_category text, p_count integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog
AS $$
  SELECT CASE WHEN p_count = 1 THEN '1 new photo was' ELSE p_count::text || ' new photos were' END
      || ' added to the ' || public.gallery_album_label(p_album) || ' album'
      || CASE WHEN nullif(btrim(coalesce(p_category, '')), '') IS NOT NULL
              THEN ' in ' || public.gallery_album_label(p_category) ELSE '' END
      || '. Tap to see them.'
$$;

-- 5. Queue alerts when photos are added ------------------------------------
CREATE OR REPLACE FUNCTION public.queue_gallery_photo_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uploader   uuid := auth.uid();
  v_muted      text[];
  v_album      record;
  v_recipients uuid[];
  v_image      text;
BEGIN
  IF jsonb_typeof(NEW.value) IS DISTINCT FROM 'array' THEN
    RETURN NEW;
  END IF;

  -- A bug here must never block a photo upload: log and carry on.
  BEGIN
    SELECT coalesce(array_agg(m), '{}') INTO v_muted
      FROM public.site_data sd
     CROSS JOIN LATERAL jsonb_array_elements_text(
             CASE WHEN jsonb_typeof(sd.value) = 'array' THEN sd.value ELSE '[]'::jsonb END) AS m
     WHERE sd.key = 'gallery_muted_albums';

    FOR v_album IN
      WITH old_paths AS (
        SELECT o->>'path' AS path
          FROM jsonb_array_elements(
                 CASE WHEN jsonb_typeof(OLD.value) = 'array' THEN OLD.value ELSE '[]'::jsonb END) AS o
      ), added AS (
        SELECT n->>'subfolder' AS album,
               nullif(btrim(n->>'category'), '') AS category,
               n->>'url' AS url,
               t.ord
          FROM jsonb_array_elements(NEW.value) WITH ORDINALITY AS t(n, ord)
         WHERE nullif(btrim(n->>'subfolder'), '') IS NOT NULL
           AND nullif(n->>'path', '') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM old_paths op WHERE op.path = n->>'path')
      )
      SELECT a.album,
             min(a.category) AS category,
             count(*)::int AS added,
             (array_agg(a.url ORDER BY a.ord) FILTER (WHERE a.url LIKE 'https://%'))[1] AS cover
        FROM added a
       GROUP BY a.album
    LOOP
      -- Account holders who want this album: their switch is on, and either
      -- they chose this album explicitly or it follows the default (not muted).
      SELECT coalesce(array_agg(p.id), '{}') INTO v_recipients
        FROM public.players p
        JOIN auth.users u ON u.id = p.id
        LEFT JOIN public.gallery_album_subscriptions s
               ON s.user_id = p.id AND s.album = v_album.album
       WHERE p.deleted_at IS NULL
         AND p.pref_notify_gallery IS NOT FALSE
         AND p.id IS DISTINCT FROM v_uploader
         AND coalesce(s.subscribed, NOT (v_album.album = ANY (v_muted)));

      CONTINUE WHEN cardinality(v_recipients) = 0;

      -- Push preview image: a resized JPEG (HEIC/AVIF won't render in a notification).
      v_image := CASE
        WHEN v_album.cover LIKE 'https://res.cloudinary.com/%/upload/%'
          THEN regexp_replace(v_album.cover, '/upload/(f_auto,q_auto/)?', '/upload/f_jpg,q_auto,c_limit,w_1024/')
        ELSE v_album.cover
      END;

      INSERT INTO public.scheduled_notifications AS sn
        (title, body, channels, audience, recipient_ids, scheduled_at, expires_at,
         link, event_type, group_key, payload, created_by)
      VALUES (
        'New photos: ' || public.gallery_album_label(v_album.album),
        public.gallery_photo_alert_body(v_album.album, v_album.category, v_album.added),
        ARRAY['in_app', 'push'],
        CASE WHEN v_album.album = ANY (v_muted) THEN 'custom' ELSE 'all' END,
        v_recipients,
        now() + interval '3 minutes',   -- folding window for multi-step uploads
        now() + interval '1 day',       -- never deliver a stale alert
        '/legacy?filter=' || public.gallery_url_encode(v_album.album) || '#albums',
        'gallery_photos',
        'gallery:' || v_album.album,
        jsonb_build_object('album', v_album.album, 'category', v_album.category,
                           'count', v_album.added, 'image', v_image),
        (SELECT pl.id FROM public.players pl WHERE pl.id = v_uploader)
      )
      ON CONFLICT (group_key) WHERE status = 'pending' AND group_key IS NOT NULL
      DO UPDATE SET
        payload = sn.payload || jsonb_build_object(
                    'count', coalesce((sn.payload->>'count')::int, 0) + v_album.added),
        body = public.gallery_photo_alert_body(
                 v_album.album, coalesce(sn.payload->>'category', v_album.category),
                 coalesce((sn.payload->>'count')::int, 0) + v_album.added),
        recipient_ids = EXCLUDED.recipient_ids,
        audience = EXCLUDED.audience;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'queue_gallery_photo_alerts failed: % (%)', SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.queue_gallery_photo_alerts() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS site_data_gallery_photo_alerts ON public.site_data;
CREATE TRIGGER site_data_gallery_photo_alerts
  AFTER UPDATE OF value ON public.site_data
  FOR EACH ROW
  WHEN (NEW.key = 'gallery_images' AND NEW.value IS DISTINCT FROM OLD.value)
  EXECUTE FUNCTION public.queue_gallery_photo_alerts();

-- 6. Retire the old opt-in list ---------------------------------------------
-- It held ["Open Tournament August 2026"], which is on by default now. Nothing
-- read it to send alerts; the new client uses gallery_muted_albums instead.
DELETE FROM public.site_data WHERE key = 'gallery_default_subscriptions';
