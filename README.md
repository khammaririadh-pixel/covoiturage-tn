# Covoiturage TN

Carpooling app for Tunisia (FR / AR / EN), built with Expo (React Native).

## Run it on your phone

1. Install Node.js LTS: https://nodejs.org
2. In this folder:
   ```
   npm install
   npx expo install --fix
   npx expo start
   ```
3. Install **Expo Go** on your phone and scan the QR code.

## Try the booking flow on one phone

1. Bookings tab → set your name to `Sami` → Publish a ride.
2. Change your name to `Lina` → Home → request a seat on Sami's ride.
3. Change your name back to `Sami` → Bookings → approve the request.

Data is saved on the device (AsyncStorage), so it survives closing the app.

## Build the APK on GitHub (no Node needed on your PC)

Every push to `main` runs `.github/workflows/build-apk.yml`. When the run is green
(Actions tab, ~10–15 min), open it and download **covoiturage-tn-apk** at the bottom.
Unzip it and install `app-release.apk` on an Android phone (allow "install unknown apps").
You can also start a build by hand: Actions → Build Android APK → Run workflow.

## Build an installable APK with Expo EAS (alternative)

```
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

## Not done yet

- Shared backend (rides and requests only live on one phone for now)
- Real accounts / phone sign-in
- Date & time pickers, list of Tunisian cities
- App icon and splash screen
