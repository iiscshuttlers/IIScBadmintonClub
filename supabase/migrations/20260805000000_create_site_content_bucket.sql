insert into storage.buckets (id, name, public)
values ('site_content', 'site_content', true)
on conflict (id) do nothing;

drop policy if exists "Site Content Public Access" on storage.objects;
create policy "Site Content Public Access"
  on storage.objects for select
  using ( bucket_id = 'site_content' );

drop policy if exists "Site Content Auth Insert" on storage.objects;
create policy "Site Content Auth Insert"
  on storage.objects for insert
  with check ( bucket_id = 'site_content' and auth.role() = 'authenticated' );
