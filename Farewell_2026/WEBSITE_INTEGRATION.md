# Integrating Tournament System into iiscshuttlers.github.io

## 🌐 Website Integration Guide

Your website: **https://iiscshuttlers.github.io/iiscshuttlers/**

This guide shows how to add the tournament system to your existing IISc Badminton website.

---

## 📁 Step 1: Add Tournament Data to Your Repository

### 1.1 Generate Tournament Data

1. Open `tournament-manager-v2.html`
2. Import your Excel file with all matches
3. Click **"Export for Website"** button
4. This creates `tournament-data.json`

### 1.2 Upload to GitHub Repository

```bash
# In your iiscshuttlers repository
cd iiscshuttlers
mkdir -p client/public/data
cp tournament-data.json client/public/data/

# Commit and push
git add client/public/data/tournament-data.json
git commit -m "Add farewell tournament data"
git push
```

---

## 📝 Step 2: Create Tournament Page Component

Create a new file: `client/src/pages/FarewellTournament.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, MapPin, Clock } from 'lucide-react';

interface Match {
  Match_ID: string;
  Round: string;
  Player_1?: string;
  Player_2?: string;
  Team_1?: string;
  Team_2?: string;
  Score_1: string;
  Score_2: string;
  Winner: string;
  Status: string;
  Date: string;
  Day: string;
  Time: string;
  Court: string;
  Points_Per_Set: number;
  Best_Of_Sets: number;
}

interface TournamentData {
  formats: string[];
  players: any;
  matches: any;
  config: any;
  lastUpdated: string;
}

export default function FarewellTournament() {
  const [data, setData] = useState<TournamentData | null>(null);
  const [activeFormat, setActiveFormat] = useState('MS');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/tournament-data.json')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading tournament data:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p>Loading tournament data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center">Failed to load tournament data</div>;
  }

  const matches = data.matches[activeFormat] || [];
  const completedMatches = matches.filter((m: Match) => m.Status === 'completed');
  const upcomingMatches = matches.filter((m: Match) => m.Status === 'scheduled');
  const liveMatches = matches.filter((m: Match) => m.Status === 'in-progress');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-emerald-50 py-12 px-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-xl shadow-xl p-8 border-t-4 border-emerald-600">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
              <Trophy className="w-10 h-10 text-yellow-500" />
              Farewell Tournament 2026
            </h1>
            <p className="text-gray-600">IISc Badminton Club</p>
            <p className="text-sm text-gray-500 mt-2">
              Last updated: {new Date(data.lastUpdated).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Format Tabs */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {data.formats.map(format => (
              <button
                key={format}
                onClick={() => setActiveFormat(format)}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  activeFormat === format
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {format}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live Matches */}
      {liveMatches.length > 0 && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              Live Matches
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {liveMatches.map((match: Match) => (
                <MatchCard key={match.Match_ID} match={match} isLive={true} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Matches */}
      {upcomingMatches.length > 0 && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Upcoming Matches</h2>
            <div className="space-y-3">
              {upcomingMatches.slice(0, 5).map((match: Match) => (
                <MatchCard key={match.Match_ID} match={match} isLive={false} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Completed Matches */}
      {completedMatches.length > 0 && (
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Results</h2>
            <div className="space-y-3">
              {completedMatches.map((match: Match) => (
                <MatchCard key={match.Match_ID} match={match} isLive={false} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchCard({ match, isLive }: { match: Match; isLive: boolean }) {
  const player1 = match.Player_1 || `Team ${match.Team_1}`;
  const player2 = match.Player_2 || `Team ${match.Team_2}`;
  
  return (
    <div className={`border-2 rounded-lg p-4 ${
      isLive ? 'border-yellow-400 bg-yellow-50' :
      match.Status === 'completed' ? 'border-green-300 bg-green-50' :
      'border-gray-300 bg-white'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="font-mono">{match.Match_ID}</div>
          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3" />
            {match.Day} {match.Date}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            {match.Time}
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3 h-3" />
            {match.Court}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-600">{match.Round}</div>
          <div className="text-xs text-gray-500">
            BO{match.Best_Of_Sets} • {match.Points_Per_Set} pts
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className={`flex justify-between items-center p-3 rounded ${
          match.Winner === player1 ? 'bg-emerald-600 text-white font-bold' : 'bg-white border'
        }`}>
          <span>{player1}</span>
          <span className="text-lg font-bold">{match.Score_1 || '-'}</span>
        </div>
        <div className={`flex justify-between items-center p-3 rounded ${
          match.Winner === player2 ? 'bg-emerald-600 text-white font-bold' : 'bg-white border'
        }`}>
          <span>{player2}</span>
          <span className="text-lg font-bold">{match.Score_2 || '-'}</span>
        </div>
      </div>
    </div>
  );
}
```

---

## 🔗 Step 3: Add Route to Your App

Edit `client/src/App.tsx` (or your routing file):

```typescript
import { Route } from 'wouter';
import FarewellTournament from './pages/FarewellTournament';

