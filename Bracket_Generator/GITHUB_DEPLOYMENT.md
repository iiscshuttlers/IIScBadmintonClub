# 📂 GitHub Deployment Guide

## File Structure for Your Repository

```
your-repo/
├── src/
│   ├── components/
│   │   ├── FarewellTournament.tsx    ← Updated (public view with live scores)
│   │   └── FarewellAdmin.tsx         ← Keep as is (admin/umpire interface)
│   │
│   └── lib/
│       └── firebase.ts                ← Your Firebase config (already exists)
│
├── public/
│   ├── farewell-qr.png               ← Your QR code image (already exists)
│   └── tournament-data.json          ← Generated data (for reference/backup)
│
├── scripts/
│   └── tournament-generator.js       ← Generator script (for future tournaments)
│
├── docs/                             ← Documentation (optional)
│   ├── README.md                     ← Full documentation
│   └── QUICKSTART.md                 ← Quick start guide
│
└── bracket-demo.html                 ← Standalone demo (optional, for testing)
```

## 📝 Where to Put Each File

### 1. **React Components** (Main App Files)
Location: `src/components/`

```bash
src/components/FarewellTournament.tsx  # Updated with live scores
src/components/FarewellAdmin.tsx       # Keep your existing one (already perfect)
```

**What changed in FarewellTournament.tsx:**
- ✅ Added live scores section at top showing matches in progress
- ✅ Added recent results panel 
- ✅ Enhanced visual indicators (pulsing borders for live matches)
- ✅ Better real-time display with score breakdowns

### 2. **Tournament Generator Script**
Location: `scripts/` or project root

```bash
scripts/tournament-generator.js
```

**Usage:**
```bash
cd scripts
node tournament-generator.js
# Creates tournament-data.json
```

### 3. **Generated Tournament Data**
Location: `public/` (for static reference) AND Firebase

```bash
public/tournament-data.json  # Backup/reference only
```

**Important:** The actual live data lives in **Firebase Firestore**, not in your repo!

### 4. **Documentation Files**
Location: Project root or `docs/`

```bash
README.md          # Full documentation
QUICKSTART.md      # Quick start guide
```

### 5. **Demo HTML** (Optional)
Location: Project root or `demo/`

```bash
bracket-demo.html  # Standalone bracket viewer for testing
```

## 🔥 Firebase Setup (Critical!)

### Upload Initial Tournament Data

**Option A: Firebase Console (Manual)**
1. Go to Firebase Console → Firestore Database
2. Create collection: `live_data`
3. Create document: `tournament`
4. Copy contents of `tournament-data.json` and paste as fields

**Option B: Using Firebase Admin SDK (Script)**

Create `scripts/upload-to-firebase.js`:
```javascript
const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccount = require('./path-to-your-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Read tournament data
const tournamentData = JSON.parse(fs.readFileSync('./tournament-data.json', 'utf8'));

// Upload to Firestore
db.collection('live_data').doc('tournament').set(tournamentData)
  .then(() => {
    console.log('✅ Tournament data uploaded successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error uploading:', error);
    process.exit(1);
  });
```

Run:
```bash
cd scripts
node upload-to-firebase.js
```

### Firestore Security Rules

Add to Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Tournament data
    match /live_data/tournament {
      allow read: if true;  // Anyone can view
      allow write: if request.auth != null;  // Only authenticated users can update
    }
  }
}
```

## 🚀 Deployment Steps

### Step 1: Update Your Repository

```bash
# Navigate to your local repo
cd your-lhsr-website

# Create/update files
# - Replace src/components/FarewellTournament.tsx with new version
# - Keep src/components/FarewellAdmin.tsx as is
# - Add scripts/tournament-generator.js
# - Add public/tournament-data.json (optional, for backup)

# Commit changes
git add .
git commit -m "feat: Add live scores section and tournament generator"
git push origin main
```

### Step 2: Generate Tournament Data

```bash
# Run generator locally
cd scripts
node tournament-generator.js

# This creates tournament-data.json
```

### Step 3: Upload to Firebase

```bash
# Use Firebase Console or upload script (see above)
# Upload to: live_data/tournament
```

### Step 4: Deploy Website

If using **GitHub Pages:**
```bash
npm run build
npm run deploy
```

If using **Vercel/Netlify:**
- Push to GitHub
- They auto-deploy from main branch

## 🎯 Component Integration

### In Your Main App Router

```typescript
import FarewellTournament from './components/FarewellTournament';
import FarewellAdmin from './components/FarewellAdmin';

// In your routes
<Route path="/farewell" element={<FarewellTournament />} />
<Route path="/farewell/admin" element={<FarewellAdmin />} />
```

## 📱 User Access URLs

After deployment:

- **Public View:** `https://yoursite.com/farewell` 
  - Shows registration + live scores + brackets
  - Updates in real-time as umpires enter scores
  
- **Admin Panel:** `https://yoursite.com/farewell/admin`
  - Google auth required
  - Umpire score entry interface

## 🔄 Workflow

### Before Tournament
1. ✅ Run `tournament-generator.js`
2. ✅ Review generated `tournament-data.json`
3. ✅ Upload to Firebase Firestore
4. ✅ Verify on public view that brackets appear

### During Tournament
1. 🎯 Umpires log in to `/farewell/admin`
2. 🎯 Select match, enter scores, push updates
3. 🎯 Public view auto-updates in real-time
4. 🎯 Live scores section shows active matches

### After Tournament
1. 📊 All data persists in Firebase
2. 📊 Can export from Firestore for records
3. 📊 Generate new data for next tournament

## 🎨 Visual Features

### New Live Scores Section

**Live Matches Panel (Red):**
- Shows all matches currently `in-progress`
- Pulsing red border and badge
- Real-time score updates
- Automatically appears/disappears as matches start/end

**Recent Results Panel (Green):**
- Shows last 6 completed matches
- Winners highlighted with 🏆
- Final scores displayed
- Scrollable list

### Enhanced Bracket View
- Live matches have pulsing red border
- Score displays for each set
- Winner highlighting in brackets
- TBD placeholders for upcoming matches

## 🐛 Troubleshooting

**Q: Live scores not showing?**
```bash
# Check Firebase connection
# Verify at least one match has Status: "in-progress"
```

**Q: Bracket empty?**
```bash
# Verify tournament-data.json uploaded to Firestore
# Check path: live_data/tournament
# Check browser console for errors
```

**Q: Admin can't update?**
```bash
# Verify user is authenticated (Google sign-in)
# Check Firestore security rules allow authenticated writes
```

## 📊 Data Flow

```
Umpire (Admin Panel)
    ↓
Updates Firebase Firestore
    ↓
Real-time Listener (onSnapshot)
    ↓
Public View Auto-Updates
    ↓
Spectators See Live Scores
```

## 🎓 Example Commit Messages

```bash
git commit -m "feat: Add live scores panel to tournament view"
git commit -m "chore: Add tournament generator script"
git commit -m "docs: Add deployment guide"
git commit -m "fix: Update Firestore security rules"
```

## 📞 Quick Reference

| File | Purpose | Location |
|------|---------|----------|
| `FarewellTournament.tsx` | Public bracket view | `src/components/` |
| `FarewellAdmin.tsx` | Umpire score entry | `src/components/` |
| `tournament-generator.js` | Generate initial data | `scripts/` |
| `tournament-data.json` | Generated bracket data | `public/` (backup) |
| Firebase Firestore | Live tournament state | Cloud (Firestore) |

---

**Ready to deploy?** Follow Step 1-4 above and you're live! 🚀
