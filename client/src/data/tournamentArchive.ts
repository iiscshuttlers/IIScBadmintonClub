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
  startDate: string;
  name: string;
  subtitle: string;
  description: string;
  winners?: TournamentWinner[];
  podium?: string[];
  highlights?: string[];
};

export const ARCHIVED_TOURNAMENTS: ArchivedTournament[] = [
  {
    id: 'farewell-2026',
    slug: 'farewell-match',
    status: 'completed',
    type: 'special',
    startDate: '2026-05-09',
    name: 'Farewell Badminton Tournament 2026',
    subtitle: 'Archived Results',
    description:
      'Archived results from the farewell tournament featuring singles, doubles and mixed doubles.',
    winners: [
      { category: "Men's Singles", winner: 'Jalaj (RBCCPS)' },
      {
        category: "Men's Doubles",
        winner: 'Kaling Danggen (CES) & Raja Janmejay (AE)',
      },
      { category: "Women's Singles", winner: 'Radhika Dutt (CES)' },
      {
        category: 'Mixed Doubles',
        winner: 'Radhika Dutt (CES) & Kaling Danggen (CES)',
      },
    ],
    highlights: [
      'Farewell event for the outgoing batch.',
      'Championship matches covered singles, doubles and mixed doubles.',
      'Results archived for future club records.',
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
    podium: ['UG Seniors', 'CeNSE', 'ECE', 'AE'],
    highlights: [
      'Spectrum 2026 featured strong competition across departments with exciting singles and doubles matches.',
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
      {
        category: "Men's Singles",
        winner: 'Krishnendu',
        runnerUp: 'Piyush',
        bronze: ['Abhishek Sampath', 'Manish'],
      },
      {
        category: "Women's Singles",
        winner: 'Tanisha',
        runnerUp: 'Shailli',
        bronze: ['Radhika', 'Sharanya Marathe'],
      },
      {
        category: "Men's Doubles",
        winner: 'Abhisek & Krishnendu',
        runnerUp: 'Raja & Kaling',
        bronze: ['Bhuppi & Piyush', 'Shiv Pratap & Shubham'],
      },
      {
        category: "Women's Doubles",
        winner: 'Renu & Shailli',
        runnerUp: 'Radhika & Madhuvanti',
        bronze: ['Sonali & Somili', 'Shruti & Jefrin'],
      },
      {
        category: 'Mixed Doubles',
        winner: 'Radhika & Raja',
        runnerUp: 'Shailli & Krishnendu',
        bronze: ['Tanisha & Abhisek', 'Sayoni & Piyush'],
      },
    ],
  },
];

export function getArchivedTournament(slug: string) {
  return ARCHIVED_TOURNAMENTS.find((event) => event.slug === slug);
}
