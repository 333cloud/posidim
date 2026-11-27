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
