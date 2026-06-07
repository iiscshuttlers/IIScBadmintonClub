import re

with open('client/src/pages/ProfileSetup.tsx', 'r', encoding='utf8') as f:
    content = f.read()

# Remove legacy variables
variables_to_remove = [
    r'  const OFFICIAL_TOURNAMENTS = \[\n    \.\.\.ARCHIVED_TOURNAMENTS\.map\(t => t\.name\),\n    "Other \(Type Custom below\)"\n  \];\n\n',
    r'  const EVENT_CATEGORIES = \[\n    "Men\'s Singles",\n    "Men\'s Doubles",\n    "Women\'s Singles",\n    "Women\'s Doubles",\n    "Mixed Doubles",\n    "Team Gold",\n    "Team Silver",\n    "Team Bronze"\n  \];\n\n',
    r'  const PLACEMENT_RESULTS = \[\n    "Winner",\n    "Runner-up",\n    "Semifinalist",\n    "Bronze Medalist"\n  \];\n\n',
    r'  const \[selTournament, setSelTournament\] = useState\(OFFICIAL_TOURNAMENTS\[0\]\);\n',
    r'  const \[customTournamentText, setCustomTournamentText\] = useState\(""\);\n',
    r'  const \[selCategory, setSelCategory\] = useState\(EVENT_CATEGORIES\[0\]\);\n',
    r'  const \[selResult, setSelResult\] = useState\(PLACEMENT_RESULTS\[0\]\);\n\n',
]

for pat in variables_to_remove:
    content = re.sub(pat, '', content)

# Remove addOfficialAchievement function
func_pattern = r'  const addOfficialAchievement = \(\) => \{.*?\};\n\n'
content = re.sub(func_pattern, '', content, flags=re.DOTALL)

with open('client/src/pages/ProfileSetup.tsx', 'w', encoding='utf8') as f:
    f.write(content)

print("Cleaned up unused variables.")
