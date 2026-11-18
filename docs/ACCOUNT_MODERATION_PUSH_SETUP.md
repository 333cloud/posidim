# Supabase functions and migration: account deletion, moderation, push tokens

## Included
- `supabase/account_moderation_push.sql`: moderator roles, private moderation RPCs, report workflow fields, and per-user Expo push-token registry.
- `supabase/functions/delete-account/index.ts`: authenticated Edge Function that removes the user's private gallery/avatar objects and deletes the Auth user. Related database rows are removed only where existing foreign keys use ON DELETE CASCADE.
- `supabase/config.toml`: function JWT verification is handled inside the function by validating the caller's access token.

## Setup required in Supabase
1. Run `account_moderation_push.sql` in SQL Editor.
2. Deploy the Edge Function `delete-account` from the Supabase CLI.
3. Supabase provides `SUPABASE_URL` and its platform service key to Edge Functions. If you are using the newer `sb_secret_` API key instead of the deprecated legacy service-role key, add it in Edge Functions → Secrets as `POSIDIM_SERVICE_ROLE_KEY`. The functions accept the platform `SUPABASE_SERVICE_ROLE_KEY` or this custom secret. Never put either key in the app or GitHub.
4. Assign moderator accounts manually in SQL Editor, only after verifying the account UUID:
   `insert into public.user_roles(user_id, role) values ('AUTH-USER-UUID', 'admin');`
5. Confirm the actual foreign-key delete behavior for every user-owned table and storage bucket before public release. Some legacy tables may not cascade; test with a disposable account first.

## Important limitations
This commit is backend groundwork, not a claim that the features are live. The mobile/web UI for deletion and moderator review, Expo Notifications permission/token registration, and event-driven notification delivery still need to be connected and tested. Push token storage alone does not send notifications. Do not enable the feature for production until those steps are complete.
\n## Current implementation status\n\n- Account deletion UI is present in the Profile tab and calls the authenticated `delete-account` Edge Function. It is not live until the SQL migration and function are deployed, and a disposable account has been tested.\n- Moderator review UI is shown only when `is_posidim_moderator()` returns true. Queue access and status changes are guarded by server-side role checks. Assign a moderator/admin role manually in SQL Editor.\n- Expo push registration is attempted on iOS/Android when an EAS project ID is configured in app config. Web preview does not support this native push flow.\n- Client event hooks call the verified `send-notification` function after likes, direct/group messages and invitations. Push delivery has not been verified on physical devices.\n- Account deletion cleanup depends on the existing foreign keys using `ON DELETE CASCADE`; audit every user-owned table and nested Storage object paths before public release.\n