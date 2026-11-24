# ПОСИДИМ — чек-лист подготовки к запуску

Этот документ фиксирует то, что необходимо закрыть до публичного запуска. Пункты с юридическими, платёжными или внешними аккаунтами нельзя считать выполненными только по наличию кода.

## 1. База и инфраструктура

- [ ] Выполнить все миграции в правильном порядке и сохранить журнал выполненных SQL.
- [ ] Проверить RLS для каждой таблицы под двумя независимыми аккаунтами.
- [ ] Проверить Storage buckets, тип доступа, MIME-типы, лимиты и политики удаления.
- [ ] Добавить `posidim://auth/callback`, `posidim://auth/confirm` и `posidim://auth/social` в Supabase Auth → URL Configuration → Redirect URLs; на опубликованном Web URL разрешить `/auth/callback`, `/auth/confirm` и `/auth/social`, проверить каждый маршрут реальным входом.
- [ ] Добавить URL сайта с путями `/auth/callback` и `/auth/confirm` (и адрес локальной web-разработки, если нужен) в Redirect URLs; проверить подтверждение email и восстановление пароля по письму на Android, iOS и Web.
- [ ] Проверить резервное копирование и процедуру восстановления Supabase.
- [ ] Настроить мониторинг ошибок и оповещения.
- [ ] Проверить лимиты и стоимость Supabase на ожидаемую аудиторию.
- [ ] Убедиться, что в клиентском приложении нет service_role/secret ключей.
- [ ] Настроить rate limits и мониторинг злоупотреблений.

## 2. Безопасность пользователей

- [ ] Протестировать блокировку с обеих сторон: поиск, совпадения, личные чаты и групповые приглашения.
- [ ] Проверить отправку жалобы на профиль и встречу.
- [ ] Назначить ответственных за обработку жалоб и определить сроки реакции.
- [ ] Создать защищённую роль модератора и журнал действий модерации.
- [ ] Подготовить процесс эскалации угроз, преследования и сообщений об опасности.
- [ ] Определить правила удаления запрещённого контента и апелляций.
- [ ] Проверить, что скрытие профиля удаляет сохранённую геопозицию.
- [ ] Проверить разрешение геолокации на iOS, Android и Web; убедиться, что фоновые разрешения не запрашиваются.

## 3. Юридические документы и приватность

- [ ] Указать юридическое лицо/оператора приложения, адрес и контакт для обращений.
- [ ] Подготовить и проверить с юристом Политику конфиденциальности (`docs/PRIVACY_POLICY_DRAFT.md` — черновик создан, заполнить реквизиты и подтвердить фактические процессы).
- [ ] Подготовить и проверить Условия использования (`docs/TERMS_OF_USE_DRAFT.md` — черновик создан, необходимы юридические реквизиты и проверка).
- [ ] Опубликовать Правила сообщества и правила безопасности офлайн-встреч.
- [ ] Описать цели обработки, категории данных, сроки хранения и получателей данных.
- [ ] Описать использование Supabase, картографических тайлов и геокодирования третьими сторонами.
- [ ] Реализовать запрос на выгрузку данных и удаление аккаунта.
- [ ] Проверить требования законодательства тех стран, где приложение будет доступно.
- [ ] Подготовить контакт для запросов по персональным данным и процедуру их обработки.

## 4. Публикация приложений

- [ ] Создать/подтвердить аккаунт Google Play Console.
- [ ] Создать/подтвердить Apple Developer account.
- [ ] Подготовить иконку, скриншоты, описание и возрастной рейтинг.
- [ ] Заполнить декларации Data Safety / App Privacy на основании фактического поведения приложения.
- [ ] Проверить deep links, подтверждение email и восстановление пароля; отдельно проверить, что ссылка открывает правильную установленную сборку.
- [ ] Протестировать сборки на физических iOS и Android устройствах.
- [ ] Проверить слабую сеть, отсутствие разрешений, отказ GPS и пустые состояния.
- [ ] Провести закрытое тестирование с небольшой группой пользователей.

## 5. Продуктовые проверки

