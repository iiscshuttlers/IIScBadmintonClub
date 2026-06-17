# Project Structure & Organization Guide

## 📁 Directory Layout

```
iiscshuttlers/
├── 📱 android/                    # Android native code
│   ├── app/
│   │   ├── build.gradle           # App-level gradle config
│   │   ├── src/
│   │   │   └── main/
│   │   │       ├── AndroidManifest.xml
│   │   │       ├── java/          # Kotlin/Java code
│   │   │       └── res/           # Resources (icons, layouts)
│   │   └── build/                 # Build outputs (APK/AAB)
│   ├── gradle.properties          # Gradle configuration
│   └── capacitor.settings.gradle  # Capacitor plugins
│
├── 🌐 client/                     # Web/React Frontend
│   ├── src/
│   │   ├── pages/                 # Page components (25+ pages)
│   │   │   ├── Home.tsx
│   │   │   ├── Leaderboard.tsx
│   │   │   ├── PlayerProfile.tsx
│   │   │   ├── Feed.tsx
│   │   │   ├── SiteAdmin.tsx
│   │   │   └── ... (20+ more)
│   │   ├── components/            # Reusable components (60+)
│   │   │   ├── admin/             # Admin-specific components
│   │   │   ├── feed/              # Feed-specific components
│   │   │   ├── events/            # Events-specific components
│   │   │   ├── player-profile/    # Profile-specific components
│   │   │   └── ui/                # Base UI components
│   │   ├── hooks/                 # Custom React hooks (15+)
│   │   │   ├── useAuth.ts
│   │   │   ├── useAutoRefresh.ts
│   │   │   ├── usePushNotifications.ts
│   │   │   └── ... (12+ more)
│   │   ├── contexts/              # React contexts
│   │   │   ├── AuthContext.tsx
│   │   │   └── ThemeContext.tsx
│   │   ├── lib/                   # Utilities and helpers
│   │   │   ├── supabase.ts        # Supabase client
│   │   │   ├── firebase.ts        # Firebase client
│   │   │   ├── tiers.ts           # ELO tier system
│   │   │   ├── admin.ts           # Admin utilities
│   │   │   ├── exportCsv.ts
│   │   │   └── ... (10+ more)
│   │   ├── data/                  # Static data
│   │   │   ├── features.ts        # Feature list (62 features)
│   │   │   └── tournamentArchive.ts
│   │   ├── types/                 # TypeScript type definitions
│   │   └── App.tsx                # Main app component
│   ├── public/
│   │   ├── data/
│   │   │   ├── app-version.json   # Version info
│   │   │   ├── changelog.json     # Changelog
│   │   │   ├── convener.png       # Leadership images
│   │   │   └── ...
│   │   └── index.html
│   └── vite.config.ts             # Vite bundler config
│
├── ⚙️ server/                      # Node.js Backend
│   └── index.ts                   # Express server
│
├── 🔧 scripts/                    # Build & release scripts
│   ├── release.mjs                # Release automation
│   └── ... (build scripts)
│
├── 📄 Config Files
│   ├── package.json               # Dependencies & scripts
│   ├── tsconfig.json              # TypeScript config
│   ├── tailwind.config.ts         # Tailwind CSS config
│   ├── vite.config.ts             # Vite build config
│   ├── capacitor.config.ts        # Capacitor config
│   ├── pnpm-lock.yaml             # Lock file (pnpm)
│   └── .eslintrc.json             # ESLint config
│
├── 📚 Documentation
│   ├── README.md                  # Main readme
│   ├── PLAYSTORE_GUIDE.md        # Play Store release guide
│   ├── PROJECT_STRUCTURE.md       # This file
│   ├── CLAUDE.md                  # Claude AI context
│   └── CONTRIBUTING.md            # Contribution guidelines
│
├── 🔐 .env files (NOT in git)
│   ├── .env.local                 # Local environment
│   ├── .env.production            # Production environment
│   └── .env.example               # Template (in git)
│
└── .gitignore                     # Git ignore rules
```

## 📦 Key Directories Explained

### `/client/src/pages/` - Page Components (23 pages)
User-facing pages, each handles one route:
- **Home.tsx** - Landing page
- **Leaderboard.tsx** - Ranking system
- **PlayerProfile.tsx** - Individual player stats
- **Feed.tsx** - Activity feed
- **SiteAdmin.tsx** - Admin control panel
- And 18+ more specialized pages

