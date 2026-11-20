# Uploading releases to Google Play

`npm run build:release` uploads the new AAB to Google Play as a **production
draft**: it shows up in Play Console under Production → Releases, but no user
gets it until it is rolled out. The upload uses the Google Play Developer API
through `scripts/play-upload.mjs` (no extra dependencies) and a service-account
key kept outside the repository. Without the key, the release script skips the
upload and says so.

## One-time setup

1. **Google Cloud project.** In [Google Cloud Console](https://console.cloud.google.com/),
   pick or create a project, then *APIs & Services → Library →
   "Google Play Android Developer API" → Enable*.
2. **Service account.** *IAM & Admin → Service accounts → Create service
   account* (for example `play-uploader`). It needs no Cloud roles.
3. **Key.** Open the service account → *Keys → Add key → Create new key →
   JSON*. Save the downloaded file as

   ```
   %USERPROFILE%\.config\iiscshuttlers\play-service-account.json
   ```

   or anywhere else outside the repo with `PLAY_SERVICE_ACCOUNT_KEY` pointing
   at it. Treat it like a password: anyone with it can publish the app.
4. **Play Console access.** In [Play Console](https://play.google.com/console/),
   *Users and permissions → Invite new users*, enter the service account's
   e-mail (`…@….iam.gserviceaccount.com`), and under *App permissions* add
   IIScShuttlers (`shuttlers.iisc.com`) with:
   - *Release to production, exclude devices, and use Play App Signing*
   - *Release apps to testing tracks*
   - *Manage testing tracks and edit tester lists* (only if you use testing tracks)

   Send the invite. New access can take a few minutes to start working.
5. **Check it.** `npm run play:upload -- --dry-run` checks the key and bundle
   offline. `npm run play:upload -- --validate` signs in and asks Play to
   validate a draft without committing anything. Validation uploads the bundle
   but then discards the edit; it fails with "version code already used" if
   that build was uploaded before.

## Everyday use

| Goal | Command |
|---|---|
| Upload the last built AAB as a production draft | `npm run play:upload` |
| Upload a specific bundle | `npm run play:upload -- --aab releases/aab/IIScShuttlers_v4.33.aab` |
| Roll out a draft to everyone | `npm run play:upload -- --existing 433 --rollout` |
| Staged rollout (e.g. 20 %) | `npm run play:upload -- --existing 433 --fraction 0.2` |
| Testing track instead | add `--track internal` (or `alpha`, `beta`) |
| Custom notes | `--notes "…"` or `--notes-file notes.txt` (max 500 characters) |

Default release notes are built from the newest `client/public/data/changelog.json`
entry: commit prefixes are stripped, docs/chore lines dropped, and the list is
cut to fit Play's 500-character limit. Edit them in Play Console before rolling
out if they read too technically. The notes language defaults to `en-US`
(override with `--lang` or `PLAY_NOTES_LANG`); it must be one of the app's
store listing languages.

If the API answers 401 or 403, the service account isn't invited in Play
Console with release rights yet, or the API isn't enabled in its Cloud project.
