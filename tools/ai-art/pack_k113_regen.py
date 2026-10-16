"""K-0113 다시 그린 49장 포장 → 정본. _out/k113_picks.json {id: "k113_regen/<id>_v0N.png"} (Claude 눈 고름).

  py tools/ai-art/pack_k113_regen.py      # 몬스터 32 → portraits-monster(make_monster_dex pack) · 용 → portraits-mount(make_mount_dex fit)
                                          # RTS 7 → web2d/rts · 도시 9 → world/sprite (pack_static2d 256 알파)
옛 license 의 표시 칸(picked 등)은 새 값으로, redo_of·base_license 는 배치 meta 가 남긴 그대로.
"""
import json
import os
import shutil
import subprocess
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, '_out')
sys.path.insert(0, HERE)
picks = json.load(open(os.path.join(OUT, 'k113_picks.json'), encoding='utf-8'))
mon = {k: v for k, v in picks.items() if k.startswith(('mon_', 'boss_'))}
n = 0

# 몬스터 초상 — make_monster_dex.pack 을 고른 표로
import make_monster_dex as MD  # noqa: E402
tmp = os.path.join(OUT, 'k113_monpicks.json')
json.dump(mon, open(tmp, 'w', encoding='utf-8'))
MD.pack(tmp)
dst = os.path.join(ROOT, 'saga-assets', 'portraits-monster')
for pid in mon:
    for suf in ('_s.webp', '_c.webp', '.license.json'):
        shutil.copyfile(os.path.join(MD.FINAL, pid + suf), os.path.join(dst, pid + suf))
    n += 1

# 탈것 용
import make_mount_dex as MM  # noqa: E402
i = 'mt_dragon'
src = os.path.join(OUT, picks[i])
sq = MM.fit(Image.open(src).convert('RGB'))
cd = os.path.join(ROOT, 'saga-assets', 'portraits-mount')
sq.resize((192, 192), Image.LANCZOS).save(os.path.join(cd, i + '_s.webp'), 'WEBP', quality=88, method=6)
card = Image.new('RGB', (300, 344), (255, 255, 255))
card.paste(sq.resize((300, 300), Image.LANCZOS), (0, 22))
card.save(os.path.join(cd, i + '_c.webp'), 'WEBP', quality=86, method=6)
lic = json.load(open(src[:-4] + '.license.json', encoding='utf-8'))
lic.update({'id': i, 'picked': picks[i], 'base_body': 'saga-assets/pets3d/pet_pt_cheongryong.glb', 'sizes': {'s': [192, 192], 'c': [300, 344]},
            'packed_by': 'tools/ai-art/pack_k113_regen.py (make_mount_dex.fit)'})
json.dump(lic, open(os.path.join(cd, i + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
n += 1

# RTS 건물·도시 — pack_static2d
st = os.path.join(OUT, 'k113_static_src')
shutil.rmtree(st, ignore_errors=True)
os.makedirs(st)
for k, v in picks.items():
    if k.startswith(('rts_', 'city_')):
        shutil.copyfile(os.path.join(OUT, v), os.path.join(st, k + '.png'))
        shutil.copyfile(os.path.join(OUT, v[:-4] + '.license.json'), os.path.join(st, k + '.license.json'))
pk = os.path.join(OUT, 'k113_static_pack')
shutil.rmtree(pk, ignore_errors=True)
r = subprocess.run([sys.executable, os.path.join(HERE, 'pack_static2d.py'), st, pk], capture_output=True, text=True, encoding='utf-8', errors='replace')
print(r.stdout[-400:])
for k in picks:
    if k.startswith(('rts_', 'city_')):
        d = os.path.join(ROOT, 'saga-assets', 'web2d', 'rts') if k.startswith('rts_') else os.path.join(ROOT, 'saga-assets', 'world', 'sprite')
        for ext in ('.webp', '.license.json'):
            shutil.copyfile(os.path.join(pk, k + ext), os.path.join(d, k + ext))
        n += 1
print('K113_PACK', n)
