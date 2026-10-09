# Implementation Plan: Team Tournaments (Phase 2)

## Overview
This plan establishes a comprehensive tournament operations system for Team Events in IISc Badminton Club, covering:
1. **Multi-Format Bracket & Pool Generation**: 1, 2, 3, 4+ pools, round-robin scheduling, direct knockouts (QF, SF, 3rd-Place match, Finals).
2. **Pool Assignment Options**: Seeded Snake Draw, Random Shuffle, and **Manual Pool Assignment** (drag/select teams into pools).
3. **Tie Decider Rules & Settings (Admin Configurable)**:
   - Configurable deciders for even-rubber ties (e.g., 3-3 in a 6-rubber tie):
     - Net Set Difference ($S_{\text{for}} - S_{\text{against}}$)
     - Net Point Difference ($P_{\text{for}} - P_{\text{against}}$)
     - Total Points
     - Designated Rubber Winner (e.g. WS or XD)
     - Golden Decider Match (extra game)
4. **Dynamic Points Table on Pulse**: Group-by-pool standings table with customizable sorting priority and qualification cutoff indicators.
5. **Points System**: Default 2 pts for Win, 1 pt for Draw, 0 pts for Loss (with admin override).
6. **Captains & Umpire Lineup Workflow**: Blind multi-edit submissions for captains with proposed playing order, granular Umpire reveal controls (Reveal All vs Single Rubber), and an emergency substitution/reordering audit trail.
7. **Database & RLS Fixes**: Immediate resolution of `tournament_ties` RLS violation and audit schema creation.

---

## Confirmed Specifications & Decisions

- **Tie Decider Rule**: Fully admin-configurable under tournament tie settings, supporting Net Set Diff, Net Point Diff, Total Points, Winner of Specific Rubber, or Golden Decider Game.
- **Pool Assignment**: Seeded Snake Draw by default, with one-click Random Shuffle and full **Manual Assignment** (assign team directly to Pool A, B, C, etc.).
- **Points System**: 2 for Win, 1 for Draw, 0 for Loss (configurable in settings).
- **Captains**: Submit lineup & propose rubber order, can revise and re-submit $N$ times until Umpire reveals.
- **Umpires**: Reveal All or Reveal Specific Rubber; can execute emergency player substitutions or order swaps with automated logging of referee ID, timestamp, original/new player, and reason.

---

## Architecture & Proposed Changes

### 1. Database Schema & RLS Policies
#### `supabase/migrations/20261009194500_team_phase2_schema.sql`
- **Fix RLS on `tournament_ties`**:
  - Add `INSERT`, `UPDATE`, and `DELETE` policies allowing tournament managers and master admins full write permissions (`WITH CHECK (is_admin_or_master() OR is_tournament_manager(tournament_id))`).
- **Create `tie_lineup_audits` Table**:
  - Columns: `id (uuid)`, `tie_id (uuid)`, `rubber_order (int)`, `action_type (text)` (`'PLAYER_SUBSTITUTED'`, `'ORDER_CHANGED'`, `'REVEALED'`), `original_player_id (uuid)`, `replacement_player_id (uuid)`, `referee_id (uuid)`, `reason (text)`, `created_at (timestamptz)`.
  - RLS policies allowing umpires/admins to insert audit entries and public to read.
- **Update `tie_lineups` Table**:
  - Add `revealed_at timestamptz`, `revealed_by uuid REFERENCES players(id)`, `is_revealed boolean DEFAULT false`.
- **Enhance `tournament_team_standings` View**:
  - Calculate `sets_for`, `sets_against`, `sets_diff`, `points_for`, `points_against`, `points_diff` from completed `tournament_matches` associated with each tie.
- **Update Tie Completion Trigger / RPC (`submit_tournament_match`)**:
  - Incorporate `tie_decider_rule` from `tournaments.tie_format_config` when score reaches equal split (e.g. 3-3).
  - Automatically evaluate sets/points diff or spawn/unlock Golden Decider rubber.

---

### 2. Generator Wizard & Scheduling
#### `client/src/lib/teamBracketGenerator.ts`
- **Berger Algorithm (Circle Method)**:
  - Generates round-robin fixtures for $N$ teams per pool, guaranteeing balanced home/away distribution.
- **Pool Distribution Engine**:
  - **Seeded Snake**: Pool A (Seed 1, 4), Pool B (Seed 2, 3)...
  - **Random Shuffle**: Randomly distribute teams.
  - **Manual Assignment**: Allow admin to pick which team goes to which pool in the UI.
