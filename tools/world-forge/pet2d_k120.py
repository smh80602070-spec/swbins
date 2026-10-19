"""K-0120 단계 4 — 오마주 펫 16 + 까치의 웹 2D 그림을 자체 몸(pets3d/pet_<id>)으로 굽는다.

    py tools/world-forge/pet2d_k120.py [--only pk_mew,...] [--sheet 비교.png]

지금 웹 2D(saga-go js/sprite.js 의 `pk_*: '<짐승>'` 표)는 다른 짐승 그림(beast_<짐승>.png)을 **나눠 쓴다** — 그 파일을 바꾸면
그 짐승까지 바뀌므로 덮지 않고 **새 이름** `beast_<펫 id>.png` 로 쓴다(웹은 표 줄만 `pk_x: 'pk_x'` 로 — 수신함 웹 줄).
렌더·맞춤은 K-0114 `beast2d_rebake.py` 그대로(옆모습 az 90 · el 12 · 옛 그림 칸 크기·바닥 가운데 정렬).
결과 = 정본 `saga-assets/sprites2d-creatures/beast/beast_<펫 id>.png` + license → `place.py --write --item beast2d-web`.
"""
import json
import os
import re
import subprocess
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import beast2d_rebake as BR  # noqa: E402

OUT = BR.OUT
PETS = os.path.join(ROOT, 'saga-web', 'shared', 'assets', 'world3d')
SPRITE = os.path.join(ROOT, 'saga-web', 'saga-go', 'js', 'sprite.js')
TARGETS = os.path.join(ROOT, 'tools', 'ai-art', 'remote3d', 'k120_targets.json')


def standins():
    s = open(SPRITE, encoding='utf-8').read()
    return dict(re.findall(r"\b((?:pk|pt)_[a-z_]+): '([A-Za-z_0-9]+)'", s))


def render(pid, az, el):
    os.makedirs(BR.TMP, exist_ok=True)
    out = os.path.join(BR.TMP, f'pet_{pid}_{int(az)}_{int(el)}t.png')
    if not os.path.exists(out):
        subprocess.run([BR.BLENDER, '-b', '--factory-startup', '-P', os.path.join(HERE, 'render_sprite.py'),
                        '--', out, os.path.join(PETS, f'pet_{pid}.glb'), '--size', '512', '--az', str(az), '--el', str(el), '--tight'],
                       stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    return Image.open(out).convert('RGBA')


def main():
    only = set(sys.argv[sys.argv.index('--only') + 1].split(',')) if '--only' in sys.argv else None
    ids = [t['id'] for t in json.load(open(TARGETS, encoding='utf-8'))['items']]
    st = standins()
    pairs = []
    os.makedirs(OUT, exist_ok=True)
    for pid in ids:
        if only and pid not in only:
            continue
        old_name = st.get(pid)
        oldp = os.path.join(OUT, f'beast_{old_name}.png')
        if not old_name or not os.path.exists(oldp):
            oldp = os.path.join(ROOT, 'saga-web', 'saga-go', 'assets', 'sprites2d', f'beast_{old_name}.png')
        if not os.path.exists(oldp):
            print('옛 그림 없음', pid, old_name)
            continue
        old = Image.open(oldp).convert('RGBA')
        new = BR.fit(render(pid, 90, 12), old)
        dst = os.path.join(OUT, f'beast_{pid}.png')
        new.save(dst, optimize=True)
        json.dump({'id': f'beast_{pid}', 'generator': 'tools/world-forge/pet2d_k120.py (Blender render_sprite.py 옆모습, K-0114 맞춤)',
                   'source': f'self: pets3d/pet_{pid}', 'license': 'CC0-1.0 (자체 3D 몸 렌더 — 몸 출처는 pets3d license)',
                   'replaces': f'beast_{old_name}.png 나눠 쓰기', 'ticket': 'K-0120'},
                  open(os.path.splitext(dst)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        pairs.append((old, new, pid))
    print('K120_PET2D', len(pairs))
    if '--sheet' in sys.argv and pairs:
        p = sys.argv[sys.argv.index('--sheet') + 1]
        W = max(o.width for o, _, _ in pairs) * 2 + 20
        im = Image.new('RGBA', (W * 2, sum(o.height * 2 + 10 for o, _, _ in pairs)), (205, 210, 200, 255))
        y = 0
        for o, n, _ in pairs:
            im.alpha_composite(o.resize((o.width * 2, o.height * 2), Image.NEAREST), (0, y))
            im.alpha_composite(n.resize((n.width * 2, n.height * 2), Image.NEAREST), (W, y))
            y += o.height * 2 + 10
        im.save(p)


if __name__ == '__main__':
    main()
