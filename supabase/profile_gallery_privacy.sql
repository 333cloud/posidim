-- ПОСИДИМ: профиль, приватность и фотогалерея
-- Выполнять после базовой schema.sql и discovery_and_events.sql.
alter table public.profiles
  add column if not exists mood_status text not null default '' check (char_length(mood_status) <= 80),
  add column if not exists mood_expires_at timestamptz;
drop policy if exists "profiles_read_authenticated" on public.profiles;
drop policy if exists "profiles_read_visible" on public.profiles;
create policy "profiles_read_visible" on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (
    coalesce(is_discoverable, false) = true
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = profiles.id)
         or (b.blocker_id = profiles.id and b.blocked_id = (select auth.uid()))
    )
  )
);
create table if not exists public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  sort_order smallint not null default 0 check (sort_order between 0 and 4),
  created_at timestamptz not null default now()
);
alter table public.profile_photos enable row level security;
drop policy if exists "profile_photos_read_visible" on public.profile_photos;
create policy "profile_photos_read_visible" on public.profile_photos
for select to authenticated using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.profiles p where p.id = profile_photos.user_id
      and p.is_discoverable = true
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id = (select auth.uid()) and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = (select auth.uid()))
      )
  )
);
drop policy if exists "profile_photos_insert_own" on public.profile_photos;
create policy "profile_photos_insert_own" on public.profile_photos
for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "profile_photos_delete_own" on public.profile_photos;
create policy "profile_photos_delete_own" on public.profile_photos
for delete to authenticated using (user_id = (select auth.uid()));
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];
drop policy if exists "profile_photos_storage_read_visible" on storage.objects;
create policy "profile_photos_storage_read_visible" on storage.objects
for select to authenticated using (
  bucket_id = 'profile-photos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1 from public.profiles p where p.id::text = (storage.foldername(name))[1]
        and p.is_discoverable = true
        and not exists (
          select 1 from public.user_blocks b
          where (b.blocker_id = (select auth.uid()) and b.blocked_id = p.id)
             or (b.blocker_id = p.id and b.blocked_id = (select auth.uid()))
        )
    )
  )
);
drop policy if exists "profile_photos_storage_insert_own" on storage.objects;
create policy "profile_photos_storage_insert_own" on storage.objects
for insert to authenticated with check (
  bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists "profile_photos_storage_delete_own" on storage.objects;
create policy "profile_photos_storage_delete_own" on storage.objects
for delete to authenticated using (
  bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create index if not exists profile_photos_user_order_idx on public.profile_photos(user_id, sort_order, created_at);
grant select, insert, delete on public.profile_photos to authenticated;
