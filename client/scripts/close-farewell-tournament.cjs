/**
 * Closes the Farewell tournament in Firebase.
 *
 * Usage:
 *   node close-farewell-tournament.cjs
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));
const dataPath = path.join(__dirname, "tournament-data.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const tournamentData = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const now = new Date().toISOString();
const champions = tournamentData.config.champions;

async function closeFarewellTournament() {
  await db.collection("live_data").doc("tournament").set({
    ...tournamentData,
    lastUpdated: now,
    config: {
      ...tournamentData.config,
      status: "archived",
      archivedAt: now,
      champions,
    },
  });

  const tournaments = await db.collection("tournaments").get();
  const matchingDocs = tournaments.docs.filter((doc) => {
    const data = doc.data();
    const slug = String(data.slug || "").toLowerCase();
    const name = String(data.name || data.title || "").toLowerCase();
    return slug.includes("farewell") || name.includes("farewell");
  });

  await Promise.all(
    matchingDocs.map((doc) =>
      doc.ref.update({
        status: "completed",
        archivedAt: now,
        completedAt: now,
        champions,
      })
    )
  );

  console.log("Farewell tournament archived.");
  console.log(`Updated live_data/tournament and ${matchingDocs.length} tournament record(s).`);
}

closeFarewellTournament()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed to archive Farewell tournament:", err);
    process.exit(1);
  });
