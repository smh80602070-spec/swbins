"""K-0150 — 2D 컷아웃(saga-web/shared/js/cutout2d.js 규격) 2단계: 색칠·부위 자르기·rig.json.

  py tools/ai-art/pack_cutout.py batch id1,id2      # tools/char-forge/_out/k150/<id>/full.png → 흰 바탕 밑그림 + 키트 _in/k150_cutout_C.json(img2img 0.45) → prompt_kit build
  (원격) push_batch.py batches/k150_cutout_C.json → _out/k150_cutout_C/<id>_v0N.png
  py tools/ai-art/pack_cutout.py pack id1=2,id2=1   # 고른 후보로 부위 webp + rig.json → saga-assets/web2d/cutout/<id>/ · index.json(pools: 인물 id → rig id)
  py tools/ai-art/pack_cutout.py sheet id1,id2      # 미리보기 _out/k150/cutout_sheet.jpg — 엔진(cutout2d.pose)과 같은 식으로 조립 · 쉬는 자세 + 팔다리 돌린 자세

1단계(Blender 렌더)는 tools/char-forge/cutout_parts.py. 부위 그림 = 보이는 곳은 색칠본 픽셀(색 지도로 판정), 가려진 곳(몸 뒤 L 팔다리·관절 겹침)은 렌더 픽셀.
뼈 축 자리 = VRoid 뼈 머리(2D, 몸 높이 100 · 발 y 0 · 위 −) → 부모 기준 x·y(rot 0 = 팔다리 아래로 늘어짐, 엔진 REST 와 같은 뜻).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'tools', 'char-forge', '_out', 'k150')
AI = os.path.join(HERE, '_out', 'k150_cutout_C')
CANON = os.path.join(ROOT, 'saga-assets', 'web2d', 'cutout')
KIT = os.path.join(HERE, 'batches', '_in', 'k150_cutout_C.json')
PARENT = {'hip': None, 'chest': 'hip', 'head': 'chest', 'hair': 'head', 'armUL': 'chest', 'armLL': 'armUL', 'handL': 'armLL', 'armUR': 'chest', 'armLR': 'armUR',
          'handR': 'armLR', 'legUL': 'hip', 'legLL': 'legUL', 'footL': 'legLL', 'legUR': 'hip', 'legLR': 'legUR', 'footR': 'legLR'}
# 그리는 차례(z 작은 것이 뒤) — L(안쪽) 팔다리 → 옷자락 → 몸·머리 → R(바깥) 다리 → R 팔
Z = {'armUL': 1, 'armLL': 2, 'handL': 3, 'legUL': 4, 'legLL': 5, 'footL': 6, 'cape': 7, 'hip': 8, 'legUR': 9, 'legLR': 10, 'footR': 11, 'chest': 12,
     'hair': 13, 'head': 14, 'armUR': 15, 'armLR': 16, 'handR': 17}


def batch(ids):
    os.makedirs(os.path.join(HERE, '_out', 'k150_cutout_init'), exist_ok=True)
    items = []
    for i, hid in enumerate(ids):
        im = Image.open(os.path.join(SRC, hid, 'full.png')).convert('RGBA')
        bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
        bg.alpha_composite(im)
        p = os.path.join(HERE, '_out', 'k150_cutout_init', hid + '.png')
        bg.convert('RGB').save(p)
        json.dump({'id': hid + '_k150_init', 'generator': 'tools/char-forge/cutout_parts.py (Blender 옆모습 렌더, 흰 바탕)', 'license': 'MIT',
                   'base_body': f'tools/char-forge/_out/vroid/{hid}/{hid}.glb'},
                  open(p[:-4] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        items.append({'id': hid, 'spec': 'character', 'width': 640, 'height': 640, 'view': 'side',
                      'subject': 'side view, full body, facing right, standing straight, arms down, hand-painted 2D game character art, clean lineart',
                      'extra': 'solo, simple background, white background', 'init_image': os.path.relpath(p, ROOT).replace(os.sep, '/'), 'denoise': 0.45,
                      'seed': 20271400 + i * 11})
    kit = {'name': 'k150_cutout_C', 'spec': 'character', 'style': 'C', 'model': 'animagine-xl-4.0-opt', 'variants': 4,
           'note': 'K-0150 컷아웃 색칠 — Blender 옆모습 렌더를 그림체 C 로 칠함(0.45, 윤곽 유지) · 부위는 pack_cutout.py 가 색 지도로 자름', 'items': items}
    json.dump(kit, open(KIT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('KIT', KIT, len(items))

def batch_parts(ids, den=0.3):
    """부위마다 따로 칠하기(2차) — 부위 렌더를 흰 512 정사각에 가운데 놓고 같은 프롬프트·씨앗·낮은 강도. 보이는/가려진 곳이 안 갈린다."""
    d0 = os.path.join(HERE, '_out', 'k150_cutpart_init')
    os.makedirs(d0, exist_ok=True)
    items = []
    for hid in ids:
        m = json.load(open(os.path.join(SRC, hid, 'rig_src.json'), encoding='utf-8'))
        for part in m['parts']:
            im = Image.open(os.path.join(SRC, hid, 'parts', part + '.png')).convert('RGBA')
            bb = im.getchannel('A').getbbox()
            im = im.crop(bb)
            sc = min(440 / im.width, 440 / im.height)
            im = im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS)
            bg = Image.new('RGBA', (512, 512), (255, 255, 255, 255))
            bg.alpha_composite(im, ((512 - im.width) // 2, (512 - im.height) // 2))
            p = os.path.join(d0, f'{hid}__{part}.png')
            bg.convert('RGB').save(p)
            json.dump({'bbox': bb, 'scale': sc, 'off': [(512 - im.width) // 2, (512 - im.height) // 2], 'size': list(im.size)}, open(p[:-4] + '.place.json', 'w'))
            json.dump({'id': f'{hid}__{part}_k150_init', 'generator': 'tools/char-forge/cutout_parts.py (Blender 부위 렌더, 흰 바탕 512)', 'license': 'MIT',
                       'base_body': f'tools/char-forge/_out/vroid/{hid}/{hid}.glb'}, open(p[:-4] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            items.append({'id': f'{hid}__{part}', 'spec': 'sprite', 'width': 512, 'height': 512, 'view': 'side',
                          'subject': 'hand-painted 2D game art, clean lineart, flat cel shading, single isolated body part of a character, same colors',
                          'extra': 'white background', 'init_image': os.path.relpath(p, ROOT).replace(os.sep, '/'), 'denoise': den, 'seed': 20271500})
    kit = {'name': 'k150_cutpart_C', 'spec': 'sprite', 'style': 'C', 'model': 'animagine-xl-4.0-opt', 'variants': 1,
           'note': 'K-0150 컷아웃 2차 — 부위마다 같은 프롬프트·씨앗·0.3 으로 따로 칠함(1차 전체 칠하기는 보이는/가려진 곳이 갈려 조각보)', 'items': items}
    kp = os.path.join(HERE, 'batches', '_in', 'k150_cutpart_C.json')
    json.dump(kit, open(kp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('KIT', kp, len(items))



def pack(picks):
    os.makedirs(CANON, exist_ok=True)
    idx_p = os.path.join(CANON, 'index.json')
    index = json.load(open(idx_p, encoding='utf-8')) if os.path.exists(idx_p) else {'pools': {}}
    for hid, k in picks.items():
        d = os.path.join(SRC, hid)
        m = json.load(open(os.path.join(d, 'rig_src.json'), encoding='utf-8'))
        px, u = m['px'], 100 / m['H_m'] * m['m_per_px']                       # 픽셀 → 뼈 단위
        cc = m['cam_center_2d']
        raw_only = k == 0                                                   # 0 = 칠하기 없이 렌더 그대로(10-20 1차 — 칠하기 두 방법 다 △)
        ai_p = os.path.join(SRC, hid, 'full.png') if raw_only else os.path.join(AI, f'{hid}_v0{k}.png')
        ai = np.asarray(Image.open(ai_p).convert('RGB').resize((px, px), Image.LANCZOS)).astype(np.uint8)
        idm = np.asarray(Image.open(os.path.join(d, 'idmap.png')).convert('RGBA')).astype(np.int16)
        P = m['pivots']
        out = os.path.join(CANON, hid)
        os.makedirs(out, exist_ok=True)
        rig = {'h': 100, 'bones': {}, 'parts': [], 'sway': {'hair': 0.8}}
        for b, par in PARENT.items():
            if b in P:
                rig['bones'][b] = {'x': round(P[b][0] - (P[par][0] if par else 0), 2), 'y': round(P[b][1] - (P[par][1] if par else 0), 2), 'rot': 0}
        for part in m['parts']:
            raw = np.asarray(Image.open(os.path.join(d, 'parts', part + '.png')).convert('RGBA')).copy()
            col = np.array(m['ids'][part]) / 255.0                       # 렌더는 물체 색(선형)을 sRGB 로 내보낸다
            col = np.where(col <= 0.0031308, 12.92 * col, 1.055 * col ** (1 / 2.4) - 0.055) * 255
            vis = (np.abs(idm[..., :3] - col).max(axis=2) <= 3) & (idm[..., 3] > 0) & (raw[..., 3] > 0)
            pp = os.path.join(HERE, '_out', 'k150_cutpart_C', f'{hid}__{part}_v01.png')
            if not os.path.exists(pp):                                     # 후보 하나면 _v01 없이 놓인다
                pp = pp.replace('_v01.png', '.png')
            if raw_only:
                pass
            elif os.path.exists(pp):                                       # 2차: 부위마다 칠한 그림을 원래 자리로 되돌려 렌더 알파에 입힘
                pl = json.load(open(os.path.join(HERE, '_out', 'k150_cutpart_init', f'{hid}__{part}.place.json')))
                x0, y0, x1, y1 = pl['bbox']
                pi = Image.open(pp).convert('RGB').resize((512, 512)).crop((pl['off'][0], pl['off'][1], pl['off'][0] + pl['size'][0], pl['off'][1] + pl['size'][1]))
                pi = np.asarray(pi.resize((x1 - x0, y1 - y0), Image.LANCZOS))
                raw[y0:y1, x0:x1, :3] = pi
            else:
                raw[vis, :3] = ai[vis]
            im = Image.fromarray(raw)
            bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
            if not bb:
                continue
            im = im.crop(bb)
            im.save(os.path.join(out, part + '.webp'), 'WEBP', quality=88, method=6)
            bone = part if part in PARENT or part == 'weapon' else 'hip'   # K-0169 무기 = extra 뼈 'weapon'(손 handR 자식)
            tl = (cc[0] + (bb[0] - px / 2) * u, cc[1] + (bb[1] - px / 2) * u)
            rig['parts'].append({'bone': bone, 'img': part + '.webp', 'x': round(tl[0] - P[bone][0], 2), 'y': round(tl[1] - P[bone][1], 2),
                                 'w': round((bb[2] - bb[0]) * u, 2), 'h': round((bb[3] - bb[1]) * u, 2), 'z': Z.get(part, 8)})
        json.dump(rig, open(os.path.join(out, 'rig.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        lic = {'generator': 'tools/char-forge/cutout_parts.py (Blender 옆모습 부위 렌더)', 'license': 'MIT', 'model': '', 'model_license': '',
               'note': '렌더 대역 — 칠하기 미완(K-0150 10-20: 전체 칠하기는 조각보·부위 칠하기는 지글거림 △)'} if raw_only else json.load(open(ai_p[:-4] + '.license.json', encoding='utf-8'))
        lic.update({'id': f'cutout_{hid}', 'picked_candidate': 'render' if raw_only else os.path.basename(ai_p), 'base_body': f'tools/char-forge/_out/vroid/{hid}/{hid}.glb',
                    'packed_by': 'K-0150 tools/char-forge/cutout_parts.py(Blender 옆모습 부위 렌더) → tools/ai-art/pack_cutout.py(보이는 곳 = img2img 색칠, 가려진 곳 = 렌더)'})
        json.dump(lic, open(os.path.join(out, 'rig.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        index['pools'][hid] = hid
        print('CUTOUT', hid, len(rig['parts']))
    json.dump(index, open(idx_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def compose(hid, H=300, rots=None):
    """cutout2d.pose 와 같은 식(뼈 단위 행렬 · 부모 곱) — rots = {뼈: 각(도)}."""
    rig = json.load(open(os.path.join(CANON, hid, 'rig.json'), encoding='utf-8'))
    rots = rots or {}
    M = {}
    import math

    def mul(a, b):
        return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]

    def tr(x, y, deg):
        r = math.radians(deg)
        return [math.cos(r), math.sin(r), -math.sin(r), math.cos(r), x, y]
    for b, par in PARENT.items():
        r = rig['bones'].get(b, {'x': 0, 'y': 0})
        loc = tr(r['x'], r['y'], rots.get(b, 0))
        M[b] = mul(M[par], loc) if par else loc
    k = H / 110
    can = Image.new('RGBA', (int(H * 0.8), H), (235, 235, 235, 255))
    ox, oy = can.width / 2, H - 6
    for p in sorted(rig['parts'], key=lambda q: q['z']):
        im = Image.open(os.path.join(CANON, hid, p['img'])).convert('RGBA')
        w, h = max(1, round(p['w'] * k)), max(1, round(p['h'] * k))
        im = im.resize((w, h), Image.LANCZOS)
        a, b_, c, d, e, f = M[p['bone']]                                 # 엔진 행렬 [a b c d e f]: x' = a x + c y + e · y' = b x + d y + f
        det = a * d - c * b_
        ia, ic, ib, id_ = d / det, -c / det, -b_ / det, a / det
        # 화면 (X,Y) = 원점 + k·M·(부위 자리 + 픽셀/k) 를 거꾸로 → 부위 그림 픽셀 (u,v)
        T = (ia, ic, -ia * ox - ic * oy - k * (ia * e + ic * f) - k * p['x'],
             ib, id_, -ib * ox - id_ * oy - k * (ib * e + id_ * f) - k * p['y'])
        layer = im.transform(can.size, Image.AFFINE, T, resample=Image.BILINEAR)
        can.alpha_composite(layer)
    return can


def sheet(ids):
    poses = [{}, {'armUR': -55, 'armLR': -40, 'armUL': 35, 'legUR': -25, 'legLR': 30, 'legUL': 20, 'head': -8}]
    H = 300
    out = Image.new('RGB', (int(H * 0.8) * len(poses) * len(ids) + 10 * len(ids), H + 20), (40, 40, 40))
    dr = ImageDraw.Draw(out)
    x = 0
    for hid in ids:
        for q in poses:
            out.paste(compose(hid, H, q).convert('RGB'), (x, 20))
            x += int(H * 0.8)
        dr.text((x - int(H * 0.8) * len(poses) + 4, 4), hid, fill=(255, 255, 0))
        x += 10
    p = os.path.join(ROOT, 'tools', 'char-forge', '_out', 'k150', 'cutout_sheet.jpg')
    out.save(p, quality=88)
    print('SHEET', p)


def engine_consts():
    """엔진(saga-web/shared/js/cutout2d.js) 의 BONES·PARENT·REST·CLIPS 를 node 로 그대로 읽는다(옮겨 적다 어긋나지 않게)."""
    import subprocess
    js = ("global.window=global;require(%r);var C=window.DG.cutout2d;"
          "console.log(JSON.stringify({BONES:C.BONES,PARENT:C.PARENT,REST:C.REST,CLIPS:C.CLIPS}))") % os.path.join(ROOT, 'saga-web', 'shared', 'js', 'cutout2d.js')
    return json.loads(subprocess.run(['node', '-e', js], capture_output=True, text=True, check=True).stdout)


def engine_pose(E, rig, clip, phase):
    """cutout2d.sample + pose 와 같은 식 — 뼈(+extra) → 행렬 [a b c d e f]."""
    import math

    def ease(u):
        return u * u * (3 - 2 * u)

    def at(keys, ph):
        if not keys:
            return None
        if len(keys) == 1 or ph <= keys[0][0]:
            return keys[0]
        for i in range(1, len(keys)):
            if ph <= keys[i][0]:
                a, b = keys[i - 1], keys[i]
                u = ease((ph - a[0]) / max(1e-6, b[0] - a[0]))
                g = lambda j: (a[j] if len(a) > j else 0) + ((b[j] if len(b) > j else 0) - (a[j] if len(a) > j else 0)) * u
                return [ph, g(1), g(2), g(3)]
        return keys[-1]

    def mul(m, n):
        return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]

    def tr(x, y, deg):
        a = math.radians(deg)
        return [math.cos(a), math.sin(a), -math.sin(a), math.cos(a), x, y]
    c = (rig.get('clips') or {}).get(clip) or E['CLIPS'][clip]
    M = {}
    for b in E['BONES']:
        r = (rig.get('bones') or {}).get(b) or E['REST'][b]
        k = at(c['keys'].get(b), phase)
        q = [k[1] if len(k) > 1 else 0, k[2] if len(k) > 2 else 0, k[3] if len(k) > 3 else 0] if k else [0, 0, 0]
        loc = tr(r.get('x', 0) + q[1], r.get('y', 0) + q[2], r.get('rot', 0) + q[0])
        M[b] = mul(M[E['PARENT'][b]], loc) if E['PARENT'][b] else loc
    for b, r in (rig.get('extra') or {}).items():
        M[b] = mul(M.get(r.get('parent')) or M['chest'], tr(r.get('x', 0), r.get('y', 0), r.get('rot', 0)))
    return M


def engine_draw(E, rig, folder, clip, phase, W=300, H=380, k=3.2):
    """drawRig 와 같은 차례(z 오름차순)·같은 행렬로 한 칸 — 오른쪽을 봄, 발 = 아래에서 30px."""
    M = engine_pose(E, rig, clip, phase)
    can = Image.new('RGBA', (W, H), (226, 226, 222, 255))
    ImageDraw.Draw(can).line([(0, H - 30), (W, H - 30)], fill=(150, 140, 120), width=2)
    ox, oy = W / 2, H - 30
    for p in sorted(rig['parts'], key=lambda q: q.get('z', 0)):
        m = M.get(p['bone'])
        if not m:
            continue
        im = Image.open(os.path.join(folder, p['img'])).convert('RGBA')
        sx, sy = p['w'] / im.width, p['h'] / im.height
        # 캔버스 = O + k·(m · (p.x + u·sx, p.y + v·sy)) → 정방향 A(u,v)
        A = np.array([[k * m[0] * sx, k * m[2] * sy, ox + k * (m[0] * p['x'] + m[2] * p['y'] + m[4])],
                      [k * m[1] * sx, k * m[3] * sy, oy + k * (m[1] * p['x'] + m[3] * p['y'] + m[5])], [0, 0, 1]])
        Ai = np.linalg.inv(A)
        can.alpha_composite(im.transform(can.size, Image.AFFINE, tuple(Ai[:2].ravel()), resample=Image.BICUBIC))
    return can


def frames(ids, tag='now'):
    """K-0169 시험판 — 사람마다 한 줄: 옆 걷기 4칸(위상 0·.25·.5·.75) + attack 4칸(.25·.5·.75·1). _out/k169/frames_<tag>.png"""
    E = engine_consts()
    cells = [('walk', x) for x in (0, 0.25, 0.5, 0.75)] + [('attack', x) for x in (0.25, 0.5, 0.75, 1.0)]
    W, H = 300, 380
    out = Image.new('RGB', (W * len(cells), (H + 22) * len(ids)), (40, 40, 40))
    dr = ImageDraw.Draw(out)
    for r, hid in enumerate(ids):
        folder = os.path.join(CANON, hid)
        rig = json.load(open(os.path.join(folder, 'rig.json'), encoding='utf-8'))
        for i, (c, ph) in enumerate(cells):
            out.paste(engine_draw(E, rig, folder, c, ph, W, H).convert('RGB'), (i * W, r * (H + 22) + 22))
            dr.text((i * W + 6, r * (H + 22) + 5), f'{hid} {c} {ph}', fill=(255, 255, 0))
    d = os.path.join(ROOT, 'tools', 'char-forge', '_out', 'k169')
    os.makedirs(d, exist_ok=True)
    p = os.path.join(d, f'frames_{tag}.png')
    out.save(p)
    print('FRAMES', p)


K169_LEGS = {'legUR': [[0, 0], [0.3, 6], [0.62, -22], [1, -20]], 'legLR': [[0, 0], [0.62, 8], [1, 6]],
             'legUL': [[0, 0], [0.62, 16], [1, 14]], 'legLL': [[0, 0], [0.62, 10], [1, 8]],
             'chest': [[0, 0], [0.3, -8], [0.62, 12], [1, 8]], 'head': [[0, 0], [0.3, -4], [0.62, 4], [1, 2]],
             'armUL': [[0, 0], [0.3, -25], [0.62, 35], [1, 25]], 'armLL': [[0, -10], [0.62, -30], [1, -25]],
             'hip': [[0, 0, 0, 0], [0.3, 0, -2, 0], [0.62, 0, 3, 1], [1, 0, 3, 1]]}
# 무기별: 쉬는 자세 무기 각(화면 도, 0 = 앞 · 90 = 아래) + attack 오른팔 사슬. 끝 키(1) = 앞으로 뻗은 끝 자세에 머문다(한 번 클립).
K169_KIND = {
    'dagger': {'rest_deg': 90, 'z': 18,                                    # 단검 = 늘어진 손에서 아래로(아래팔 따라) → 머리 위로 젖혔다 앞으로 베고 앞으로 뻗음
               'attack': {'armUR': [[0, 0], [0.3, -200], [0.62, -60], [0.8, -88], [1, -85]], 'armLR': [[0, -10], [0.3, -35], [0.62, 0], [1, -4]],
                          'handR': [[0, 0], [0.3, -10], [0.62, 0], [1, 0]]}},
    'staff': {'rest_deg': -72, 'z': 18, 'comp': True,                      # 지팡이 = 세워 듦(10-22: 앞으로 18° 기울여 얼굴 앞을 안 가림)(시트 'upright' 와 같음) → 당겼다 앞으로 내밀어 세운 채 뻗음(시트 attack = skill)
              'attack': {'armUR': [[0, -6], [0.3, 40], [0.62, -80], [1, -85]], 'armLR': [[0, -10], [0.3, -70], [0.62, -8], [1, -5]],
                         'handR': [[0, 16], [0.3, 28], [0.62, 91], [1, 92]]}},
}


def k169(picks):
    """K-0169: 렌더 대역 다시 묶기 — 무기 부위(extra 'weapon' ← handR) · 안쪽(L) 팔다리 어둡게(옆 깊이) · rig clips(walk 팔 흔들기 줄임 · attack 끝 자세)."""
    global SRC
    SRC = os.path.join(ROOT, 'tools', 'char-forge', '_out', 'k169')
    E = engine_consts()
    pack({h: 0 for h in picks})
    for hid, kind in picks.items():
        K = K169_KIND[kind]
        out = os.path.join(CANON, hid)
        rig = json.load(open(os.path.join(out, 'rig.json'), encoding='utf-8'))
        m = json.load(open(os.path.join(SRC, hid, 'rig_src.json'), encoding='utf-8'))
        P = m['pivots']
        for p in rig['parts']:
            if p['bone'].endswith('L') and p['bone'] in PARENT:         # 몸 뒤 팔다리 — 28% 어둡게
                f = os.path.join(out, p['img'])
                im = Image.open(f).convert('RGBA')
                a = np.asarray(im).astype(np.float32)
                a[..., :3] *= 0.72
                Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(f, 'WEBP', quality=88, method=6)
            if p['bone'] == 'weapon':
                p['z'] = K['z']
        if 'weapon' in P:
            rig['extra'] = {'weapon': {'parent': 'handR', 'x': round(P['weapon'][0] - P['handR'][0], 2), 'y': round(P['weapon'][1] - P['handR'][1], 2),
                                       'rot': round(K['rest_deg'] - m['weapon']['axis_deg'], 1)}}
        walk = json.loads(json.dumps(E['CLIPS']['walk']))
        walk['keys'].update({'armUL': [[0, -14], [0.5, 14], [1, -14]], 'armUR': [[0, 14], [0.5, -14], [1, 14]], 'armLL': [[0, -12]], 'armLR': [[0, -12]]})
        atk = {'len': 0.45, 'loop': False, 'keys': dict(K169_LEGS, **K['attack'])}
        clips = {'walk': walk, 'attack': atk}
        if K.get('comp'):                                                 # 세워 든 무기가 쉬기·걷기 팔 흔들림에 같이 안 기울게 손목으로 되돌림
            walk['keys']['handR'] = [[0, -5], [0.5, 23], [1, -5]]
            idle = json.loads(json.dumps(E['CLIPS']['idle']))
            idle['keys']['handR'] = [[0, 16], [0.5, 17.5], [1, 16]]
            clips['idle'] = idle
        rig['clips'] = clips
        json.dump(rig, open(os.path.join(out, 'rig.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        lic_p = os.path.join(out, 'rig.license.json')
        lic = json.load(open(lic_p, encoding='utf-8'))
        lic.update({'generator': 'tools/char-forge/cutout_parts.py (Blender 옆모습 부위 렌더 + 무기 부위)', 'weapon': m.get('weapon', {}).get('glb', '').replace('\\', '/').split('/swbins/')[-1],
                    'packed_by': 'K-0169 tools/char-forge/cutout_parts.py --weapon → tools/ai-art/pack_cutout.py k169(무기 extra·안쪽 팔다리 어둡게·walk/attack 클립)',
                    'note': '렌더 대역(칠하기 미완, K-0150) · K-0169 어깨를 몸통에·무기 부위·attack 끝 자세'})
        json.dump(lic, open(lic_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('K169', hid, kind, rig.get('extra'))


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'k169':
        k169(dict(kv.split('=') for kv in sys.argv[2].split(',')))
        sys.exit(0)
    if cmd == 'frames':
        frames(sys.argv[2].split(','), sys.argv[3] if len(sys.argv) > 3 else 'now')
        sys.exit(0)
    if cmd == 'batch':
        batch(sys.argv[2].split(','))
    elif cmd == 'batch_parts':
        batch_parts(sys.argv[2].split(','))
    elif cmd == 'pack':
        pack(dict((kv.split('=')[0], int(kv.split('=')[1])) for kv in sys.argv[2].split(',')))
    elif cmd == 'sheet':
        sheet(sys.argv[2].split(','))
    else:
        print(__doc__)
