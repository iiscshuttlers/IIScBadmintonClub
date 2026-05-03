# Quick Fix: Advance All Winners

This script will **automatically advance all completed match winners** to their next round matches.

## Run This Once to Fix Current Brackets

### Option 1: Add Button to Admin Panel (Easiest)

Add this to your `FarewellAdmin.tsx`:

```tsx
import { batchAdvanceAllWinners } from '../lib/tournamentProgression';

// Add this button in the admin interface
<button 
  onClick={async () => {
    if (confirm('Advance all completed match winners to next rounds?')) {
      try {
        await batchAdvanceAllWinners();
        alert('✅ All winners advanced!');
      } catch (error) {
        alert('❌ Error: ' + error.message);
      }
    }
  }}
  className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold"
>
  🔄 Fix All Progressions (Run Once)
</button>
```

### Option 2: Run in Browser Console

1. Open your website `/farewell-admin`
2. Open browser console (F12)
3. Paste this code:

```javascript
// Import Firebase
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from './lib/firebase';

async function fixProgressions() {
  const tournamentRef = doc(db, "live_data", "tournament");
  const snap = await getDoc(tournamentRef);
  const data = snap.data();
  
  const progressions = {
    8: {  // 8-match brackets
      1: { next: 5, pos: 1 },
      2: { next: 5, pos: 2 },
      3: { next: 6, pos: 1 },
      4: { next: 6, pos: 2 },
      5: { next: 7, pos: 1 },
      6: { next: 7, pos: 2 },
      7: { next: 8, pos: 1 }
    }
  };
  
  // For MS format (8 matches)
  const msMatches = [...data.matches.MS];
  const prog = progressions[8];
  
  // Advance MS_1 winner (Aneesh) to MS_5
  const ms1 = msMatches.find(m => m.Match_ID === 'MS_1');
  const ms5 = msMatches.find(m => m.Match_ID === 'MS_5');
  if (ms1.Winner && ms5.Player_1 === 'TBD') {
    ms5.Player_1 = ms1.Winner;
  }
  
  // Advance MS_2 winner (Vishvajeet) to MS_5
  const ms2 = msMatches.find(m => m.Match_ID === 'MS_2');
  if (ms2.Winner && ms5.Player_2 === 'TBD') {
    ms5.Player_2 = ms2.Winner;
  }
  
  // Advance MS_3 winner (Jalaj) to MS_6
  const ms3 = msMatches.find(m => m.Match_ID === 'MS_3');
  const ms6 = msMatches.find(m => m.Match_ID === 'MS_6');
  if (ms3.Winner && ms6.Player_1 === 'TBD') {
    ms6.Player_1 = ms3.Winner;
  }
  
  // Update Firebase
  await updateDoc(tournamentRef, {
    'matches.MS': msMatches,
    lastUpdated: new Date().toISOString()
  });
  
  console.log('✅ Progressions fixed!');
}

fixProgressions();
```

### Option 3: Manual Fix in Firebase Console

Go to Firebase Console → Firestore → `live_data/tournament/matches/MS`:

**MS_5 (Round 2):**
- Change `Player_1` from `"TBD"` to `"Aneesh (UG)"`
- Change `Player_2` from `"TBD"` to `"Vishvajeet verma (AI)"`

**MS_6 (Round 2):**
- Change `Player_1` from `"TBD"` to `"Jalaj (RBCCPS)"`
- Keep `Player_2` as `"TBD"` (waiting for MS_4)

## Going Forward

After implementing the updated `FarewellAdmin.tsx` with progression logic:

**The system will automatically:**
1. When umpire marks match as "completed" and selects winner
2. Winner is immediately advanced to the correct next-round match
3. No manual fixes needed anymore

## Complete Progression Map

For 8-match bracket (MS with 7 players):

```
Round 1:
  MS_1 winner → MS_5 position 1
  MS_2 winner → MS_5 position 2
  MS_3 winner → MS_6 position 1
  MS_4 winner → MS_6 position 2

Round 2:
  MS_5 winner → MS_7 position 1
  MS_6 winner → MS_7 position 2

Quarterfinals:
  MS_7 winner → MS_8 (Final)
```

## Files Needed

1. **tournamentProgression.ts** → `src/lib/tournamentProgression.ts`
2. **Updated FarewellAdmin.tsx** → `src/pages/FarewellAdmin.tsx`

After adding these files, winners will advance automatically! ✨
