-- Список заблокированных пользователей для владельца аккаунта.
create or replace function public.get_my_blocked_users()
returns table (
  blocked_id uuid,
  display_name text,
  age integer,
  city text
)
language sql
security definer
set search_path = ''
as $function$
  select p.id, p.display_name, p.age, p.city
  from public.user_blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$function$;

revoke all on function public.get_my_blocked_users() from public, anon;
grant execute on function public.get_my_blocked_users() to authenticated;
