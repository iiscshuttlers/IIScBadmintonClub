# Google Sheets → Website Brackets - Complete Setup Guide

## 🎯 What You'll Have

1. **You update Google Sheets** - add scores, winners, status
2. **Website auto-updates** - pulls data every 30 seconds
3. **Shows as brackets** - visual tournament tree
4. **Zero manual work** - just edit the sheet!

---

## 📋 Step 1: Publish Your Google Sheets

### 1.1 Open Your Google Sheets

https://docs.google.com/spreadsheets/d/1349yetmbCMyrfdRWCwIBCj_GU8-xW0kr8Jnj2ycrSz0/edit

### 1.2 Publish Each Sheet as CSV

**For EACH format (MS_Matches, WS_Matches, XD_Matches, MD_Matches, WD_Matches):**

1. Click **File** → **Share** → **Publish to web**
2. In the dropdown, select the specific sheet (e.g., "MS_Matches")
3. Change "Web page" to **"Comma-separated values (.csv)"**
4. Click **Publish**
5. Copy the URL (looks like: `https://docs.google.com/spreadsheets/d/e/YOUR_ID/pub?gid=SHEET_ID&single=true&output=csv`)
6. Save this URL!

**Repeat for all 5 formats** and save URLs like:

```
MS: https://docs.google.com/...MS_Matches...csv
WS: https://docs.google.com/...WS_Matches...csv  
XD: https://docs.google.com/...XD_Matches...csv
MD: https://docs.google.com/...MD_Matches...csv
WD: https://docs.google.com/...WD_Matches...csv
```

---

## 📋 Step 2: Define Your Bracket Structure

Edit `bracket-structure.json` to match YOUR tournament:

### Example: MS Format (8 players → Single Elimination)

```json
{
  "MS": {
    "format": "Single Elimination",
    "rounds": [
      {
        "name": "Quarterfinals",
        "matches": ["MS_1", "MS_2", "MS_3", "MS_4"]
      },
      {
        "name": "Semifinals",
        "matches": ["MS_5", "MS_6"],
        "connections": {
          "MS_5": { "from": ["MS_1", "MS_2"] },
          "MS_6": { "from": ["MS_3", "MS_4"] }
        }
      },
      {
        "name": "Final",
        "matches": ["MS_7"],
        "connections": {
          "MS_7": { "from": ["MS_5", "MS_6"] }
        }
      }
    ]
  }
}
```

**This means:**
- **MS_1** and **MS_2** winners play in **MS_5**
- **MS_3** and **MS_4** winners play in **MS_6**  
- **MS_5** and **MS_6** winners play in **MS_7** (Final)

### Your Bracket:

You tell me:
- How many players in each format?
- What's the knockout structure? (QF → SF → F)?
- Which matches feed into which?

I'll help you create the exact JSON structure!

---

## 📋 Step 3: Add to Your Website

### 3.1 Add Files to Repository

```bash
cd iiscshuttlers

# Add bracket structure
cp bracket-structure.json client/public/

# Add React component
cp FarewellBrackets.tsx client/src/pages/
```

### 3.2 Update Component with Your URLs

Edit `client/src/pages/FarewellBrackets.tsx`:

```typescript
const SHEETS_URLS = {
  MS: 'YOUR_MS_CSV_URL_HERE',  // ← Paste your MS URL
  WS: 'YOUR_WS_CSV_URL_HERE',  // ← Paste your WS URL
  XD: 'YOUR_XD_CSV_URL_HERE',  // ← Paste your XD URL
  MD: 'YOUR_MD_CSV_URL_HERE',  // ← Paste your MD URL
  WD: 'YOUR_WD_CSV_URL_HERE'   // ← Paste your WD URL
};
```

### 3.3 Add Route

Edit `client/src/App.tsx`:

```typescript
import FarewellBrackets from './pages/FarewellBrackets';

// Add route
<Route path="/farewell" component={FarewellBrackets} />
```

### 3.4 Add Navigation Link

Edit your nav component:

```typescript
<Link href="/farewell">🏆 Farewell Tournament</Link>
```

### 3.5 Deploy

```bash
git add .
git commit -m "Add farewell tournament brackets"
git push origin main
```

**Live at:** `https://iiscshuttlers.github.io/iiscshuttlers/farewell`

---

## ✏️ Step 4: Update Scores in Google Sheets

### Your Google Sheets Columns:

```
Match_ID | Round | Player_1 | Set-1 | Set-2 | Set-3 | Player_2 | Winner | Status
MS_1     | QF    | Aneesh   | 21-18 | 19-21 | 21-15 | Raja     | Aneesh | completed
MS_2     | QF    | KD       | 15-21 |       |       | Varun    |        | in-progress
```

### Update Process:

1. **Before match:** Status = `scheduled`
2. **Match starts:** Status = `in-progress`
3. **Update scores:** Fill Set-1, Set-2, Set-3 (format: `21-18`)
4. **Match ends:** 
   - Fill Winner column
   - Status = `completed`

**Website auto-updates in 30 seconds!**

---

## 🎨 How Brackets Look

### Round Robin (MS, WS, MD):
```
┌────────────────────┐  ┌────────────────────┐
│  MS_1: Aneesh      │  │  MS_2: KD          │
│  21-18             │  │  15-21             │
│  vs Raja           │  │  vs Varun          │
│  ✓ Aneesh wins     │  │  In Progress...    │
└────────────────────┘  └────────────────────┘
```

