#!/usr/bin/env python3
"""Download NTT/CPFL logos and embed as base64 in CicloPdfExport.jsx"""
import urllib.request, base64, re, subprocess, os, json

# Refresh token then read from configstore/firebase-tools.json
subprocess.run(['node', 'scripts/_refresh_token.mjs'], capture_output=True)
creds = json.load(open(os.path.expanduser('~/.config/configstore/firebase-tools.json')))
tok = creds['tokens']['access_token']
print(f'Token: {len(tok)} chars, starts: {tok[:15]}')

BASE = 'https://firebasestorage.googleapis.com/v0/b/sgt-renato.firebasestorage.app/o/'
logos = {
    'NTT': 'projects%2FVhQneyHDUFL6bclMEVIS%2Flogo_nttdata_white%201.png',
    'CPFL': 'projects%2FVhQneyHDUFL6bclMEVIS%2FLogo_CPFL_Energia_white%201.png',
}

b64 = {}
for name, path in logos.items():
    url = BASE + path + '?alt=media'
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + tok})
    with urllib.request.urlopen(req) as r:
        data = r.read()
    b64[name] = 'data:image/png;base64,' + base64.b64encode(data).decode()
    print(f'{name}: {len(data)} bytes → {len(b64[name])} b64 chars')

# Read source file
src_path = 'src/components/CicloPdfExport.jsx'
with open(src_path, 'r', encoding='utf-8') as f:
    src = f.read()

# Replace URL constants with embedded base64
src = re.sub(
    r"const NTT_LOGO_URL\s*=\s*'[^']*';",
    f"const NTT_LOGO_URL  = '{b64['NTT']}';",
    src
)
src = re.sub(
    r"const CPFL_LOGO_URL\s*=\s*'[^']*';",
    f"const CPFL_LOGO_URL = '{b64['CPFL']}';",
    src
)

# Replace the fetch block with direct assignment
src = re.sub(
    r'  // Pre-fetch.*?(?:imgToDataUrl|svgToDataUrl)\(CPFL_LOGO_URL\),\s*\]\);',
    '  const nttDataUrl = NTT_LOGO_URL;\n  const cpflDataUrl = CPFL_LOGO_URL;',
    src,
    flags=re.DOTALL
)
src = re.sub(
    r'  async function (?:imgToDataUrl|svgToDataUrl)[\s\S]*?(?:imgToDataUrl|svgToDataUrl)\(CPFL_LOGO_URL\),\s*\]\);',
    '  const nttDataUrl = NTT_LOGO_URL;\n  const cpflDataUrl = CPFL_LOGO_URL;',
    src
)

# Write back
with open(src_path, 'w', encoding='utf-8') as f:
    f.write(src)

# Verify
print('NTT b64 in file:', 'iVBORw0KGgoAAAANSU' in src)
print('nttDataUrl = NTT_LOGO_URL:', 'nttDataUrl = NTT_LOGO_URL' in src)
print('fetch block gone:', 'imgToDataUrl' not in src and 'svgToDataUrl' not in src)
print('Done.')
