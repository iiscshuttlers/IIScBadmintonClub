const fs = require('fs');

const dataSqlPath = 'e:\\Github\\IIScBadmintonClub\\scratch_backup\\data.sql';
const sql = fs.readFileSync(dataSqlPath, 'utf8');

// Find the INSERT INTO "public"."tournament_matches" block
const matchStart = sql.indexOf('INSERT INTO "public"."tournament_matches"');
if (matchStart === -1) {
  console.log('No matches found');
  process.exit(1);
}

// Find the end of this statement (a semicolon)
const matchEnd = sql.indexOf(';\n', matchStart);
const insertBlock = sql.substring(matchStart, matchEnd);

// Split by line
const lines = insertBlock.split('\n');
const mdLines = [];

for (const line of lines) {
  if (line.includes("'MD'")) {
    // It's an MD match!
    // The line format is: \t('id', ..., false),
    // We need to keep the exact row data.
    mdLines.push(line.trim());
  }
}

// Clean up trailing commas if any
if (mdLines.length > 0 && mdLines[mdLines.length - 1].endsWith(',')) {
    mdLines[mdLines.length - 1] = mdLines[mdLines.length - 1].slice(0, -1);
}

const finalSql = `
DELETE FROM public.tournament_matches WHERE category = 'MD' AND tournament_id = '62c5341c-df12-4511-9253-a9a0e9546667';

INSERT INTO "public"."tournament_matches" ("id", "tournament_id", "category", "match_code", "round", "round_name", "match_number", "player1_id", "player3_id", "team1_label", "player2_id", "player4_id", "team2_label", "court_number", "scheduled_at", "points_to_win", "best_of_sets", "golden_point", "winner_side", "winner_id", "score", "sets_history", "status", "locked", "advances_to_match", "advances_to_position", "advances_to_match_loser", "advances_to_position_loser", "umpired_by", "scored_by", "scored_at", "created_at", "started_at", "ended_at", "reminder_sent") VALUES
${mdLines.join('\n')};
`;

fs.writeFileSync('e:\\Github\\IIScBadmintonClub\\scratch_backup\\md_restore.sql', finalSql);
console.log(`Saved ${mdLines.length} MD matches to md_restore.sql`);
