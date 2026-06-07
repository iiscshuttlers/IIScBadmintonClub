import re

with open('client/src/pages/ProfileSetup.tsx', 'r', encoding='utf8') as f:
    content = f.read()

# Regex to capture the Achievements block
ach_pattern = r'(\s*\{/\* Achievements tag chips \*/\}.*?)(?=\s*\{/\* Tournaments tag chips \*/\})'
# Regex to capture the Tournaments block
tour_pattern = r'(\s*\{/\* Tournaments tag chips \*/\}.*?)(?=\s*\{/\* Career Highlights Builder \*/\})'

ach_match = re.search(ach_pattern, content, flags=re.DOTALL)
tour_match = re.search(tour_pattern, content, flags=re.DOTALL)

if ach_match and tour_match:
    ach_block = ach_match.group(1)
    tour_block = tour_match.group(1)
    
    # Replace the combined area with swapped blocks
    # Be careful about exactly how we replace it. 
    # Let's find the start index of ach_block and the end index of tour_block.
    start_idx = ach_match.start()
    end_idx = tour_match.end()
    
    # We want to replace content[start_idx:end_idx] with tour_block + ach_block
    # But wait! We need to make sure we keep the spacing correct.
    new_combined = tour_block + "\n" + ach_block
    content = content[:start_idx] + new_combined + content[end_idx:]
    
    with open('client/src/pages/ProfileSetup.tsx', 'w', encoding='utf8') as f:
        f.write(content)
    print("Successfully swapped blocks.")
else:
    print("Could not find the blocks to swap.")