- [ ] Регистрация и вход после подтверждения email.
- [ ] Создание, редактирование, отмена и поиск встреч.
- [ ] Заявки, приглашения и ограничения вместимости.
- [ ] Взаимные лайки и отмена симпатии.
- [ ] Личные и групповые чаты в реальном времени.
- [ ] Повторный вход и восстановление истории.
- [ ] Фотогалерея, удаление фото и ограничения размера.
- [ ] Геопоиск, радиусы, скрытие профиля и блокировки.
- [ ] Жалобы на профили и встречи.
- [ ] Проверка поведения при ошибках Supabase и потере сети.

## 6. Что не следует объявлять готовым заранее

- Верификация личности и liveness — пока нет выбранного провайдера и проверенного процесса.
- Панель модератора — пока нет защищённых ролей, очереди и регламента.
- Push-уведомления — пока нет настроенного провайдера и проверенных токенов устройств.
- Публичный запуск — пока не закрыты юридические документы, безопасность и тестирование на устройствах.

## 7. Автоматически проверено 19.11.2026

- База Supabase активна; все таблицы схем public и storage имеют включённый RLS.
- Добавлены недостающие индексы для 12 внешних ключей; предупреждение Supabase Advisor об unindexed foreign keys исчезло.
- В 21 RLS-политике auth.uid() обёрнут в scalar SELECT для однократного вычисления на запрос; предупреждение auth_rls_initplan исчезло. Оставшиеся INFO unused_index ожидаемы для пустой/малонагруженной базы — индексы не удалять без реальной статистики трафика.
- Единственная таблица без прямых RLS-политик — user_message_preferences: прямые права для клиентских ролей отозваны, доступ выполняется через проверяемые RPC.
- У публичных функций SECURITY DEFINER нет права выполнения у роли anon.
- Внутренние RLS-helper функции перенесены в закрытую схему private; оставшиеся SECURITY DEFINER RPC доступны только авторизованным сценариям приложения и требуют проверки пользователя/роли.
- Проверен RLS в имитации authenticated-сессии единственного пользователя: собственный профиль читается, таблица настроек личных сообщений напрямую не читается, moderator RPC возвращает true.
- Исправлена изоляция групповых сообщений по конкретной встрече; отправка новых сообщений запрещена после закрытия/отмены встречи.
- RPC-проверки приватности профиля и возможности начать личный чат сверяют инициатора с auth.uid(), а не доверяют переданному клиентом UUID.
- Storage: avatars — публичное чтение, profile-photos — приватное чтение; для обоих бакетов ограничение 5 МБ и MIME JPEG/PNG/WebP.
- Edge Functions delete-account и send-notification развёрнуты и активны с обязательной JWT-проверкой.
- В GitHub Actions на commit `8226fc9a68ce181ab9000ce3ef0d899f73f9b3a3` успешно завершились `npm ci`, `npm audit --audit-level=high`, `expo install --check`, `expo-doctor`, TypeScript и exports Web/Android/iOS. Это проверка JavaScript bundle/export, не замена native EAS build или физического тестирования. Локальный полный прогон Windows отдельно не подтверждён.

## 8. Блокеры перед реальным запуском

- Не подтверждены фактические Redirect URLs в Supabase Auth; нужно проверить ссылки подтверждения почты и восстановления пароля на опубликованном Web URL и на телефонах.
- В Supabase Advisor отмечено, что защита от скомпрометированных паролей (Leaked Password Protection) выключена.
- EAS-проект привязан и подтверждён: owner `marrksss131s-team`, project ID `649dc7e2-142d-4860-b56b-9172c19cfcb9` (также указан в `app.json`). Push всё ещё не готов до проверки реальных токенов устройств и доставки уведомлений.
- Не проведён сценарный тест под двумя независимыми аккаунтами и на физических iOS/Android устройствах.
- Единственный текущий Auth-аккаунт назначен модератором guarded bootstrap-миграцией (она срабатывает только при ровно одном пользователе и пустой таблице ролей). Для полноценного теста двух независимых пользователей всё ещё нужен второй аккаунт.
- Не заполнены юридические сведения оператора, политика конфиденциальности, условия использования и правила сообщества; их нельзя достоверно придумать вместо владельца.
- Возраст 18+ сейчас подтверждается самодекларацией в форме, без проверки документа или даты рождения; если выбранная юрисдикция требует строгую age assurance, до запуска нужен соответствующий процесс/провайдер.
- Не подтверждены резервное копирование, мониторинг, лимиты расходов и регламент работы модерации.

