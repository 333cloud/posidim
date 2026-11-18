-- ПОСИДИМ: личные сообщения только между взаимными совпадениями.
create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  user_one uuid not null references public.profiles(id) on delete cascade,
  user_two uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint direct_conversations_order check (user_one < user_two),
  constraint direct_conversations_unique_pair unique (user_one, user_two)
);
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages(conversation_id, created_at);
create index if not exists direct_conversations_user_one_idx
  on public.direct_conversations(user_one, updated_at desc);
create index if not exists direct_conversations_user_two_idx
  on public.direct_conversations(user_two, updated_at desc);

alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "direct_conversations_read_member" on public.direct_conversations;
create policy "direct_conversations_read_member" on public.direct_conversations
for select to authenticated
using ((select auth.uid()) = user_one or (select auth.uid()) = user_two);

drop policy if exists "direct_messages_read_member" on public.direct_messages;
create policy "direct_messages_read_member" on public.direct_messages
for select to authenticated
using (
  exists (
    select 1 from public.direct_conversations c
    where c.id = conversation_id
      and ((c.user_one = (select auth.uid())) or (c.user_two = (select auth.uid())))
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id = (select auth.uid()) and b.blocked_id = case when c.user_one = (select auth.uid()) then c.user_two else c.user_one end)
           or (b.blocker_id = case when c.user_one = (select auth.uid()) then c.user_two else c.user_one end and b.blocked_id = (select auth.uid()))
      )
  )
);

drop policy if exists "direct_messages_send_member" on public.direct_messages;
create policy "direct_messages_send_member" on public.direct_messages
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.direct_conversations c
    where c.id = conversation_id
      and ((c.user_one = (select auth.uid())) or (c.user_two = (select auth.uid())))
      and exists (
        select 1 from public.profile_matches m
        where m.user_low = least(c.user_one,c.user_two)
          and m.user_high = greatest(c.user_one,c.user_two)
      )
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id = (select auth.uid()) and b.blocked_id = case when c.user_one = (select auth.uid()) then c.user_two else c.user_one end)
           or (b.blocker_id = case when c.user_one = (select auth.uid()) then c.user_two else c.user_one end and b.blocked_id = (select auth.uid()))
      )
  )
);

revoke insert, update, delete on public.direct_conversations from anon, authenticated;
grant select on public.direct_conversations to authenticated;
revoke update, delete on public.direct_messages from anon, authenticated;
grant select, insert on public.direct_messages to authenticated;

create or replace function public.get_or_create_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_low uuid;
  v_high uuid;
  v_id uuid;
begin
  if v_me is null then raise exception 'Необходимо войти в аккаунт'; end if;
  if p_other_user_id is null or p_other_user_id = v_me then
    raise exception 'Нельзя открыть чат с этим пользователем';
  end if;
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = v_me and b.blocked_id = p_other_user_id)
       or (b.blocker_id = p_other_user_id and b.blocked_id = v_me)
  ) then raise exception 'Чат недоступен: один из пользователей заблокировал другого'; end if;
  if not exists (
    select 1 from public.profile_matches m
    where m.user_low = least(v_me,p_other_user_id)
      and m.user_high = greatest(v_me,p_other_user_id)
  ) then raise exception 'Личные сообщения доступны после взаимной симпатии'; end if;

  v_low := least(v_me,p_other_user_id);
  v_high := greatest(v_me,p_other_user_id);
  insert into public.direct_conversations(user_one,user_two)
  values (v_low,v_high)
  on conflict (user_one,user_two) do update set updated_at = public.direct_conversations.updated_at
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.get_or_create_direct_conversation(uuid) from public;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

create or replace function public.touch_direct_conversation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.direct_conversations
  set updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists direct_message_touch_conversation on public.direct_messages;
create trigger direct_message_touch_conversation
after insert on public.direct_messages
for each row execute function public.touch_direct_conversation();

-- Realtime включается для новых сообщений, если таблица ещё не добавлена в publication.
do $$
begin
  alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then null;
when undefined_object then null;
end;
$$;
