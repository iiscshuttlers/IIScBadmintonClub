const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://htejmhsqqlfedlajqqyv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZWptaHNxcWxmZWRsYWpxcXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc1NjAsImV4cCI6MjA5ODkzMzU2MH0.2HhspVm0_ncPvEsv7-qET_6SYtjTP1s6nUbwuy30FRk"
);

async function checkVotes() {
  const { data: votes, error } = await supabase
    .from("live_match_votes")
    .select(`
      live_match_id,
      pick,
      user_id,
      players:user_id (full_name)
    `);
    
  if (error) {
    console.error("Error fetching votes:", error);
    return;
  }
  
  // Find votes where either player is likely Raja Janmejay or Anurag
  const relevantVotes = votes.filter(v => v.live_match_id.includes("m") || true);
  
  // Group by match_id
  const byMatch = {};
  for (const v of relevantVotes) {
    if (!byMatch[v.live_match_id]) byMatch[v.live_match_id] = [];
    byMatch[v.live_match_id].push({ pick: v.pick, user: v.players?.full_name || v.user_id });
  }
  
  console.log(JSON.stringify(byMatch, null, 2));
}

checkVotes();
