const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Absolute paths (no confusion anymore)
const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
const dataPath = path.join(__dirname, "tournament-data.json");

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Read JSON safely
const data = JSON.parse(
  fs.readFileSync(dataPath, "utf8")
);

async function upload() {
  try {
    await db.collection("live_data").doc("tournament").set(data);
    console.log("✅ Data uploaded successfully");
  } catch (error) {
    console.error("❌ Upload failed:", error);
  }
}

upload();