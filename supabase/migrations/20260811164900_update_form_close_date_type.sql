-- Update form_close_date from DATE to TIMESTAMPTZ to support time alongside date for tournament form closing
ALTER TABLE public.tournaments
ALTER COLUMN form_close_date TYPE TIMESTAMPTZ USING form_close_date::TIMESTAMPTZ;
