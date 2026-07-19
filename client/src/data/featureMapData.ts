export const FEATURES = [
  {c:"Match Management", items:[
    {n:"Singles Match Logging", d:"Log individual results — MS vs WS and beyond.", s:"active"},
    {n:"Doubles Match Logging", d:"MD/WD/XD with category enforcement in tournaments.", s:"active"},
    {n:"Hybrid Matches (1v2)", d:"Uneven team matches, friendly only, no ELO impact.", s:"active"},
    {n:"Cross-Gender Singles", d:"Men vs women singles, friendly only, no ELO.", s:"active"},
    {n:"Mixed-Category Doubles", d:"WD vs MD, XD vs MD etc. in friendlies, no ELO.", s:"active"},
    {n:"Offline Match Logging", d:"“Gym Mode” — log without signal, auto-sync later.", s:"active"},
  ]},
  {c:"Rankings & Ratings", items:[
    {n:"ELO Rating System", d:"Dynamic ELO recalculated on every competitive match.", s:"active"},
    {n:"Leaderboard", d:"Global and per-category boards (MS/WS/MD/WD/XD).", s:"active"},
    {n:"ELO Tier System", d:"Bronze → Grandmaster visual progression.", s:"active"},
    {n:"Hall of Fame", d:"Historical tournament winners and champions.", s:"active"},
  ]},
  {c:"Player Profiles", items:[
    {n:"Player Profiles", d:"Stats, records, and performance metrics per player.", s:"active"},
    {n:"Head-to-Head Stats", d:"Player vs player history and win/loss ratios.", s:"active"},
    {n:"Achievement Badges", d:"Unlockable badges for streaks and milestones.", s:"active"},
    {n:"Player Directory", d:"Searchable, filterable roster with departments.", s:"active"},
    {n:"Compare Players", d:"Side-by-side stat and head-to-head comparison.", s:"active"},
    {n:"Doubles Pair Profiles", d:"Dedicated stat pages for established pairs.", s:"active"},
  ]},
  {c:"Social & Community", items:[
    {n:"Buddy System", d:"Send and manage buddy requests for coordination.", s:"active"},
    {n:"Match Announcements", d:"Broadcast upcoming matches and notices.", s:"active"},
    {n:"Match Confirmations", d:"Real-time alerts for pending match confirmations.", s:"active"},
    {n:"Rivalry Tracking", d:"Surfaces intense, recurring player matchups.", s:"active"},
    {n:"Club Marketplace", d:"Buy and sell used gear among members.", s:"active"},
  ]},
  {c:"Competitions & Events", items:[
    {n:"Tournament Management", d:"Organize tournaments with brackets.", s:"active"},
    {n:"Weekly Challenges", d:"Time-limited match challenges with rewards.", s:"active"},
    {n:"Events Calendar", d:"Schedule view with holidays and events merged in.", s:"active"},
    {n:"Live Scoring", d:"Real-time score updates during tournaments.", s:"active"},
  ]},
  {c:"Umpiring", items:[
    {n:"Umpire Mode", d:"Dedicated UI for umpires to run and log matches.", s:"active"},
    {n:"Dispute Resolution", d:"Admins review and resolve disputed results.", s:"active"},
  ]},
  {c:"Content & Media", items:[
    {n:"Photo Gallery", d:"Club event and tournament photo collection.", s:"active"},
    {n:"Video Library", d:"Highlights, tutorials, and club footage.", s:"active"},
    {n:"Find & Lost Board", d:"Community board for lost/found club items.", s:"active"},
  ]},
  {c:"Predictions & Analytics", items:[
    {n:"Match Predictions", d:"AI win-probability predictions for upcoming matches.", s:"active"},
    {n:"Performance Trends", d:"Charts of player performance over time.", s:"active"},
    {n:"Match Analytics", d:"Statistical analysis of outcomes and patterns.", s:"active"},
    {n:"Shuttlecock Optical Tracking", d:"Computer vision frame-differencing shuttle tracking.", s:"active"},
    {n:"Acoustic String Tuner", d:"Audio analysis to detect racket string tension.", s:"active"},
  ]},
  {c:"Admin Tools", items:[
    {n:"Admin Dashboard", d:"Central hub for platform management and stats.", s:"active"},
    {n:"ELO Audit & Recalc", d:"Review and recompute ELO from scratch.", s:"active"},
    {n:"User & Player Mgmt", d:"Add, edit, approve, remove player accounts.", s:"active"},
    {n:"Content Management", d:"Manage flyers, announcements, holidays, events, video.", s:"active"},
    {n:"Activity Logs", d:"Audit trail of system changes and user actions.", s:"active"},
    {n:"System Settings", d:"App-wide config and push notification controls.", s:"active"},
    {n:"Guest Player Mgmt", d:"Create guest profiles, track ELO, merge later.", s:"active"},
    {n:"Maintenance Mode", d:"Site-wide banner with optional lockout controls.", s:"active"},
  ]},
  {c:"Authentication & Security", items:[
    {n:"Email & Password Auth", d:"Standard secure login.", s:"active"},
    {n:"Password Change & Reset", d:"Self-serve recovery and management.", s:"active"},
    {n:"Account Deletion", d:"Permanent removal with data cleanup.", s:"active"},
  ]},
  {c:"Platform Features", items:[
    {n:"Dark Mode", d:"Light/dark theme with persisted preference.", s:"active"},
    {n:"PWA Support", d:"Installable on mobile/desktop, works offline.", s:"active"},
    {n:"Push Notifications", d:"Match, announcement, and challenge alerts.", s:"active"},
    {n:"App Badge", d:"Native badge count for pending matches.", s:"active"},
    {n:"QR Code Scanning", d:"Scan a player's QR for quick selection.", s:"active"},
    {n:"CSV Export", d:"Export leaderboard and match data as CSV.", s:"active"},
    {n:"Responsive Design", d:"Tuned for mobile, tablet, and desktop.", s:"active"},
    {n:"Global Search", d:"Search across players, matches, announcements.", s:"active"},
    {n:"Onboarding Tour", d:"Guided walkthrough for first-time users.", s:"active"},
    {n:"Quick Settings Menu", d:"One place to toggle global preferences.", s:"active"},
  ]},
];
  
