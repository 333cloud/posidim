# Supabase functions and migration: account deletion, moderation, push tokens

## Included
- `supabase/account_moderation_push.sql`: moderator roles, private moderation RPCs, report workflow fields, and per-user Expo push-token registry.
- `supabase/functions/delete-account/index.ts`: authenticated Edge Function that removes the user's private gallery/avatar objects and deletes the Auth user. Related database rows are removed only where existing foreign keys use ON DELETE CASCADE.
- `supabase/config.toml`: function JWT verification is handled inside the function by validating the caller's access token.

## Setup required in Supabase
1. Run `account_moderation_push.sql` in SQL Editor.
2. Deploy the Edge Function `delete-account` from the Supabase CLI.
3. Set Edge Function secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in Supabase. Never put the service role key in the app or GitHub.
4. Assign moderator accounts manually in SQL Editor, only after verifying the account UUID:
   `insert into public.user_roles(user_id, role) values ('AUTH-USER-UUID', 'admin');`
5. Confirm the actual foreign-key delete behavior for every user-owned table and storage bucket before public release. Some legacy tables may not cascade; test with a disposable account first.

## Important limitations
This commit is backend groundwork, not a claim that the features are live. The mobile/web UI for deletion and moderator review, Expo Notifications permission/token registration, and event-driven notification delivery still need to be connected and tested. Push token storage alone does not send notifications. Do not enable the feature for production until those steps are complete.
