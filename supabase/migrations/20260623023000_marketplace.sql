create table public.marketplace_listings (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references public.players(id) on delete cascade not null,
  title text not null,
  description text not null,
  price numeric(10,2) not null,
  condition text not null check (condition in ('New', 'Like New', 'Used')),
  category text not null check (category in ('Racket', 'Shoes', 'Shuttlecocks', 'Accessories', 'Other')),
  image_url text,
  status text not null default 'active' check (status in ('active', 'sold')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table public.marketplace_listings enable row level security;

create policy "Anyone can view active marketplace listings"
  on public.marketplace_listings for select
  using (status = 'active');

create policy "Users can view their own listings regardless of status"
  on public.marketplace_listings for select
  using (auth.uid() = seller_id);

create policy "Users can create listings"
  on public.marketplace_listings for insert
  with check (auth.uid() = seller_id);

create policy "Users can update their own listings"
  on public.marketplace_listings for update
  using (auth.uid() = seller_id);

create policy "Users can delete their own listings"
  on public.marketplace_listings for delete
  using (auth.uid() = seller_id);
