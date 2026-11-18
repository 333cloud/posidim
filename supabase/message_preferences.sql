-- ПОСИДИМ: настройки того, кто может начинать личный диалог.
create table if not exists public.user_message_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  allowed_from text not null default 'matches' check (allowed_from in ('all','liked','matches')),
  updated_at timestamptz not null default now()
);
alter table public.user_message_preferences enable row level security;
revoke all on public.user_message_preferences from anon, authenticated;

create or replace function public.can_receive_direct_message(p_sender_id uuid, p_recipient_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select case coalesce((select pref.allowed_from from public.user_message_preferences pref where pref.user_id=p_recipient_id),'matches')
    when 'all' then true
    when 'liked' then exists (select 1 from public.profile_reactions r where r.actor_id=p_recipient_id and r.target_id=p_sender_id and r.liked=true)
    else exists (select 1 from public.profile_matches m where m.user_low=least(p_sender_id,p_recipient_id) and m.user_high=greatest(p_sender_id,p_recipient_id))
  end
  and p_sender_id is not null and p_recipient_id is not null and p_sender_id<>p_recipient_id
  and not exists (select 1 from public.user_blocks b where (b.blocker_id=p_sender_id and b.blocked_id=p_recipient_id) or (b.blocker_id=p_recipient_id and b.blocked_id=p_sender_id));
$function$;
revoke all on function public.can_receive_direct_message(uuid,uuid) from public;
grant execute on function public.can_receive_direct_message(uuid,uuid) to authenticated;

create or replace function public.get_my_message_preference()
returns text language sql stable security definer set search_path = ''
as $function$
 select coalesce((select p.allowed_from from public.user_message_preferences p where p.user_id=auth.uid()),'matches');
$function$;
revoke all on function public.get_my_message_preference() from public;
grant execute on function public.get_my_message_preference() to authenticated;

create or replace function public.set_my_message_preference(p_allowed_from text)
returns text language plpgsql security definer set search_path = ''
as $function$
begin
 if auth.uid() is null then raise exception 'Необходимо войти в аккаунт'; end if;
 if p_allowed_from not in ('all','liked','matches') then raise exception 'Недопустимая настройка личных сообщений'; end if;
 insert into public.user_message_preferences(user_id,allowed_from) values(auth.uid(),p_allowed_from)
 on conflict(user_id) do update set allowed_from=excluded.allowed_from,updated_at=now();
 return p_allowed_from;
end;
$function$;
revoke all on function public.set_my_message_preference(text) from public;
grant execute on function public.set_my_message_preference(text) to authenticated;

create or replace function public.get_or_create_direct_conversation(p_other_user_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_me uuid:=auth.uid(); v_low uuid; v_high uuid; v_id uuid;
begin
 if v_me is null then raise exception 'Необходимо войти в аккаунт'; end if;
 if p_other_user_id is null or p_other_user_id=v_me then
   raise exception 'Нельзя открыть чат с этим пользователем';
 end if;
 v_low:=least(v_me,p_other_user_id); v_high:=greatest(v_me,p_other_user_id);

 -- Уже начатый диалог можно продолжать, даже если владелец профиля позже изменил настройку.
 select c.id into v_id
 from public.direct_conversations c
 where c.user_one=v_low and c.user_two=v_high
   and exists (select 1 from public.direct_messages dm where dm.conversation_id=c.id)
 limit 1;
 if v_id is not null then return v_id; end if;

 if not public.can_receive_direct_message(v_me,p_other_user_id) then
   raise exception 'Пользователь ограничил круг тех, кто может начинать личный чат';
 end if;

 insert into public.direct_conversations(user_one,user_two) values(v_low,v_high)
 on conflict(user_one,user_two) do update set updated_at=public.direct_conversations.updated_at
 returning id into v_id;
 return v_id;
end;
$function$;
revoke all on function public.get_or_create_direct_conversation(uuid) from public;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

drop policy if exists "direct_messages_send_member" on public.direct_messages;
create policy "direct_messages_send_member" on public.direct_messages
for insert to authenticated with check (
 sender_id=(select auth.uid())
 and public.can_access_direct_conversation(conversation_id)
 and (
   -- После первого сообщения обе стороны могут нормально продолжать существующий диалог.
   exists (select 1 from public.direct_messages previous
     where previous.conversation_id=direct_messages.conversation_id)
   or exists (select 1 from public.direct_conversations c where c.id=conversation_id
     and public.can_receive_direct_message(auth.uid(),case when c.user_one=auth.uid() then c.user_two else c.user_one end))
 )
);
