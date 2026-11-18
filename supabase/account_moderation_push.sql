-- ПОСИДИМ: account deletion, moderator queue, and push-token registry
-- Run once in Supabase SQL Editor after the existing project migrations.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('moderator','admin')),
  created_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;
drop policy if exists user_roles_read_self on public.user_roles;
create policy user_roles_read_self on public.user_roles for select to authenticated using (user_id = auth.uid());

alter table public.reports
  add column if not exists status text not null default 'pending',
  add column if not exists moderator_id uuid references auth.users(id) on delete set null,
  add column if not exists moderator_note text,
  add column if not exists reviewed_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reports_status_check') then
    alter table public.reports add constraint reports_status_check check (status in ('pending','reviewing','resolved','dismissed'));
  end if;
end $$;
create index if not exists reports_status_created_idx on public.reports(status, created_at desc);

create or replace function public.is_posidim_moderator()
returns boolean language sql stable security definer set search_path = ''
as $function$
  select exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('moderator','admin'));
$function$;
revoke all on function public.is_posidim_moderator() from public;
grant execute on function public.is_posidim_moderator() to authenticated;

create or replace function public.get_moderation_queue(p_status text default 'pending', p_limit integer default 50)
returns table (
  id uuid, reporter_id uuid, reported_user_id uuid, event_id uuid, reason text,
  status text, moderator_note text, created_at timestamptz,
  reporter_name text, reported_name text, event_title text
)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if not public.is_posidim_moderator() then raise exception 'moderator access required'; end if;
  return query
    select r.id, r.reporter_id, r.reported_user_id, r.event_id, r.reason,
      r.status, r.moderator_note, r.created_at,
      rp.display_name, tp.display_name, e.title
    from public.reports r
    left join public.profiles rp on rp.id = r.reporter_id
    left join public.profiles tp on tp.id = r.reported_user_id
    left join public.events e on e.id = r.event_id
    where (p_status = 'all' or r.status = p_status)
    order by r.created_at desc
    limit least(greatest(coalesce(p_limit,50),1),100);
end;
$function$;
revoke all on function public.get_moderation_queue(text,integer) from public;
grant execute on function public.get_moderation_queue(text,integer) to authenticated;

create or replace function public.review_report(p_report_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  if not public.is_posidim_moderator() then raise exception 'moderator access required'; end if;
  if p_status not in ('reviewing','resolved','dismissed') then raise exception 'invalid report status'; end if;
  update public.reports
    set status = p_status, moderator_id = auth.uid(),
        moderator_note = left(coalesce(p_note,''),1000),
        reviewed_at = case when p_status in ('resolved','dismissed') then now() else null end
    where id = p_report_id;
  if not found then raise exception 'report not found'; end if;
end;
$function$;
revoke all on function public.review_report(uuid,text,text) from public;
grant execute on function public.review_report(uuid,text,text) to authenticated;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  device_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens for select to authenticated using (user_id = auth.uid());
drop policy if exists push_tokens_insert_own on public.push_tokens;
create policy push_tokens_insert_own on public.push_tokens for insert to authenticated with check (user_id = auth.uid());
drop policy if exists push_tokens_update_own on public.push_tokens;
create policy push_tokens_update_own on public.push_tokens for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_delete_own on public.push_tokens for delete to authenticated using (user_id = auth.uid());

create or replace function public.save_my_push_token(p_token text, p_device_name text default null)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_token is null or length(p_token) > 255 or p_token not like 'ExponentPushToken[%]' then raise exception 'invalid Expo push token'; end if;
  insert into public.push_tokens(user_id,expo_push_token,device_name)
  values(auth.uid(),p_token,left(p_device_name,120))
  on conflict(expo_push_token) do update set user_id=excluded.user_id,device_name=excluded.device_name,updated_at=now();
end;
$function$;
revoke all on function public.save_my_push_token(text,text) from public;
grant execute on function public.save_my_push_token(text,text) to authenticated;
