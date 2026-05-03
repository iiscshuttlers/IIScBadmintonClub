/**
 * Tournament Progression Logic
 * Automatically advances winners to next round when match completes
 */

import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from '../lib/firebase';

/**
 * Advance winners when a match is completed
 * Call this after updating a match to "completed" status
 */
export async function advanceWinners(format, completedMatchId) {
  try {
    // Get current tournament data
    const tournamentRef = doc(db, "live_data", "tournament");
    const tournamentSnap = await getDoc(tournamentRef);
    
    if (!tournamentSnap.exists()) {
      throw new Error("Tournament data not found");
    }
    
    const tournamentData = tournamentSnap.data();
    const matches = [...tournamentData.matches[format]];
    
    // Find the completed match
    const completedMatch = matches.find(m => m.Match_ID === completedMatchId);
    if (!completedMatch || completedMatch.Status !== 'completed' || !completedMatch.Winner) {
      console.log("Match not completed or no winner set");
      return;
    }
    
    // Determine which next-round match this winner advances to
    const progression = getMatchProgression(format, completedMatchId, matches.length);
    
    if (!progression) {
      console.log("No progression needed (this is the final)");
      return;
    }
    
    // Find the next round match
    const nextMatch = matches.find(m => m.Match_ID === progression.nextMatchId);
    if (!nextMatch) {
      console.log("Next round match not found");
      return;
    }
    
    // Update next round match with winner
    const isDoubles = ['MD', 'WD', 'XD'].includes(format);
    const playerField = isDoubles ? 
      (progression.position === 1 ? 'Players_1' : 'Players_2') :
      (progression.position === 1 ? 'Player_1' : 'Player_2');
    
    nextMatch[playerField] = completedMatch.Winner;
    
    // Update Firebase
    await updateDoc(tournamentRef, {
      [`matches.${format}`]: matches,
      lastUpdated: new Date().toISOString()
    });
    
    console.log(`✅ Advanced ${completedMatch.Winner} to ${progression.nextMatchId}`);
    
  } catch (error) {
    console.error("Error advancing winners:", error);
    throw error;
  }
}

/**
 * Get progression mapping for a completed match
 * Returns which next-round match the winner advances to and which position (1 or 2)
 */
function getMatchProgression(format, matchId, totalMatches) {
  // Extract match number from Match_ID (e.g., "MS_1" -> 1)
  const matchNum = parseInt(matchId.split('_')[1]);
  
  // Define progression trees for different bracket sizes
  // Format: { matchNum: { nextMatchId: string, position: 1 or 2 } }
  
  const progressionMaps = {
    // 8-match bracket (4 R1 + 2 R2 + 1 QF + 1 F)
    8: {
      1: { nextMatchId: `${format}_5`, position: 1 },  // R1 M1 winner -> R2 M5 pos 1
      2: { nextMatchId: `${format}_5`, position: 2 },  // R1 M2 winner -> R2 M5 pos 2
      3: { nextMatchId: `${format}_6`, position: 1 },  // R1 M3 winner -> R2 M6 pos 1
      4: { nextMatchId: `${format}_6`, position: 2 },  // R1 M4 winner -> R2 M6 pos 2
      5: { nextMatchId: `${format}_7`, position: 1 },  // R2 M5 winner -> QF M7 pos 1
      6: { nextMatchId: `${format}_7`, position: 2 },  // R2 M6 winner -> QF M7 pos 2
      7: { nextMatchId: `${format}_8`, position: 1 },  // QF M7 winner -> F M8 (pos doesn't matter, but set 1)
    },
    
    // 2-match bracket (1 R1 + 1 F)
    2: {
      1: { nextMatchId: `${format}_2`, position: 1 },  // R1 winner -> Final
    },
    
    // 15-match bracket (8 R1 + 4 R2 + 2 QF + 1 SF + 1 F)
    15: {
      // Round 1 -> Round 2
      1: { nextMatchId: `${format}_9`, position: 1 },
      2: { nextMatchId: `${format}_9`, position: 2 },
      3: { nextMatchId: `${format}_10`, position: 1 },
      4: { nextMatchId: `${format}_10`, position: 2 },
      5: { nextMatchId: `${format}_11`, position: 1 },
      6: { nextMatchId: `${format}_11`, position: 2 },
      7: { nextMatchId: `${format}_12`, position: 1 },
      8: { nextMatchId: `${format}_12`, position: 2 },
      // Round 2 -> Quarterfinals
      9: { nextMatchId: `${format}_13`, position: 1 },
      10: { nextMatchId: `${format}_13`, position: 2 },
      11: { nextMatchId: `${format}_14`, position: 1 },
      12: { nextMatchId: `${format}_14`, position: 2 },
      // Quarterfinals -> Semifinals
      13: { nextMatchId: `${format}_15`, position: 1 },
      14: { nextMatchId: `${format}_15`, position: 2 },
      // Semifinals -> Final (no entry, this is the final)
    }
  };
  
  // Select appropriate progression map
  const progressionMap = progressionMaps[totalMatches];
  
  if (!progressionMap) {
    console.warn(`No progression map for ${totalMatches} matches`);
    return null;
  }
  
  return progressionMap[matchNum] || null;
}

/**
 * Manual batch progression - advances all completed matches
 * Useful for fixing brackets after bulk updates
 */
export async function batchAdvanceAllWinners() {
  try {
    const tournamentRef = doc(db, "live_data", "tournament");
    const tournamentSnap = await getDoc(tournamentRef);
    
    if (!tournamentSnap.exists()) {
      throw new Error("Tournament data not found");
    }
    
    const tournamentData = tournamentSnap.data();
    let updated = false;
    
    // Process each format
    for (const format of ['MS', 'WS', 'MD', 'WD', 'XD']) {
      const matches = [...tournamentData.matches[format]];
      const totalMatches = matches.length;
      
      // Find all completed matches with winners
      const completedMatches = matches
        .filter(m => m.Status === 'completed' && m.Winner)
        .sort((a, b) => {
          // Sort by match number to process in order
          const numA = parseInt(a.Match_ID.split('_')[1]);
          const numB = parseInt(b.Match_ID.split('_')[1]);
          return numA - numB;
        });
      
      // Advance each winner
      for (const match of completedMatches) {
        const progression = getMatchProgression(format, match.Match_ID, totalMatches);
        
        if (!progression) continue; // Skip if no progression (final match)
        
        const nextMatch = matches.find(m => m.Match_ID === progression.nextMatchId);
        if (!nextMatch) continue;
        
        const isDoubles = ['MD', 'WD', 'XD'].includes(format);
        const playerField = isDoubles ? 
          (progression.position === 1 ? 'Players_1' : 'Players_2') :
          (progression.position === 1 ? 'Player_1' : 'Player_2');
        
        // Only update if currently TBD
        if (nextMatch[playerField] === 'TBD') {
          nextMatch[playerField] = match.Winner;
          updated = true;
          console.log(`✅ Advanced ${match.Winner} to ${progression.nextMatchId}`);
        }
      }
      
      // Update this format's matches
      tournamentData.matches[format] = matches;
    }
    
    // Save if any updates made
    if (updated) {
      await updateDoc(tournamentRef, {
        matches: tournamentData.matches,
        lastUpdated: new Date().toISOString()
      });
      console.log("✅ Batch progression complete");
    } else {
      console.log("No updates needed");
    }
    
  } catch (error) {
    console.error("Error in batch progression:", error);
    throw error;
  }
}
