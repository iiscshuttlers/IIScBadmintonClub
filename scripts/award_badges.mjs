import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
} catch (e) {
  // ignore if not found
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase credentials in env.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runAchievementEngine() {
  console.log("🏆 Starting Achievement Engine...");

  // Fetch all players
  const { data: players, error: playerErr } = await supabase
    .from("players")
    .select("id, full_name, achievements");

  if (playerErr || !players) {
    console.error("Failed to fetch players:", playerErr);
    process.exit(1);
  }

  // Fetch all confirmed matches
  const { data: matches, error: matchErr } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "confirmed")
    .order("created_at", { ascending: true });

  if (matchErr || !matches) {
    console.error("Failed to fetch matches:", matchErr);
    process.exit(1);
  }

  console.log(`Found ${players.length} players and ${matches.length} confirmed matches.`);

  let updatesCount = 0;

  for (const player of players) {
    const currentAchievements = Array.isArray(player.achievements) ? player.achievements : [];
    const newAchievements = new Set(currentAchievements);

    // Player matches
    const pMatches = matches.filter(
      (m) =>
        m.player1_id === player.id ||
        m.player2_id === player.id ||
        m.team1_partner_id === player.id ||
        m.team2_partner_id === player.id
    );

    // 1. Ironman (50+ matches)
    if (pMatches.length >= 50) {
      newAchievements.add("Ironman");
    }

    // 2. Early Bird / Night Owl
    pMatches.forEach((m) => {
      const date = new Date(m.created_at);
      const hour = date.getHours();
      if (hour < 7) newAchievements.add("Early Bird");
      if (hour >= 22) newAchievements.add("Night Owl");
    });

    // Calculate streaks and upsets
    let currentStreak = 0;
    let maxStreak = 0;

    pMatches.forEach((m) => {
      const isWinner =
        m.winner_id === player.id ||
        (m.winner_id === m.player1_id && m.team1_partner_id === player.id) ||
        (m.winner_id === m.player2_id && m.team2_partner_id === player.id);

      if (isWinner) {
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;

        // Giant Slayer check (assuming p1 is winner for diff check)
        // Wait, upsetScore is stored in upsetScore, but let's just check if upset
        // If elo_change_p1 and elo_change_p2 are present, huge elo change means big upset
        // Simple heuristic: if elo change is > 20 for this player, it's a giant slay
        const myChange =
          m.player1_id === player.id
            ? m.elo_change_p1
            : m.player2_id === player.id
              ? m.elo_change_p2
              : 0;

        if (myChange && myChange >= 25) {
          newAchievements.add("Giant Slayer");
        }
      } else {
        currentStreak = 0;
      }
    });

    // 3. Flawless (5+ win streak)
    if (maxStreak >= 5) {
      newAchievements.add("Flawless");
    }
    
    // 4. Unstoppable (10+ win streak)
    if (maxStreak >= 10) {
      newAchievements.add("Unstoppable");
    }

    // Check if new achievements were added
    const updatedArray = Array.from(newAchievements);
    if (updatedArray.length !== currentAchievements.length) {
      console.log(`Updating ${player.full_name} with achievements: ${updatedArray.join(", ")}`);
      
      const { error } = await supabase
        .from("players")
        .update({ achievements: updatedArray })
        .eq("id", player.id);
        
      if (error) {
        console.error(`Failed to update ${player.full_name}:`, error);
      } else {
        updatesCount++;
      }
    }
  }

  console.log(`✅ Achievement Engine finished. Updated ${updatesCount} players.`);
  process.exit(0);
}

runAchievementEngine();