### Knockout (XD, WD):
```
Quarterfinals          Semifinals              Final
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  XD_1        │───┐   │  XD_5        │───┐   │  XD_7        │
│  Team 1      │   └───│  Winner XD_1 │   └───│  Champion    │
│  vs Team 2   │       │  vs          │       │              │
└──────────────┘       │  Winner XD_2 │       └──────────────┘
                       └──────────────┘
┌──────────────┐       
│  XD_2        │───┘   
│  Team 3      │       
│  vs Team 4   │       
└──────────────┘       
```

---

## 🔄 Data Flow Diagram

```
Google Sheets (You edit here)
        ↓
Published as CSV (auto-updated)
        ↓
Website fetches every 30s
        ↓
Displays as brackets
        ↓
Users see live scores!
```

---

## 🛠️ Customization

### Change Auto-Refresh Time

In `FarewellBrackets.tsx`:

```typescript
// Change from 30 seconds to 10 seconds
const interval = setInterval(loadAllMatches, 10000);  // 10000 = 10 seconds
```

### Add More Rounds

In `bracket-structure.json`:

```json
{
  "name": "Round of 16",
  "matches": ["MS_1", "MS_2", ... "MS_8"]
}
```

### Change Colors

```typescript
// Live match color
className="border-yellow-400" → className="border-red-400"

// Completed match color  
className="border-green-300" → className="border-blue-300"
```

---

## 🐛 Troubleshooting

### Problem: Data not loading

**Check:**
1. Are CSV URLs correct in `SHEETS_URLS`?
2. Is Google Sheet published to web?
3. Open CSV URL directly in browser - does it show data?

### Problem: Brackets not connecting properly

**Check:**
1. Is `bracket-structure.json` in `/client/public/`?
2. Do Match_IDs in JSON match your Google Sheets?
3. Browser console for errors

### Problem: Scores not updating

**Wait 30 seconds** for auto-refresh, or click "Refresh" button

---

## 📊 Example Bracket Structure for Different Formats

### 8-Player Single Elimination (MS, WS)

```json
{
  "MS": {
    "format": "Single Elimination",
    "rounds": [
      {
        "name": "Quarterfinals",
        "matches": ["MS_1", "MS_2", "MS_3", "MS_4"]
      },
      {
        "name": "Semifinals",
        "matches": ["MS_5", "MS_6"],
        "connections": {
          "MS_5": { "from": ["MS_1", "MS_2"] },
          "MS_6": { "from": ["MS_3", "MS_4"] }
        }
      },
      {
        "name": "Final",
        "matches": ["MS_7"],
        "connections": {
          "MS_7": { "from": ["MS_5", "MS_6"] }
        }
      }
    ]
  }
}
```

### Round Robin + Knockout (XD, WD)

```json
{
  "XD": {
    "format": "League + Knockout",
    "rounds": [
      {
        "name": "League Stage",
        "matches": ["XD_1", "XD_2", "XD_3", ... "XD_15"]
      },
      {
        "name": "Semifinals",
        "matches": ["XD_16", "XD_17"],
        "note": "Top 4 teams from league"
      },
      {
        "name": "Final",
        "matches": ["XD_18"],
        "connections": {
          "XD_18": { "from": ["XD_16", "XD_17"] }
        }
      }
    ]
  }
}
```

---

## ✅ Quick Checklist

- [ ] Publish all 5 Google Sheets tabs as CSV
- [ ] Save all 5 CSV URLs
- [ ] Create `bracket-structure.json` with your tournament structure
- [ ] Update `SHEETS_URLS` in `FarewellBrackets.tsx` with your URLs
- [ ] Add files to repository
- [ ] Add route and navigation
- [ ] Deploy to GitHub
- [ ] Test by updating a score in Google Sheets
- [ ] Verify website updates within 30 seconds

---

## 🎯 What Happens When You Update Google Sheets

**You type in Google Sheets:**
```
MS_1: Set-1 = "21-18", Winner = "Aneesh", Status = "completed"
```

**Within 30 seconds, website shows:**
```
┌────────────────────────┐
│  MS_1 - Quarterfinals  │
│  ✓ COMPLETED           │
│                        │
│  Aneesh  🏆            │
│  21-18                 │
│  Raja                  │
└────────────────────────┘
```

**No manual export, no file upload, no rebuild!**

---

## 💡 Pro Tips

1. **Test with one format first** (MS) before setting up all 5
2. **Keep Match_IDs consistent** between Google Sheets and bracket structure
3. **Use Status wisely:**
   - `scheduled` = gray border
   - `in-progress` = yellow border, LIVE badge, pulsing
   - `completed` = green border, winner highlighted
4. **Score format:** Use `21-18` or `18-21` (dash separated)
5. **Winner name must match Player_1 or Player_2 exactly**

---

## 🚀 You're Ready!

**Next steps:**
1. Send me your bracket structure (how many rounds, which matches connect)
2. I'll create the exact `bracket-structure.json` for you
3. You publish your Google Sheets
4. Paste URLs
5. Deploy
6. Done! ✅

**Your tournament will be live and auto-updating!**

Questions? Just ask - I'll help you set it up perfectly!
