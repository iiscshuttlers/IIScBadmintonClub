import re

filename = 'client/src/components/umpire/UmpireSetupFlow.tsx'
with open(filename, 'r', encoding='utf8') as f:
    content = f.read()

content = content.replace(
    't1: { ...match.t1, p1Name: getName(match.t1.p1Id), p2Name: match.t1.p2Id ? getName(match.t1.p2Id) : undefined },',
    't1: { ...match.t1, p1Name: getName(match.t1.p1Id) || match.t1.p1Name, p2Name: match.t1.p2Id ? getName(match.t1.p2Id) : match.t1.p2Name },'
)

content = content.replace(
    't2: { ...match.t2, p1Name: getName(match.t2.p1Id), p2Name: match.t2.p2Id ? getName(match.t2.p2Id) : undefined },',
    't2: { ...match.t2, p1Name: getName(match.t2.p1Id) || match.t2.p1Name, p2Name: match.t2.p2Id ? getName(match.t2.p2Id) : match.t2.p2Name },'
)

with open(filename, 'w', encoding='utf8') as f:
    f.write(content)
print('Patched UmpireSetupFlow successfully!')
