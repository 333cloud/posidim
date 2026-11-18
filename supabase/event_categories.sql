-- Расширение категорий встреч ПОСИДИМ.
-- Безопасно обновляет существующее ограничение категории.
alter table public.events
  drop constraint if exists events_category_check;

alter table public.events
  add constraint events_category_check
  check (category in ('Кофе','Игры','Прогулка','Общение','Кино','Спорт','Настолки','Другое'));
