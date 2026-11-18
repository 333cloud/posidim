-- ПОСИДИМ: взаимные симпатии и совпадения
-- Выполнять после schema.sql и discovery_and_events.sql.

create table if not exists public.profile_matches (
  user_low uuid not null references public.profiles(id) on delete cascade,
  user_high uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_low, user_high),
  constraint profile_matches_order check (user_low < user_high)
);
alter table public.profile_matches enable row level security;
drop policy if exists "profile_matches_read_member" on public.profile_matches;
create policy "profile_matches_read_member" on public.profile_matches
for select to authenticated
using ((select auth.uid()) = user_low or (select auth.uid()) = user_high);
revoke insert, update, delete on public.profile_matches from anon, authenticated;
grant select on public.profile_matches to authenticated;

-- Реакции изменяются только через RPC, чтобы взаимность рассчитывалась на сервере.
drop policy if exists "profile_reactions_insert_self" on public.profile_reactions;
revoke insert, update, delete on public.profile_reactions from anon, authenticated;
grant select on public.profile_reactions to authenticated;

create or replace function public.react_to_profile(p_target_id uuid, p_liked boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_mutual boolean := false;
  v_low uuid;
  v_high uuid;
begin
  if v_actor is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;
  if p_target_id is null or p_target_id = v_actor then
    raise exception 'Нельзя поставить реакцию этому профилю';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_target_id and p.is_discoverable = true
  ) then
    raise exception 'Этот профиль сейчас недоступен';
  end if;
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = v_actor and b.blocked_id = p_target_id)
       or (b.blocker_id = p_target_id and b.blocked_id = v_actor)
  ) then
    raise exception 'Действие недоступно';
  end if;

  insert into public.profile_reactions(actor_id, target_id, liked)
  values (v_actor, p_target_id, p_liked)
  on conflict (actor_id, target_id)
  do update set liked = excluded.liked, created_at = now();

  v_low := least(v_actor, p_target_id);
  v_high := greatest(v_actor, p_target_id);

  if p_liked and exists (
    select 1 from public.profile_reactions r
    where r.actor_id = p_target_id
      and r.target_id = v_actor
      and r.liked = true
  ) then
    insert into public.profile_matches(user_low, user_high)
    values (v_low, v_high)
    on conflict (user_low, user_high) do nothing;
    v_mutual := true;
  else
    delete from public.profile_matches
    where user_low = v_low and user_high = v_high;
  end if;

  return v_mutual;
end;
$$;
revoke all on function public.react_to_profile(uuid, boolean) from public;
grant execute on function public.react_to_profile(uuid, boolean) to authenticated;

create or replace function public.get_my_matches()
returns table (
  id uuid, display_name text, age integer, bio text, avatar_url text,
  city text, mood_status text, mood_expires_at timestamptz, matched_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.age, p.bio, p.avatar_url,
         p.city, p.mood_status, p.mood_expires_at, m.created_at
  from public.profile_matches m
  join public.profiles p
    on p.id = case when m.user_low = auth.uid() then m.user_high else m.user_low end
  where (m.user_low = auth.uid() or m.user_high = auth.uid())
    and p.is_discoverable = true
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    )
  order by m.created_at desc;
$$;
revoke all on function public.get_my_matches() from public;
grant execute on function public.get_my_matches() to authenticated;

create or replace function public.get_incoming_likes()
returns table (
  id uuid, display_name text, age integer, bio text, avatar_url text,
  city text, mood_status text, mood_expires_at timestamptz, liked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.age, p.bio, p.avatar_url,
         p.city, p.mood_status, p.mood_expires_at, r.created_at
  from public.profile_reactions r
  join public.profiles p on p.id = r.actor_id
  where r.target_id = auth.uid()
    and r.liked = true
    and p.is_discoverable = true
    and not exists (
      select 1 from public.profile_matches m
      where (m.user_low = least(auth.uid(), p.id)
         and m.user_high = greatest(auth.uid(), p.id))
    )
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    )
  order by r.created_at desc;
$$;
revoke all on function public.get_incoming_likes() from public;
grant execute on function public.get_incoming_likes() to authenticated;

create or replace function public.get_my_likes()
returns table (
  id uuid, display_name text, age integer, bio text, avatar_url text,
  city text, mood_status text, mood_expires_at timestamptz, liked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.age, p.bio, p.avatar_url,
         p.city, p.mood_status, p.mood_expires_at, r.created_at
  from public.profile_reactions r
  join public.profiles p on p.id = r.target_id
  where r.actor_id = auth.uid()
    and r.liked = true
    and p.is_discoverable = true
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    )
  order by r.created_at desc;
$$;
revoke all on function public.get_my_likes() from public;
grant execute on function public.get_my_likes() to authenticated;
