-- Включить Realtime для групповых сообщений встреч.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'Публикация supabase_realtime не найдена; включи Realtime в настройках Supabase.';
end
$$;