### `/client/src/components/` - Reusable Components (60+)
Organized by feature:
- **admin/** - Admin UI components (8 components)
- **feed/** - Feed widgets (5 components)
- **events/** - Event displays (4 components)
- **player-profile/** - Profile widgets (5 components)
- **ui/** - Base UI components (10 components)
- Plus shared components at root level

### `/client/src/hooks/` - Custom React Hooks (15+)
- **useAuth.ts** - Authentication logic
- **useAutoRefresh.ts** - Auto-refresh data
- **usePushNotifications.ts** - Push notifications
- **useMatchNotification.ts** - Match alerts
- And 11+ more specialized hooks

### `/client/src/lib/` - Utilities & Helpers (15+ files)
- **supabase.ts** - Supabase database client
- **firebase.ts** - Firebase services
- **tiers.ts** - ELO tier system
- **admin.ts** - Admin utilities
- **exportCsv.ts** - CSV export logic
- And more...

### `/android/app/build/outputs/` - Build Artifacts
- **apk/debug/** - Debug APKs (for testing)
- **apk/release/** - Release APKs (for distribution)
- **bundle/release/** - AAB (for Play Store)

## 🗑️ Files to Clean Up

### Safe to Delete
```
.manus-logs/                      # Temporary logs
.env.local (if committed)         # Local dev env
*.log files anywhere              # Log files
.DS_Store (macOS)                 # System files
Thumbs.db (Windows)               # System files
node_modules/ (regenerated)       # Dependencies
dist/ (regenerated)               # Build output
android/.gradle/ (regenerated)    # Gradle cache
android/app/build/ (regenerated)  # Build artifacts
.turbo/ (if exists)               # Turbo cache
```

### Must Keep
```
src/                              # Source code
public/                           # Public assets
package.json                      # Dependencies
.env.example                      # Env template
.gitignore                        # Git rules
android/gradle.properties         # Gradle config
capacitor.config.ts             # App config
```

## 🔄 Build Workflow

### Development
```bash
npm run dev              # Start dev server
npm run check            # Type checking
npm run format           # Code formatting
```

### Production Build
```bash
npm run build            # Build web app
npm run cap:sync         # Sync with Android
```

### Release Build
```bash
npm run build:apk        # Create debug APK
npm run build:aab        # Create release AAB (for Play Store)
```

## 📊 Code Statistics

| Category | Count | Files |
|----------|-------|-------|
| Pages | 23 | `/pages` |
| Components | 60+ | `/components` |
| Hooks | 15+ | `/hooks` |
| Utilities | 15+ | `/lib` |
| Admin Components | 8 | `/components/admin` |
| Total TypeScript Files | 137 | |
| Total Lines of Code | 50,000+ | |

## 🔐 Environment Files

### `.env.example` (in git, template)
```
VITE_FIREBASE_CONFIG=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_KEY=...
```

### `.env.local` (NOT in git, local only)
```
VITE_FIREBASE_CONFIG=actual_value
VITE_SUPABASE_URL=actual_url
VITE_SUPABASE_KEY=actual_key
```

### `.env.production` (NOT in git, server only)
```
NODE_ENV=production
PORT=3000
VITE_FIREBASE_CONFIG=prod_value
```

## 🎯 Organization Best Practices

### Component Organization
- Group by feature, not type
- Each component in its own folder with index.ts
- Keep related styles & types together
- One component per file

### Type Safety
- Use TypeScript for all new code
- Keep types near usage
- Share types in `/types` directory
- No `any` types without justification

### Naming Conventions
- **Components**: PascalCase (UserProfile.tsx)
- **Files**: kebab-case (user-profile.tsx)
- **Functions**: camelCase (getUserData)
- **Constants**: UPPER_SNAKE_CASE (MAX_ITEMS)
- **Interfaces**: PascalCase with I prefix (IUser)

## 📱 Android Structure

```
android/app/
├── src/
│   └── main/
│       ├── java/com/iiscshuttlers/app/
│       │   └── MainActivity.java
│       ├── res/
│       │   ├── mipmap-*/
│       │   │   └── ic_launcher.png (app icons)
│       │   ├── values/
│       │   │   └── strings.xml (app strings)
│       │   └── xml/
│       │       └── network_security_config.xml
│       └── AndroidManifest.xml
├── build.gradle                  # App config
└── proguard-rules.pro           # Code obfuscation
```

## 🚀 Performance Optimization

### Webpack/Vite Optimization
- Tree shaking enabled
- Code splitting by route
- Lazy loading of components
- Image optimization

### Android Optimization
- ProGuard code obfuscation
- Resource shrinking
- Minification enabled
- AAB format for Play Store

## 📋 Checklist for New Features

1. [ ] Create component in appropriate `/components` subdirectory
2. [ ] Add TypeScript types to `/types` if needed
3. [ ] Create hook in `/hooks` if stateful logic needed
4. [ ] Add utility functions to `/lib` if reusable
5. [ ] Create page in `/pages` if new route
6. [ ] Update routing in `App.tsx`
7. [ ] Add feature to `/data/features.ts`
8. [ ] Test on multiple devices
9. [ ] Update documentation
10. [ ] Commit with clear message

---

**Last Updated**: June 17, 2026  
**Status**: Systematic and Clean ✅
