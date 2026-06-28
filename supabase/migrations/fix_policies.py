import re
f = 'supabase/migrations/20260628000000_tournaments_supabase.sql'
with open(f, 'r') as file:
    content = file.read()
content = re.sub(r'CREATE POLICY ("[^\"]+") ON (\w+)', r'DROP POLICY IF EXISTS \1 ON \2;\nCREATE POLICY \1 ON \2', content)
with open(f, 'w') as file:
    file.write(content)
