import re

filename = 'client/src/components/umpire/UmpireEngine.tsx'
with open(filename, 'r', encoding='utf8') as f:
    content = f.read()

target = '''        {isDirectScoreOpen && (
          <DirectScoreModal 
            directWinner={directWinner} 
            setDirectWinner={setDirectWinner} 
            directSetsText={directSetsText} 
            setDirectSetsText={setDirectSetsText} 
            onSave={() => {
              updateMatch({ status: "finished", winner: directWinner, setsHistory: directSetsText.split(",").map(s => s.trim()) });
              setIsDirectScoreOpen(false);
            }} 
            onClose={() => setIsDirectScoreOpen(false)} 
          />
        )}'''

replacement = '''        {isDirectScoreOpen && (
          <DirectScoreModal 
            directWinner={directWinner} 
            setDirectWinner={setDirectWinner} 
            directSetsText={directSetsText} 
            setDirectSetsText={setDirectSetsText} 
            team1Label={match.t1.p1Name + (match.t1.p2Name ? " / " + match.t1.p2Name : "") || "Team 1"}
            team2Label={match.t2.p1Name + (match.t2.p2Name ? " / " + match.t2.p2Name : "") || "Team 2"}
            onSave={() => {
              updateMatch({ status: "finished", winner: directWinner, setsHistory: directSetsText.split(",").map(s => s.trim()).filter(Boolean) });
              setIsDirectScoreOpen(false);
            }} 
            onClose={() => setIsDirectScoreOpen(false)} 
          />
        )}'''

content = content.replace(target, replacement)

with open(filename, 'w', encoding='utf8') as f:
    f.write(content)
print('Patched UmpireEngine.tsx successfully!')
