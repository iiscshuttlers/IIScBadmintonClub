export type TournamentStatus = 'live' | 'upcoming' | 'completed';
export type TournamentType = 'open' | 'team' | 'special';

export type TournamentWinner = {
  category: string;
  winner: string;
  runnerUp?: string;
  bronze?: string[];
};

export type ArchivedTournament = {
  id: string;
  slug: string;
  status: TournamentStatus;
  type: TournamentType;
  /** ISO date string or year string e.g. "2026-05-09" or "2026" */
  startDate: string;
  name: string;
  subtitle: string;
  description: string;
  winners?: TournamentWinner[];
  podium?: string[];
  highlights?: string[];
  /**
   * Folder name inside src/assets/gallery/tournaments/ that contains
   * photos for this tournament. Used to link the detail page to the Gallery.
   */
  galleryFolder?: string;
};

export const ARCHIVED_TOURNAMENTS: ArchivedTournament[] = [
  {
    id: 'farewell-2026',
    slug: 'farewell-match',
    status: 'completed',
    type: 'special',
    startDate: '2026-05-09',
    name: 'Farewell Badminton Tournament 2026',
    subtitle: 'Official Results',
    description:
      'Final results from the farewell tournament featuring singles, doubles and mixed doubles for the outgoing batch.',
    galleryFolder: 'Farewell-2026',
    winners: [
      { category: "Men's Singles", winner: 'Jalaj (RBCCPS)' },
      { category: "Men's Doubles", winner: 'Kaling Danggen (CES) & Raja Janmejay (AE)' },
      { category: "Women's Singles", winner: 'Radhika Dutt (CES)' },
      { category: 'Mixed Doubles', winner: 'Radhika Dutt (CES) & Kaling Danggen (CES)' },
    ],
    highlights: [
      'Farewell event for the outgoing batch.',
      'Championship matches covered singles, doubles and mixed doubles.',
    ],
  },
  {
    id: 'spectrum-2026',
    slug: 'spectrum-2026',
    status: 'completed',
    type: 'team',
    startDate: '2026',
    name: 'SPECTRUM 2026',
    subtitle: 'Inter-Department Championship Results',
    description:
      'Inter-department championship results featuring UG Seniors, CeNSE, ECE and AE on the final podium.',
    galleryFolder: 'Spectrum-2026',
    podium: ['UG Seniors', 'CeNSE', 'ECE', 'AE'],
    highlights: [
      'Spectrum 2026 featured strong competition across departments.',
      'UG Seniors delivered a dominant campaign to become champions.',
      'CeNSE and ECE also impressed with consistent performances.',
    ],
  },
  {
    id: 'open-2025',
    slug: 'open-2025',
    status: 'completed',
    type: 'open',
    startDate: '2025',
    name: 'Open Tournament 2025',
    subtitle: 'Official Results',
    description:
      'Official category results for singles, doubles and mixed doubles from the Open Tournament 2025.',
    winners: [
      { category: "Men's Singles", winner: 'Krishnendu', runnerUp: 'Piyush', bronze: ['Abhishek Sampath', 'Manish'] },
      { category: "Women's Singles", winner: 'Tanisha', runnerUp: 'Shailli', bronze: ['Radhika', 'Sharanya Marathe'] },
      { category: "Men's Doubles", winner: 'Abhisek & Krishnendu', runnerUp: 'Raja & Kaling', bronze: ['Bhuppi & Piyush', 'Shiv Pratap & Shubham'] },
      { category: "Women's Doubles", winner: 'Renu & Shailli', runnerUp: 'Radhika & Madhuvanti', bronze: ['Sonali & Somili', 'Shruti & Jefrin'] },
      { category: 'Mixed Doubles', winner: 'Radhika & Raja', runnerUp: 'Shailli & Krishnendu', bronze: ['Tanisha & Abhisek', 'Sayoni & Piyush'] },
    ],
  },
  {
    id: 'open-2024',
    slug: 'open-2024',
    status: 'completed',
    type: 'open',
    startDate: '2024',
    name: 'Open Tournament 2024 (Gandhi Cup)',
    subtitle: 'Official Results',
    description:
      'Results for the Gandhi Cup Badminton Tournament, featuring Category 1 (IISM Eligible) and Category 2 events.',
    winners: [
      { category: "Cat 1: Men's Singles", winner: 'Gokul', runnerUp: 'Varun' },
      { category: "Cat 1: Women's Singles", winner: 'Tanisha', runnerUp: 'Renu' },
      { category: "Cat 1: Men's Doubles", winner: 'Gokul & Piyush', runnerUp: 'Arun & Varun' },
      { category: "Cat 1: Women's Doubles", winner: 'Tanisha & Renu', runnerUp: 'Radhika & Madhuvanti' },
      { category: "Cat 1: Mixed Doubles", winner: 'Kaling & Aditi', runnerUp: 'Atul & Ritul' },
      { category: "Cat 2: Men's Singles", winner: 'Arindhan', runnerUp: 'Krishnendu' },
      { category: "Cat 2: Women's Singles", winner: 'Shaili', runnerUp: 'Dimple' },
      { category: "Cat 2: Men's Doubles", winner: 'Arindhan & Krishnendu', runnerUp: 'Dilshad & Gowtham' },
      { category: "Cat 2: Women's Doubles", winner: 'Dimple & Rakshita', runnerUp: 'Sneha & Aparna' },
      { category: "Cat 2: Mixed Doubles", winner: 'Shaili & Dilshad', runnerUp: 'Abhishek & Sonali' },
    ],
  },
  {
    id: 'iism-2025',
    slug: 'iism-2025',
    status: 'completed',
    type: 'team',
    startDate: '2025-12',
    name: 'IISM 2025 — NISER Bhubaneswar',
    subtitle: 'Inter-IISER Sports Meet',
    description:
      "IISc Shuttlers swept all three categories at IISM 2025 hosted by NISER Bhubaneswar, winning Gold in Men's, Women's, and Mixed events.",
    galleryFolder: 'IISM-2025',
    podium: ['IISc (Gold — All 3 events)'],
    highlights: [
      "Gold medal — Men's category.",
      "Gold medal — Women's category.",
      'Gold medal — Mixed category.',
      'IISc swept all three categories at IISM 2025.',
    ],
  },
  {
    id: 'iism-2024',
    slug: 'iism-2024',
    status: 'completed',
    type: 'team',
    startDate: '2024-12',
    name: 'IISM 2024 — IISER Pune',
    subtitle: 'Inter-IISER Sports Meet',
    description:
      "IISc competed at IISM 2024 hosted by IISER Pune, winning Gold in Men's and Women's categories.",
    galleryFolder: 'IISM-2024',
    highlights: [
      "Gold medal — Men's category.",
      "Gold medal — Women's category.",
      '4th place — Mixed Doubles.',
    ],
  },
];

