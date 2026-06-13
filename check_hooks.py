import os
import re

def check_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    func_pattern = re.compile(r'(?:export\s+(?:default\s+)?)?(?:function\s+([A-Z][a-zA-Z0-9_]*)\s*\(|const\s+([A-Z][a-zA-Z0-9_]*)\s*=\s*(?:function|\([^)]*\)\s*=>))', re.MULTILINE)
    
    for match in func_pattern.finditer(content):
        func_name = match.group(1) or match.group(2)
        start_idx = match.start()
        
        brace_count = 0
        in_string = False
        string_char = ''
        end_idx = -1
        
        brace_start = content.find('{', start_idx)
        if brace_start == -1: continue
        
        for i in range(brace_start, len(content)):
            char = content[i]
            if in_string:
                if char == string_char and content[i-1] != '\\':
                    in_string = False
                continue
            
            if char in ["'", '"', '`']:
                in_string = True
                string_char = char
                continue
                
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    end_idx = i
                    break
                    
        if end_idx != -1:
            func_body = content[brace_start:end_idx]
            early_return_pattern = re.compile(r'if\s*\([^)]+\)\s*(?:\{[^}]*return[^}]*\}|return[^;]*;)')
            returns = list(early_return_pattern.finditer(func_body))
            
            if returns:
                first_early_return_idx = returns[0].end()
                rest_of_body = func_body[first_early_return_idx:]
                
                hook_pattern = re.compile(r'\buse[A-Z][a-zA-Z0-9_]*\s*\(')
                hooks = list(hook_pattern.finditer(rest_of_body))
                
                if hooks:
                    print(f'Potential hook after early return in {path} in component {func_name}')
                    for h in hooks:
                        print(f'  - found hook: {h.group(0).strip()}')

for root, _, files in os.walk('e:/Github/iiscshuttlers/client/src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            check_file(os.path.join(root, file))
