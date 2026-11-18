-- ПОСИДИМ: обнаружение людей, лайки и публикация встреч
alter table public.profiles
  add column if not exists visible_on_map boolean not null default false,
  add column if not exists activity_status text not null default '💬 Открыт к общению';

create table if not exists public.profile_likes (
  liker_id uuid not null references public.profiles(id) on delete cascade,
  liked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (liker_id, liked_id),
  check (liker_id <> liked_id)
);
alter table public.profile_likes enable row level security;
drop policy if exists "profile_likes_insert_self" on public.profile_likes;
create policy "profile_likes_insert_self" on public.profile_likes
  for insert to authenticated with check (liker_id = auth.uid());
drop policy if exists "profile_likes_read_self" on public.profile_likes;
create policy "profile_likes_read_self" on public.profile_likes
  for select to authenticated using (liker_id = auth.uid());

create or replace function public.like_profile(p_liked_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match boolean;
begin
  if auth.uid() is null or p_liked_id = auth.uid() then
    raise exception 'Некорректный пользователь';
  end if;
  insert into public.profile_likes(liker_id, liked_id)
  values (auth.uid(), p_liked_id)
  on conflict do nothing;
  select exists (
    select 1 from public.profile_likes
    where liker_id = p_liked_id and liked_id = auth.uid()
  ) into v_match;
  return v_match;
end;
$$;
revoke all on function public.like_profile(uuid) from public;
grant execute on function public.like_profile(uuid) to authenticated;

create index if not exists profiles_city_visible_idx
  on public.profiles(city, visible_on_map);
create index if not exists events_city_status_created_idx
  on public.events(city, status, created_at desc);

-- Исправляем проверку вместимости: capacity включает организатора.
create or replace function public.respond_to_event_invitation(p_invitation_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.event_invitations%rowtype;
  v_event public.events%rowtype;
  v_count integer;
begin
  select * into v_invite
  from public.event_invitations
  where id = p_invitation_id and invitee_id = auth.uid() and status = 'pending'
  for update;
  if not found then raise exception 'Приглашение не найдено или уже обработано'; end if;

  select * into v_event from public.events
  where id = v_invite.event_id and status = 'open' for update;
  if not found then raise exception 'Встреча больше недоступна'; end if;

  if p_accept then
    select count(*) into v_count from public.event_members
    where event_id = v_event.id and status = 'accepted';
    if v_count + 2 > v_event.capacity then
      raise exception 'В этой встрече уже нет свободных мест';
    end if;
    insert into public.event_members(event_id, user_id, status)
    values (v_event.id, auth.uid(), 'accepted')
    on conflict (event_id, user_id) do update set status = 'accepted';
    update public.event_invitations
    set status = 'accepted', responded_at = now() where id = v_invite.id;
  else
    update public.event_invitations
    set status = 'declined', responded_at = now() where id = v_invite.id;
  end if;
  return v_event.id;
end;
$$;
revoke all on function public.respond_to_event_invitation(uuid, boolean) from public;
grant execute on function public.respond_to_event_invitation(uuid, boolean) to authenticated;
