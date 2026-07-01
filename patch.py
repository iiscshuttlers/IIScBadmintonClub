import re

filename = 'client/src/components/umpire/PlayerSelect.tsx'
with open(filename, 'r', encoding='utf8') as f:
    content = f.read()

content = re.sub(
    r'export function PlayerSelect\(\{\n  value,\n  onChange,\n  players,\n  placeholder,\n\}\: \{\n  value\: string;\n  onChange\: \(v\: string\) => void;\n  players\: Player\[\];\n  placeholder\?\: string;\n\}\) \{',
    'export function PlayerSelect({\n  value,\n  onChange,\n  players,\n  placeholder,\n  fallbackName,\n}: {\n  value: string;\n  onChange: (v: string) => void;\n  players: Player[];\n  placeholder?: string;\n  fallbackName?: string;\n}) {',
    content
)

content = re.sub(
    r'setSearch\(p \? p\.full_name \: value\);\n    \} else \{\n      setSearch\(\"\"\);\n    \}',
    'setSearch(p ? p.full_name : value);\n    } else {\n      setSearch(fallbackName || \"\");\n    }',
    content
)

content = re.sub(
    r'\[value, players\]\);',
    '[value, players, fallbackName]);',
    content
)

with open(filename, 'w', encoding='utf8') as f:
    f.write(content)
print('Patched successfully!')
