-- ПОСИДИМ: приглашения на встречи и безопасное принятие
-- Выполни этот файл целиком в Supabase Dashboard -> SQL Editor -> New query.

create table if not exists public.event_invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (event_id, invitee_id),
  check (inviter_id <> invitee_id)
);

alter table public.event_invitations enable row level security;

drop policy if exists "event_invites_read_participants" on public.event_invitations;
create policy "event_invites_read_participants" on public.event_invitations
for select to authenticated
using (inviter_id = auth.uid() or invitee_id = auth.uid());

drop policy if exists "event_invites_create_host" on public.event_invitations;
create policy "event_invites_create_host" on public.event_invitations
for insert to authenticated
with check (
  inviter_id = (select auth.uid())
  and status = 'pending'
  and responded_at is null
  and exists (
    select 1 from public.events e
    where e.id = event_id and e.host_id = (select auth.uid()) and e.status = 'open'
  )
);

-- Enforce mutual block checks at the database layer, including blocks hidden by RLS.
create or replace function public.reject_blocked_event_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = new.inviter_id and b.blocked_id = new.invitee_id)
       or (b.blocker_id = new.invitee_id and b.blocked_id = new.inviter_id)
  ) then
    raise exception 'Cannot invite a blocked user';
  end if;
  return new;
end;
$function$;
revoke all on function public.reject_blocked_event_invitation() from public, anon, authenticated, service_role;
drop trigger if exists reject_blocked_event_invitation on public.event_invitations;
create trigger reject_blocked_event_invitation
before insert on public.event_invitations
for each row execute function public.reject_blocked_event_invitation();
drop trigger if exists reject_blocked_event_invitation_acceptance on public.event_invitations;
create trigger reject_blocked_event_invitation_acceptance
before update of status on public.event_invitations
for each row
when (old.status = 'pending' and new.status = 'accepted')
execute function public.reject_blocked_event_invitation();

-- Ответ на приглашение атомарно добавляет принявшего человека в состав встречи.
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

  if not found then
    raise exception 'Приглашение не найдено или уже обработано';
  end if;

  select * into v_event
  from public.events
  where id = v_invite.event_id and status = 'open'
  for update;

  if not found then
    raise exception 'Встреча больше недоступна';
  end if;

  if p_accept then
    select count(*) into v_count
    from public.event_members
    where event_id = v_event.id and status = 'accepted';

    if v_count + 1 >= v_event.capacity then
      raise exception 'В этой встрече уже нет свободных мест';
    end if;

    insert into public.event_members(event_id, user_id, status)
    values (v_event.id, auth.uid(), 'accepted')
    on conflict (event_id, user_id)
    do update set status = 'accepted';

    update public.event_invitations
    set status = 'accepted', responded_at = now()
    where id = v_invite.id;
  else
    update public.event_invitations
    set status = 'declined', responded_at = now()
    where id = v_invite.id;
  end if;

  return v_event.id;
end;
$$;

revoke all on function public.respond_to_event_invitation(uuid, boolean) from public;
grant execute on function public.respond_to_event_invitation(uuid, boolean) to authenticated;

-- Участник не может сам назначить себе статус accepted.
drop policy if exists "members_update_self_or_host" on public.event_members;
drop policy if exists "members_update_host_only" on public.event_members;
create policy "members_update_host_only" on public.event_members
for update to authenticated
using (
  exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid())
)
with check (
  exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid())
);

-- Запрос на участие может создать только сам пользователь и только со статусом requested.
drop policy if exists "members_request_self" on public.event_members;
create policy "members_request_self" on public.event_members
for insert to authenticated
with check (user_id = auth.uid() and status = 'requested');

-- Принятые участники могут видеть состав своей групповой встречи.
drop policy if exists "members_read_related" on public.event_members;
create policy "members_read_related" on public.event_members
for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.events e
    where e.id = event_id and e.host_id = auth.uid()
  )
);

create index if not exists event_invitations_inbox_idx
on public.event_invitations(invitee_id, status, created_at desc);
create index if not exists event_invitations_event_idx
on public.event_invitations(event_id, status);
