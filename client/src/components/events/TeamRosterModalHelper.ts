// Smart gender resolver with fallback heuristics for guest rosters
export function resolveMemberGender(gender?: string | null, name?: string): "Male" | "Female" {
  if (gender) {
    const g = gender.trim().toLowerCase();
    if (g.startsWith("f") || g === "female" || g === "w" || g === "women") return "Female";
    if (g.startsWith("m") || g === "male") return "Male";
  }
  if (name) {
    const clean = name.toLowerCase().replace(/\s*\(guest\)\s*/i, "").trim();
    const firstName = clean.split(" ")[0];
    const femaleNames = new Set([
      "alice", "priya", "sara", "sarah", "neha", "kavya", "ananya", "pooja", 
      "sneha", "ritu", "radhika", "ushnaa", "jefrin", "divya", "swati", "tanvi",
      "deepa", "meera", "nisha", "riya", "shreya", "sharmitha", "megha", "aditi",
      "sakshi", "aishwarya", "anjali", "sunita", "rekha", "parvathi", "lakshmi"
    ]);
    if (femaleNames.has(firstName)) return "Female";
  }
  return "Male";
}
