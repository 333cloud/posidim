-- ПОСИДИМ: security hardening and event chat isolation.
-- Applied to the linked Supabase project on 2026-11-19.
-- Keep this file in the repository so the live database change is documented.

drop policy if exists "messages_read_event_members" on public.messages;
create policy "messages_read_event_members" on public.messages
for select to authenticated
using (
  exists (
    select 1 from public.event_members em
    where em.event_id = messages.event_id
      and em.user_id = (select auth.uid())
      and em.status = 'accepted'
  )
  or exists (
    select 1 from public.events e
    where e.id = messages.event_id
      and e.host_id = (select auth.uid())
  )
);

drop policy if exists "messages_send_as_member" on public.messages;
create policy "messages_send_as_member" on public.messages
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and (
    exists (
      select 1 from public.event_members em
      where em.event_id = messages.event_id
        and em.user_id = (select auth.uid())
        and em.status = 'accepted'
    )
    or exists (
      select 1 from public.events e
      where e.id = messages.event_id
        and e.host_id = (select auth.uid())
    )
  )
);

-- SECURITY DEFINER helpers and RPCs are available only to signed-in users.
revoke all on function public.can_access_direct_conversation(uuid) from public, anon;
revoke all on function public.can_receive_direct_message(uuid, uuid) from public, anon;
revoke all on function public.can_view_profile(uuid, uuid) from public, anon;
revoke all on function public.get_incoming_likes() from public, anon;
revoke all on function public.get_moderation_queue(text, integer) from public, anon;
revoke all on function public.get_my_likes() from public, anon;
revoke all on function public.get_my_matches() from public, anon;
revoke all on function public.get_my_message_preference() from public, anon;
revoke all on function public.get_or_create_direct_conversation(uuid) from public, anon;
revoke all on function public.is_posidim_moderator() from public, anon;
revoke all on function public.react_to_profile(uuid, boolean) from public, anon;
revoke all on function public.respond_to_event_invitation(uuid, boolean) from public, anon;
revoke all on function public.review_report(uuid, text, text) from public, anon;
revoke all on function public.save_my_push_token(text, text) from public, anon;
revoke all on function public.set_my_message_preference(text) from public, anon;

grant execute on function public.can_access_direct_conversation(uuid) to authenticated;
grant execute on function public.can_receive_direct_message(uuid, uuid) to authenticated;
grant execute on function public.can_view_profile(uuid, uuid) to authenticated;
grant execute on function public.get_incoming_likes() to authenticated;
grant execute on function public.get_moderation_queue(text, integer) to authenticated;
grant execute on function public.get_my_likes() to authenticated;
grant execute on function public.get_my_matches() to authenticated;
grant execute on function public.get_my_message_preference() to authenticated;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;
grant execute on function public.is_posidim_moderator() to authenticated;
grant execute on function public.react_to_profile(uuid, boolean) to authenticated;
grant execute on function public.respond_to_event_invitation(uuid, boolean) to authenticated;
grant execute on function public.review_report(uuid, text, text) to authenticated;
grant execute on function public.save_my_push_token(text, text) to authenticated;
grant execute on function public.set_my_message_preference(text) to authenticated;

-- Trigger-only functions are not RPC endpoints.
revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;
revoke all on function public.enforce_profile_photo_limit() from public, anon, authenticated;
revoke all on function public.touch_direct_conversation() from public, anon, authenticated;


-- SECURITY DEFINER helpers must not accept spoofed user identities from RPC callers.
create or replace function public.can_view_profile(p_viewer uuid, p_target uuid)
returns boolean
language sql stable security definer set search_path = ''
as $function$
  select p_viewer = (select auth.uid())
    and (
      p_viewer = p_target
      or (
        exists (select 1 from public.profiles p where p.id = p_target and p.is_discoverable = true)
        and not exists (
          select 1 from public.user_blocks b
          where (b.blocker_id = p_viewer and b.blocked_id = p_target)
             or (b.blocker_id = p_target and b.blocked_id = p_viewer)
        )
      )
    );
$function$;

create or replace function public.can_receive_direct_message(p_sender_id uuid, p_recipient_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $function$
  select p_sender_id = (select auth.uid())
    and p_sender_id is not null and p_recipient_id is not null and p_sender_id <> p_recipient_id
    and case coalesce((select pref.allowed_from from public.user_message_preferences pref where pref.user_id=p_recipient_id),'matches')
      when 'all' then true
      when 'liked' then exists (
        select 1 from public.profile_reactions r
        where r.actor_id=p_recipient_id and r.target_id=p_sender_id and r.liked=true
      )
      else exists (
        select 1 from public.profile_matches m
        where m.user_low=least(p_sender_id,p_recipient_id)
          and m.user_high=greatest(p_sender_id,p_recipient_id)
      )
    end
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id=p_sender_id and b.blocked_id=p_recipient_id)
         or (b.blocker_id=p_recipient_id and b.blocked_id=p_sender_id)
    );
$function$;


-- Enforce read-only group chats after an event is cancelled or completed.
drop policy if exists "messages_send_as_member" on public.messages;
create policy "messages_send_as_member" on public.messages
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.events e
    where e.id = messages.event_id
      and e.status = 'open'
      and (
        e.host_id = (select auth.uid())
        or exists (
          select 1 from public.event_members em
          where em.event_id = messages.event_id
            and em.user_id = (select auth.uid())
            and em.status = 'accepted'
        )
      )
  )
);


-- Keep message preferences accessible only through owner-scoped RPCs.
drop policy if exists "user_message_preferences_no_direct_access" on public.user_message_preferences;
create policy "user_message_preferences_no_direct_access"
on public.user_message_preferences
for all to anon, authenticated
using (false)
with check (false);
