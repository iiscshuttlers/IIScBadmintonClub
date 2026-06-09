/**
 * patch-progression.cjs
 * Patches ONLY advancesTo fields in Firebase — does NOT touch scores/status/winner.
 * Safe to run at any time during tournament.
 *
 * Usage: node patch-progression.cjs
 */

const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// =====================================================================
// DEFINE PROGRESSIONS HERE — edit for each tournament
// Format: 'FORMAT': { 'MATCH_ID': { matchId: 'NEXT_ID', position: 1 or 2 } }
// position 1 = Player_1 / Players_1
// position 2 = Player_2 / Players_2
// =====================================================================
const PROGRESSIONS = {
  MS: {
    MS1: { matchId: "MS2", position: 2 },
    MS2: { matchId: "MS3", position: 2 },
  },
  WS: {
    // WS1 is final — no progression
  },
  XD: {
    XD1: { matchId: "XD3", position: 2 },
    XD2: { matchId: "XD4", position: 1 },
    XD3: { matchId: "XD4", position: 2 },
  },
  MD: {
    MD1: { matchId: "MD3", position: 2 },
    // Pool matches: winners determined manually by standings
  },
};

async function patchProgression() {
  const ref = db.collection("live_data").doc("tournament");
  const snap = await ref.get();

  if (!snap.exists) {
    console.error("Tournament document not found.");
    process.exit(1);
  }

  const data = snap.data();
  const updates = {};

  for (const [format, progressions] of Object.entries(PROGRESSIONS)) {
    const matches = data.matches[format];
    if (!matches) continue;

    const updated = matches.map((m) => {
      if (progressions[m.Match_ID]) {
        return { ...m, advancesTo: progressions[m.Match_ID] };
      }
      return m;
    });

    updates[`matches.${format}`] = updated;
  }

  await ref.update({
    ...updates,
    lastUpdated: new Date().toISOString(),
  });

  console.log("✅ Progression fields patched. Scores/status untouched.");
  process.exit(0);
}

patchProgression().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