// Add to your routes
<Route path="/farewell-tournament" component={FarewellTournament} />
```

---

## 🎨 Step 4: Add Navigation Link

Edit your navigation component (e.g., `client/src/components/Nav.tsx`):

```typescript
<Link href="/farewell-tournament" className="nav-link">
  🏆 Farewell Tournament
</Link>
```

---

## 🚀 Step 5: Deploy

```bash
# Build your site
npm run build

# Push to GitHub
git add .
git commit -m "Add farewell tournament page"
git push origin main

# GitHub Pages will auto-deploy
```

Your tournament will be live at:
**https://iiscshuttlers.github.io/iiscshuttlers/farewell-tournament**

---

## 🔄 Updating Tournament Data (During Event)

### Real-time Updates Option 1: Manual Upload

1. Update scores in `tournament-manager-v2.html`
2. Export for Website → `tournament-data.json`
3. Replace file in repository
4. Git commit + push
5. GitHub Pages rebuilds (2-3 minutes)

### Real-time Updates Option 2: Google Sheets Integration (Advanced)

If you want live updates without rebuilding:

1. **Publish Google Sheet as JSON**:
   - File → Share → Publish to web
   - Select "Comma-separated values (.csv)"
   - Copy link

2. **Create API endpoint** (use Apps Script or Netlify Function):
   ```javascript
   // Convert Google Sheets data to JSON format
   // Host at: https://your-site.com/api/tournament-data
   ```

3. **Update component to fetch from API**:
   ```typescript
   fetch('https://your-api-endpoint/tournament-data')
   ```

---

## 📱 Mobile Optimization

The tournament page is already mobile-responsive with:
- ✅ Responsive grid layouts
- ✅ Touch-friendly buttons
- ✅ Compact match cards on mobile
- ✅ Swipeable format tabs

---

## 🎨 Customization

### Change Colors

Match your website's theme by editing the Tailwind classes:

```typescript
// Replace emerald-600 with your primary color
className="bg-emerald-600" → className="bg-blue-600"

// Replace yellow for live matches
className="border-yellow-400" → className="border-red-400"
```

### Add Features

**Live Score Animation**:
```typescript
// Add auto-refresh every 30 seconds
useEffect(() => {
  const interval = setInterval(() => {
    fetch('/data/tournament-data.json')
      .then(res => res.json())
      .then(setData);
  }, 30000);
  return () => clearInterval(interval);
}, []);
```

**Player Statistics**:
```typescript
// Calculate wins, losses, points for each player
const playerStats = calculatePlayerStats(matches);
```

---

## 🔧 Troubleshooting

### Problem: Data not loading
**Solution**: Check `/data/tournament-data.json` exists in `client/public/data/`

### Problem: 404 on route
**Solution**: Ensure route is added to your routing configuration

### Problem: Styles not matching
**Solution**: Check Tailwind CSS is configured properly

---

## 📊 Data Format

The `tournament-data.json` structure:

```json
{
  "formats": ["MS", "WS", "XD", "MD", "WD"],
  "players": {
    "MS": [
      { "Player": "Aneesh", "Department": "Physics" }
    ]
  },
  "matches": {
    "MS": [
      {
        "Match_ID": "MS_1",
        "Round": "League",
        "Player_1": "Aneesh",
        "Player_2": "Raja",
        "Score_1": "21-18",
        "Score_2": "18-21",
        "Winner": "Aneesh",
        "Status": "completed",
        "Date": "2026-05-10",
        "Day": "Saturday",
        "Time": "10:00",
        "Court": "Court 1",
        "Points_Per_Set": 21,
        "Best_Of_Sets": 1
      }
    ]
  },
  "config": { ... },
  "lastUpdated": "2026-05-02T10:30:00.000Z"
}
```

---

## 🎯 Quick Commands

```bash
# Clone your repo
git clone https://github.com/iiscshuttlers/iiscshuttlers.git
cd iiscshuttlers

# Create tournament data directory
mkdir -p client/public/data

# Add tournament data
cp tournament-data.json client/public/data/

# Create tournament page
# (copy the React component code above to client/src/pages/FarewellTournament.tsx)

# Add route to App.tsx
# (add the route code shown above)

# Test locally
npm run dev

# Build and deploy
npm run build
git add .
git commit -m "Add farewell tournament"
git push origin main
```

---

## ✅ Checklist

- [ ] Generate `tournament-data.json` from tournament manager
- [ ] Add JSON to `client/public/data/`
- [ ] Create `FarewellTournament.tsx` component
- [ ] Add route to App.tsx
- [ ] Add navigation link
- [ ] Test locally (`npm run dev`)
- [ ] Deploy to GitHub Pages
- [ ] Verify live site works
- [ ] Update tournament data as matches complete

---

**Your tournament page will be live at:**
`https://iiscshuttlers.github.io/iiscshuttlers/farewell-tournament`

**Questions?** Check the existing code structure in your repository for patterns to follow!
