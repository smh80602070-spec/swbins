"""K-0032 탈것 — 사가만리 탈것 도감(W-0117 codex.js 🐎 칸) 다섯의 전용 초상. 지금은 연결 펫 초상을 빌려 펫 칸과 같은 그림이 두 번 나온다.

  py tools/ai-art/make_mount_dex.py render   # 게임이 그리는 몸(아래 BODY) → 흰 배경 3/4 렌더 768 (_out/mount_init/<id>.png) — Blender(render_monster_init.py)
  py tools/ai-art/make_mount_dex.py kit      # → batches/_in/mount_dex_C.json (그림체 C, 안장·고삐로 "타는 것"이 보이게, img2img 0.62, 후보 4)
  py tools/ai-art/prompt_kit.py build tools/ai-art/batches/_in/mount_dex_C.json
  py tools/ai-art/gen.py tools/ai-art/batches/mount_dex_C.json
  py tools/ai-art/make_mount_dex.py sheet    # 고르기 시트 _out/mount_dex_pick.jpg (탈것마다 후보 4 한 줄)
  py tools/ai-art/make_mount_dex.py pack     # _out/mount_dex_picks.json {id: "mount_dex_C/<id>_v0N.png"} → saga-assets/portraits-mount/<id>_s.webp·_c.webp + .license.json
  py tools/ai-art/make_mount_dex.py check    # 5 × 2 · 크기 · license 100%

규격은 인물·펫·몬스터 도감과 같다(정사각 192 + 카드 300×344). id = mount.js MOUNTS id(mt_*). 원작 이름 없음(gen.py BLOCK).
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
INIT = os.path.join(OUT, 'mount_init')
CANON = os.path.join(ROOT, 'saga-assets', 'portraits-mount')
BLENDER = os.environ.get('BLENDER', 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe')
GO = os.path.join(ROOT, 'saga-web', 'saga-go', 'assets', 'models')
# 사가만리 asset3d.js 의 pet:<펫> 몸 — 탈것은 그 펫 몸을 탄다(mount.js MOUNTS.pet). 청룡은 K-0090 ④ 신수 몸
BODY = {
    'mt_farm': os.path.join(GO, 'animals_extra', 'Horse_Farm.glb'),
    'mt_brown': os.path.join(GO, 'animals', 'Horse.glb'),
    'mt_white': os.path.join(GO, 'animals', 'Horse_White.glb'),
    'mt_crane': os.path.join(GO, 'animals', 'Crane.glb'),
    'mt_dragon': os.path.join(ROOT, 'saga-assets', 'pets3d', 'pet_pt_cheongryong.glb'),
}
BODY_LICENSE = {
    'mt_dragon': 'CC0-1.0 (K-0075 신수 몸 — 재질 Poly Haven CC0, 형태는 코드)',
}
SUBJECT = {   # 주제 태그 — 첫 태그에 가중치(키트 규칙). 사람은 안 태운다(no humans) — 안장·고삐로 탈것임을 보인다
    'mt_farm': 'sturdy bay draft horse, leather saddle, simple reins, saddlebags, thick mane, calm',
    'mt_brown': 'sleek brown riding horse, red saddle blanket, leather saddle, bridle and reins, flowing dark mane',
    'mt_white': 'graceful white horse, silver trimmed saddle, blue saddle blanket, bridle, flowing white mane',
    'mt_crane': 'giant gray-blue crane, long thin legs, long neck, small cushioned saddle on its back, ribbon reins',
    'mt_dragon': 'teal blue-green eastern dragon, long serpentine body, small horns, golden saddle with tassels on its back, reins, cloud wisps',
}
DEFAULT_LIC = 'CC0-1.0 (Quaternius Ultimate Animated Animals — 사가만리 assets/ASSET_LICENSES.md)'


def render():
    os.makedirs(INIT, exist_ok=True)
    tmp = os.path.join(INIT, '_glb')
    os.makedirs(tmp, exist_ok=True)
    for i, p in BODY.items():
        shutil.copyfile(p, os.path.join(tmp, i + '.glb'))
    subprocess.run([BLENDER, '-b', '--factory-startup', '-P', os.path.join(HERE, 'render_monster_init.py'), '--', tmp, INIT],
                   stdin=subprocess.DEVNULL, check=True, stdout=subprocess.DEVNULL)
    for i in BODY:
        rgba = Image.open(os.path.join(INIT, i + '_rgba.png'))
        bg = Image.new('RGB', rgba.size, (255, 255, 255))
        bg.paste(rgba, mask=rgba.getchannel('A'))
        bg.save(os.path.join(INIT, i + '.png'))
    print('RENDER', len(BODY))


def kit():
    items = [{'id': i, 'subject': SUBJECT[i], 'view': 'three_quarter', 'extra': 'no humans, mount, riding animal',
              'init_image': 'tools/ai-art/_out/mount_init/%s.png' % i, 'denoise': 0.62, 'seed': 20271100 + 37 * k}
             for k, i in enumerate(BODY)]
    out = {'name': 'mount_dex_C', 'spec': 'creature', 'style': 'C', 'model': 'animagine-xl-4.0-opt', 'variants': 4,
           'note': 'K-0032 탈것 도감 다섯 — 게임 몸 렌더 밑그림 img2img, 안장·고삐로 탈것임을 보인다', 'items': items}
    p = os.path.join(HERE, 'batches', '_in', 'mount_dex_C.json')
    json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(p, len(items))


def sheet():
    d = os.path.join(OUT, 'mount_dex_C')
    s = 256
    im = Image.new('RGB', (s * 4, s * len(BODY)), (255, 255, 255))
    for r, i in enumerate(BODY):
        for v in range(4):
            p = os.path.join(d, '%s_v%02d.png' % (i, v + 1))
            if os.path.exists(p):
                im.paste(Image.open(p).convert('RGB').resize((s, s)), (v * s, r * s))
    im.save(os.path.join(OUT, 'mount_dex_pick.jpg'), quality=88)
    print('SHEET', os.path.join(OUT, 'mount_dex_pick.jpg'))


def fit(im, margin=0.1):
    """흰 바탕 밖 몸의 테두리 상자를 정사각으로 넓혀(여백 10%) 자른다 — 길고 납작한 용이 아래쪽에 작게 놓이던 것(10-09)."""
    import numpy as np
    a = np.asarray(im).astype(np.int16)
    # 거의 흰 바탕(옅은 회색 네모·얼룩)은 순백으로 — 카드 바탕이 고르게
    lo, hi = a.min(2), a.max(2)
    a[(lo > 222) & (hi - lo < 18)] = 255
    im = Image.fromarray(a.astype(np.uint8))
    mask = (255 - a).max(2) > 60
    rows, cols = mask.sum(1), mask.sum(0)
    ys, xs = np.nonzero(rows > 4)[0], np.nonzero(cols > 4)[0]   # 띄엄띄엄한 색 점(꽃가루 같은 장식)은 몸으로 안 친다
    if not len(xs) or not len(ys):
        return im
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    side = int(max(x1 - x0, y1 - y0) * (1 + 2 * margin))
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    canvas = Image.new('RGB', (side, side), (255, 255, 255))
    canvas.paste(im, (side // 2 - cx, side // 2 - cy))
    return canvas.resize((768, 768), Image.LANCZOS)


def pack():
    picks = json.load(open(os.path.join(OUT, 'mount_dex_picks.json'), encoding='utf-8'))
    os.makedirs(CANON, exist_ok=True)
    for i in BODY:
        src = os.path.join(OUT, picks[i])
        im = Image.open(src).convert('RGB')
        sq = fit(im)
        sq.resize((192, 192), Image.LANCZOS).save(os.path.join(CANON, i + '_s.webp'), 'WEBP', quality=88, method=6)
        card = Image.new('RGB', (300, 344), (255, 255, 255))
        card.paste(sq.resize((300, 300), Image.LANCZOS), (0, 22))
        card.save(os.path.join(CANON, i + '_c.webp'), 'WEBP', quality=86, method=6)
        lic = json.load(open(src[:-4] + '.license.json', encoding='utf-8'))
        lic.update({'id': i, 'picked': picks[i], 'base_body': os.path.relpath(BODY[i], ROOT).replace('\\', '/'),
                    'base_license': BODY_LICENSE.get(i, DEFAULT_LIC), 'sizes': {'s': [192, 192], 'c': [300, 344]},
                    'packed_by': 'tools/ai-art/make_mount_dex.py pack (K-0032)'})
        lic.pop('init_image', None)
        json.dump(lic, open(os.path.join(CANON, i + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('PACK', len(BODY))


def check():
    bad = []
    for i in BODY:
        for suf, size in (('_s', (192, 192)), ('_c', (300, 344))):
            p = os.path.join(CANON, i + suf + '.webp')
            if not os.path.exists(p) or Image.open(p).size != size:
                bad.append(i + suf)
        if not os.path.exists(os.path.join(CANON, i + '.license.json')):
            bad.append(i + ' license')
    print('MOUNTDEX', 'OK' if not bad else bad)
    return 0 if not bad else 1


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'check'
    sys.exit({'render': render, 'kit': kit, 'sheet': sheet, 'pack': pack, 'check': check}[cmd]() or 0)
