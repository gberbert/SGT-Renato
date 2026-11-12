with open('src/components/ProblemsPdfExport.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Make the blue even darker: near-black navy
content = content.replace(
    "background:'linear-gradient(135deg, #071640 0%, #0f2152 45%, #091a4a 100%)'",
    "background:'linear-gradient(135deg, #020b1f 0%, #061535 45%, #030e28 100%)'"
)

with open('src/components/ProblemsPdfExport.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done — cover background darkened to near-black navy')
