-- =====================================================================
-- Reppit — v2a step 2 follow-on to 001b: catalogue publishing support.
--
-- Not part of the provided migration set - authored while building
-- catalogue publishing to fill the same gap 001c fixed for
-- distributor_details: catalogues/catalogue_items were created by
-- 001b without RLS enabled at all.
--
-- Run after 001b (and 001c, no ordering dependency between them).
-- =====================================================================

alter table public.catalogues enable row level security;

-- Browsable like provider_profiles: anyone can see an active catalogue
-- (catalogue browsing happens before unlock, same as provider discovery -
-- only contact info is gated, not the listing itself). The owner can also
-- see their own inactive/draft catalogues.
create policy catalogues_select on public.catalogues
  for select using (
    active or business_user_id = auth.uid() or public.is_admin()
  );

create policy catalogues_insert_own on public.catalogues
  for insert with check (
    business_user_id = auth.uid()
    and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'business')
  );

create policy catalogues_update_own on public.catalogues
  for update using (business_user_id = auth.uid() or public.is_admin());

alter table public.catalogue_items enable row level security;

create policy catalogue_items_select on public.catalogue_items
  for select using (
    exists (
      select 1 from public.catalogues c
      where c.id = catalogue_id and (c.active or c.business_user_id = auth.uid() or public.is_admin())
    )
  );

create policy catalogue_items_insert_own on public.catalogue_items
  for insert with check (
    exists (select 1 from public.catalogues c where c.id = catalogue_id and c.business_user_id = auth.uid())
  );

create policy catalogue_items_update_own on public.catalogue_items
  for update using (
    exists (select 1 from public.catalogues c where c.id = catalogue_id and c.business_user_id = auth.uid())
  );

create policy catalogue_items_delete_own on public.catalogue_items
  for delete using (
    exists (select 1 from public.catalogues c where c.id = catalogue_id and c.business_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- Storage: catalogue item photos - public, same convention as
-- provider-photos (path "<user_id>/<file>" so RLS can scope writes to
-- the uploading business without a lookup).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogue-photos', 'catalogue-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy catalogue_photos_read on storage.objects
  for select using (bucket_id = 'catalogue-photos');

create policy catalogue_photos_insert_own on storage.objects
  for insert with check (
    bucket_id = 'catalogue-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy catalogue_photos_update_own on storage.objects
  for update using (
    bucket_id = 'catalogue-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy catalogue_photos_delete_own on storage.objects
  for delete using (
    bucket_id = 'catalogue-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
