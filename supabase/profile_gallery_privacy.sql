-- ПОСИДИМ: профиль, приватность и фотогалерея
-- Выполнять после базовой schema.sql и discovery_and_events.sql.
alter table public.profiles
  add column if not exists is_discoverable boolean not null default false,
  add column if not exists mood_status text not null default '' check (char_length(mood_status) <= 80),
  add column if not exists mood_expires_at timestamptz;
create or replace function public.can_view_profile(p_viewer uuid, p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_viewer = p_target
    or exists (
      select 1 from public.profiles p
      where p.id = p_target and p.is_discoverable = true
    ) and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = p_viewer and b.blocked_id = p_target)
         or (b.blocker_id = p_target and b.blocked_id = p_viewer)
    );
$$;
revoke all on function public.can_view_profile(uuid, uuid) from public;
grant execute on function public.can_view_profile(uuid, uuid) to authenticated;

drop policy if exists "profiles_read_authenticated" on public.profiles;
drop policy if exists "profiles_read_visible" on public.profiles;
create policy "profiles_read_visible" on public.profiles
for select to authenticated
using (public.can_view_profile((select auth.uid()), id));

-- Existing avatar uploader uses a public URL, so keep this bucket public
-- while restricting writes to the authenticated owner folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
for select to public using (bucket_id = 'avatars');
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
for update to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
) with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
for delete to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
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
for select to authenticated using (public.can_view_profile((select auth.uid()), user_id));
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
  bucket_id = 'profile-photos' and public.can_view_profile((select auth.uid()), ((storage.foldername(name))[1])::uuid)
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

drop index if exists public.profile_photos_user_sort_unique;
create or replace function public.enforce_profile_photo_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare photo_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));
  select count(*) into photo_count from public.profile_photos where user_id = new.user_id;
  if photo_count >= 5 then raise exception 'Можно добавить не больше пяти фотографий'; end if;
  return new;
end;
$$;
drop trigger if exists profile_photos_limit on public.profile_photos;
create trigger profile_photos_limit before insert on public.profile_photos
for each row execute function public.enforce_profile_photo_limit();

grant select, insert, delete on public.profile_photos to authenticated;
