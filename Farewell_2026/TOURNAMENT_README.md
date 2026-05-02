# IISc Badminton Farewell Tournament System

A complete Excel-based tournament management system with web interface for tracking matches, scores, and results across all formats.

## 📦 Files Included

1. **Farewell_Tournament_Template.xlsx** - Excel template with all player lists and structure
2. **tournament-manager.html** - Web interface for managing tournament (Import/Export Excel)
3. **README.md** - This file

## 🚀 Quick Start (3 Steps)

### Step 1: Prepare Your Excel File (5 minutes)

1. Open `Farewell_Tournament_Template.xlsx`
2. **Fill in Department names** for all players:
   - Go to `MS_Players` sheet → Add departments in "Department" column
   - Go to `WS_Players` sheet → Add departments
   - Go to `XD_Players`, `MD_Players`, `WD_Players` → Add departments in "Department_1" and "Department_2" columns
3. Save the file

**Your Excel file now has:**
- ✅ All player names (already filled from your uploaded file)
- ✅ Department names (you just added these)
- ✅ Tournament configuration (already set: Round Robin for MS/WS/MD, League+Knockout for XD/WD)
- ✅ Empty match sheets ready for you to create matches

### Step 2: Create Matches Using Web Interface

1. Open `tournament-manager.html` in your browser
2. Click "📤 Import Excel" and select your Excel file
3. **For each format (MS, WS, XD, MD, WD):**
   - Click the format tab
   - Click "➕ Add Match" to create a new match
   - Match ID is auto-generated (MS_1, MS_2, XD_1, etc.)
   - Select players/teams from dropdowns
   - Set round (League, Semi Finals, Final)
   - Set status (scheduled/in-progress/completed)
4. Click "📥 Export Excel" to save your work

### Step 3: During Tournament - Update Scores

1. Open `tournament-manager.html`
2. Import your Excel file
3. Enter scores as matches happen
4. Status automatically updates when scores are entered
5. Winner is automatically determined (higher score wins)
6. Export Excel to save progress

## 📊 Excel File Structure

### Player Sheets (5 sheets)

**Singles (MS_Players, WS_Players):**
```
| Sr_No | Player   | Department |
|-------|----------|------------|
| 1     | Aneesh   | Physics    |
| 2     | Raja     | Chemistry  |
```

**Doubles (XD_Players, MD_Players, WD_Players):**
```
| Sr_No | Team_No | Player_1 | Department_1 | Player_2 | Department_2 |
|-------|---------|----------|--------------|----------|--------------|
| 1     | 1       | Radhika  | Math         | Raja     | Chemistry    |
```

### Tournament Config Sheet

```
| Format | Full_Name       | Format_Type        | Points_League | Points_Knockout | Rounds                       |
|--------|-----------------|--------------------|--------------:|----------------:|------------------------------|
| MS     | Men's Singles   | Round Robin        | 21            | 21              | League                       |
| XD     | Mixed Doubles   | League + Knockout  | 15            | 21              | League, Semi Finals, Final   |
```

### Match Sheets (5 sheets)

**Singles Match Sheet (MS_Matches, WS_Matches):**
```
| Match_ID | Round  | Player_1 | Dept_1  | Score_1 | Score_2 | Player_2 | Dept_2   | Winner  | Status     | Points_To_Win |
|----------|--------|----------|---------|---------|---------|----------|----------|---------|------------|---------------|
| MS_1     | League | Aneesh   | Physics | 21      | 18      | Raja     | Chemistry| Aneesh  | completed  | 21            |
```

**Doubles Match Sheet (XD_Matches, MD_Matches, WD_Matches):**
```
| Match_ID | Round  | Team_1 | Players_1      | Dept_1 | Score_1 | Score_2 | Team_2 | Players_2     | Dept_2 | Winner | Status     | Points_To_Win |
|----------|--------|--------|----------------|--------|---------|---------|--------|---------------|--------|--------|------------|---------------|
| XD_1     | League | 1      | Radhika / Raja | Math/Chem| 15    | 12      | 2      | Aneesh/Tanisha| Phy/Bio| Team 1 | completed  | 15            |
```

## 🎯 Match ID Format