- **Playoff Tree Builder**:
  - Direct Knockout: $2, 4, 8, 16$ teams with optional 3rd Place Match (`loser_advances_to_tie`).
  - Pool Stage $\rightarrow$ Knockout:
    - 1 Pool: Top 2 $\rightarrow$ Finals, or Top 4 $\rightarrow$ SF $\rightarrow$ Finals.
    - 2 Pools: A1 vs B2, B1 vs A2 $\rightarrow$ SF $\rightarrow$ Finals & 3rd Place Match.
    - 4 Pools: A1 vs B2, C1 vs D2, B1 vs A2, D1 vs C2 $\rightarrow$ QF $\rightarrow$ SF $\rightarrow$ Finals.

#### `client/src/components/admin/TeamBracketGeneratorModal.tsx` & `TeamBracketTab.tsx`
- Interactive modal with visual steps:
  1. **Format**: Direct Knockout vs. Pools + Knockouts vs. Pure League.
  2. **Pools & Assignment**: Select 1, 2, 3, 4 pools; choose Seeded Snake, Random, or Manual per-team assignment.
  3. **Playoff Structure**: Toggle SF, QF, 3rd Place Match.
  4. **Tie Decider Settings**: Choose rule for even-rubber ties (Set Diff, Point Diff, Total Points, Specific Rubber, Golden Match).
  5. **Review & Generate**: Preview pairings and generate with a single click.

---

### 3. Points Table on Pulse Page
#### `client/src/components/pulse/LiveTab.tsx` & `client/src/components/events/TeamStandingsTable.tsx`
- Add **"Standings"** subtab button in Pulse header when active tournament is a Team event.
- **Pool Switcher**: Pills at top (`All Pools`, `Pool A`, `Pool B`, etc.).
- **Rich Data Grid**:
  - Rank, Team (Logo + Short + Full name), P, W, D, L, R (+/-), S (+/-), Pts (+/-), Total Tie Pts.
  - Qualification border / badge for Top $N$ teams (e.g. green pill: "Qualifies for SF").
- **Interactive Sorting**:
  - Column headers clickable to sort by Wins, Set Diff, Point Diff, or Total Points.

---

### 4. Captain Lineup Builder with Playing Order
#### `client/src/components/admin/TeamLineupBuilder.tsx` & `client/src/pages/TournamentTeamHub.tsx`
- **Player Assignment**: Dropdown selectors filtered to active team roster.
- **Playing Order Reordering**: Captains can propose the sequence of rubbers (e.g., Rubber 1: XD, Rubber 2: MS, etc.) with up/down arrows or drag-and-drop.
- **Multiple Submissions**: Captain can click **"Submit Proposed Lineup"** at any time; status updates to `SUBMITTED (v2)`. Remains fully editable until an Umpire reveals it.
- **Blind Privacy**: Team B cannot see Team A's submitted roster prior to umpire reveal.

---

### 5. Umpire Console with Reveal & Emergency Substitutions
#### `client/src/components/umpire/UmpireTournamentTab.tsx` & `client/src/components/umpire/TieUmpireConsole.tsx`
- **Umpire Control Board**:
  - View side-by-side proposed lineups and proposed playing orders from Team A and Team B.
  - Controls:
    - **"Reveal All Rubbers"**: Unlocks all rubbers and syncs roster into `tournament_matches`.
    - **"Reveal Rubber #X"**: Granular reveal for sequential court play.
  - Display badge: *"Revealed by Umpire [Name] at [HH:MM]"*.
- **Emergency Substitution & Order Modification**:
  - Umpire action: **"Emergency Replace / Modify"**.
  - Modal allows selecting substitute player from the team roster or swapping rubber playing order.
  - Requires entering a mandatory reason (e.g. "Player injured during warm-up").
  - Writes to `tie_lineup_audits` and updates `tournament_matches`.
  - Prominently displays the audit badge on the tie overview:
    > ⚠️ *Substitution: MD Rubber — Player A replaced by Player B by Referee Jane Doe at 19:42 (Reason: Injury)*

---

## Verification Plan

### Automated & Unit Verification
- Run database migration and test RLS policies for `tournament_ties` and `tie_lineup_audits`.
- Test Berger round-robin generator with odd and even numbers of teams.
- Build test (`pnpm run build`) to ensure strict TypeScript type safety.

### Manual / Browser Verification
1. Open Tournament Manager $\rightarrow$ Bracket Tab:
   - Click "Generate Bracket" $\rightarrow$ configure 2 pools with SF and 3rd place match.
   - Verify all ties and rubber matches are generated with zero RLS errors.
2. Open Pulse $\rightarrow$ Standings Tab:
   - Verify pool standings table displays correct columns (P, W, D, L, R +/-, S +/-, Pts +/-, Total Pts).
3. Open Captain Hub:
   - Assign players, reorder playing order, and submit lineup multiple times.
4. Open Umpire Console:
   - Verify umpire sees both teams' proposed lineups.
   - Test "Reveal All" and "Reveal Specific Rubber".
   - Test Emergency Substitution and verify audit log displays with referee name and timestamp.
