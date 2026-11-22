# Android App Links: root-domain site

Shared links such as
`https://iiscshuttlers.github.io/IIScBadmintonClub/tournaments/<id>/matches/<id>`
open in the Android app when it is installed and in the browser when it is not.
For that, Android has to verify that the app owns the domain. It fetches **only**

    https://iiscshuttlers.github.io/.well-known/assetlinks.json

at the domain root. This repo's Pages site lives under `/IIScBadmintonClub/`, so the
copy in `client/public/.well-known/` (served at
`/IIScBadmintonClub/.well-known/assetlinks.json`) does not count. If the root file is
missing, Android 12+ never opens links in the app.

`org-pages-root/` is the content of the account's root Pages site, the repo
`iiscshuttlers/iiscshuttlers.github.io` (GitHub serves a repo with that exact name
at the domain root; the club repo keeps serving under `/IIScBadmintonClub/`):

| File | Purpose |
| --- | --- |
| `.well-known/assetlinks.json` | Domain verification for `shuttlers.iisc.com` |
| `.nojekyll` | Stops Jekyll from dropping the `.well-known` folder |
| `index.html` | `iiscshuttlers.github.io/` → the club site |
| `404.html` | A link missing `/IIScBadmintonClub` still lands on the right page |

## Keep the fingerprints in sync

`assetlinks.json` lists two SHA-256 certificate fingerprints:

- `76:2C:A7:…:CF:41`: Play App Signing key (what users installing from Play get).
  Check it in Play Console → Test and release → App integrity → App signing.
- `88:67:03:…:D2:9F`: upload key (`android/app/release.keystore`), used for
  sideloaded release APKs.

If either changes, update **both** copies. `client/src/lib/deepLink.test.ts` fails
when they differ.

## Publish or update the root site

1. First time only, create the repo:

   ```powershell
   gh repo create iiscshuttlers/iiscshuttlers.github.io --public --description "Root site: Android App Links verification for IISc Shuttlers"
   ```

2. Clone it and copy the files in:

   ```powershell
   gh repo clone iiscshuttlers/iiscshuttlers.github.io $env:TEMP\org-root
   ```

   ```powershell
   Copy-Item -Recurse -Force deploy\org-pages-root\* $env:TEMP\org-root\
   ```

3. Commit and push `main` in that clone.

4. First time only, after the first push, make sure Pages is on for `main`. GitHub
   usually turns it on by itself for a `<name>.github.io` repo; this returns
   `409 already enabled` when it has:

   ```powershell
   gh api -X POST repos/iiscshuttlers/iiscshuttlers.github.io/pages -f "source[branch]=main" -f "source[path]=/"
   ```

## Check it

```powershell
curl.exe -sI https://iiscshuttlers.github.io/.well-known/assetlinks.json
```

```powershell
curl.exe -s "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://iiscshuttlers.github.io&relation=delegate_permission/common.handle_all_urls"
```

The first must be `200` with `content-type: application/json`. The second must list
`shuttlers.iisc.com`.

Android verifies on install and on update. After the root file is live, users who
already have the app get in-app links from the next app update. Before that, they can
turn it on in Settings → Apps → IISc Shuttlers → Open by default → Add link.

On a test device:

```powershell
adb shell pm verify-app-links --re-verify shuttlers.iisc.com
```

```powershell
adb shell pm get-app-links shuttlers.iisc.com
```

`iiscshuttlers.github.io` must show `verified`.
