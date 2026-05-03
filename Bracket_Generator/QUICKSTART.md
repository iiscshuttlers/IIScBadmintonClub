# Quick Start Guide

## 🚀 Getting Started

### Step 1: Generate Tournament Data
```bash
node tournament-generator.js
```
This creates `tournament-data.json` with:
- MS: 16 players (15 matches)
- WS: 8 players (7 matches)
- MD: 8 teams (7 matches)
- WD: 6 teams (5 matches)
- XD: 7 teams (6 matches)

**Total: 41 matches across all formats**

### Step 2: View the Bracket (Static Demo)
Open `bracket-demo.html` in your browser to see the bracket visualization.

### Step 3: Upload to Firebase (For Live Updates)
1. Create a Firestore database
2. Upload `tournament-data.json` to: `live_data/tournament`
3. Set up authentication for admin access

### Step 4: Deploy React Components
- `FarewellAdmin.tsx`: Admin/Umpire interface
- `TournamentBracket.tsx`: Public bracket display

## 📋 File Overview

| File | Purpose | Usage |
|------|---------|-------|
| `tournament-generator.js` | Creates initial data | Run once at start |
| `tournament-data.json` | Tournament structure | Upload to Firebase |
| `bracket-demo.html` | Static bracket viewer | Open in browser |
| `FarewellAdmin.tsx` | Live score entry | For umpires |
| `TournamentBracket.tsx` | Live bracket display | For spectators |
| `README.md` | Full documentation | Reference guide |

## 🎯 Key Concepts

### Match Numbering
All matches numbered sequentially per format:
- `MS_1` through `MS_15` (16-player bracket)
- `WS_1` through `WS_7` (8-player bracket)
- etc.

### Seeding
Top seeds get favorable matchups:
- Seed 1 vs Seed 16 (or BYE if < 16)
- Seed 2 vs Seed 15
- Winners meet higher seeds later

### Score Format
Scores stored as: `"21-15, 19-21, 21-18"`
- First number = Player 1/Team 1
- Second number = Player 2/Team 2
- Sets separated by commas

### Match Statuses
- **scheduled**: Not started
- **in-progress**: Currently playing (shows LIVE)
- **completed**: Finished (must have winner)

## 🔧 Customization

### Change Player Count
Edit `generateTournamentData()`:
```javascript
matches: {
  MS: generateFormatMatches('MS', 32),  // Now 32 players
  // ...
}
```

### Add Real Names
Edit arrays in generator:
```javascript
const maleNames = ['Your', 'Real', 'Names', ...];
```

### Customize Tournament Info
```javascript
config: {
  eventName: 'Your Event Name',
  venue: 'Your Venue'
}
```

## 📱 Admin Workflow

1. **Select Format**: Tap MS/WS/MD/WD/XD
2. **Choose Match**: Pick from dropdown
3. **Enter Scores**: Tap +/- buttons
4. **Add Sets**: Tap + to add new set (max 5)
5. **Set Status**: Mark as Live or Completed
6. **Select Winner**: Choose winner if completed
7. **Push Update**: Sync to Firebase

## 🎨 Features Highlight

### Auto-Complete BYE Matches
```json
{
  "Player_1": "Seed 1 (CSA)",
  "Player_2": "Bye",
  "Status": "completed",
  "Winner": "Seed 1 (CSA)"
}
```

### Live Match Indicator
Matches with `Status: "in-progress"` show:
- 🔴 LIVE badge
- Pulsing border
- Red shadow effect

### Winner Highlighting
Winners show:
- 🏆 Trophy icon
- Green background
- Winning set scores highlighted

## 🐛 Troubleshooting

**Q: Bracket looks empty?**
- Check `tournament-data.json` exists in same directory as `bracket-demo.html`

**Q: Admin can't push updates?**
- Verify Firebase auth is working
- Check Firestore security rules

**Q: Scores not updating?**
- Confirm Firebase connection
- Check browser console for errors

## 📊 Database Structure

```
Firestore
└── live_data
    └── tournament
        ├── formats: ["MS", "WS", ...]
        ├── config: {...}
        ├── matches
        │   ├── MS: [...]
        │   ├── WS: [...]
        │   └── ...
        └── lastUpdated: "ISO timestamp"
```

## 🎓 Next Steps

1. ✅ Generate your data
2. ✅ Test with bracket demo
3. ⬜ Set up Firebase project
4. ⬜ Deploy admin interface
5. ⬜ Deploy public bracket view
6. ⬜ Run your tournament!

---

**Need help?** Check the full `README.md` for detailed documentation.
