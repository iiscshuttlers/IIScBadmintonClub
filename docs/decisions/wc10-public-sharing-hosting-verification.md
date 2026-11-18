# WC-10: public sharing and actual hosting

Date: 14 November 2026 (Asia/Calcutta)  
State: verified; current hosting does not satisfy route-specific crawler metadata or HTTP-success deep links

## Verified live behavior

Read-only requests were made to the deployed GitHub Pages site:

| URL shape | HTTP status | server-returned title/OG URL |
| --- | --- | --- |
| `/IIScBadmintonClub/` | 200 | Generic `IISc Shuttlers`; no canonical link |
| `/IIScBadmintonClub/tournaments/<id>` | 404 | Same generic title; `og:url` points to the site root |
| `/IIScBadmintonClub/matches/<id>` | 404 | Same generic title; `og:url` points to the site root |

The deployed `404.html` contains the SPA shell, so a browser can boot the client after a deep-link 404. Link crawlers receive a 404 and generic root metadata before JavaScript executes. Client-side `usePageMeta` changes therefore cannot provide route-specific social previews.

## What is qualified

- Match sharing uses absolute canonical public URLs and never a Capacitor/device origin.
- Winner orientation, doubles labels, walkovers and undecided-result suppression are directly tested.
- The GitHub Pages workflow copies the static `index.html` to `404.html`; it does not prerender dynamic routes.

## Decision

Do not promise rich tournament/match previews on the current host. Meeting the acceptance target requires an approved hosting change or a prerender/edge layer that returns HTTP 200 and route-specific metadata for permitted public entities while returning non-disclosing metadata for private entities. No hosting or production deployment was changed.
