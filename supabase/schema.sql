-- ПОСИДИМ: базовая схема Supabase
-- Выполни этот файл в Supabase Dashboard -> SQL Editor -> New query.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  age integer not null check (age >= 18 and age <= 120),
  bio text not null default '' check (char_length(bio) <= 500),
  city text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  category text not null check (category in ('Кофе','Игры','Прогулка','Общение')),
  description text not null default '' check (char_length(description) <= 1000),
  city text not null,
  venue text not null,
  starts_at timestamptz not null,
  capacity integer not null default 6 check (capacity between 2 and 30),
  status text not null default 'open' check (status in ('open','cancelled','completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.event_members (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','accepted','declined','left')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  reason text not null check (char_length(reason) between 5 and 1000),
  created_at timestamptz not null default now()
);

-- Автоматически создаём профиль после регистрации через Supabase Auth.
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  age_text text;
begin
  age_text := new.raw_user_meta_data ->> 'age';

  if age_text is null or age_text !~ '^[0-9]{1,3}$' then
    raise exception 'Укажи возраст от 18 до 120 лет';
  end if;

  if age_text::integer < 18 or age_text::integer > 120 then
    raise exception 'Регистрация доступна только пользователям от 18 лет';
  end if;

  insert into public.profiles (id, display_name, age, city)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''), 'Новый пользователь'),
    age_text::integer,
    coalesce(new.raw_user_meta_data ->> 'city','')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_posidim on auth.users;
create trigger on_auth_user_created_posidim
after insert on auth.users
for each row execute procedure public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.messages enable row level security;
alter table public.user_blocks enable row level security;
alter table public.reports enable row level security;

-- Профили видны вошедшим пользователям; редактировать можно только свой.
drop policy if exists "profiles_read_authenticated" on public.profiles;
create policy "profiles_read_authenticated" on public.profiles
for select to authenticated using (true);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert to authenticated with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "events_read_authenticated" on public.events;
create policy "events_read_authenticated" on public.events
for select to authenticated using (status = 'open' or host_id = auth.uid());
drop policy if exists "events_create_own" on public.events;
create policy "events_create_own" on public.events
for insert to authenticated with check (host_id = auth.uid());
drop policy if exists "events_update_host" on public.events;
create policy "events_update_host" on public.events
for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
drop policy if exists "events_delete_host" on public.events;
create policy "events_delete_host" on public.events
for delete to authenticated using (host_id = auth.uid());

drop policy if exists "members_read_related" on public.event_members;
create policy "members_read_related" on public.event_members
for select to authenticated using (
  user_id = auth.uid() or exists (
    select 1 from public.events e where e.id = event_id and e.host_id = auth.uid()
  )
);
drop policy if exists "members_request_self" on public.event_members;
create policy "members_request_self" on public.event_members
for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "members_update_self_or_host" on public.event_members;
create policy "members_update_self_or_host" on public.event_members
for update to authenticated using (
  user_id = auth.uid() or exists (
    select 1 from public.events e where e.id = event_id and e.host_id = auth.uid()
  )
) with check (
  user_id = auth.uid() or exists (
    select 1 from public.events e where e.id = event_id and e.host_id = auth.uid()
  )
);

drop policy if exists "messages_read_event_members" on public.messages;
create policy "messages_read_event_members" on public.messages
for select to authenticated using (
  exists (select 1 from public.event_members m where m.event_id = event_id and m.user_id = auth.uid() and m.status = 'accepted')
  or exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid())
);
drop policy if exists "messages_send_as_member" on public.messages;
create policy "messages_send_as_member" on public.messages
for insert to authenticated with check (
  sender_id = auth.uid() and (
    exists (select 1 from public.event_members m where m.event_id = event_id and m.user_id = auth.uid() and m.status = 'accepted')
    or exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid())
  )
);

drop policy if exists "blocks_read_own" on public.user_blocks;
create policy "blocks_read_own" on public.user_blocks
for select to authenticated using (blocker_id = auth.uid());
drop policy if exists "blocks_create_own" on public.user_blocks;
create policy "blocks_create_own" on public.user_blocks
for insert to authenticated with check (blocker_id = auth.uid());
drop policy if exists "blocks_delete_own" on public.user_blocks;
create policy "blocks_delete_own" on public.user_blocks
for delete to authenticated using (blocker_id = auth.uid());

drop policy if exists "reports_create_own" on public.reports;
create policy "reports_create_own" on public.reports
for insert to authenticated with check (reporter_id = auth.uid());
drop policy if exists "reports_read_own" on public.reports;
create policy "reports_read_own" on public.reports
for select to authenticated using (reporter_id = auth.uid());

create index if not exists events_city_starts_at_idx on public.events(city, starts_at);
create index if not exists event_members_user_idx on public.event_members(user_id);
create index if not exists messages_event_created_idx on public.messages(event_id, created_at);
