# Design Tokens Specification — IISc Badminton Club

This document specifies the design tokens, semantic color mappings, typography roles, and styling primitives used across the IISc Badminton Club platform.

---

## 1. CSS Custom Properties & Semantic Color Variables

All core theme variables are declared in [`client/src/index.css`](../client/src/index.css) and exposed into Tailwind v4 theme configuration.

### 1.1 Core Brand & Functional Colors
| CSS Variable | Default (Light Mode) | Dark Mode | Semantic Meaning / Role |
| :--- | :--- | :--- | :--- |
| `--primary` | `#4d7c0f` (AA lime/volt) | `#a3e635` / Neon volt | Primary action buttons, primary branding, active state highlights |
| `--primary-foreground` | `#ffffff` | `#020617` / dark slate | Foreground text rendered on top of `--primary` fills |
| `--accent` | `#0e7490` (Deep Cyan) | `#22d3ee` (Cyan) | Data visualization accents, secondary callouts, info chips |
| `--accent-foreground` | `#ffffff` | `#020617` | Text on saturated accent backgrounds |
| `--secondary` | `#c2410c` (Ember Orange) | `#fb923c` | Streak counters, warm highlights, secondary actions |
| `--secondary-foreground` | `#ffffff` | `#020617` | Text on secondary backgrounds |
| `--background` | `#f7f8f4` | `#090d16` (Deep Navy) | Surface canvas background |
| `--foreground` | `#0c0d10` | `#f8fafc` | Default primary text and icons |
| `--card` | `#ffffff` | `#0d1322` | Card, container, and dialog body surfaces |
| `--card-foreground` | `#0c0d10` | `#f8fafc` | Text within cards |
| `--muted` | `#e5e7eb` | `#1e293b` | Inactive tab backgrounds, subtle button states, skeleton loaders |
| `--muted-foreground` | `#6b7280` | `#94a3b8` | Subtitles, metadata labels, timestamps, secondary copy |
| `--border` | `#e2e8f0` | `rgba(255, 255, 255, 0.08)` | Dividers, card boundaries, input borders |
| `--ring` | `#4d7c0f` | `#a3e635` | Accessible keyboard focus rings |

### 1.2 Status & Semantic Lifecycle Tokens (`SEMANTIC`)
Exported from [`client/src/lib/tournamentTheme.ts`](../client/src/lib/tournamentTheme.ts):

| Token Family | Light Mode Classes | Dark Mode Classes | Semantic Rule |
| :--- | :--- | :--- | :--- |
| **`SEMANTIC.live`** | `text-rose-600 bg-rose-500/15` | `text-rose-400 bg-rose-500/20` | **Exclusively** for active/live play in progress. Never used for static errors or decorations. |
| **`SEMANTIC.pending`** | `text-amber-600 bg-amber-500/15` | `text-amber-400 bg-amber-500/20` | Awaiting reveal, registration open, pending verification, needs attention. |
| **`SEMANTIC.success`** | `text-emerald-600 bg-emerald-500/15` | `text-emerald-400 bg-emerald-500/20` | Completed matches, verified check-ins, winning teams, confirmations. |
| **`SEMANTIC.neutral`** | `text-slate-600 bg-slate-200/80` | `text-slate-400 bg-slate-800` | Casual matches, archived brackets, inactive tags. |
| **`SEMANTIC.brand`** | `text-primary bg-primary/10` | `text-primary bg-primary/20` | Platform navigation, official features. |

---

## 2. Typography Hierarchy

Fonts are loaded from Google Fonts (`Inter`, `Outfit`, `Barlow Condensed`):

| Role | Class / Font Family | Usage |
| :--- | :--- | :--- |
| **Display / Hero** | `font-display` (`Outfit`) | Main page hero titles, tournament names, major marketing headings |
| **Heading** | `font-sans font-bold` (`Inter`) | Card titles, section headers, dialog titles (`text-lg`, `text-xl`) |
| **Stats & Scores** | `font-stat` (`Barlow Condensed`) | Game scores, seed numbers, ranking points, ELO ratings |
| **Body** | `font-sans font-normal` (`Inter`) | General reading text, match descriptions, rules copy |
| **Caption & Meta** | `text-xs text-muted-foreground` | Timestamps, venue indicators, subtitle annotations |

---

## 3. UI Primitives

Standard components reside in `client/src/components/ui/`:

1. **`PageHeader`** (`PageHeader.tsx`):
   - `variant="default"`: Standard full-width page header with icon badge, eyebrow badge, title, description, and action buttons.
   - `variant="card"`: Inner container variant with seamless borders for centered account or legal pages (e.g., Privacy, Terms, ChangePassword, DeleteAccount).
2. **`Button`** (`button.tsx`):
   - Standard button with variants `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `glow`.
3. **`StatusChip`** (`StatusChip.tsx`):
   - Consistent pill badge binding status strings (`live`, `pending`, `completed`, `upcoming`, `draft`) to `SEMANTIC` colors with optional pulse animation.
4. **`EmptyState`** & **`ErrorState`**:
   - Standardized feedback surfaces with iconography, supportive copy, and recovery action buttons.
