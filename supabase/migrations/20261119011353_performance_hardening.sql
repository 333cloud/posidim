-- Performance hardening applied to the live Supabase project on 2026-11-19.
-- Safe to re-run: indexes use IF NOT EXISTS; policy updates are idempotent.

create index if not exists direct_messages_sender_id_idx on public.direct_messages(sender_id);
create index if not exists event_invitations_inviter_id_idx on public.event_invitations(inviter_id);
create index if not exists events_host_id_idx on public.events(host_id);
create index if not exists messages_sender_id_idx on public.messages(sender_id);
create index if not exists profile_matches_user_high_idx on public.profile_matches(user_high);
create index if not exists profile_reactions_target_id_idx on public.profile_reactions(target_id);
create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);
create index if not exists reports_event_id_idx on public.reports(event_id);
create index if not exists reports_moderator_id_idx on public.reports(moderator_id);
create index if not exists reports_reported_user_id_idx on public.reports(reported_user_id);
create index if not exists reports_reporter_id_idx on public.reports(reporter_id);
create index if not exists user_blocks_blocked_id_idx on public.user_blocks(blocked_id);

do $optimize_policies$
declare
  pol record;
  v_roles text;
  v_using text;
  v_check text;
  v_using_clause text;
  v_check_clause text;
begin
  for pol in
    select *
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual,'') || ' ' || coalesce(with_check,'')) ~* 'auth\.uid\(\)'
      and (coalesce(qual,'') || ' ' || coalesce(with_check,'')) !~* 'SELECT[[:space:]]+auth\.uid\(\)'
  loop
    select string_agg(quote_ident(role_name::text), ', ')
      into v_roles
    from unnest(pol.roles) as role_name;

    v_using := case when pol.qual is null then null
      else regexp_replace(pol.qual, 'auth\.uid\(\)', '(SELECT auth.uid())', 'gi') end;
    v_check := case when pol.with_check is null then null
      else regexp_replace(pol.with_check, 'auth\.uid\(\)', '(SELECT auth.uid())', 'gi') end;
    v_using_clause := case when v_using is null then '' else format(' USING (%s)', v_using) end;
    v_check_clause := case when v_check is null then '' else format(' WITH CHECK (%s)', v_check) end;

    execute format('DROP POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    execute format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      pol.policyname, pol.schemaname, pol.tablename, pol.permissive, pol.cmd,
      v_roles, v_using_clause, v_check_clause
    );
  end loop;
end;
$optimize_policies$;
