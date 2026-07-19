import glob
import re

routes = [
  '/', '/pulse', '/tv', '/tv/:matchId', '/hub', '/legacy', '/hall-of-fame', '/gallery',
  '/events/:slug', '/join', '/player/:id', '/player/:id/personal', '/compare/:p1/:p2',
  '/doubles/:p1/:p2', '/marketplace', '/exchange', '/find-lost', '/umpire', '/privacy',
  '/terms', '/admin', '/tournament-admin', '/profile/setup', '/player/:id/edit',
  '/profile/password', '/delete-account', '/personal', '/personal/me', '/personal/player/:id',
  '/broadcast/:matchId', '/404'
]

def match_route(link):
    if '?' in link: link = link.split('?')[0]
    if '#' in link: link = link.split('#')[0]
    
    if link in routes: return True
    
    for route in routes:
        if ':' not in route: continue
        
        route_parts = route.strip('/').split('/')
        link_parts = link.strip('/').split('/')
        
        if len(route_parts) != len(link_parts) and not route.endswith('/*?'): continue
        if route.endswith('/*?') and len(link_parts) >= len(route_parts):
            is_match = True
            for i in range(len(route_parts) - 1):
                if route_parts[i] != link_parts[i] and not route_parts[i].startswith(':'):
                    is_match = False
            if is_match: return True
            
        is_match = True
        for i in range(len(route_parts)):
            if route_parts[i] != link_parts[i] and not route_parts[i].startswith(':'):
                is_match = False
                break
        if is_match: return True
    return False

files = glob.glob('client/src/**/*.ts', recursive=True) + glob.glob('client/src/**/*.tsx', recursive=True)
broken_links = set()
total_links = 0

for file in files:
    with open(file, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        
    matches = re.findall(r'href=["\'](/[^"\']+)["\']|to=["\'](/[^"\']+)["\']|setLocation\([\'"](/[^"\']+)[\'"]\)', content)
    
    for match in matches:
        link = match[0] or match[1] or match[2]
        total_links += 1
        if not match_route(link):
            broken_links.add(f"{link} (in {file})")

print(f"Checked {total_links} internal links.")
print("Broken Links found:")
for link in broken_links:
    print(link)
