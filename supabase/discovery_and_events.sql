-- ПОСИДИМ: видимость профиля, свайпы и реакции
alter table public.profiles
  add column if not exists is_discoverable boolean not null default false;

create table if not exists public.profile_reactions (
  actor_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  liked boolean not null,
  created_at timestamptz not null default now(),
  primary key (actor_id, target_id),
  check (actor_id <> target_id)
);
alter table public.profile_reactions enable row level security;

drop policy if exists "profile_reactions_insert_self" on public.profile_reactions;
create policy "profile_reactions_insert_self" on public.profile_reactions
  for insert to authenticated with check (actor_id = auth.uid());
drop policy if exists "profile_reactions_read_self" on public.profile_reactions;
create policy "profile_reactions_read_self" on public.profile_reactions
  for select to authenticated using (actor_id = auth.uid());

create index if not exists profiles_city_discoverable_idx
  on public.profiles(city, is_discoverable);
create index if not exists profile_reactions_actor_idx
  on public.profile_reactions(actor_id, liked, created_at desc);
create index if not exists events_city_status_starts_idx
  on public.events(city, status, starts_at);

grant select, insert on public.profile_reactions to authenticated;