export const ANDROID = [
  {n:"tv_scoreboard", d:"Full-screen scoreboard for a Smart TV/Chromecast, live via Supabase, 5s auto-refresh."},
  {n:"floating_score_overlay", d:"Draw-over-apps score bubble using SYSTEM_ALERT_WINDOW + a foreground service."},
  {n:"umpire_bg_service", d:"Keeps scoring alive when minimized/locked; lock-screen notification with +1 buttons."},
  {n:"lock_screen_scoring", d:"Score from the notification shade; requires device unlock to prevent mis-taps."},
  {n:"exact_match_alarms", d:"AlarmManager fires a reminder 15 min before a match, even app-closed."},
  {n:"picture_in_picture", d:"Native PiP window for the umpire screen while multitasking."},
  {n:"motion_tracking", d:"Accelerometer-based intensity classifier: idle / walking / running / smash_sprint."},
  {n:"home_screen_widget", d:"AppWidgetProvider showing live score, pushed from the score engine."},
  {n:"gymkhana_geofence", d:"50m geofence around the club; auto welcome notification on entry."},
  {n:"qs_tile_umpire", d:"Quick Settings tile that deep-links straight into Umpire mode."},
];
  
export const DOMAINS = [
  {t:"Match engine & officiating", items:[
    "Multi-match umpire — atomic set writes, scoring history",
    "Rally & shot analytics — rally stats, shot tempo, stroke analytics",
    "Player paths — on-court movement tracking per match",
  ]},
  {t:"ELO, tournaments & records", items:[
    "Tournament brackets and per-category ELO",
    "ELO recalculation + rollback triggers on match delete",
    "Category record fixes (mixed-doubles detection)",
  ]},
  {t:"Player health & biometrics", items:[
    "Match health data + HRV / SpO2",
    "Player sleep data",
    "Match sensor & motion stats",
  ]},
  {t:"Teams, guests & endorsements", items:[
    "Doubles teams as first-class entities",
    "Guest players — create, claim, retire",
    "Player endorsements",
  ]},
  {t:"Marketplace", items:[
    "Listings for club gear",
    "“Want to buy” (WTB) requests",
  ]},
  {t:"Venue & presence", items:[
    "Venue presence tracking + notifications",
    "Club courts as bookable/live entities",
  ]},
  {t:"Social & notifications", items:[
    "Live match votes (realtime)",
    "Notification preference rework",
    "Match notification triggers + admin history log",
  ]},
];
  
export const DEV = [
  {n:"Path Tracing Wizard", d:"Import → calibrate homography → process → sync rally anchors → viewer. Turns a courtside video into tracked player paths."},
  {n:"AR Replay Viewer", d:"Camera overlay that redraws a player's movement path on top of live video."},
  {n:"Acoustic Tension Analyzer", d:"Uses the mic to estimate racket string tension from strike pitch."},
  {n:"Auto Highlights Recorder", d:"Rolling 15s audio-triggered buffer that clips and saves rally highlights automatically."},
  {n:"Line Call Challenge", d:"In/out line-call review flow for disputed points."},
  {n:"Shadow Drill Engine", d:"Guided solo footwork/shadow-drill trainer."},
  {n:"Screen Lock Overlay", d:"Pocket-mode screen lock with wake-lock, so umpiring doesn't fumble in a pocket."},
  {n:"Live Courts Dashboard", d:"Real-time view of which club courts are occupied right now."},
  {n:"Venue Traffic Widget", d:"Hourly check-in chart showing when the venue is typically busiest."},
  {n:"Match Analytics Section", d:"Feed-level analytics module surfacing match stats inline."},
];
  
export const UNAVAILABLE = [
  {n:"My Matches page", d:"A dedicated “my matches” view (client/src/pages/MyMatchesPage.tsx) wrapping the MyMatchesTab component.", why:"Not in App.tsx's route table — no path points here."},
  {n:"My Network page", d:"A dedicated network/buddies view (client/src/pages/MyNetworkPage.tsx).", why:"Not in App.tsx's route table — no path points here."},
  {n:"My Stats page", d:"A standalone personal stats view (client/src/pages/MyStatsPage.tsx).", why:"Not in App.tsx's route table — no path points here."},
  {n:"Player Directory", d:"Searchable, filterable player database (players-directory/tabs/DirectoryTab.tsx).", why:"Not imported by any routed page — the registry's “Player Directory” feature has nowhere to render."},
  {n:"Leaderboard", d:"Global/category leaderboards (players-directory/LeaderboardSection.tsx).", why:"Not imported by any routed page — same fate as the Directory."},
  {n:"Weekly Challenges (for players)", d:"Time-limited match challenges with rewards (feed/WeeklyChallenges.tsx).", why:"Only rendered inside the admin panel's own “Player View Preview” — never shown to an actual player."},
];
