-- ПОСИДИМ: единый пакет следующих функций.
-- Выполнить один раз в Supabase SQL Editor после schema, invitations, matches and direct_messages.
-- Включает безопасный геопоиск, категории встреч, Realtime групповых чатов,
-- управление блокировками и базовые ограничения против спама.


-- ============================================================
-- Включено из supabase/nearby_locations.sql
-- ============================================================

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

-- Если пользователь скрывает профиль напрямую через базу или другое устройство,
-- автоматически удаляем сохранённую геопозицию.
create or replace function public.cleanup_hidden_user_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.is_discoverable is distinct from true then
    delete from public.user_locations where user_id = new.id;
  end if;
  return new;
end;
$function$;

drop trigger if exists cleanup_hidden_user_location_trigger on public.profiles;
create trigger cleanup_hidden_user_location_trigger
after update of is_discoverable on public.profiles
for each row
execute function public.cleanup_hidden_user_location();

revoke all on function public.cleanup_hidden_user_location() from public, anon, authenticated;


-- ============================================================
-- Включено из supabase/event_categories.sql
-- ============================================================

-- Расширение категорий встреч ПОСИДИМ.
-- Безопасно обновляет существующее ограничение категории.
alter table public.events
  drop constraint if exists events_category_check;

alter table public.events
  add constraint events_category_check
  check (category in ('Кофе','Игры','Прогулка','Общение','Кино','Спорт','Настолки','Другое'));


-- ============================================================
-- Включено из supabase/group_chat_realtime.sql
-- ============================================================

-- Включить Realtime для групповых сообщений встреч.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'Публикация supabase_realtime не найдена; включи Realtime в настройках Supabase.';
end
$$;


-- ============================================================
-- Включено из supabase/moderation_controls.sql
-- ============================================================

-- Список заблокированных пользователей для владельца аккаунта.
create or replace function public.get_my_blocked_users()
returns table (
  blocked_id uuid,
  display_name text,
  age integer,
  city text
)
language sql
security definer
set search_path = ''
as $function$
  select p.id, p.display_name, p.age, p.city
  from public.user_blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$function$;

revoke all on function public.get_my_blocked_users() from public, anon;
grant execute on function public.get_my_blocked_users() to authenticated;


-- ============================================================
-- Включено из supabase/anti_spam_limits.sql
-- ============================================================

-- Базовые ограничения частоты действий для снижения спама.
-- Ограничения привязаны к аккаунту и проверяются в базе данных.

create or replace function public.enforce_profile_reaction_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.actor_id::text || ':reactions', 0));
  select count(*) into v_count
  from public.profile_reactions r
  where r.actor_id = new.actor_id
    and r.created_at > now() - interval '1 hour';
  if v_count >= 80 then
    raise exception 'Слишком много действий за короткое время. Попробуй позже.';
  end if;
  return new;
end;
$function$;

drop trigger if exists profile_reactions_rate_limit on public.profile_reactions;
create trigger profile_reactions_rate_limit
before insert or update on public.profile_reactions
for each row execute function public.enforce_profile_reaction_rate();

create or replace function public.enforce_direct_message_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.sender_id::text || ':direct_messages', 0));
  select count(*) into v_count
  from public.direct_messages m
  where m.sender_id = new.sender_id
    and m.created_at > now() - interval '5 minutes';
  if v_count >= 30 then
    raise exception 'Слишком много сообщений за короткое время. Подожди немного.';
  end if;
  return new;
end;
$function$;

drop trigger if exists direct_messages_rate_limit on public.direct_messages;
create trigger direct_messages_rate_limit
before insert on public.direct_messages
for each row execute function public.enforce_direct_message_rate();

create or replace function public.enforce_event_invitation_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.inviter_id::text || ':event_invites', 0));
  select count(*) into v_count
  from public.event_invitations i
  where i.inviter_id = new.inviter_id
    and i.created_at > now() - interval '1 hour';
  if v_count >= 12 then
    raise exception 'Слишком много приглашений за короткое время. Попробуй позже.';
  end if;
  return new;
end;
$function$;

drop trigger if exists event_invitations_rate_limit on public.event_invitations;
create trigger event_invitations_rate_limit
before insert on public.event_invitations
for each row execute function public.enforce_event_invitation_rate();

revoke all on function public.enforce_profile_reaction_rate() from public, anon, authenticated;
revoke all on function public.enforce_direct_message_rate() from public, anon, authenticated;
revoke all on function public.enforce_event_invitation_rate() from public, anon, authenticated;
