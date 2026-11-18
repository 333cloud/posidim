-- ПОСИДИМ: безопасная геолокация и поиск людей по радиусу.
-- Выполнить один раз в Supabase SQL Editor после предыдущих миграций.

create table if not exists public.user_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  updated_at timestamptz not null default now()
);

alter table public.user_locations enable row level security;

drop policy if exists "user_locations_read_own" on public.user_locations;
create policy "user_locations_read_own"
on public.user_locations for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "user_locations_insert_own" on public.user_locations;
create policy "user_locations_insert_own"
on public.user_locations for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "user_locations_update_own" on public.user_locations;
create policy "user_locations_update_own"
on public.user_locations for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "user_locations_delete_own" on public.user_locations;
create policy "user_locations_delete_own"
on public.user_locations for delete to authenticated
using (user_id = (select auth.uid()));

create index if not exists user_locations_geo_idx
on public.user_locations (latitude, longitude);

create or replace function public.set_my_location(
  p_latitude double precision,
  p_longitude double precision
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Некорректные координаты';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_discoverable = true
  ) then
    raise exception 'Сначала включи видимость профиля на карте';
  end if;

  insert into public.user_locations (user_id, latitude, longitude, updated_at)
  values (auth.uid(), p_latitude, p_longitude, now())
  on conflict (user_id) do update
    set latitude = excluded.latitude,
        longitude = excluded.longitude,
        updated_at = now();
end;
$function$;

create or replace function public.delete_my_location()
returns void
language sql
security definer
set search_path = ''
as $function$
  delete from public.user_locations where user_id = auth.uid();
$function$;

create or replace function public.find_nearby_profiles(p_radius_km integer default 10)
returns table (
  id uuid,
  display_name text,
  age integer,
  bio text,
  avatar_url text,
  city text,
  mood_status text,
  mood_expires_at timestamptz,
  approx_latitude double precision,
  approx_longitude double precision,
  distance_km double precision
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_lat double precision;
  v_lon double precision;
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;
  if p_radius_km is null or p_radius_km < 1 or p_radius_km > 40 then
    raise exception 'Радиус должен быть от 1 до 40 км';
  end if;

  select ul.latitude, ul.longitude into v_lat, v_lon
  from public.user_locations ul
  where ul.user_id = auth.uid();

  if v_lat is null or v_lon is null then
    return;
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.age,
    p.bio,
    p.avatar_url,
    p.city,
    p.mood_status,
    p.mood_expires_at,
    (ul.latitude + (sin(random() * 6.283185307179586) * (0.004 + random() * 0.004)))::double precision,
    (ul.longitude + (cos(random() * 6.283185307179586) * (0.004 + random() * 0.004)) / greatest(abs(cos(radians(ul.latitude))), 0.2))::double precision,
    (
      6371 * 2 * asin(
        least(1, sqrt(
          power(sin(radians(ul.latitude - v_lat) / 2), 2) +
          cos(radians(v_lat)) * cos(radians(ul.latitude)) *
          power(sin(radians(ul.longitude - v_lon) / 2), 2)
        ))
      )
    )::double precision
  from public.user_locations ul
  join public.profiles p on p.id = ul.user_id
  where ul.user_id <> auth.uid()
    and p.is_discoverable = true
    and (p.mood_expires_at is null or p.mood_expires_at > now())
    and (
      6371 * 2 * asin(
        least(1, sqrt(
          power(sin(radians(ul.latitude - v_lat) / 2), 2) +
          cos(radians(v_lat)) * cos(radians(ul.latitude)) *
          power(sin(radians(ul.longitude - v_lon) / 2), 2)
        ))
      )
    ) <= p_radius_km
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    )
  order by distance_km asc
  limit 100;
end;
$function$;

revoke all on public.user_locations from anon, authenticated;
grant select, insert, update, delete on public.user_locations to authenticated;
revoke all on function public.set_my_location(double precision, double precision) from public, anon;
revoke all on function public.delete_my_location() from public, anon;
revoke all on function public.find_nearby_profiles(integer) from public, anon;
grant execute on function public.set_my_location(double precision, double precision) to authenticated;
grant execute on function public.delete_my_location() to authenticated;
grant execute on function public.find_nearby_profiles(integer) to authenticated;
