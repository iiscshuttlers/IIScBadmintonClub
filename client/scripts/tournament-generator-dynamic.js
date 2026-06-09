#!/usr/bin/env node
/**
 * Dynamic Tournament Generator - ES Module Version
 * Reads from Farewell_2026_Seeding.xlsx
 */

import fs from "fs";
import XLSX from "xlsx";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read Excel file
function readExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const data = {};

  ["MS", "WS", "MD", "WD", "XD"].forEach((format) => {
    if (workbook.SheetNames.includes(format)) {
      const sheet = workbook.Sheets[format];
      const jsonData = XLSX.utils.sheet_to_json(sheet);
      data[format] = jsonData;
    }
  });

  return data;
}

// Process Singles format (MS, WS)
function processSinglesData(rawData) {
  return rawData
    .filter((row) => row.Player && row.Player !== "PlayerA")
    .map((row) => ({
      name: row.Player.trim(),
      department: row.Department ? row.Department.trim() : "Unknown",
      seed: row.Seeding || 999,
      level: row.Level || "Unknown",
    }))
    .sort((a, b) => a.seed - b.seed);
}

// Process Doubles format (MD, WD, XD)
function processDoublesData(rawData) {
  return rawData
    .filter((row) => row.Team && row.Team !== "PlayerA" && row.Sr_No)
    .map((row) => ({
      player1: (row.Team || "").toString().trim(),
      player2: (row.__EMPTY_1 || "").toString().trim(),
      department1: (row.__EMPTY || "").toString().trim(),
      department2: (row.__EMPTY_2 || "").toString().trim(),
      seed: row.Seeding || 999,
      level: row.Level || "Unknown",
    }))
    .filter((team) => team.player1 && team.player2)
    .sort((a, b) => a.seed - b.seed);
}

// Seeding patterns
const seedingPatterns = {
  16: [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15],
  8: [1, 8, 4, 5, 2, 7, 3, 6],
  7: [1, "BYE", 4, 5, 2, 7, 3, 6],
  6: [1, "BYE", 4, 5, 2, "BYE", 3, 6],
  4: [1, 4, 2, 3],
  3: [1, "BYE", 2, 3],
  2: [1, 2],
};

function getBracketSize(count) {
  let size = 2;
  while (size < count) size *= 2;
  return size;
}

function createSinglesRound1(format, players) {
  const matches = [];
  const bracketSize = getBracketSize(players.length);
  const pattern = seedingPatterns[bracketSize] || seedingPatterns[8];

  let matchNum = 1;
  const participantMap = {};
  players.forEach((p) => {
    participantMap[p.seed] = p;
  });

  for (let i = 0; i < pattern.length; i += 2) {
    const seed1 = pattern[i];
    const seed2 = pattern[i + 1];

    let player1, player2;

    if (seed1 === "BYE" || !participantMap[seed1]) {
      player1 = "Bye";
      const p2 = participantMap[seed2];
      player2 = p2 ? `${p2.name} (${p2.department})` : "Bye";
    } else if (seed2 === "BYE" || !participantMap[seed2]) {
      const p1 = participantMap[seed1];
      player1 = p1 ? `${p1.name} (${p1.department})` : "Bye";
      player2 = "Bye";
    } else {
      const p1 = participantMap[seed1];
      const p2 = participantMap[seed2];
      player1 = `${p1.name} (${p1.department})`;
      player2 = `${p2.name} (${p2.department})`;
    }

    const match = {
      Match_ID: `${format}_${matchNum}`,
      Round: "Round 1",
      Status:
        player1 === "Bye" || player2 === "Bye" ? "completed" : "scheduled",
      Score_1: "",
      Winner: "",
      Player_1: player1,
      Player_2: player2,
    };

    if (player1 === "Bye") match.Winner = player2;
    else if (player2 === "Bye") match.Winner = player1;

    matches.push(match);
    matchNum++;
  }

  return { matches, matchNum };
}

function createDoublesRound1(format, teams) {
  const matches = [];
  const bracketSize = getBracketSize(teams.length);
  const pattern = seedingPatterns[bracketSize] || seedingPatterns[8];

  let matchNum = 1;
  const participantMap = {};
  teams.forEach((t) => {
    participantMap[t.seed] = t;
  });

  for (let i = 0; i < pattern.length; i += 2) {
    const seed1 = pattern[i];
    const seed2 = pattern[i + 1];

    let players1, players2;

    if (seed1 === "BYE" || !participantMap[seed1]) {
      players1 = "Bye";
      const t2 = participantMap[seed2];
      players2 = t2
        ? `${t2.player1}/${t2.player2} (${t2.department1}/${t2.department2})`
        : "Bye";
    } else if (seed2 === "BYE" || !participantMap[seed2]) {
      const t1 = participantMap[seed1];
      players1 = t1
        ? `${t1.player1}/${t1.player2} (${t1.department1}/${t1.department2})`
        : "Bye";
      players2 = "Bye";
    } else {
      const t1 = participantMap[seed1];
      const t2 = participantMap[seed2];
      players1 = `${t1.player1}/${t1.player2} (${t1.department1}/${t1.department2})`;
      players2 = `${t2.player1}/${t2.player2} (${t2.department1}/${t2.department2})`;
    }

    const match = {
      Match_ID: `${format}_${matchNum}`,
      Round: "Round 1",
      Status:
        players1 === "Bye" || players2 === "Bye" ? "completed" : "scheduled",
      Score_1: "",
      Winner: "",
      Players_1: players1,
      Players_2: players2,
    };

    if (players1 === "Bye") match.Winner = players2;
    else if (players2 === "Bye") match.Winner = players1;

    matches.push(match);
    matchNum++;
  }

  return { matches, matchNum };
}

