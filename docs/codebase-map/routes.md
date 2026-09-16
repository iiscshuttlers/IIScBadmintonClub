# Routing Map

Uses `wouter` for routing.

| Route | Component |
|---|---|
| `/` | `Home` |
| `/pulse` | `Children` |
| `/tv` | `TvScoreboardIndex` |
| `/tv/overlay/:matchId?` | `ObsOverlayScoreboard` |
| `/tv/camera/:matchId?` | `Children` |
| `/tv/:matchId` | `TvScoreboard` |
| `/hub` | `Children` |
| `/legacy` | `Legacy` |
| `/hall-of-fame` | `() => { window.location.href=`${import.meta.env.BASE_URL` |
| `/gallery` | `() => { window.location.href=`${import.meta.env.BASE_URL` |
| `/events/:slug` | `TournamentDetail` |
| `/join` | `Join` |
| `/player/:id` | `Children` |
| `/player/:id/personal/*?` | `Children` |
| `/compare/:p1/:p2` | `Children` |
| `/doubles/:p1/:p2` | `Children` |
| `/marketplace` | `() => { window.location.href=`${import.meta.env.BASE_URL` |
| `/exchange` | `() => { window.location.href=`${import.meta.env.BASE_URL` |
| `/find-lost` | `() => { window.location.href=`${import.meta.env.BASE_URL` |
| `/umpire` | `() => { window.location.href=`${import.meta.env.BASE_URL` |
| `/feed/announcements` | `() => { window.location.href=`${import.meta.env.BASE_URL` |
| `/privacy` | `PrivacyPolicy` |
| `/terms` | `TermsOfService` |
| `/glossary` | `Glossary` |
| `/login-callback` | `() => {
            const [, setLoc] = useLocation();
            const { session, isInitializing ` |
| `/admin` | `Children` |
| `/tournament-admin` | `Children` |
| `/profile/setup` | `Children` |
| `/profile/subscriptions` | `Children` |
| `/settings` | `Children` |
| `/my-matches` | `Children` |
| `/standings` | `TournamentStandingsPage` |
| `/player/:id/edit` | `Children` |
| `/profile/password` | `Children` |
| `/delete-account` | `Children` |
| `/personal` | `Children` |
| `/personal/me` | `Children` |
| `/personal/player/:id` | `Children` |
| `/broadcast/:matchId` | `BroadcastOverlay` |
| `/test-umpire-engine` | `() => (
             <UmpireEngine 
               initialMatchState={{
                 id: "test-match-123",
                 status: "playing",
                 t1: { p1Name: "P1", score: 0, games: 0 ` |
| `/404` | `NotFound` |