export function getArchivedTournament(slug: string): ArchivedTournament | undefined {
  return ARCHIVED_TOURNAMENTS.find((event) => event.slug === slug);
}

/**
 * Compute a leaderboard of individual winners across all tournaments.
 * Returns entries sorted by win count descending.
 */
export type PlayerWinEntry = {
  name: string;
  wins: number;
  categories: string[];
  tournaments: string[];
};

export function computeWinnerLeaderboard(): PlayerWinEntry[] {
  const map = new Map<string, PlayerWinEntry>();

  for (const t of ARCHIVED_TOURNAMENTS) {
    if (!t.winners) continue;
    for (const w of t.winners) {
      // Handle pairs like "A & B" — count each individual
      const names = w.winner.split(/[&/]/).map(n => n.replace(/\(.*?\)/g, '').trim()).filter(Boolean);
      for (const name of names) {
        if (!name || name.length < 2) continue;
        const existing = map.get(name);
        if (existing) {
          existing.wins += 1;
          if (!existing.categories.includes(w.category)) existing.categories.push(w.category);
          if (!existing.tournaments.includes(t.name)) existing.tournaments.push(t.name);
        } else {
          map.set(name, { name, wins: 1, categories: [w.category], tournaments: [t.name] });
        }
      }
    }
  }

  return [...map.values()].sort((a, b) => b.wins - a.wins);
}
