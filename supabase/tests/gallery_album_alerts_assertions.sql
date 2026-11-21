-- gallery_album_alerts_assertions.sql
-- Verifies migration 20261121150000_gallery_album_alerts:
--   1. New photos queue one alert per album, on by default (new albums too).
--   2. Recipients honour: uploader excluded, pref_notify_gallery off, per-album
--      mute (subscribed=false), admin mute (gallery_muted_albums) with explicit
--      subscribed=true overriding it.
--   3. A second upload inside the folding window updates the same pending row.
--   4. Edits that add no photos queue nothing.
--   5. RLS: members only see and write their own album overrides.
-- Runs inside one transaction and rolls back. Needs no psql meta-commands, so
-- it also runs through `supabase db query -f`.

BEGIN;

-- ---------------------------------------------------------------- fixtures --
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-4000-8000-00000000000a', 'gallery-uploader@test.invalid'),
  ('b0000000-0000-4000-8000-00000000000b', 'gallery-default@test.invalid'),
  ('c0000000-0000-4000-8000-00000000000c', 'gallery-album-muted@test.invalid'),
  ('d0000000-0000-4000-8000-00000000000d', 'gallery-pref-off@test.invalid'),
  ('e0000000-0000-4000-8000-00000000000e', 'gallery-explicit-on@test.invalid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.players (id, full_name, email, role) VALUES
  ('a0000000-0000-4000-8000-00000000000a', 'Gallery Uploader',     'gallery-uploader@test.invalid',     'admin'),
  ('b0000000-0000-4000-8000-00000000000b', 'Gallery Default',      'gallery-default@test.invalid',      'member'),
  ('c0000000-0000-4000-8000-00000000000c', 'Gallery Album Muted',  'gallery-album-muted@test.invalid',  'member'),
  ('d0000000-0000-4000-8000-00000000000d', 'Gallery Pref Off',     'gallery-pref-off@test.invalid',     'member'),
  ('e0000000-0000-4000-8000-00000000000e', 'Gallery Explicit On',  'gallery-explicit-on@test.invalid',  'member');

UPDATE public.players SET pref_notify_gallery = false
 WHERE id = 'd0000000-0000-4000-8000-00000000000d';

INSERT INTO public.gallery_album_subscriptions (user_id, album, subscribed) VALUES
  ('c0000000-0000-4000-8000-00000000000c', 'ZZ Test Album-2099', false),
  ('e0000000-0000-4000-8000-00000000000e', 'ZZ Muted Album', true);

INSERT INTO public.site_data (key, value) VALUES ('gallery_muted_albums', '["ZZ Muted Album"]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.site_data (key, value) VALUES ('gallery_images', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- The uploader is signed in, as in the admin gallery uploader.
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-00000000000a', true);
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

-- ----------------------------------------------------------- first upload --
UPDATE public.site_data
   SET value = value || '[
     {"id":"t1","title":"One","category":"Tournaments","subfolder":"ZZ Test Album-2099","path":"zz/test/1.jpg","url":"https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/zz/test/1.heic"},
     {"id":"t2","title":"Two","category":"Tournaments","subfolder":"ZZ Test Album-2099","path":"zz/test/2.jpg","url":"https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/zz/test/2.heic"},
     {"id":"m1","title":"Muted","category":"Events","subfolder":"ZZ Muted Album","path":"zz/muted/1.jpg","url":"https://example.com/m1.jpg"}
   ]'::jsonb
 WHERE key = 'gallery_images';

DO $$
DECLARE r public.scheduled_notifications;
BEGIN
  SELECT * INTO STRICT r FROM public.scheduled_notifications
   WHERE group_key = 'gallery:ZZ Test Album-2099' AND status = 'pending';

  IF r.event_type <> 'gallery_photos' THEN RAISE EXCEPTION 'event_type %', r.event_type; END IF;
  IF r.title <> 'New photos: ZZ Test Album 2099' THEN RAISE EXCEPTION 'title %', r.title; END IF;
  IF r.body <> '2 new photos were added to the ZZ Test Album 2099 album in Tournaments. Tap to see them.' THEN
    RAISE EXCEPTION 'body %', r.body; END IF;
  IF r.link <> '/legacy?filter=ZZ%20Test%20Album-2099#albums' THEN RAISE EXCEPTION 'link %', r.link; END IF;
  IF r.channels <> ARRAY['in_app', 'push'] THEN RAISE EXCEPTION 'channels %', r.channels; END IF;
  IF r.audience <> 'all' THEN RAISE EXCEPTION 'audience %', r.audience; END IF;
  IF (r.payload->>'count')::int <> 2 THEN RAISE EXCEPTION 'count %', r.payload; END IF;
  IF r.payload->>'image' <> 'https://res.cloudinary.com/demo/image/upload/f_jpg,q_auto,c_limit,w_1024/v1/zz/test/1.heic' THEN
    RAISE EXCEPTION 'image %', r.payload->>'image'; END IF;
  IF r.created_by IS DISTINCT FROM 'a0000000-0000-4000-8000-00000000000a' THEN RAISE EXCEPTION 'created_by %', r.created_by; END IF;
  IF r.scheduled_at <= now() OR r.expires_at <= r.scheduled_at THEN RAISE EXCEPTION 'timing % %', r.scheduled_at, r.expires_at; END IF;

  -- default-on member and the explicit-on member get it
  IF NOT ('b0000000-0000-4000-8000-00000000000b' = ANY (r.recipient_ids)) THEN RAISE EXCEPTION 'default member missing'; END IF;
  IF NOT ('e0000000-0000-4000-8000-00000000000e' = ANY (r.recipient_ids)) THEN RAISE EXCEPTION 'explicit-on member missing'; END IF;
  -- uploader, album-muted and switch-off members do not
  IF 'a0000000-0000-4000-8000-00000000000a' = ANY (r.recipient_ids) THEN RAISE EXCEPTION 'uploader notified'; END IF;
  IF 'c0000000-0000-4000-8000-00000000000c' = ANY (r.recipient_ids) THEN RAISE EXCEPTION 'album-muted member notified'; END IF;
  IF 'd0000000-0000-4000-8000-00000000000d' = ANY (r.recipient_ids) THEN RAISE EXCEPTION 'pref-off member notified'; END IF;
END $$;

DO $$
DECLARE r public.scheduled_notifications;
BEGIN
  SELECT * INTO STRICT r FROM public.scheduled_notifications
   WHERE group_key = 'gallery:ZZ Muted Album' AND status = 'pending';
  IF r.audience <> 'custom' THEN RAISE EXCEPTION 'muted audience %', r.audience; END IF;
  IF r.body <> '1 new photo was added to the ZZ Muted Album album in Events. Tap to see them.' THEN
    RAISE EXCEPTION 'muted body %', r.body; END IF;
  IF r.payload->>'image' <> 'https://example.com/m1.jpg' THEN RAISE EXCEPTION 'non-cloudinary image %', r.payload; END IF;
  IF NOT ('e0000000-0000-4000-8000-00000000000e' = ANY (r.recipient_ids)) THEN RAISE EXCEPTION 'explicit-on missing on muted album'; END IF;
  IF 'b0000000-0000-4000-8000-00000000000b' = ANY (r.recipient_ids) THEN RAISE EXCEPTION 'admin mute ignored'; END IF;
END $$;

-- ------------------------------------------ second upload folds into row --
UPDATE public.site_data
   SET value = value || '[{"id":"t3","title":"Three","category":"Tournaments","subfolder":"ZZ Test Album-2099","path":"zz/test/3.jpg","url":"https://res.cloudinary.com/demo/image/upload/v1/zz/test/3.jpg"}]'::jsonb
 WHERE key = 'gallery_images';

DO $$
DECLARE n int; r public.scheduled_notifications;
BEGIN
  SELECT count(*) INTO n FROM public.scheduled_notifications WHERE group_key = 'gallery:ZZ Test Album-2099';
  IF n <> 1 THEN RAISE EXCEPTION 'expected 1 folded row, got %', n; END IF;
  SELECT * INTO STRICT r FROM public.scheduled_notifications WHERE group_key = 'gallery:ZZ Test Album-2099';
  IF (r.payload->>'count')::int <> 3 THEN RAISE EXCEPTION 'folded count %', r.payload; END IF;
  IF r.body <> '3 new photos were added to the ZZ Test Album 2099 album in Tournaments. Tap to see them.' THEN
    RAISE EXCEPTION 'folded body %', r.body; END IF;
  -- first upload's cover stays
  IF r.payload->>'image' NOT LIKE '%/zz/test/1.heic' THEN RAISE EXCEPTION 'cover changed %', r.payload; END IF;
END $$;

-- ------------------------------------- edits without new photos are quiet --
UPDATE public.site_data
   SET value = (SELECT jsonb_agg(CASE WHEN e->>'id' = 't1' THEN e || '{"title":"Renamed"}' ELSE e END) FROM jsonb_array_elements(value) e)
 WHERE key = 'gallery_images';

DO $$
DECLARE n int;
BEGIN
  SELECT coalesce(sum((payload->>'count')::int), 0) INTO n FROM public.scheduled_notifications
   WHERE group_key IN ('gallery:ZZ Test Album-2099', 'gallery:ZZ Muted Album');
  IF n <> 4 THEN RAISE EXCEPTION 'title edit changed counts: %', n; END IF;
END $$;

-- -------------------------------------------- once sent, a new row starts --
UPDATE public.scheduled_notifications SET status = 'sent', sent_at = now()
 WHERE group_key = 'gallery:ZZ Test Album-2099';
UPDATE public.site_data
   SET value = value || '[{"id":"t4","title":"Four","category":"Tournaments","subfolder":"ZZ Test Album-2099","path":"zz/test/4.jpg","url":"https://example.com/4.jpg"}]'::jsonb
 WHERE key = 'gallery_images';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.scheduled_notifications
   WHERE group_key = 'gallery:ZZ Test Album-2099' AND status = 'pending' AND (payload->>'count')::int = 1;
  IF n <> 1 THEN RAISE EXCEPTION 'expected a fresh pending row after send, got %', n; END IF;
END $$;

-- ------------------------------------------------------------------- RLS --
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-00000000000b', true);
SELECT set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

INSERT INTO public.gallery_album_subscriptions (user_id, album, subscribed)
VALUES ('b0000000-0000-4000-8000-00000000000b', 'ZZ Test Album-2099', false);

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.gallery_album_subscriptions;
  IF n <> 1 THEN RAISE EXCEPTION 'member sees % override rows, expected only their own', n; END IF;

  BEGIN
    INSERT INTO public.gallery_album_subscriptions (user_id, album, subscribed)
    VALUES ('c0000000-0000-4000-8000-00000000000c', 'Other', true);
    RAISE EXCEPTION 'wrote another member''s override';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  UPDATE public.gallery_album_subscriptions SET subscribed = true
   WHERE user_id = 'c0000000-0000-4000-8000-00000000000c';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'updated another member''s override'; END IF;
END $$;

RESET ROLE;

ROLLBACK;
