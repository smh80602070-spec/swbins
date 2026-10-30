"""K-0202 ③ — 4종횡 표시 글꼴 Black Han Sans(OFL) 서브셋 woff2.

  py tools/asset-forge/font_subset_story.py <BlackHanSans-Regular.ttf> <OFL.txt>
      → saga-assets/fonts/blackhansans/BlackHanSans-saga.woff2 + OFL.txt + BlackHanSans-saga.license.json

글자 = 한글 KS X 1001 2350 + ASCII + 문장부호 + 4종횡 폴더(js·html·css)에 쓰인 한글·한자·기호. (Hahmlet 서브셋과 같은 규칙)
"""
import glob
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
src, ofl = sys.argv[1], sys.argv[2]
chars = set()
for lead in range(0xB0, 0xC9):
    for trail in range(0xA1, 0xFF):
        try:
            chars.add(bytes([lead, trail]).decode('euc-kr'))
        except UnicodeDecodeError:
            pass
chars |= set(chr(c) for c in range(0x20, 0x7F))
chars |= set('·…—–‘’“”〈〉《》「」『』×÷±≤≥→←↑↓★☆♥♡▶◀●○■□◆◇✓✕♪')
for pat in ('saga-web/saga-story/js/**/*.js', 'saga-web/saga-story/*.html', 'saga-web/saga-story/css/*.css', 'saga-web/shared/js/*.js'):
    for f in glob.glob(os.path.join(ROOT, pat), recursive=True):
        try:
            txt = open(f, encoding='utf-8').read()
        except Exception:
            continue
        chars |= set(re.findall(r'[가-힣㐀-鿿぀-ヿ]', txt))
out_dir = os.path.join(ROOT, 'saga-assets', 'fonts', 'blackhansans')
os.makedirs(out_dir, exist_ok=True)
txtp = os.path.join(out_dir, '_chars.txt')
open(txtp, 'w', encoding='utf-8').write(''.join(sorted(chars)))
dst = os.path.join(out_dir, 'BlackHanSans-saga.woff2')
subprocess.run([sys.executable, '-m', 'fontTools.subset', src, '--text-file=' + txtp, '--flavor=woff2', '--output-file=' + dst, '--layout-features=*', '--no-hinting'], check=True)
os.remove(txtp)
shutil.copyfile(ofl, os.path.join(out_dir, 'OFL.txt'))
lic = {'id': 'fonts/blackhansans', 'file': 'BlackHanSans-saga.woff2',
       'source': 'https://github.com/google/fonts/tree/main/ofl/blackhansans (BlackHanSans-Regular.ttf)',
       'authors': 'The Black Han Sans Project Authors (https://github.com/zesstype/Black-Han-Sans)',
       'license': 'SIL Open Font License 1.1 (OFL.txt 동봉, 상업 허용·재배포 허용, 예약 글꼴 이름 없음)',
       'modified': '서브셋(한글 KS X 1001 2350 + 4종횡 글자 %d + ASCII·문장부호) · woff2 — tools/asset-forge/font_subset_story.py' % len(chars),
       'ticket': 'K-0202', 'use': '4종횡 제목·버튼(만화 컷)'}
json.dump(lic, open(os.path.join(out_dir, 'BlackHanSans-saga.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('FONT', dst, os.path.getsize(dst) // 1024, 'KB', len(chars), '글자')
