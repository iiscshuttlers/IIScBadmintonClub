# Tournament Management System

A complete badminton tournament management system with seeding, bracket visualization, and live score updates.

## Features

### 1. **Tournament Data Generator** (`tournament-generator.js`)
Generates initial tournament structure with proper seeding based on Challonge-style brackets.

**Supported Formats:**
- **MS** (Men's Singles): 16 players
- **WS** (Women's Singles): 8 players  
- **MD** (Men's Doubles): 8 teams
- **WD** (Women's Doubles): 6 teams
- **XD** (Mixed Doubles): 7 teams

**Features:**
- Proper seeding (1v16, 8v9, 5v12, 4v13, etc.)
- Automatic BYE handling for incomplete brackets
- Random player/team generation with departments
- Match numbering: `MS_1`, `MS_2`, etc.

**Usage:**
```bash
node tournament-generator.js
```

This creates `tournament-data.json` with the complete tournament structure.

### 2. **Admin Panel** (`FarewellAdmin.tsx`)
Real-time score management interface for umpires.

**Features:**
- Google Authentication
- Live score updates with set-by-set tracking
- Score adjustment buttons (+/-)
- Multiple sets support (up to 5)
- Status management (Scheduled/Live/Completed)
- Winner selection
- Real-time Firebase sync

**Interface:**
- Big tap-friendly buttons for mobile umpires
- Set navigation tabs
- Live status indicators
- Auto-loads existing scores when selecting a match

### 3. **Bracket Visualization** (`TournamentBracket.tsx`)
Interactive tournament bracket display.

**Features:**
- Live match status (LIVE, DONE, PENDING)
- Score display per set
- Winner highlighting
- Round-by-round layout
- Responsive design
- Real-time updates from Firebase

## Data Structure

### Tournament JSON
```json
{
  "formats": ["MS", "WS", "MD", "WD", "XD"],
  "lastUpdated": "2026-05-03T16:00:00Z",
  "config": {
    "eventName": "Farewell Tournament 2026",
    "venue": "IISc Gymkhana"
  },
  "players": {},
  "matches": {
    "MS": [
      {
        "Match_ID": "MS_1",
        "Round": "Round 1",
        "Player_1": "Aryan (CSA)",
        "Player_2": "Vijay (EE)",
        "Status": "scheduled",  // or "in-progress" or "completed"
        "Score_1": "21-15, 19-21, 21-18",
        "Winner": "Aryan (CSA)"
      }
    ]
  }
}
```

### Match Statuses
- **`scheduled`**: Not started yet
- **`in-progress`**: Currently being played (shows LIVE indicator)
- **`completed`**: Finished (Winner must be set)

### Score Format
Scores are stored as comma-separated sets: `"21-15, 19-21, 21-18"`
- First number is Player 1/Players 1 score
- Second number is Player 2/Players 2 score
- Each set separated by comma

## Seeding Logic

### 16-player bracket (MS):
```
Match 1:  Seed 1  vs Seed 16
Match 2:  Seed 8  vs Seed 9
Match 3:  Seed 5  vs Seed 12
Match 4:  Seed 4  vs Seed 13
Match 5:  Seed 6  vs Seed 11
Match 6:  Seed 3  vs Seed 14
Match 7:  Seed 7  vs Seed 10
Match 8:  Seed 2  vs Seed 15
```

### 8-player bracket (WS, MD):
```
Match 1:  Seed 1  vs Seed 8
Match 2:  Seed 4  vs Seed 5
Match 3:  Seed 2  vs Seed 7
Match 4:  Seed 3  vs Seed 6
```

### 7-team bracket (XD):
```
Match 1:  Seed 1  vs BYE (Seed 1 advances)
Match 2:  Seed 4  vs Seed 5
Match 3:  Seed 2  vs Seed 7
Match 4:  Seed 3  vs Seed 6
```

### 6-team bracket (WD):
```
Match 1:  Seed 1  vs BYE (Seed 1 advances)
Match 2:  Seed 4  vs Seed 5
Match 3:  Seed 2  vs BYE (Seed 2 advances)
Match 4:  Seed 3  vs Seed 6
```

## Firebase Setup

### Firestore Structure
```
live_data/
  tournament/
    {
      formats: [...],
      config: {...},
      matches: {...},
      lastUpdated: "..."
    }
```

### Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /live_data/tournament {
      allow read: if true;  // Public read
      allow write: if request.auth != null;  // Authenticated write only
    }
  }
}
```

## Workflow

1. **Setup**: Run `tournament-generator.js` to create initial `tournament-data.json`
2. **Upload**: Upload JSON to Firebase Firestore at `live_data/tournament`
3. **Umpire**: Admin panel used by umpires to update live scores
4. **Display**: Bracket view updates in real-time for spectators
5. **Complete**: As matches finish, bracket auto-updates with winners

## Match Number Format

All matches use format: `{FORMAT}_{NUMBER}`

Examples:
- `MS_1`, `MS_2`, ... `MS_30`  (16-player bracket = 15 matches)
- `WS_1`, `WS_2`, ... `WS_7`   (8-player bracket = 7 matches)
- `MD_1`, `MD_2`, ... `MD_7`   (8-team bracket = 7 matches)
- `WD_1`, `WD_2`, ... `WD_5`   (6-team bracket = 5 matches)
- `XD_1`, `XD_2`, ... `XD_6`   (7-team bracket = 6 matches)

## Dependencies

```json
{
  "firebase": "^10.x",
  "react": "^18.x",
  "lucide-react": "^0.x"
}
```

## Customization

### Add More Players/Teams
Edit the generator arrays:
```javascript
const maleNames = ['Aryan', 'Vijay', ...];
const femaleNames = ['Aditi', 'Neha', ...];
const departments = ['CSA', 'EE', ...];
```

### Change Tournament Info
```javascript
config: {
  eventName: 'Your Tournament Name',
  venue: 'Your Venue'
}
```

### Modify Bracket Sizes
Change the counts in `generateTournamentData()`:
```javascript
MS: generateFormatMatches('MS', 16),  // Change 16 to desired size
```

## Tips

- **BYE Matches**: Automatically marked as completed with winner
- **TBD Players**: Show in later rounds until previous round completes
- **Score Entry**: Umpires can add up to 5 sets per match
- **Live Updates**: All changes sync to Firebase in real-time
- **Mobile-First**: Admin interface optimized for tablets/phones
