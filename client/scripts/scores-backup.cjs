/**
 * scores-backup.cjs
 * Usage:
 *   node scores-backup.cjs backup   — saves current scores to scores-backup.json
 *   node scores-backup.cjs restore  — restores scores from scores-backup.json into Firebase
 *
 * Workflow when you need to re-upload tournament-data.json:
 *   1. node scores-backup.cjs backup
 *   2. node upload.cjs              (re-seeds full data)
 *   3. node scores-backup.cjs restore
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const ref = db.collection("live_data").doc("tournament");
const BACKUP_FILE = path.join(__dirname, "scores-backup.json");

// Fields to preserve per match
const FIXED_FIELDS = ["Status", "Winner"];

async function backup() {
  const snap = await ref.get();
  if (!snap.exists) { console.error("No tournament doc."); process.exit(1); }

  const data = snap.data();
  const scores = {};

  for (const [format, matches] of Object.entries(data.matches)) {
    scores[format] = {};
    for (const m of matches) {
      scores[format][m.Match_ID] = {};
      // Fixed fields
      for (const f of FIXED_FIELDS) {
        scores[format][m.Match_ID][f] = m[f] ?? "";
      }
      // All Score_* fields dynamically
      for (const key of Object.keys(m)) {
        if (key.startsWith("Score_")) {
          scores[format][m.Match_ID][key] = m[key] ?? "";
        }
      }
    }
  }

  fs.writeFileSync(BACKUP_FILE, JSON.stringify(scores, null, 2));
  console.log(`✅ Scores backed up to scores-backup.json`);
  process.exit(0);
}

async function restore() {
  if (!fs.existsSync(BACKUP_FILE)) {
    console.error("scores-backup.json not found. Run backup first.");
    process.exit(1);
  }

  const scores = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf8"));
  const snap = await ref.get();
  if (!snap.exists) { console.error("No tournament doc."); process.exit(1); }

  const data = snap.data();
  const updates = {};

  for (const [format, matchScores] of Object.entries(scores)) {
    const matches = data.matches[format];
    if (!matches) continue;

    const updated = matches.map(m => {
      if (matchScores[m.Match_ID]) {
        return { ...m, ...matchScores[m.Match_ID] };
      }
      return m;
    });

    updates[`matches.${format}`] = updated;
  }

  await ref.update({ ...updates, lastUpdated: new Date().toISOString() });
  console.log("✅ Scores restored.");
  process.exit(0);
}

const cmd = process.argv[2];
if (cmd === "backup") backup();
else if (cmd === "restore") restore();
else {
  console.log("Usage: node scores-backup.cjs backup|restore");
  process.exit(1);
}
