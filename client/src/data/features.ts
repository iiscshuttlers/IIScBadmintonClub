/**
 * Comprehensive features list for IISc Badminton Club App
 * Used for admin feature tracking and documentation
 */

export interface Feature {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "active" | "beta" | "coming-soon";
  icon: string;
}

export const FEATURES: Feature[] = [
  // ── Match Management ──
  {
    id: "match-logging-singles",
    name: "Singles Match Logging",
    description: "Log individual badminton match results (man vs woman, MS vs WS, etc.)",
    category: "Match Management",
    status: "active",
    icon: "Sword",
  },
  {
    id: "match-logging-doubles",
    name: "Doubles Match Logging",
    description: "Log team badminton matches (MD, WD, XD with category enforcement in tournaments)",
    category: "Match Management",
    status: "active",
    icon: "Users",
  },
  {
    id: "hybrid-matches",
    name: "Hybrid Matches (1v2)",
    description: "Log uneven team matches (one player vs two), friendly only, no ELO impact",
    category: "Match Management",
    status: "active",
    icon: "Zap",
  },
  {
    id: "cross-gender-singles",
    name: "Cross-Gender Singles",
    description: "Allow men and women to play singles against each other (friendly only, no ELO)",
    category: "Match Management",
    status: "active",
    icon: "Heart",
  },
  {
    id: "mixed-category-doubles",
    name: "Mixed-Category Doubles",
    description: "Allow WD vs MD, XD vs MD, etc. in friendly matches (no ELO impact)",
    category: "Match Management",
    status: "active",
    icon: "GitMerge",
  },
  {
    id: "offline-match-logging",
    name: "Offline Match Logging (Gym Mode)",
    description: "Log matches without internet connection, sync automatically when reconnected",
    category: "Match Management",
    status: "active",
    icon: "WifiOff",
  },

  // ── Rankings & Ratings ──
  {
    id: "elo-ratings",
    name: "ELO Rating System",
    description: "Dynamic ELO rating calculations for competitive matches",
    category: "Rankings & Ratings",
    status: "active",
    icon: "TrendingUp",
  },
  {
    id: "leaderboard",
    name: "Leaderboard",
    description: "Global and category-specific leaderboards (MS, WS, MD, WD, XD)",
    category: "Rankings & Ratings",
    status: "active",
    icon: "Trophy",
  },
  {
    id: "elo-tiers",
    name: "ELO Tier System",
    description: "Bronze → Grandmaster tier visualization and progression",
    category: "Rankings & Ratings",
    status: "active",
    icon: "Crown",
  },
  {
    id: "hall-of-fame",
    name: "Hall of Fame",
    description: "Historical tournament winners and champions display",
    category: "Rankings & Ratings",
    status: "active",
    icon: "Award",
  },

  // ── Player Profiles ──
  {
    id: "player-profiles",
    name: "Player Profiles",
    description: "Detailed player stats, records, and performance metrics",
    category: "Player Profiles",
    status: "active",
    icon: "User",
  },
  {
    id: "head-to-head",
    name: "Head-to-Head Stats",
    description: "Player vs Player historical match records and win/loss ratios",
    category: "Player Profiles",
    status: "active",
    icon: "GitCompare",
  },
  {
    id: "achievement-badges",
    name: "Achievement Badges",
    description: "Unlockable badges for milestones (10-match streak, etc.)",
    category: "Player Profiles",
    status: "active",
    icon: "Badge",
  },
  {
    id: "player-directory",
    name: "Player Directory",
    description: "Searchable, filterable player database with departments",
    category: "Player Profiles",
    status: "active",
    icon: "Users",
  },
  {
    id: "compare-players",
    name: "Compare Players",
    description: "Side-by-side player statistics and head-to-head comparison",
    category: "Player Profiles",
    status: "active",
    icon: "Scale",
  },

  // ── Social & Community ──
  {
    id: "buddy-system",
    name: "Buddy System",
    description: "Send and manage buddy requests for team coordination",
    category: "Social & Community",
    status: "active",
    icon: "Handshake",
  },
  {
    id: "match-announcements",
    name: "Match Announcements",
    description: "Broadcast upcoming matches and important notifications",
    category: "Social & Community",
    status: "active",
    icon: "Megaphone",
  },
  {
    id: "match-chat",
    name: "Match Confirmations & Notifications",
    description: "Real-time notifications for pending match confirmations",
    category: "Social & Community",
    status: "active",
    icon: "Bell",
  },
  {
    id: "rivalries",
    name: "Rivalry Tracking",
    description: "Track intense player rivalries and competitive matchups",
    category: "Social & Community",
    status: "active",
    icon: "Flame",
  },

  // ── Competitions & Events ──
  {
    id: "tournaments",
    name: "Tournament Management",
    description: "Organize and manage badminton tournaments with brackets",
    category: "Competitions & Events",
    status: "active",
    icon: "Trophy",
  },
  {
    id: "weekly-challenges",
    name: "Weekly Challenges",
    description: "Time-limited match challenges with rewards",
    category: "Competitions & Events",
    status: "active",
    icon: "Target",
  },
  {
    id: "events-calendar",
    name: "Events Calendar",
    description: "Schedule view with integrated holidays and event management",
    category: "Competitions & Events",
    status: "active",
    icon: "Calendar",
  },
  {
    id: "live-scoring",
    name: "Live Scoring",
    description: "Real-time match score updates during tournaments",
    category: "Competitions & Events",
    status: "active",
    icon: "Activity",
  },

  // ── Umpiring ──
  {
    id: "umpire-mode",
    name: "Umpire Mode",
    description: "Dedicated UI for umpires to log and manage match scores",
    category: "Umpiring",
    status: "active",
    icon: "Whistle",
  },
  {
    id: "umpire-dispute-resolution",
    name: "Match Dispute Resolution",
    description: "Admins can review and resolve disputed match results",
    category: "Umpiring",
    status: "active",
    icon: "AlertTriangle",
  },

  // ── Content & Media ──
  {
    id: "photo-gallery",
    name: "Photo Gallery",
    description: "Collection of club event and tournament photographs",
    category: "Content & Media",
    status: "active",
    icon: "Image",
  },
  {
    id: "video-library",
    name: "Video Library",
    description: "Match highlights, tutorial videos, and club footage",
    category: "Content & Media",
    status: "active",
    icon: "Video",
  },
  {
    id: "find-lost-board",
    name: "Find & Lost Board",
    description: "Community board for lost/found items at the club",
    category: "Content & Media",
    status: "active",
    icon: "Search",
  },

  // ── Predictions & Analytics ──
  {
    id: "match-predictions",
    name: "Match Predictions",
    description: "AI-powered win probability predictions for upcoming matches",
    category: "Predictions & Analytics",
    status: "active",
    icon: "Brain",
  },
  {
    id: "performance-trends",
    name: "Performance Trends",
    description: "Visual charts showing player performance over time",
    category: "Predictions & Analytics",
    status: "active",
    icon: "TrendingUp",
  },
  {
    id: "match-analytics",
    name: "Match Analytics",
    description: "Statistical analysis of match outcomes and patterns",
    category: "Predictions & Analytics",
    status: "active",
    icon: "BarChart3",
  },

  // ── Admin Tools ──
  {
    id: "admin-dashboard",
    name: "Admin Dashboard",
    description: "Central hub for platform management and statistics",
    category: "Admin Tools",
    status: "active",
    icon: "Activity",
  },
  {
    id: "elo-audit",
    name: "ELO Audit & Recalculation",
    description: "Review and recalculate ELO ratings from scratch if needed",
    category: "Admin Tools",
    status: "active",
    icon: "BarChart2",
  },
  {
    id: "user-management",
    name: "User & Player Management",
    description: "Add, edit, approve, and remove player accounts",
    category: "Admin Tools",
    status: "active",
    icon: "Users",
  },
  {
    id: "content-management",
    name: "Content Management",
    description: "Manage flyers, announcements, holidays, events, and videos",
    category: "Admin Tools",
    status: "active",
    icon: "Paintbrush",
  },
  {
    id: "activity-logs",
    name: "Activity Logs & Audit Trail",
    description: "Track all system changes and user activities",
    category: "Admin Tools",
    status: "active",
    icon: "ClipboardList",
  },
  {
    id: "system-settings",
    name: "System Settings",
    description: "Configure app-wide settings and push notifications",
    category: "Admin Tools",
    status: "active",
    icon: "Settings",
  },

  // ── Authentication & Security ──
  {
    id: "email-password-auth",
    name: "Email & Password Authentication",
    description: "Secure login with email and password",
    category: "Authentication & Security",
    status: "active",
    icon: "Lock",
  },
  {
    id: "password-reset",
    name: "Password Change & Reset",
    description: "Secure password management and recovery",
    category: "Authentication & Security",
    status: "active",
    icon: "KeyRound",
  },
  {
    id: "account-deletion",
    name: "Account Deletion",
    description: "Permanent account removal with data cleanup",
    category: "Authentication & Security",
    status: "active",
    icon: "Trash2",
  },

  // ── Platform Features ──
  {
    id: "dark-mode",
    name: "Dark Mode / Theme Switching",
    description: "Light and dark theme support with persistent preference",
    category: "Platform Features",
    status: "active",
    icon: "Moon",
  },
  {
    id: "pwa-support",
    name: "Progressive Web App (PWA)",
    description: "Install as app on mobile/desktop, offline capability",
    category: "Platform Features",
    status: "active",
    icon: "Download",
  },
  {
    id: "push-notifications",
    name: "Push Notifications",
    description: "Match updates, announcements, and challenge alerts",
    category: "Platform Features",
    status: "active",
    icon: "Bell",
  },
  {
    id: "app-badge",
    name: "App Badge (Pending Matches)",
    description: "Native app badge showing pending match count on home screen",
    category: "Platform Features",
    status: "active",
    icon: "Badge",
  },
  {
    id: "qr-code-scanning",
    name: "QR Code Scanning",
    description: "Scan player QR codes for quick selection in match logging",
    category: "Platform Features",
    status: "active",
    icon: "QrCode",
  },
  {
    id: "csv-export",
    name: "CSV Export",
    description: "Export leaderboard and data as CSV files",
    category: "Platform Features",
    status: "active",
    icon: "Download",
  },
  {
    id: "responsive-design",
    name: "Responsive Design",
    description: "Optimized for mobile, tablet, and desktop devices",
    category: "Platform Features",
    status: "active",
    icon: "Smartphone",
  },
  {
    id: "search-functionality",
    name: "Global Search",
    description: "Quick search across players, matches, and announcements",
    category: "Platform Features",
    status: "active",
    icon: "Search",
  },
  {
    id: "club-marketplace",
    name: "Club Marketplace",
    description: "A hub for members to buy and sell used badminton gear",
    category: "Social & Community",
    status: "active",
    icon: "Target",
  },
  {
    id: "guest-management",
    name: "Guest Player Management",
    description: "Create guest profiles, track their ELO, and merge them later",
    category: "Admin Tools",
    status: "active",
    icon: "Users",
  },
  {
    id: "onboarding-tour",
    name: "Interactive Onboarding Tour",
    description: "A guided walkthrough for new users to understand the app",
    category: "Platform Features",
    status: "active",
    icon: "Brain",
  },
  {
    id: "doubles-pair-profiles",
    name: "Doubles Pair Profiles",
    description: "Dedicated statistical profiles for established doubles teams",
    category: "Player Profiles",
    status: "active",
    icon: "Users",
  },
  {
    id: "quick-settings",
    name: "Quick Settings Menu",
    description: "A universally accessible menu for toggling global preferences",
    category: "Platform Features",
    status: "active",
    icon: "Settings",
  },
  {
    id: "maintenance-mode",
    name: "Maintenance Mode",
    description: "Global site-wide maintenance banner with optional lockout controls",
    category: "Admin Tools",
    status: "active",
    icon: "AlertTriangle",
  },

  // ── Native Android Features ──
  {
    id: "tv-scoreboard",
    name: "TV Scoreboard Mode",
    description: "Full-screen, Olympic-style scoreboard optimized for large displays. Open on any Smart TV, Chromecast, or desktop browser — scores update in real-time via Supabase as the umpire taps their phone. Supports auto-refresh every 5 seconds and a cinematic dark theme with giant score digits.",
    category: "Native Android",
    status: "active",
    icon: "Tv2",
  },
  {
    id: "floating-score-overlay",
    name: "Floating Score Overlay",
    description: "Draw-over-apps overlay that displays the live match score as a draggable bubble on top of any app. Uses Android's SYSTEM_ALERT_WINDOW permission and a foreground service to persist across app switches. Umpires can glance at the score while using other apps.",
    category: "Native Android",
    status: "active",
    icon: "Smartphone",
  },
  {
    id: "background-service",
    name: "Umpire Background Service",
    description: "Android foreground service that keeps the scoring engine alive even when the app is minimized or the screen is locked. Shows a persistent notification with the live score and +1 point buttons for each team — umpires can score directly from the lock screen without unlocking the device.",
    category: "Native Android",
    status: "active",
    icon: "Activity",
  },
  {
    id: "interactive-notifications",
    name: "Interactive Lock Screen Scoring",
    description: "Rich notification actions that let the umpire add points to either team directly from the Android notification shade or lock screen. Uses setAuthenticationRequired(true) to require device unlock before actions execute, preventing accidental taps.",
    category: "Native Android",
    status: "active",
    icon: "Bell",
  },
  {
    id: "match-alarms",
    name: "Exact Match Alarms",
    description: "Scheduled exact alarms (AlarmManager.setExactAndAllowWhileIdle) that fire 15 minutes before a match starts. Uses a BroadcastReceiver to show a gentle notification reminder even if the app is completely closed. Requires SCHEDULE_EXACT_ALARM permission on Android 12+.",
    category: "Native Android",
    status: "active",
    icon: "Calendar",
  },
  {
    id: "picture-in-picture",
    name: "Picture-in-Picture (PiP) Mode",
    description: "Shrinks the umpire screen into a small floating window using Android's native PiP API. Stays on top of all apps so the umpire can reference scores while multitasking. Requires android:supportsPictureInPicture='true' in the manifest. Toggle via the PiP button in the Umpire Engine.",
    category: "Native Android",
    status: "active",
    icon: "Tv2",
  },
  {
    id: "player-motion-tracking",
    name: "Player Motion Tracking (Accelerometer)",
    description: "Real-time movement intensity tracking using Android's TYPE_LINEAR_ACCELERATION sensor via SensorManager. Calculates magnitude from raw X/Y/Z vectors and classifies activity into idle, walking, running, or smash_sprint. Toggle on/off in the Umpire Engine to monitor physical intensity during a match.",
    category: "Native Android",
    status: "active",
    icon: "Activity",
  },
  {
    id: "home-screen-widget",
    name: "Home Screen Widget",
    description: "Native Android AppWidgetProvider that displays live match scores right on the phone's home screen. The React app pushes score updates to the widget via WidgetManagerPlugin whenever a point is scored. Shows team names, current score, and tournament name in a compact widget layout.",
    category: "Native Android",
    status: "active",
    icon: "Smartphone",
  },
  {
    id: "geofencing",
    name: "Gymkhana Geofencing (Auto Check-in)",
    description: "Uses Google Play Services GeofencingClient to create a 50-meter virtual radius around the IISc Gymkhana (13.0186°N, 77.5647°E). When a user enters the geofence, a background BroadcastReceiver fires a gentle welcome notification: 'Welcome to Gymkhana! Tap to see today\\'s matches.' Requires ACCESS_FINE_LOCATION and ACCESS_BACKGROUND_LOCATION.",
    category: "Native Android",
    status: "active",
    icon: "Target",
  },
  {
    id: "quick-settings-tile",
    name: "Quick Settings Tile (Umpire Launch)",
    description: "Android TileService that adds an 'Umpire Match' tile to the Quick Settings pull-down panel. Tapping it deep-links into the app via iiscshuttlers://umpire scheme, routing directly to the My Matches tab. Available to all users — non-umpires simply see their own matches without any umpire controls.",
    category: "Native Android",
    status: "active",
    icon: "Zap",
  }
];

export function getFeaturesByCategory(category: string): Feature[] {
  return FEATURES.filter((f) => f.category === category);
}

export function getFeatureStats() {
  return {
    total: FEATURES.length,
    active: FEATURES.filter((f) => f.status === "active").length,
    beta: FEATURES.filter((f) => f.status === "beta").length,
    comingSoon: FEATURES.filter((f) => f.status === "coming-soon").length,
    categories: Array.from(new Set(FEATURES.map((f) => f.category))).sort(),
  };
}
