# Настройка авторизации ПОСИДИМ

В приложении добавлены интерфейсы и клиентские обработчики для входа по email, телефону (SMS OTP), Telegram и VK ID. Внешние провайдеры нужно включить отдельно: без их Client ID/Secret и SMS-реквизитов кнопки не смогут завершить авторизацию.

## 1. Телефон и SMS-код

В Supabase Dashboard открой **Authentication → Sign In / Providers → Phone**:

1. Включи Phone provider.
2. Подключи SMS-провайдера (Twilio, Vonage или MessageBird) и укажи его учётные данные.
3. Настрой шаблон SMS с переменной OTP.
4. Настрой разумные лимиты отправки и CAPTCHA/rate limiting перед публичным запуском.
5. Добавь тестовый номер и фиксированный код, если хочешь проверить интерфейс без реальной отправки SMS.

В приложении номер вводится в международном формате E.164, например `+37255555555`. После отправки SMS пользователь вводит шестизначный код. Для регистрации также заполняются имя, возраст 18+ и город.

## 2. Telegram Login (OIDC)

1. Создай бота через [@BotFather](https://t.me/BotFather).
2. В настройках бота открой **Login Widget** и переключи авторизацию на **OpenID Connect Login**.
3. Добавь callback Supabase в список разрешённых Redirect URI:

   `https://romsqawhikabdtwsrxkb.supabase.co/auth/v1/callback`

4. Сохрани Client ID и Client Secret из BotFather.
5. В Supabase Dashboard открой раздел Custom OAuth/OIDC Providers и создай провайдера:
   - Type: OIDC
   - Identifier: `custom:telegram`
   - Name: `Telegram`
   - Issuer: `https://oauth.telegram.org`
   - Scopes: `openid profile`
   - Email optional: enabled
   - Client ID / Client Secret: значения из BotFather

Telegram не передаёт email по умолчанию, поэтому email optional обязателен. Не помещай Client Secret в приложение или репозиторий.

## 3. VK ID

Кнопка VK ID временно помечена «Скоро» и отключена, поскольку реальный OAuth 2.1 обмен не реализован. Не считать VK ID доступным входом.

Новые приложения VK ID используют Authorization Code + PKCE и дополнительные параметры/данные обмена, в том числе `device_id`. Это не тот же самый старый OAuth ВКонтакте. Стандартный generic OAuth-провайдер Supabase нельзя считать совместимым без проверки полного обмена кода и получения профиля. Нужны приложение VK ID и его Client ID, redirect URI, а также серверный адаптер, который безопасно выполняет обмен PKCE и проверяет ответ VK. Client Secret и verifier никогда не должны попадать в клиентские логи или публичный код.

После получения данных приложения VK можно закончить серверную интеграцию и проверить вход на web, Android и iOS. Пока провайдер не зарегистрирован, Supabase вернёт ошибку о ненастроенном provider.

## 4. Redirect URLs приложения

В Supabase Dashboard → Authentication → URL Configuration добавь:

- `posidim://auth/social`
- `https://<домен-развёрнутого-web-приложения>/auth/social`

Web URL должен соответствовать реальному домену публикации. Маршрут `/auth/social` обменивает PKCE code на сессию Supabase.

## Проверка перед запуском

- Провести вход новым пользователем и повторный вход существующего пользователя каждым способом.
- Убедиться, что Telegram/VK не создают дубли при повторном входе.
- Проверить восстановление сессии после закрытия и повторного открытия приложения.
- Проверить Android и iOS на реальных устройствах.
- Ограничить SMS rate limits и включить CAPTCHA.
- Не запрашивать и не сохранять телефон, если он не нужен; не показывать его другим пользователям.
