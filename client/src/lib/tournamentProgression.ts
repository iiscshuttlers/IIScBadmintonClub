/**
 * tournamentProgression.ts
 * Dynamic progression — reads "advancesTo" field from match JSON.
 * No hardcoded bracket sizes. Works for any tournament structure.
 *
 * Each match in tournament-data.json can have:
 *   "advancesTo": { "matchId": "MS3", "position": 2 }
 *
 * position 1 = Player_1 / Players_1
 * position 2 = Player_2 / Players_2
 */

import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from '../lib/firebase';

export async function advanceWinners(format: string, completedMatchId: string) {
  try {
    const tournamentRef = doc(db, "live_data", "tournament");
    const snap = await getDoc(tournamentRef);
    if (!snap.exists()) throw new Error("Tournament data not found");

    const data = snap.data();
    const matches = [...data.matches[format]];

    const completed = matches.find(m => m.Match_ID === completedMatchId);
    if (!completed || completed.Status !== 'completed' || !completed.Winner) {
      console.log("Match not completed or no winner.");
      return;
    }

    if (!completed.advancesTo) {
      console.log(`No advancesTo for ${completedMatchId} — likely final.`);
      return;
    }

    const { matchId: nextId, position } = completed.advancesTo;
    const nextMatch = matches.find(m => m.Match_ID === nextId);
    if (!nextMatch) {
      console.warn(`Next match ${nextId} not found.`);
      return;
    }

    const isDoubles = ['MD', 'WD', 'XD'].includes(format);
    const field = isDoubles
      ? (position === 1 ? 'Players_1' : 'Players_2')
      : (position === 1 ? 'Player_1' : 'Player_2');

    nextMatch[field] = completed.Winner;

    await updateDoc(tournamentRef, {
      [`matches.${format}`]: matches,
      lastUpdated: new Date().toISOString()
    });

    console.log(`✅ ${completed.Winner} → ${nextId} (pos ${position})`);

  } catch (err) {
    console.error("advanceWinners error:", err);
    throw err;
  }
}

export async function batchAdvanceAllWinners() {
  try {
    const tournamentRef = doc(db, "live_data", "tournament");
    const snap = await getDoc(tournamentRef);
    if (!snap.exists()) throw new Error("Tournament data not found");

    const data = snap.data();
    let anyUpdate = false;

    for (const format of data.formats as string[]) {
      const matches = [...data.matches[format]];
      const completed = matches
        .filter(m => m.Status === 'completed' && m.Winner && m.advancesTo)
        .sort((a, b) => a.Match_ID.localeCompare(b.Match_ID));

      for (const match of completed) {
        const { matchId: nextId, position } = match.advancesTo;
        const next = matches.find(m => m.Match_ID === nextId);
        if (!next) continue;

        const isDoubles = ['MD', 'WD', 'XD'].includes(format);
        const field = isDoubles
          ? (position === 1 ? 'Players_1' : 'Players_2')
          : (position === 1 ? 'Player_1' : 'Player_2');

        const cur = next[field] || '';
        if (!cur || cur.startsWith('Winner of') || cur === 'TBD') {
          next[field] = match.Winner;
          anyUpdate = true;
          console.log(`✅ ${match.Winner} → ${nextId} pos ${position}`);
        }
      }
      data.matches[format] = matches;
    }

    if (anyUpdate) {
      await updateDoc(tournamentRef, {
        matches: data.matches,
        lastUpdated: new Date().toISOString()
      });
      console.log("Batch done.");
    } else {
      console.log("Nothing to update.");
    }
  } catch (err) {
    console.error("batchAdvanceAllWinners error:", err);
    throw err;
  }
}
