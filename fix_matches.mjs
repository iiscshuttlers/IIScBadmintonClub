import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://htejmhsqqlfedlajqqyv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZWptaHNxcWxmZWRsYWpxcXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc1NjAsImV4cCI6MjA5ODkzMzU2MH0.2HhspVm0_ncPvEsv7-qET_6SYtjTP1s6nUbwuy30FRk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: matches } = await supabase.from('tournament_matches')
     .select('*')
     .or('player1_id.eq.player3_id,player1_id.eq.player4_id,player2_id.eq.player3_id,player2_id.eq.player4_id,player3_id.eq.player4_id,player1_id.eq.player2_id');

  console.log(`Found ${matches.length} corrupted matches.`);

  // Get all valid matches in those tournaments to find team pairings
  const t_ids = [...new Set(matches.map(m => m.tournament_id))];
  const { data: all_matches } = await supabase.from('tournament_matches').select('id, tournament_id, player1_id, player2_id, player3_id, player4_id').in('tournament_id', t_ids);
  
  let sql = 'BEGIN;\n\n';
  
  for (let m of matches) {
      let p1 = m.player1_id, p2 = m.player2_id, p3 = m.player3_id, p4 = m.player4_id;
      
      // Try to find the correct team pairings by looking at previous rounds (advances_to_match = m.id)
      const { data: prev_matches } = await supabase.from('tournament_matches').select('*').eq('advances_to_match', m.id);
      
      let foundFromPrev = false;
      if (prev_matches && prev_matches.length > 0) {
          // If we have previous matches, the winners of those matches should be the players here
          for (let pm of prev_matches) {
              // Wait, if it advances to position 1, it's team 1. Position 2, team 2.
              // Which team won the previous match? (pm.winner_side)
              // If winner_side == 1, then Team 1 of previous match advances.
              let w_p1 = null, w_p2 = null;
              if (pm.winner_side === 1) { w_p1 = pm.player1_id; w_p2 = pm.player2_id; }
              else if (pm.winner_side === 2) { w_p1 = pm.player3_id; w_p2 = pm.player4_id; }
              else if (pm.winner_id) {
                  // Fallback if winner_side is null but winner_id exists
                  if (pm.winner_id === pm.player1_id || pm.winner_id === pm.player2_id) {
                      w_p1 = pm.player1_id; w_p2 = pm.player2_id;
                  } else {
                      w_p1 = pm.player3_id; w_p2 = pm.player4_id;
                  }
              }

              if (w_p1 || w_p2) {
                  if (pm.advances_to_position === 1) {
                      p1 = w_p1; p2 = w_p2;
                      foundFromPrev = true;
                  } else if (pm.advances_to_position === 2) {
                      p3 = w_p1; p4 = w_p2;
                      foundFromPrev = true;
                  }
              }
          }
      }
      
      // fallback: deduce from other matches
      const deduceTeam = (player_id) => {
          let partners = new Set();
          for (let am of all_matches) {
              if (am.id === m.id) continue;
              if (am.player1_id === player_id) partners.add(am.player2_id);
              if (am.player2_id === player_id) partners.add(am.player1_id);
              if (am.player3_id === player_id) partners.add(am.player4_id);
              if (am.player4_id === player_id) partners.add(am.player3_id);
          }
          partners.delete(null);
          return Array.from(partners);
      };
      
      if (!foundFromPrev && (p1 === p3 || p1 === p4 || p2 === p3 || p2 === p4 || p3 === p4 || p1 === p2)) {
          console.log(`Need deduction for match ${m.id}`);
          let all_players = [m.player1_id, m.player2_id, m.player3_id, m.player4_id].filter(Boolean);
          let unique_players = [...new Set(all_players)];
          
          if (unique_players.length === 3) {
              // One player is duplicated, missing 1 player.
              for (let up of unique_players) {
                  let partners = deduceTeam(up);
                  for (let partner of partners) {
                      if (!unique_players.includes(partner)) {
                          console.log(`Found missing partner for ${up}: ${partner}`);
                          // Replace the duplicate
                          if (m.player1_id === m.player3_id && up === m.player3_id) { p3 = partner; }
                          else if (m.player2_id === m.player3_id && up === m.player3_id) { p3 = partner; }
                          else if (m.player2_id === m.player4_id && up === m.player4_id) { p4 = partner; }
                          else if (m.player1_id === m.player4_id && up === m.player4_id) { p4 = partner; }
                      }
                  }
              }
          }
      }

      sql += `UPDATE tournament_matches SET player1_id = ${p1 ? `'${p1}'` : 'NULL'}, player2_id = ${p2 ? `'${p2}'` : 'NULL'}, player3_id = ${p3 ? `'${p3}'` : 'NULL'}, player4_id = ${p4 ? `'${p4}'` : 'NULL'} WHERE id = '${m.id}';\n`;
  }

  sql += 'COMMIT;\n';
  fs.writeFileSync('C:/Users/JANMEJAY/.gemini/antigravity-ide/brain/70921bd4-5cc3-4ab4-af65-797792d868c0/fix_brackets.sql', sql);
  console.log(`Generated fix_brackets.sql with ${matches.length} matches`);
}

run();