## 9. Автоматически проверено 21.11.2026

- EAS owner/project ID подтверждены чтением локального `app.json` и успешным запросом списка сборок по проекту. В GitHub `main` привязка добавлена коммитом [e363f76](https://github.com/333cloud/posidim/commit/e363f76b1935b257e7d7aaf53e76250e5b87556c).
- Android internal preview APK завершён 20.11.2026 (SDK 57, build ID `90c85449-1e2f-458d-976e-0ca95f3c60ee`); артефакт истекает 04.12.2026. [APK](https://expo.dev/artifacts/eas/fbQubfub4i4yCH8CmNx4JxMXjuR_0f7SkaXaCe9hoow.apk). SHA коммита в метаданных сборки отсутствует; сборка предшествует четырём последним push-фиксам, поэтому актуальный main ещё не подтверждён этой APK.
- iOS simulator build завершён 20.11.2026 (SDK 57, ID `f3c5c99b-0536-4990-b843-ffadcc23b056`); это simulator archive, не IPA для реального устройства/App Store.
- GitHub Actions run #227 для commit `e363f76` завершился success: npm install/audit, Expo dependency check/Doctor, TypeScript и Web/Android/iOS export. [CI](https://github.com/333cloud/posidim/actions/runs/44886116607).
- На Windows `DESKTOP-2IDEH2B` подтверждены Node `v26.13.1`, npm `11.20.0`, `npm run typecheck` (exit 0), `npm audit --audit-level=high` (0 vulnerabilities) и локальные Expo exports Web, Android, iOS (exit 0; результаты в `%LOCALAPPDATA%\Temp\posidim-*-export`).
- `npm run lint` на локальной Windows-папке завершился ошибкой: 54 errors / 49 warnings. В корне присутствуют диагностические скрипты, логи и backup-файлы, которых нет в GitHub main; targeted lint app/lib/scripts также завершился с 43 errors (включая React Compiler/ref правила и Node `__dirname`). CI lint не запускает. Чистый source-only lint не подтверждён; не считать lint зелёным.
- Commit `9e7e69db` добавил CORS preflight (`OPTIONS`) и заголовки для JSON-ответов в исходники `send-notification` и `delete-account`; readback подтвердил все ответы через helper. Production Edge Functions не развёртывались; Deno на Windows не установлен, CI не проверяет Deno-код, поэтому live web preflight/type-check ещё не подтверждены.
- Git отсутствует в PATH на Windows-компьютере; локальный working-tree status не подтверждён. Новые EAS cloud builds в этой проверке не запускались.

## 10. Автоматически проверено 22.11.2026

- Текущий main SHA: `aaca7ce5b7f221c91b9e31a803872ac6fb6e7ae`. Commit `8d13f6b` исправляет ответ Edge Function `delete-account`: отсутствие Authorization теперь возвращает 401 Unauthorized, а ошибка конфигурации остаётся 500. Readback файла и diff подтверждены; CI run #232 завершился success. [CI](https://github.com/333cloud/posidim/actions/runs/45001459285).
- Проверена вместимость приглашений: интерфейс явно сообщает, что вместимость включает организатора, а host не входит в accepted `event_members`. Проверка `v_count + 1 >= capacity` в `respond_to_event_invitation` поэтому оставлена как корректная. Временное изменение в commit `9521d1b` было отменено commit `aaca7ce` до production-развёртывания; оба CI (#233 и #234) прошли. [CI #234](https://github.com/333cloud/posidim/actions/runs/45001630524).
- Expo/EAS read-only: Android preview APK build `90c85449-1e2f-458d-976e-0ca95f3c60ee` и iOS Simulator build `f3c5c99b-0536-4990-b843-ffadcc23b056` — FINISHED. Оба без git commit SHA; EAS metadata указывает SDK 57, тогда как main `package.json` закрепляет Expo `~54.0.0`. Точное соответствие этих build artifacts актуальному main не подтверждено — требуется сверить версии и собрать main заново.
- Компьютер `DESKTOP-2IDEH2B` недоступен (offline, последний контакт примерно 9 часов назад). Локальные проверки typecheck/lint/audit/export сегодня не выполнялись; предыдущие результаты от 21.11 не переутверждены.
- В текущем main `package.json` отсутствует script `lint`; CI не запускает ESLint. CI #234 подтвердил npm install/audit, Expo dependency check, Expo Doctor, TypeScript и Web/Android/iOS export, но не Deno/SQL tests.
- В `app/index.tsx` статический поиск не обнаружил `TODO`, `FIXME` или пустых `onPress/onClick` handlers. В репозитории не найден каталог `assets/`; `app.json` не задаёт custom app icon/splash — магазинные материалы/иконка остаются блокером.
- Static review подтвердил риск Storage abuse: RLS для `profile-photos` ограничивает upload папкой владельца и тип/размер файла, но не количеством объектов. DB trigger ограничивает rows `profile_photos` пятью; прямой upload в Storage может обходить этот metadata limit и создавать orphan files. `delete-account` удаляет только одну страницу Storage list (limit 1000). Нужна безопасная серверная/storage-quota стратегия и проверка удаления; production SQL/Storage не менялся.
- Live Supabase project/Advisor/function status не проверены: доступный Supabase skill в этом запуске отсутствует (skills listing пуст). Edge Function CORS fixes всё ещё не подтверждены deployment в production.

- Telegram OIDC first-time signup is blocked by the current profile trigger: `create_profile_for_new_user` requires `raw_user_meta_data.age`, while the Telegram OIDC `profile` claims documented by Telegram do not include age; app `signInSocial` sends no age metadata. This is a static code-path finding, not a live OAuth test. Do not relax the 18+ check or assign a default age; design an explicit age-confirmation/onboarding flow before enabling new Telegram registrations. [Telegram OIDC claims](https://core.telegram.org/bots/telegram-login).
- Potential block/invitation policy gap: `event_invitations` insert RLS validates host and open event but not `user_blocks`, and the invitation push branch validates invite/event without checking blocks. UI profile visibility filters blocked profiles, but direct API invitations may bypass that filter. Review/define blocking semantics and add server-side enforcement before beta; no production policy/function changes made.


## 11. Автоматически проверено 23.11.2026

- Актуальный GitHub `main`: `798687a0cd4ac276aef30712edee185abe519bc7` (коммит от 22.11; новых коммитов на момент проверки нет). Последний GitHub Actions run #236 для этого SHA завершился `success`: npm install, `npm audit --audit-level=high` (CI log: 0 vulnerabilities), Expo dependency check, Expo Doctor, TypeScript, exports Web/Android/iOS. [CI #236](https://github.com/333cloud/posidim/actions/runs/45001907619). Это не native EAS build и не device QA. В логе есть deprecation предупреждения о Node 20 actions и `punycode`, но run успешен.
- `app.json` readback подтверждает Expo owner `marrksss131s-team` и project ID `649dc7e2-142d-4860-b56b-9172c19cfcb9`. EAS read-only list: Android preview build `90c85449-1e2f-458d-976e-0ca95f3c60ee` и iOS simulator build `f3c5c99b-0536-4990-b843-ffadcc23b056` — FINISHED, SDK 57, commit SHA отсутствует; `package.json` на main указывает Expo `~54.0.0`. Источник этих сборок не подтверждён как текущий main; не считать APK/iOS simulator актуальными builds. EAS workflow list пуст.
- GitHub `package.json` readback: script `lint` и ESLint dependency отсутствуют; CI не запускает ESLint. Отдельный lint не подтверждён/не выполнен на актуальном main.
- Desktop Commander показал `DESKTOP-2IDEH2B` Online (последний контакт 3 минуты на момент запроса), однако remote terminal/read-file вызовы не получили ответа и завершились timeout/pending. Локальный аудит был запущен, но результаты `git status`, `npm run typecheck`, `npm run lint`, `npm audit`, Expo exports, Expo Doctor и поиск placeholders не получены. Не переиспользовать прошлые локальные результаты как сегодняшние; повторить при восстановлении командного канала.
- Supabase live project, Advisors, deployed Edge Functions, Auth settings и Storage policies не проверены: Supabase skill отсутствовал в доступном списке. Production не изменялся.
- Read-only повторный просмотр main подтвердил сохраняющиеся статические риски: Telegram OAuth signup требует age metadata, которой provider не предоставляет; invitation insert policy и invitation push branch не проверяют блокировки в обе стороны; upload в `profile-photos` не enforce-ит лимит объектов, а `delete-account` list удаляет только первую страницу до 1000 объектов. Не выполнялись live tests; production SQL/Storage/Functions не изменялись.


## 12. Автоматически проверено 24.11.2026

- GitHub main остаётся на commit `fc74efc5d83ccfed42ccfa13a059b23c14ce79d1`; последний push-triggered CI run #237 завершён success. Jobs/steps read-back подтверждает успешные install, audit, Expo dependency check, Expo Doctor, TypeScript и exports Web/Android/iOS. [CI #237](https://github.com/333cloud/posidim/actions/runs/45144172365).
- Security-hardening PR #2 остаётся open/draft, не merged. Head обновлён commit `983a13f23fdc554b10afa7e660508c218ed52baf`. В его migration `enforce_blocks_on_event_invitations.sql` обнаружено, что RLS SELECT на `user_blocks` видит только записи blocker_id=auth.uid(); поэтому policy subquery не может надежно обнаружить обратную блокировку invitee. Минимальная branch-only правка добавила SECURITY DEFINER trigger для двусторонней проверки и убрала block lookup из INSERT policy. Read-back/diff подтверждены; CI #240 (PR head 983a13f) на момент записи выполняется: iOS export in progress. Не merge, не production deployment; SQL не протестирован на live DB.
- Локальный Windows проект в указанной папке доступен. Он **не является Git working tree** (git status/rev-parse сообщают not a git repository), поэтому не может быть доказанным checkout main; hash comparison показывает отличия от GitHub main в `app/index.tsx`, `app/auth/social.tsx`, `package.json`, `app.json`, обе Edge Functions. `lib/supabase.ts` и `eas.json` совпадают по Git blob hash. Local package Expo `~57.0.33`, RN `0.86.3`; GitHub main package Expo `~54.0.0`, RN `0.81.5`. Local folder имеет `assets/icon.png` и `assets/adaptive-icon.png`; main не содержит assets directory и app.json не задаёт icon. Локальные результаты нельзя переносить на main.
- На локальном (SDK57, non-Git) snapshot: `npm run typecheck` exit 0; полный `npm audit` — 0 vulnerabilities; Expo Doctor 21/21 passed; Web, Android, iOS exports завершились exit 0. `npm run lint` exit 0: 0 errors, 9 React hooks dependency warnings в `app/index.tsx` (строки 247, 358–359, 362, 373, 494–496, 628). Source не менялся; exports создали локальный `dist`.
- EAS read-only list подтверждает finished Android SDK57 preview APK builds (`90c85449...`, `aa6151e8...`) и iOS simulator SDK57 (`f3c5c99b...`); также есть старые SDK54 builds. SHA коммита отсутствует во всех, поэтому не подтверждено, что они собраны из актуального main. [Android APK 1](https://expo.dev/artifacts/eas/fbQubfub4i4yCH8CmNx4JxMXjuR_0f7SkaXaCe9hoow.apk) · [Android APK 2](https://expo.dev/artifacts/eas/QI4UmQXE7zHLTadzXtHPPMp9cxpbCuh4lDHY_MTS96g.apk) · [iOS Simulator](https://expo.dev/artifacts/eas/MDi7yoR5YemIPxiGeWQlXFTiA5r-SL07hza3C0meuWI.tar.gz). New EAS builds not started (no approved build usage budget).
- Local static scan found no empty `onPress/onClick/onSubmit` handlers; broad placeholder search matched input placeholder attributes and the intentionally disabled VK “soon” UI, not an obvious TODO/FIXME.
- Supabase production live status/Advisors/Auth/Storage/Edge deployments not checked: Supabase skill unavailable in this run. No production schema, Auth, Storage, secrets, or Edge deployments changed.
