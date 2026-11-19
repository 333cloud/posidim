# EAS builds for ПОСИДИМ

The repository contains preview and production profiles in eas.json. The Expo account owner must link the project once before cloud builds or push notifications can be completed.

## One-time project linking

1. Install or use the current EAS CLI and sign in with the Expo account that will own ПОСИДИМ.
2. Run `eas project:init` from the project root and select/create the ПОСИДИМ project.
3. Copy the generated EAS project UUID into app.json under expo.extra.eas.projectId. Do not use the local Expo device UUID.
4. Confirm the slug, owner, iOS bundle identifier and Android package name in the Expo dashboard.
5. Add the production website's /auth/confirm and /auth/callback URLs, plus posidim://auth/confirm and posidim://auth/callback, to Supabase Auth's allowed redirect URLs.
6. Configure the iOS push credentials and Android FCM credentials in EAS, then build and test on physical devices.

## Build commands

- Internal Android APK / iOS internal preview: `eas build --platform all --profile preview`
- Store builds: `eas build --platform all --profile production`
- Submit after store metadata and credentials are ready: `eas submit --platform all --profile production`

## Important

No Expo account credentials or EAS project UUID are stored in this repository. Do not commit access tokens, service-role keys, signing certificates or private push credentials. Push notifications are not considered production-ready until real device tokens and delivery have been tested.