- **MS**: MS_1, MS_2, MS_3, ... (Men's Singles)
- **WS**: WS_1, WS_2, WS_3, ... (Women's Singles)
- **XD**: XD_1, XD_2, XD_3, ... (Mixed Doubles)
- **MD**: MD_1, MD_2, MD_3, ... (Men's Doubles)
- **WD**: WD_1, WD_2, WD_3, ... (Women's Doubles)

## 🎮 Web Interface Features

### Import/Export
- **Import Excel**: Load your tournament file
- **Export Excel**: Save all changes back to Excel

### Per Format View
- **Switch tabs**: MS, WS, XD, MD, WD
- **View players**: See all players/teams with departments
- **Quick stats**: Total matches, completed, in-progress, scheduled

### Match Management
- **Add Match**: Creates new match with auto-generated Match ID
- **Edit Scores**: Enter scores directly in table
- **Update Status**: Change match status (scheduled → in-progress → completed)
- **Auto Winner**: Winner determined automatically when scores entered
- **Delete Match**: Remove matches if needed

### Live Features
- ✅ Real-time score updates
- ✅ Automatic winner calculation
- ✅ Color-coded match status (green=completed, yellow=in-progress)
- ✅ Department info displayed with players

## 📝 Tournament Formats

### Round Robin (MS, WS, MD)
- All players/teams play each other once
- League Stage only
- 21 points to win

### League + Knockout (XD, WD)
- League Stage: 15 points to win
- Top teams advance to Semi Finals
- Semi Finals & Final: 21 points to win

## 🔄 Workflow Example

**Day 1: Setup**
1. Fill department names in Excel
2. Save as `IISc_Farewell_Tournament.xlsx`
3. Open web interface
4. Import Excel
5. Create all matches for MS format (click Add Match for each)
6. Set Player_1 and Player_2 for each match
7. Export Excel to save

**Day 2: Tournament Day**
1. Open web interface
2. Import your Excel file
3. As matches complete:
   - Enter Score_1 and Score_2
   - Status changes to "completed"
   - Winner auto-calculated
4. Export Excel after each round to save progress

**Day 3: View Results**
1. Import Excel
2. See all completed matches
3. Winners highlighted in green
4. Export final results

## 🎨 Customization

### Change Points to Win
Edit `Tournament_Config` sheet in Excel:
```
Format | Points_League | Points_Knockout
MS     | 21            | 21              (change to 15 if needed)
```

### Change Format Type
Edit `Tournament_Config` sheet:
```
Format | Format_Type
MS     | Round Robin   (change to "League + Knockout" if needed)
```

### Add More Players
Add rows to respective `*_Players` sheets:
```
Sr_No | Player    | Department
9     | New Name  | New Dept
```

## 🔧 Troubleshooting

### Problem: Web interface shows "No players loaded"
**Solution**: Make sure you clicked "Import Excel" and selected your Excel file

### Problem: Match_ID not auto-generating
**Solution**: Manually set it in Excel as FORMAT_NUMBER (e.g., MS_1, XD_2)

### Problem: Winner not showing
**Solution**: Both Score_1 and Score_2 must be filled with numbers

### Problem: Department not showing
**Solution**: Make sure Department column is filled in *_Players sheets

## 📤 Exporting for Website

After tournament is complete:
1. Export Excel from web interface
2. Convert to JSON for website display (use previous tournament bracket components)
3. Or use Excel file directly as data source

## 💡 Tips

1. **Start with one format**: Set up MS completely before moving to WS, XD, etc.
2. **Save frequently**: Export Excel after creating matches for each format
3. **Use meaningful round names**: "League", "Quarter Finals", "Semi Finals", "Final"
4. **Manual seeding**: You control which players face which - no automatic seeding
5. **Test with dummy data**: Create a few test matches first to understand the workflow

## 🎯 What's Automated vs Manual

### Automated ✅
- Match ID generation (MS_1, MS_2, etc.)
- Winner determination (from scores)
- Status color coding
- Department info display
- Statistics calculation

### Manual 🔧
- Which players/teams face each other (seeding)
- Round assignments (League, Semi Finals, etc.)
- Score entry
- Status changes (scheduled → in-progress)

## 📞 Common Tasks

### Create all Round Robin matches
```
1. Import Excel
2. Click format tab (e.g., MS)
3. For each pair of players:
   - Click "Add Match"
   - Match ID auto-fills (MS_1, MS_2, ...)
   - Select Player_1 from list
   - Select Player_2 from list
   - Round = "League"
   - Status = "scheduled"
4. Export Excel
```

### Update live scores during match
```
1. Open web interface
2. Import Excel
3. Find match in table
4. Enter current scores in Score_1 and Score_2
5. Status shows "in-progress"
6. When match done, final scores auto-set winner
7. Export Excel to save
```

### Create knockout rounds
```
1. Add new matches
2. Set Round = "Semi Finals" or "Final"
3. Manually select winners from League Stage
4. Points_To_Win = 21 (for XD/WD knockout)
```

## 🏆 Final Output

Your Excel file will contain:
- Complete player list with departments
- All match results with scores
- Winners for each match
- Tournament progression
- Ready to import into website for display

---

**Made with ❤️ for IISc Badminton Farewell Tournament**

Questions? Check the Instructions sheet in the Excel file or open the web interface!
