"""claude.ai Artifact 公開用に index.html から外枠(doctype/html/head/body)を外したページを作る。
通常の静的ホスティングでは不要(index.html をそのまま使う)。"""
import os, re, shutil
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'dist-artifact')
src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', src, re.S).group(1)
head = re.sub(r'\s*<meta (charset|name="viewport")[^>]*>', '', head)
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(head.strip() + '\n' + body.strip() + '\n')
print('built', OUT)