function createSubsequentRounds(format, round1Count, startMatchNum, isDoubles) {
  const matches = [];
  let matchNum = startMatchNum;

  const rounds = [
    { count: round1Count / 2, name: "Round 2" },
    { count: round1Count / 4, name: "Quarterfinals" },
    { count: round1Count / 8, name: "Semifinals" },
    { count: 1, name: "Final" },
  ].filter((r) => r.count >= 1);

  rounds.forEach((round) => {
    for (let i = 0; i < round.count; i++) {
      const match = {
        Match_ID: `${format}_${matchNum}`,
        Round: round.name,
        Status: "scheduled",
        Score_1: "",
        Winner: "",
      };

      if (isDoubles) {
        match.Players_1 = "TBD";
        match.Players_2 = "TBD";
      } else {
        match.Player_1 = "TBD";
        match.Player_2 = "TBD";
      }

      matches.push(match);
      matchNum++;
    }
  });

  return matches;
}

function generateFormatMatches(format, participants, isDoubles) {
  if (participants.length === 0) {
    console.warn(`⚠️  No participants found for ${format}`);
    return [];
  }

  const createRound1 = isDoubles ? createDoublesRound1 : createSinglesRound1;
  const { matches: round1, matchNum } = createRound1(format, participants);
  const laterRounds = createSubsequentRounds(
    format,
    round1.length,
    matchNum,
    isDoubles,
  );

  return [...round1, ...laterRounds];
}

function generateTournamentData(excelFilePath) {
  console.log("📖 Reading Excel file:", excelFilePath);
  const excelData = readExcelFile(excelFilePath);

  console.log("\n📊 Processing seeding data...\n");

  const msPlayers = processSinglesData(excelData.MS || []);
  const wsPlayers = processSinglesData(excelData.WS || []);
  const mdTeams = processDoublesData(excelData.MD || []);
  const wdTeams = processDoublesData(excelData.WD || []);
  const xdTeams = processDoublesData(excelData.XD || []);

  console.log(`✓ MS (Men's Singles): ${msPlayers.length} players`);
  console.log(`✓ WS (Women's Singles): ${wsPlayers.length} players`);
  console.log(`✓ MD (Men's Doubles): ${mdTeams.length} teams`);
  console.log(`✓ WD (Women's Doubles): ${wdTeams.length} teams`);
  console.log(`✓ XD (Mixed Doubles): ${xdTeams.length} teams`);

  const tournament = {
    formats: ["MS", "WS", "MD", "WD", "XD"],
    lastUpdated: new Date().toISOString(),
    config: {
      eventName: "Farewell Tournament 2026",
      venue: "IISc Gymkhana",
    },
    players: {},
    matches: {
      MS: generateFormatMatches("MS", msPlayers, false),
      WS: generateFormatMatches("WS", wsPlayers, false),
      MD: generateFormatMatches("MD", mdTeams, true),
      WD: generateFormatMatches("WD", wdTeams, true),
      XD: generateFormatMatches("XD", xdTeams, true),
    },
  };

  const totalMatches = Object.values(tournament.matches).reduce(
    (sum, matches) => sum + matches.length,
    0,
  );
  console.log(`\n✅ Generated ${totalMatches} total matches\n`);

  return tournament;
}

// MAIN EXECUTION
const excelPath = process.argv[2] || "./Farewell_2026_Seeding.xlsx";

console.log("🚀 Starting tournament generator...\n");

if (!fs.existsSync(excelPath)) {
  console.error(`❌ Error: Excel file not found at ${excelPath}`);
  console.log(
    "\nUsage: node tournament-generator-dynamic.js <path-to-excel-file>",
  );
  process.exit(1);
}

try {
  const tournamentData = generateTournamentData(excelPath);

  const outputPath = "./tournament-data.json";
  fs.writeFileSync(outputPath, JSON.stringify(tournamentData, null, 2));

  console.log(`✅ Tournament data saved to ${outputPath}`);
  console.log("\n📋 Summary:");
  Object.entries(tournamentData.matches).forEach(([format, matches]) => {
    console.log(`   ${format}: ${matches.length} matches`);
  });

  console.log("\n🎉 Done! Upload tournament-data.json to Firebase.\n");
} catch (error) {
  console.error("❌ Error generating tournament:", error.message);
  console.error(error.stack);
  process.exit(1);
}
