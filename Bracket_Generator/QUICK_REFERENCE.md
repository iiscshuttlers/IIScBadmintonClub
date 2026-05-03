# 📋 Quick Copy-Paste Reference

## Exactly Where Each File Goes

### 1. FarewellTournament.tsx
```
FROM: Downloaded file "FarewellTournament.tsx"
TO:   E:\Github\iiscshuttlers\client\src\pages\FarewellTournament.tsx
ACTION: REPLACE existing file
```

### 2. FarewellAdmin.tsx  
```
FROM: Downloaded file "FarewellAdmin.tsx"
TO:   E:\Github\iiscshuttlers\client\src\pages\FarewellAdmin.tsx
ACTION: REPLACE existing file
```

### 3. tournament-generator.js
```
FROM: Downloaded file "tournament-generator.js"
TO:   E:\Github\iiscshuttlers\client\scripts\tournament-generator.js
ACTION: CREATE new folder "scripts" first, then copy
```

### 4. tournament-data.json
```
STEP 1: Generate it
  cd E:\Github\iiscshuttlers\client\scripts
  node tournament-generator.js
  
STEP 2: Copy to public
  FROM: E:\Github\iiscshuttlers\client\scripts\tournament-data.json
  TO:   E:\Github\iiscshuttlers\client\public\tournament-data.json
  ACTION: REPLACE existing file

STEP 3: Upload to Firebase
  Firebase Console → Firestore → live_data → tournament
  Copy entire JSON content and paste as fields
```

## Git Commands

```bash
# Navigate to your repo
cd E:\Github\iiscshuttlers\client

# Check what changed
git status

# Add changed files
git add src/pages/FarewellTournament.tsx
git add src/pages/FarewellAdmin.tsx
git add public/tournament-data.json
git add scripts/tournament-generator.js

# Commit
git commit -m "feat: Add live scores section and tournament generator"

# Push
git push origin main
```

## Visual Checklist

- [ ] **Step 1:** Copy FarewellTournament.tsx → `src/pages/`
- [ ] **Step 2:** Copy FarewellAdmin.tsx → `src/pages/`
- [ ] **Step 3:** Create folder `scripts/`
- [ ] **Step 4:** Copy tournament-generator.js → `scripts/`
- [ ] **Step 5:** Run `node scripts/tournament-generator.js`
- [ ] **Step 6:** Copy generated JSON → `public/tournament-data.json`
- [ ] **Step 7:** Upload JSON to Firebase Firestore
- [ ] **Step 8:** Test locally: `npm run dev`
- [ ] **Step 9:** Commit and push to GitHub
- [ ] **Step 10:** Verify live at your URL

## Firebase Upload (Manual Method)

1. Open Firebase Console
2. Go to Firestore Database
3. Navigate to: `live_data` collection
4. Click on `tournament` document
5. Click "Edit document" or create if doesn't exist
6. Delete all existing fields
7. Open `public/tournament-data.json` in text editor
8. Copy **entire** content
9. Paste into Firebase (it will parse the JSON)
10. Click "Update" / "Save"

## Testing After Deploy

### Test 1: Basic Load
- Go to `/farewell` on your website
- Click "Live Brackets" tab
- Should see format tabs: MS | WS | MD | WD | XD
- Bracket should display

### Test 2: Live Scores
- In Firebase Firestore: `live_data/tournament`
- Find any match, change `Status` to `"in-progress"`
- Refresh your website
- Should see red "🔴 LIVE NOW" panel appear at top

### Test 3: Admin Panel
- Go to `/farewell-admin`
- Sign in with Google
- Select a format and match
- Enter scores, push update
- Check public view - should update instantly

## File Sizes (FYI)

- FarewellTournament.tsx: ~11 KB
- FarewellAdmin.tsx: ~7 KB
- tournament-generator.js: ~6 KB
- tournament-data.json: ~11 KB (41 matches)

Total: ~35 KB of changes

## What Changed

### In FarewellTournament.tsx
- ✨ NEW: Live matches panel (red)
- ✨ NEW: Recent results panel (green)
- 🔧 Enhanced: Bracket visual indicators
- 🔧 Enhanced: Real-time score display

### In FarewellAdmin.tsx
- ✔️ No changes (already perfect)

### New Files
- 📄 tournament-generator.js (creates brackets)
- 📄 tournament-data.json (generated data)

---

**Need help?** Check EXACT_DEPLOYMENT.md for detailed troubleshooting.
