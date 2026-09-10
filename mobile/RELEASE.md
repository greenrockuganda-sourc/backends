# Mobile release guide

The project is configured for installable Android and iOS builds:

- Android application ID: `com.greenrockuganda.grow`
- iOS bundle ID: `com.greenrockuganda.grow`
- API: `https://backends-production-3d0b.up.railway.app`

## One-time setup

1. Create or sign in to an Expo account, an Apple Developer account, and a Google Play Developer account.
2. From this folder, run `npx eas-cli@latest login`.
3. Run `npx eas-cli@latest build:configure` and accept the prompt to link this project to the Expo account. This adds the Expo project ID to the app configuration.
4. Confirm that `com.greenrockuganda.grow` is available in both Apple Developer and Google Play Console before the first production build. Change the two identifiers in `app.json` together if it is unavailable.

## Share directly with testers

Build an Android APK that can be downloaded and installed from the EAS build link:

```sh
npx eas-cli@latest build --platform android --profile preview
```

Build an iOS internal-distribution IPA for registered Apple devices:

```sh
npx eas-cli@latest build --platform ios --profile preview
```

Apple requires the test devices to be registered to the Apple Developer account for direct IPA installation. TestFlight is simpler for wider iPhone testing.

## Store release

Build Android and iOS store artifacts:

```sh
npx eas-cli@latest build --platform all --profile production
```

The Android build is an AAB for Google Play. The iOS build is an IPA for TestFlight/App Store Connect. Submit each completed build from EAS, or run:

```sh
npx eas-cli@latest submit --platform android --latest
npx eas-cli@latest submit --platform ios --latest
```

Before each production release, update `expo.version` in `app.json`. EAS increments Android `versionCode` and iOS `buildNumber` automatically for production builds.
