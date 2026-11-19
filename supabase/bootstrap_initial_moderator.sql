-- One-time bootstrap for the initial project owner.
-- Grants moderator only when there is exactly one Auth user and no role has been assigned.
-- Safe to re-run: ON CONFLICT DO NOTHING and the empty-role guard prevent duplicate grants.
do $bootstrap$
declare
  v_user_count integer;
  v_user_id uuid;
begin
  select count(*) into v_user_count from auth.users;
  if v_user_count = 1 and not exists (select 1 from public.user_roles) then
    select id into v_user_id from auth.users limit 1;
    insert into public.user_roles(user_id, role)
    values (v_user_id, 'moderator')
    on conflict do nothing;
  end if;
end;
$bootstrap$;
