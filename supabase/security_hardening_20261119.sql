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
