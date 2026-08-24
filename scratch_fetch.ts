const url = "https://htejmhsqqlfedlajqqyv.supabase.co/rest/v1/players?select=id,elo_rating,singles_elo,doubles_elo,mixed_elo,gender&deleted_at=is.null";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZWptaHNxcWxmZWRsYWpxcXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc1NjAsImV4cCI6MjA5ODkzMzU2MH0.2HhspVm0_ncPvEsv7-qET_6SYtjTP1s6nUbwuy30FRk";

async function run() {
  const res = await fetch(url, {
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`
    }
  });
  
  const data = await res.json();
  console.log("Total players fetched:", data.length);
  
  const targetId = "1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b";
  const targetPlayer = data.find((p: any) => p.id.toLowerCase() === targetId.toLowerCase());
  const targetGender = targetPlayer?.gender?.toLowerCase() || "unknown";

  const sameGenderData = targetGender !== "unknown" 
    ? data.filter((p: any) => (p.gender || "").toLowerCase() === targetGender)
    : data;

  const sortedOverall = [...data].sort((a: any, b: any) => (b.elo_rating || 0) - (a.elo_rating || 0));
  const sortedSingles = [...sameGenderData].sort((a: any, b: any) => (b.singles_elo || 0) - (a.singles_elo || 0));

  const overallRank = sortedOverall.findIndex((p: any) => p.id.toLowerCase() === targetId.toLowerCase()) + 1;
  const singlesRank = sortedSingles.findIndex((p: any) => p.id.toLowerCase() === targetId.toLowerCase()) + 1;

  console.log("Overall Rank:", overallRank > 0 ? overallRank : null);
  console.log("Singles Rank:", singlesRank > 0 ? singlesRank : null);
}
run();
