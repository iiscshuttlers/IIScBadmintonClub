import { planDraw, generateSingleElimBracket, findWalkoverMatches } from './client/src/lib/bracketGenerator';

const players = [];
players.push({ seed: 1, displayName: 'Seed 1', entryRound: 3 });
players.push({ seed: 2, displayName: 'Seed 2', entryRound: 3 });
players.push({ seed: 3, displayName: 'Seed 3', entryRound: 2 });
players.push({ seed: 4, displayName: 'Seed 4', entryRound: 2 });

for (let i = 5; i <= 100; i++) {
  players.push({ seed: 99, displayName: 'Player ' + i });
}

const plan = planDraw(players);
console.log('Over allocated:', plan.overAllocatedSlots);
const matches = generateSingleElimBracket(players, 'MS', 't1');
const r1Walkovers = findWalkoverMatches(matches).filter((m: any) => m.round === 1);
const r2Walkovers = findWalkoverMatches(matches).filter((m: any) => m.round === 2);
console.log('R1 Walkovers for Seed 1:', r1Walkovers.some((m: any) => m.team1_label === 'Seed 1' || m.team2_label === 'Seed 1'));
console.log('R2 Walkovers for Seed 1:', r2Walkovers.some((m: any) => m.team1_label === 'Seed 1' || m.team2_label === 'Seed 1'));
