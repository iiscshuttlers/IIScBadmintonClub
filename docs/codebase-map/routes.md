# Routing Map

Uses `wouter` for routing.

| Route | Component |
|---|---|
| `/` | `Home` |
| `/pulse` | `Children` |
| `/tv` | `TvScoreboardIndex` |
| `/tv/draw/:tournamentId?` | `TvDrawReveal` |
| `/tv/next/:tournamentId` | `TvNextUp` |
| `/predict/:tournamentId` | `BracketPredictPage` |
| `/rate/:tournamentId` | `RateTournamentPage` |
| `/tv/overlay/:matchId?` | `ObsOverlayScoreboard` |
| `/tv/camera/:matchId?` | `Children` |
| `/tv/:matchId` | `TvScoreboard` |
| `/club` | `Children` |
| `/hub` | `() => { window.location.replace(`${import.meta.env.BASE_URL` |
| `/legacy` | `Legacy` |
| `/hall-of-fame` | `() => { window.location.href=`${import.meta.env.BASE_URL` |
| `/gallery` | `() => { window.location.href=`${import.meta.env.BASE_URL` |
| `/events/:slug` | `TournamentDetail` |
| `/tournaments` | `TournamentsHub` |
| `/tournaments/:id/matches/:matchId/:mtab?` | `TournamentMatchPage` |
| `/tournaments/:id/venue` | `VenueScoreboardPage` |
| `/tournaments/:id/scoreboard` | `VenueScoreboardPage` |
| `/tournaments/:id/:tab?` | `TournamentPage` |
| `/matches/:matchId` | `MatchShortRedirect` |
| `/team-hub/:id` | `Children` |
| `/join-team/:token` | `Children` |
| `/tournament-setup/:id` | `Children` |
| `/join` | `Join` |
| `/auth` | `() => {
            window.location.replace(`${import.meta.env.BASE_URL` |
| `/player/:id` | `Children` |
| `/player/:id/personal/*?` | `Children` |
| `/h2h` | `Children` |
| `/compare/:p1/:p2` | `Children` |
| `/doubles/:p1/:p2` | `Children` |
| `/marketplace` | `() => { window.location.href=`${import.meta.env.BASE_URL` |
| `/exchange` | `() => { window.location.href=`${import.meta.env.BASE_URL` |
| `/find-lost` | `() => { window.location.href=`${import.meta.env.BASE_URL` |
| `/umpire` | `OfficiatePage` |
| `/officiate` | `OfficiatePage` |
| `/feed/announcements` | `() => { window.location.href=`${import.meta.env.BASE_URL` |
| `/privacy` | `PrivacyPolicy` |
| `/terms` | `TermsOfService` |
| `/glossary` | `Glossary` |
| `/verify/:code?` | `VerifyCertificate` |
| `/host-tournament` | `HostTournament` |
| `/host-tournament/new` | `HostTournamentWizard` |
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
| `/personal/me` | `() => { window.location.replace(`${import.meta.env.BASE_URL` |
| `/personal/player/:id` | `({ params ` |
| `/test-umpire-engine` | `() => (
             <UmpireEngine 
               initialMatchState={{
                 id: "test-match-123",
                 umpireId: "test-user-123",
                 umpireName: "Test Umpire",
                 isFriendly: true,
                 status: "playing",
                 t1: { p1Id: "test-player-1", p1Name: "P1", score: 0, games: 0 ` |
| `/404` | `NotFound` |
