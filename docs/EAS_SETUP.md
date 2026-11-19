# EAS builds for ПОСИДИМ

The repository contains preview and production profiles in eas.json. The Expo account owner must link the project once before cloud builds or push notifications can be completed.

## One-time project linking

1. Install the EAS CLI (`npm install --global eas-cli`) and sign in with the Expo account that will own ПОСИДИМ (`eas login`).
2. Run `eas init` from the project root and select/create the ПОСИДИМ project. This links the app and normally writes expo.extra.eas.projectId and expo.owner into app.json.
3. Confirm app.json contains the generated EAS project UUID. Do not use the local Expo device UUID.
4. Confirm the slug, owner, iOS bundle identifier and Android package name in the Expo dashboard.
5. Add the production website's /auth/confirm and /auth/callback URLs, plus posidim://auth/confirm and posidim://auth/callback, to Supabase Auth's allowed redirect URLs.
6. Configure the iOS push credentials and Android FCM credentials in EAS, then build and test on physical devices.

## Build commands

- Internal Android APK / iOS internal preview: `eas build --platform all --profile preview`
- Store builds: `eas build --platform all --profile production`
- Submit after store metadata and credentials are ready: `eas submit --platform all --profile production`

## Important

No Expo account credentials or EAS project UUID are stored in this repository. Do not commit access tokens, service-role keys, signing certificates or private push credentials. Push notifications are not considered production-ready until real device tokens and delivery have been tested.

## Supabase Auth and web hosting

Add these URLs in Supabase Dashboard → Authentication → URL Configuration:

- posidim://auth/confirm
- posidim://auth/callback
- http://localhost:8081/auth/confirm
- http://localhost:8081/auth/callback
- https://YOUR_WEB_DOMAIN/auth/confirm
- https://YOUR_WEB_DOMAIN/auth/callback

Set the production Site URL to the actual web domain. Replace YOUR_WEB_DOMAIN with the real host; do not add a placeholder URL.

The web host must serve the Expo SPA entry point for /auth/confirm and /auth/callback (history fallback to index.html), otherwise email links may return a 404 before the app can process the PKCE code.

In Supabase Dashboard → Authentication → Sign In / Providers → Email, enable “Prevent use of leaked passwords”. Supabase currently offers this HaveIBeenPwned check on Pro plans and above; if this project is on Free, the setting cannot be enabled without upgrading. Supabase Advisor currently reports it as disabled.
