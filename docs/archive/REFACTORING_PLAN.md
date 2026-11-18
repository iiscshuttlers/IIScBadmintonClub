# IISc Shuttlers — Code Quality Refactoring Plan (Unified)

> **Created:** 2026-06-24  
> **Goal:** Upgrade code quality, scalability, maintainability, and aggressive decentralization of the React application by dismantling the UI-heavy "God Components" and extracting complex domain logic into dedicated state machines/hooks, without changing any functionality.

---

## Table of Contents

1. [Current Architecture](#1-current-architecture)
2. [Critical Problems Identified](#2-critical-problems-identified)
3. [Round 1: Foundation & Decentralization](#3-round-1-foundation--decentralization)
    - [Phase 1: Shared Type System](#phase-1-shared-type-system)
    - [Phase 2: Extract Shared Utilities](#phase-2-extract-shared-utilities)
    - [Phase 3: Data Access Layer](#phase-3-data-access-layer)
    - [Phase 4: Break Up God Components](#phase-4-break-up-god-components)
    - [Phase 5: Context Decomposition](#phase-5-context-decomposition)
    - [Phase 6: Cleanup & Hygiene](#phase-6-cleanup--hygiene)
4. [Round 2: UI Decomposition & Performance](#4-round-2-ui-decomposition--performance)
    - [Phase 7: PlayerProfile Decomposition](#phase-7-playerprofiletsx-decomposition-complete---surgical)
    - [Phase 8: UmpireEngine Domain Extraction](#phase-8-umpireenginetsx-domain-extraction-complete)
    - [Phase 9: PlayersDirectory Decomposition](#phase-9-playersdirectorytsx-decomposition-complete)
    - [Phase 10: Lazy Loading & Code Splitting](#phase-10-lazy-loading--code-splitting-complete)
5. [Round 3: UI Unification & Feature Enhancements](#5-round-3-ui-unification--feature-enhancements)
    - [Phase 11: Match Score Rendering Standardization](#phase-11-match-score-rendering-standardization-complete)
    - [Phase 12: Advanced Poll Management Integration](#phase-12-advanced-poll-management-integration-complete)
6. [Verification Checklist](#6-verification-checklist)
7. [Next Steps](#7-next-steps)

---

## 1. Current Architecture

```
iiscshuttlers/
├── client/src/
│   ├── App.tsx              # Root: providers, routing, global hooks
│   ├── pages/               # 23 page components
│   ├── components/          # 40+ components in subdirectories
│   ├── contexts/            # AuthContext, ThemeContext, AdminHistoryContext
│   ├── hooks/               # Custom hooks for logic and state
│   ├── lib/                 # Utility modules + supabase client + umpire logic
│   ├── data/                # Static data (features, tournament archive)
│   └── types/               # Type definitions
├── server/index.ts          # Express static file server
├── supabase/migrations/     # 12 timestamped migrations
├── database/                # SQL files for db config
└── android/                 # Capacitor Android shell
```

**Stack:** React 19 + Vite 7 + TypeScript + Tailwind 4 + Supabase (Auth/DB/Realtime/Storage) + Capacitor 8 (Android)

**Key pattern:** There is NO backend API. All data flows are: `Component → supabase.from("table").select() → setState()`. Realtime subscriptions are set up ad-hoc per component or inside dedicated hooks.

---

## 2. Critical Problems Identified

### 🔴 P0: UI God Components (Catastrophic)

| File | Lines | Size | Verdict | Issue |
|------|-------|------|---------|-------|
| `PlayerProfile.tsx` | **2,750** | **138 KB** | 🚨 Critical | Complex UI inside main file, single component with 15+ state vars, data fetching, buddy logic, match actions, animations. |
| `UmpireEngine.tsx` | **1,670** | **87 KB** | 🚨 Critical | Inline scoring logic coupled with complex rendering. |
| `PlayersDirectory.tsx` | **1,437** | **70 KB** | ⚠️ High | Directory + buddy system + match logging + caching all in one. |
| `ProfileSetup.tsx` | 2,053 | 103 KB | Fixed | 30+ individual `useState` calls for form fields, password change, avatar upload. |
| `AdminEditors.tsx` | — | 82 KB | Fixed | Every admin editor in one file. |

### P1: Type Safety Violations
`useState<any>` is used in **22+ files**. Key offenders: `PlayerProfile.tsx`, `PlayersDirectory.tsx`, `Feed.tsx`, `App.tsx`, `AuthContext.tsx`.

### P2: Duplicate `Player` Interface
The `interface Player` was independently defined in 8 different places (PlayerProfile, PlayerCard, LogMatchModal, etc).

### P3: Duplicated Utility Functions
Multiple functions like `getYouTubeId()`, `parseShoesList()`, win/loss parsing, and animation variants were duplicated across files.

### P4: No Data Access Layer
Every component called `supabase.from("table")` directly with duplicated select strings, without deduplication or consistent error handling.

### P5: AuthContext Overloaded
`AuthContext.tsx` handles session management, profile fetching, role computation, app badge management, realtime match subscription, and push notifications.

### P6: Database Migration Chaos
57 loose SQL files in `database/` with no ordering or tracking.

---

## 3. Round 1: Foundation & Decentralization

### Phase 1: Shared Type System
**Goal:** Create a single source of truth for all TypeScript types.
- **[DONE]** Created `client/src/types/player.ts` and `client/src/types/match.ts`.
- **[DONE]** Replaced local `interface Player` definitions with imports.

### Phase 2: Extract Shared Utilities
**Goal:** Extract duplicated utility functions.
- **[DONE]** Extracted `playerUtils.ts`, `authUtils.ts`, `departments.ts`.
- **[DONE]** Extracted shared Framer Motion variants.

### Phase 3: Data Access Layer
**Goal:** Centralize all Supabase queries into service modules.
- **[DONE]** Extracted queries to `playerService.ts` and `matchService.ts`.

### Phase 4: Break Up God Components
**Goal:** Break down monolithic components safely.
- **[DONE]** Extracted `PlayerProfile` data fetching to `usePlayerProfile.ts` and actions to `usePlayerActions.ts`.
- **[DONE]** Extracted `ProfileSetup` logic to `useProfileForm.ts` and tabs to separate components.
- **[DONE]** Split `AdminEditors.tsx` into individual files (`ConfigEditor.tsx`, `FlyerEditor.tsx`, etc).
- **[DONE]** Split `Navigation.tsx` into `DesktopNav`, `MobileDrawer`, and `UserMenu`.

### Phase 5: Context Decomposition
**Goal:** Clean up AuthContext.
- **[DONE]** Extracted `useAppBadge.ts` and `useMatchRealtime.ts` to handle side effects separately from the context.

### Phase 6: Cleanup & Hygiene
**Goal:** Final hygiene pass.
- **[DONE]** Removed dead/temporary files and scripts.
- **[DONE]** Cleaned up unused imports.

---

## 4. Round 2: UI Decomposition & Performance

> [!IMPORTANT]
> All refactoring must preserve existing functionality 100%. No features are added or removed. 

### Phase 7: `PlayerProfile.tsx` Decomposition (Complete - Surgical)
**Goal:** Reduce `PlayerProfile.tsx` size carefully.
1. **[DONE]** Extracted `PlayerAttributesWidget.tsx` using strict line-boundary slicing, bypassing fuzzy-match AST limits.
2. **[PAUSED]** Due to the "be careful" directive and the heavy reliance on inline state mapping, no further physical extractions are planned for `PlayerProfile.tsx` unless feature updates demand it. 

### Phase 8: `UmpireEngine.tsx` Domain Extraction (Complete)
**Goal:** Separate the BWF scoring logic from the React UI.
1. **[DONE]** `lib/umpire/scoringLogic.ts`: Extracted a pure TypeScript class/module that handles serving rules, intervals, game points, and undo history. *100% UI independent.*
2. **[DONE]** `components/umpire/CourtVisual.tsx`: Extracted the massive SVG display UI.
3. **[DONE]** `components/umpire/PlayerSelect.tsx`: Extracted the player dropdown components.
4. **[DONE]** `UmpireEngine.tsx` was successfully rewired to instantiate the `scoringLogic.ts` class. The inline mathematical positional logic was safely mapped to the pure class.

### Phase 9: `PlayersDirectory.tsx` Decomposition (Complete)
**Goal:** Extract the complex leaderboard and directory grid.
1. **[DONE]** `components/players-directory/DirectoryFilters.tsx` was extracted using rigid file-slicing to guarantee zero syntax corruption. It fully encapsulates the search and filter state layout.
2. **[PAUSED]** `DirectoryGrid.tsx`: Left inline because extracting it requires passing 12+ hooks, violating the decoupling principle.

### Phase 10: Lazy Loading & Code Splitting (Complete)
**Goal:** Improve initial bundle size and parse times.
1. **[DONE]** Wrapped `VideoPlayerModal` and `YoutubePlayer` in `Gallery.tsx` using `React.lazy()` and `<Suspense>`.
2. **[DONE]** Wrapped `LogMatchModal` in `PlayersDirectory.tsx` using `React.lazy()` and `<Suspense>`.
*Result: Production bundle parsing size heavily reduced for first-load!*

---

## 5. Round 3: UI Unification & Feature Enhancements

### Phase 11: Match Score Rendering Standardization (Complete)
**Goal:** Unify how match scores and participants are displayed across the entire application.
1. **[DONE]** Integrated `BeautifulScoreDisplay.tsx` into `MatchHistorySection.tsx`, completely replacing legacy regex-parsed text with interactive, modern visual score cards.
2. **[DONE]** Refactored `H2HSection.tsx` (Head-to-Head) to use the new standardized score component, and successfully expanded it to fully render all 4 players in doubles matchups.
3. **[DONE]** Dynamically map and render exact match formats (e.g. `MS`, `MD`, `XD`, `WS`, `WD`) in the Umpire Panel and H2H History by fetching and computing participant genders.

### Phase 12: Advanced Poll Management Integration (Complete)
**Goal:** Empower administrators with full control over the Community Poll feature directly from the Admin Dashboard.
1. **[DONE]** Wired `PollEditor.tsx` safely into `SiteAdmin.tsx` under a new "Community Polls" tab, fully hooking into the centralized save and undo state cycles.
2. **[DONE]** Implemented decentralized Admin "Manage" shortcuts natively into `PollCard.tsx` on the user feed for rapid editing.
3. **[DONE]** Enhanced the Poll data model to support Start Dates and End Dates for autonomous schedule execution.
4. **[DONE]** Integrated an "Archive" capability (`is_archived`), gracefully hiding older polls from the active list and displaying them in a restricted, read-only "Archived Polls" block within the feed.

---

## 6. Verification Checklist

After **every phase**, verify:

- [x] `pnpm run check` — TypeScript compiles with no errors
- [x] `pnpm run build` — Production build succeeds
- [x] Manual: Home page loads correctly
- [x] Manual: Player profile page loads and displays data
- [x] Manual: Player directory loads, search works, buddy system works
- [x] Manual: Feed page loads with match cards
- [x] Manual: Admin panel loads all tabs
- [x] Manual: Log Match modal opens and submits
- [x] Manual: Profile setup form loads and saves
- [x] Manual: Pull-to-refresh works on mobile viewport
- [x] Bundle size has NOT increased (check `dist/` output)

---

## 7. Next Steps

Round 1, Round 2, and Round 3 of refactoring have successfully achieved their primary safety goals: centralizing logic into the Data Access Layer, isolating the core BWF scoring logic from React components, shrinking the initial bundle size via lazy loading, and surgically extracting visual fragments from the God Components. With UI synchronization natively integrated across scoreboards and administrative features fully wired into the dashboard, we are ready to transition to new product features or writing domain tests.
