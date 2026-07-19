import re
import glob

sql_files = glob.glob('supabase/migrations/*.sql')

for f in sql_files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # We will replace CREATE POLICY with DROP POLICY IF EXISTS ... CREATE POLICY
    # But only if it hasn't been replaced yet!
    # A simple way is to check if DROP POLICY IF EXISTS is right before it, but re.sub will just do it if we are careful.
    
    # Let's use a simpler approach to avoid double replacing
    # Just strip all DROP POLICY IF EXISTS first to normalize, then add them back.
    content = re.sub(r'DROP POLICY IF EXISTS ("[^\"]+") ON (?:public\.)?(\w+);\n?', '', content)
    content = re.sub(r'CREATE POLICY ("[^\"]+")\s+ON\s+(?:public\.)?(\w+)', r'DROP POLICY IF EXISTS \1 ON \2;\nCREATE POLICY \1 ON \2', content)

    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
print("Policies fixed.")
