import os
import re
import json
import glob

migrations_dir = 'supabase/migrations'
sql_files = sorted(glob.glob(os.path.join(migrations_dir, '*.sql')))

schema = {}

def get_or_create_table(name):
    if name not in schema:
        schema[name] = {'columns': [], 'policies': []}
    return schema[name]

create_table_pattern = re.compile(r'create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-zA-Z0-9_]+)"?\s*\(', re.IGNORECASE)
alter_table_pattern = re.compile(r'alter\s+table\s+(?:public\.)?"?([a-zA-Z0-9_]+)"?', re.IGNORECASE)
create_policy_pattern = re.compile(r'create\s+policy\s+"([^"]+)"\s+on\s+(?:public\.)?"?([a-zA-Z0-9_]+)"?\s+for\s+([a-zA-Z]+)\s+(?:using\s*\((.*?)\))?(?:\s*with\s+check\s*\((.*?)\))?', re.IGNORECASE | re.DOTALL)

for file_path in sql_files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
        # 1. Find table creations. Very rudimentary column parsing.
        # This is hard because of nested parens in SQL. We will just capture the block until the first blank line or semicolon
        
        for table_match in create_table_pattern.finditer(content):
            table_name = table_match.group(1).lower()
            get_or_create_table(table_name)
            
            # extract block inside parens
            start_idx = table_match.end()
            open_parens = 1
            curr_idx = start_idx
            while open_parens > 0 and curr_idx < len(content):
                if content[curr_idx] == '(':
                    open_parens += 1
                elif content[curr_idx] == ')':
                    open_parens -= 1
                curr_idx += 1
            
            if open_parens == 0:
                cols_str = content[start_idx:curr_idx-1]
                # split by comma, ignoring commas inside parens
                cols = []
                curr_col = ""
                p_count = 0
                for char in cols_str:
                    if char == '(': p_count += 1
                    elif char == ')': p_count -= 1
                    
                    if char == ',' and p_count == 0:
                        cols.append(curr_col.strip())
                        curr_col = ""
                    else:
                        curr_col += char
                if curr_col.strip():
                    cols.append(curr_col.strip())
                
                for col in cols:
                    if not col or col.lower().startswith('constraint') or col.lower().startswith('primary key') or col.lower().startswith('foreign key') or col.lower().startswith('unique'):
                        continue
                    parts = col.split()
                    if len(parts) >= 2:
                        col_name = parts[0].strip('"')
                        col_type = parts[1]
                        schema[table_name]['columns'].append({'name': col_name, 'type': col_type})

        # 2. Find policies
        for pol_match in create_policy_pattern.finditer(content):
            pol_name = pol_match.group(1)
            table_name = pol_match.group(2).lower()
            action = pol_match.group(3).upper()
            
            using_clause = pol_match.group(4)
            check_clause = pol_match.group(5)
            
            if using_clause: using_clause = using_clause.strip()
            if check_clause: check_clause = check_clause.strip()
            
            t = get_or_create_table(table_name)
            t['policies'].append({
                'name': pol_name,
                'action': action,
                'using': using_clause,
                'check': check_clause
            })

with open('client/src/data/dbSchemaData.json', 'w', encoding='utf-8') as f:
    json.dump(schema, f, indent=2)

print(f"Parsed {len(schema)} tables.")
