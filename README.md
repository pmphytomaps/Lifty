# Lifty

A private, offline gym tracker for two people. Routines, set-by-set logging with
your previous session beside every set, rest timer, personal records, history
with a calendar, cardio/sports with calorie estimates, and a daily intake target
for your weight goal. No accounts, no server, no feed — your data lives in a
SQLite file on your phone and nowhere else.

Built with Expo / React Native. Android only.

## Install on a phone

1. Download `lifty.apk` (from a GitHub release, an Actions artifact, or a local build).
2. Open it on the phone; allow "install unknown apps" for your browser/file manager when asked.
3. Done. The app seeds ~730 exercises and the six PPL routines on first launch.

Each phone is fully independent. To move data between phones use
Settings → Export → JSON backup on one phone and Settings → Restore on the other.

## The keystore — read this once

Android only installs an update over an existing app when both are signed with
the **same keystore**. Lose the keystore (or its password) and the only path
forward is uninstall → reinstall, **which wipes the app's local history** unless
you restore from a JSON backup afterwards.

- Keep `lifty-release.keystore` + its password somewhere permanent (password manager, cloud drive).
- The keystore is never committed to this repo.

## CI builds (GitHub Actions)

`.github/workflows/build-apk.yml` builds, tests and signs on every push to the
default branch, and attaches the APK to a GitHub release for `v*` tags.

Signing needs four repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 lifty-release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password |
| `ANDROID_KEY_ALIAS` | `lifty` |
| `ANDROID_KEY_PASSWORD` | same as the keystore password |

Without the secrets the workflow still runs but produces a debug-signed APK,
which will NOT install over the properly signed app.

Releasing an update: bump `version` and `android.versionCode` in `app.json`,
push, tag `vX.Y.Z`, download the APK from the release, install over the old one.

## Local development

```bash
npm install
npm test            # data-layer tests (vitest + better-sqlite3)
npm run typecheck
npx expo start      # dev server (Expo Go or dev client)
```

Local release build:

```bash
npx expo prebuild --platform android
node scripts/configure-android-signing.mjs
cp /path/to/lifty-release.keystore android/app/
export LIFTY_UPLOAD_STORE_FILE=lifty-release.keystore \
       LIFTY_UPLOAD_KEY_ALIAS=lifty \
       LIFTY_UPLOAD_STORE_PASSWORD=... \
       LIFTY_UPLOAD_KEY_PASSWORD=...
cd android && ./gradlew :app:assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

## Exercise catalog

`assets/exercises.json` is committed and built by
`npm run build:catalog` from:

- [`yuhonas/free-exercise-db`](https://github.com/yuhonas/free-exercise-db) (public domain) — filtered to lifting movements and renamed to `Movement (Equipment)`
- `data/extra-exercises.json` — hand-written staples the dataset lacks
- `data/cardio-exercises.json` — sports/cardio with Compendium MET values

Calorie estimates: strength time at 5.0 MET, cardio sets at their own MET,
`kcal = MET × body-weight × hours`. Daily target = BMR (measured override or
Mifflin-St Jeor) × non-exercise activity factor + logged workouts ± goal pace.
Estimates, not medicine.

## Design

`design/` holds the approved screen designs (a Claude Design canvas built from
nine `.dc.html` artboards).
