ALTER TABLE public.marketplace_listings
ADD COLUMN IF NOT EXISTS listing_type text not null default 'sell' check (listing_type in ('sell', 'buy')),
ADD COLUMN IF NOT EXISTS fulfilled_by_id uuid references public.players(id) on delete set null,
ADD COLUMN IF NOT EXISTS fulfilled_by_name text;

-- RPC to allow a user to fulfill/claim a WTB request safely, bypassing RLS which restricts updates to the owner
CREATE OR REPLACE FUNCTION public.fulfill_marketplace_request(listing_uuid uuid, claimer_id uuid, claimer_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.marketplace_listings
  SET 
    fulfilled_by_id = claimer_id,
    fulfilled_by_name = claimer_name,
    status = 'sold'
  WHERE id = listing_uuid AND listing_type = 'buy' AND fulfilled_by_id IS NULL;
END;
$$;
