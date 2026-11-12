import re

with open('src/components/FinanceiroReceita.jsx', 'r') as f:
    content = f.read()

# The bad pattern: <div style={{   <div style={{ fontSize...
# Replace with just: <div style={{ fontSize...
fixed = re.sub(
    r'<div style=\{\{\s+<div style=\{\{',
    '<div style={{',
    content
)

if fixed != content:
    with open('src/components/FinanceiroReceita.jsx', 'w') as f:
        f.write(fixed)
    print('Fixed! Changes made.')
else:
    # Show line 178-183 for debugging
    lines = content.split('\n')
    print('No change. Lines 178-183:')
    for i in range(177, min(184, len(lines))):
        print(f'  {i+1}: {repr(lines[i])}')
