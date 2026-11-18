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

create or replace function public.enforce_group_message_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.sender_id::text || ':group_messages', 0));
  select count(*) into v_count
  from public.messages m
  where m.sender_id = new.sender_id
    and m.created_at > now() - interval '5 minutes';
  if v_count >= 30 then
    raise exception 'Слишком много сообщений в групповых чатах. Подожди немного.';
  end if;
  return new;
end;
$function$;

drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit
before insert on public.messages
for each row execute function public.enforce_group_message_rate();

revoke all on function public.enforce_group_message_rate() from public, anon, authenticated;

create or replace function public.enforce_report_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.reporter_id::text || ':reports', 0));
  select count(*) into v_count
  from public.reports r
  where r.reporter_id = new.reporter_id
    and r.created_at > now() - interval '1 hour';
  if v_count >= 10 then
    raise exception 'Слишком много жалоб за короткое время. Попробуй позже.';
  end if;
  return new;
end;
$function$;

drop trigger if exists reports_rate_limit on public.reports;
create trigger reports_rate_limit
before insert on public.reports
for each row execute function public.enforce_report_rate();

revoke all on function public.enforce_report_rate() from public, anon, authenticated;
