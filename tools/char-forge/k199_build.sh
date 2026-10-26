#!/bin/bash
# K-0199 컷아웃 공용 동작 팩 굽기 — 세 3D 팩 → clips_to_cutout.py → 합치기(겹친 이름은 k. 앞붙임) → 정본 _clips/side.json + license → 웹 shared(place)
#   bash tools/char-forge/k199_build.sh
cd /c/swbins
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
O=C:/swbins/tools/char-forge/_out/k199; mkdir -p tools/char-forge/_out/k199
CV="$B -b --factory-startup -P tools/char-forge/clips_to_cutout.py --"
"$B" -b --factory-startup -P tools/char-forge/clips_to_cutout.py -- --pack C:/swbins/saga-assets/characters/anim-src/mocap/vroid_mocap_anims.glb --out $O/side_mocap.json --base-out $O/base_side.json </dev/null 2>&1 | grep -a CUTOUT_CLIPS | cut -c1-40
"$B" -b --factory-startup -P tools/char-forge/clips_to_cutout.py -- --pack C:/swbins/saga-assets/characters/anim-src/mocap/vroid_clips30_anims.glb --out $O/side_c30.json --neutral "" --base-in $O/base_side.json </dev/null 2>&1 | grep -a CUTOUT_CLIPS | cut -c1-40
# K-0201 — 전투 팩은 손 키프레임(UAL) — 기준 빼기 없이 원값(모캡 서기를 빼면 몸통 ≈20° 쏠림, 제 서기를 빼면 전투 자세라 다리가 비틀림)
"$B" -b --factory-startup -P tools/char-forge/clips_to_cutout.py -- --pack C:/swbins/tools/char-forge/_out/vroid/ac_balgwang/ac_balgwang_anims.glb --out $O/side_hero.json --neutral "" </dev/null 2>&1 | grep -a CUTOUT_CLIPS | cut -c1-40
PYTHONIOENCODING=utf-8 py - <<'E'
import json, os
O = 'tools/char-forge/_out/k199/'
packs = (('side_mocap.json', 'vroid_mocap_anims.glb'), ('side_c30.json', 'vroid_clips30_anims.glb'),
         ('side_hero.json', 'ac_balgwang_anims.glb (K-0029·K-0066 자체 키프레임·UAL CC0 바탕)'))
out, src = {}, {}
for f, tag in packs:
    for k, v in json.load(open(O + f, encoding='utf-8')).items():
        nk = k if k not in out else 'k.' + k
        out[nk] = v; src[nk] = tag
import math
# K-0200 숨쉬기 — 모캡 서기 평균을 쉼으로 빼서 idle 이 납작(키 2~3) → 손 숨쉬기 층(2.4초·25키): 가슴 들림·머리 반대·팔 늦게·골반 오르내림
def breath(robe):
    K = {b: [] for b in ('hip', 'chest', 'head', 'armUR', 'armUL', 'armLR', 'armLL', 'handR', 'handL')}
    A = {'chest': (-1.6, 0), 'head': (1.1, 0.35), 'armUR': (2.2, 0.6), 'armUL': (2.2, 0.7), 'armLR': (1.6, 0.9), 'armLL': (1.6, 1.0), 'handR': (1.2, 1.2), 'handL': (1.2, 1.3)}
    for i in range(25):
        u = i / 24; w = 2 * math.pi * u
        K['hip'].append([round(u, 3), 0.0, 0.0, round(-0.35 * (1 - math.cos(w)) / 2, 3)])
        for b, (amp, lag) in A.items():
            K[b].append([round(u, 3), round(amp * math.sin(w - lag), 2)])
    return {'len': 2.4, 'loop': True, 'src': 'k200_breath', 'keys': K}
for nk in ('idle', 'idle~robe'):
    if nk in out:
        out[nk] = breath(nk.endswith('~robe')); src[nk] = 'K-0200 손 숨쉬기(k199_build.sh)'
# K-0200 과장 — 모캡 걷기·달리기는 사람 실제 크기라 손그림에선 밋밋: 팔 흔들기·보폭·몸 오르내림 키우기(옷자락 판은 다리 그대로)
EXAG = {'armUL': 1.4, 'armUR': 1.4, 'armLL': 1.3, 'armLR': 1.3, 'legUL': 1.15, 'legUR': 1.15, 'legLL': 1.1, 'legLR': 1.1, 'chest': 1.3, 'head': 1.2}
for nk in ('walk', 'run', 'k.walk', 'walk~robe', 'run~robe', 'k.walk~robe'):
    c = out.get(nk)
    if not c:
        continue
    for b, ks in c['keys'].items():
        f = EXAG.get(b, 1.0) if not (nk.endswith('~robe') and b.startswith('leg')) else 1.0
        m = sum(k[1] for k in ks) / len(ks)          # 평균 둘레 흔들림만 키움(고정 기울기는 그대로)
        for k in ks:
            k[1] = round(m + (k[1] - m) * f, 2)
            if b == 'hip' and nk.startswith('run'):
                k[1] = round(k[1] - 8, 2)             # 달리기 숙임 — 3D 원본 척추 +12° 에 맞춤(옛 −15 는 그림 쉼 자세 탓을 덮던 값, K-0201 쉼 보정 뒤 −8)
            if b == 'hip' and len(k) > 3:
                k[3] = round(k[3] * 1.6, 3)
    src[nk] = src.get(nk, '') + ' · K-0200 과장'
# K-0200 hair 늦게 따라오기 — 머리 세계각(hip+chest+head)을 용수철로 쫓는 각 − 머리 각 = hair 상대각. 몸 오르내림 속도도 조금. 반복 클립은 두 바퀴 돌려 둘째 것
def _at(ks, u, j=1):
    if not ks: return 0.0
    if u <= ks[0][0]: return ks[0][j] if len(ks[0]) > j else 0.0
    for a, b in zip(ks, ks[1:]):
        if u <= b[0]:
            w = (u - a[0]) / max(1e-6, b[0] - a[0]); va = a[j] if len(a) > j else 0.0; vb = b[j] if len(b) > j else 0.0
            return va + (vb - va) * w
    return ks[-1][j] if len(ks[-1]) > j else 0.0
def bake_hair(c, K_=140.0, C_=14.0, VY=1.4, LIM=24.0):   # K-0201 — 긴 머리가 걷기에서 40° 채찍처럼 뻗어 단단하게(옛 90·11·1.8·35)
    n = max(8, int(round(c['len'] * 30))); dt = c['len'] / n; ks = c['keys']
    head = lambda u: _at(ks.get('hip'), u) + _at(ks.get('chest'), u) + _at(ks.get('head'), u)
    dy = lambda u: _at(ks.get('hip'), u, 3)
    x, v = head(0.0), 0.0; out = []
    rounds = 2 if c.get('loop') else 1
    for r in range(rounds):
        for i in range(n + 1):
            u = i / n
            vy = (dy(min(1, u + 1 / n)) - dy(max(0, u - 1 / n))) / (2 * dt)
            tgt = head(u) + vy * VY
            v += ((tgt - x) * K_ - v * C_) * dt; x += v * dt
            if r == rounds - 1:
                out.append([round(u, 3), round(max(-LIM, min(LIM, x - head(u))), 1)])
    kept = [out[0]]
    for i in range(1, len(out) - 1):
        a, m, b = kept[-1], out[i], out[i + 1]; w = (m[0] - a[0]) / max(1e-6, b[0] - a[0])
        if abs(m[1] - (a[1] + (b[1] - a[1]) * w)) > 0.25: kept.append(m)
    kept.append(out[-1]); c['keys']['hair'] = kept
# K-0200 공격 과장 — 타격 순간(팔·가슴 각속도 최대)을 찾아 시간을 비튼다: 움츠림은 느리게·1.25배 깊게 → 타격 빠르게 → 끝 0.12 여운(멈춤). 길이 1.1배
ATK = ('attack', 'axe_1', 'axe_2', 'axe_heavy', 'dagger_1', 'dagger_2', 'dagger_heavy', 'fist_1', 'fist_2', 'fist_heavy', 'kick', 'punch_combo',
       'shield_bash', 'spear_1', 'spear_2', 'spear_heavy', 'staff_heavy', 'sword_2', 'sword_3', 'sword_heavy', 'plunge', 'throw', 'skill')
def warp_attack(c):
    ks = c['keys']; n = max(12, int(round(c['len'] * 30)))
    sp = []
    for i in range(n):
        u0, u1 = i / n, (i + 1) / n
        sp.append(sum(abs(_at(ks.get(b), u1) - _at(ks.get(b), u0)) for b in ('armUR', 'armLR', 'chest', 'armUL')))
    up = (sp.index(max(sp)) + 0.5) / n
    if up < 0.08 or up > 0.92:
        return False
    vp = min(0.62, up + 0.14); vh = 0.88
    def src(v):
        if v <= vp:
            return up * (v / vp) ** 1.6
        if v <= vh:
            w = (v - vp) / (vh - vp); return up + (1 - up) * (1 - (1 - w) ** 2.2)
        return 1.0
    n2 = int(round(c['len'] * 1.1 * 30)); new = {}
    for b, bk in ks.items():
        out_k = []
        for i in range(n2 + 1):
            v = i / n2; u = src(v)
            k = [round(v, 3)] + [_at(bk, u, j) for j in range(1, len(bk[0]))]
            if v <= vp and b != 'hip':           # 움츠림 깊게 — 처음 자세에서 벗어난 만큼 1.25배
                k[1] = bk[0][1] + (k[1] - bk[0][1]) * 1.25
            out_k.append([k[0]] + [round(x, 2) for x in k[1:]])
        kept = [out_k[0]]
        for i in range(1, len(out_k) - 1):
            a, m, bb = kept[-1], out_k[i], out_k[i + 1]; w = (m[0] - a[0]) / max(1e-6, bb[0] - a[0])
            if any(abs(m[j] - (a[j] + (bb[j] - a[j]) * w)) > 0.25 for j in range(1, len(m))): kept.append(m)
        kept.append(out_k[-1]); new[b] = kept
    c['keys'] = new; c['len'] = round(c['len'] * 1.1, 3); c['atk'] = round(vp, 3)
    return True
_w = 0
for nk, c in out.items():
    if nk.split('~')[0] in ATK and warp_attack(c):
        _w += 1
print('K200_WARP', _w)
# K-0200 도포 판 먼 팔 — 넓은 소매 뒷팔이 앞팔만큼 휘두르면 등 뒤에 판자처럼 보인다 → 평균 둘레 0.6배
for nk, c in out.items():
    if not nk.endswith('~robe'):
        continue
    for b in ('armUL', 'armLL'):
        ks = c['keys'].get(b)
        if not ks:
            continue
        m = sum(k[1] for k in ks) / len(ks)
        for k in ks:
            k[1] = round(m + (k[1] - m) * 0.6, 2)
# K-0200 도포 판 골반 — 도포 인물은 hip 그림이 발끝까지라 골반이 기울면 도포 통째로 기울어 젖혀 보인다 → 골반 0.3배, 덜 돈 만큼 가슴에 보태 상체 세계각은 그대로
ROBE_HIP = 0.3
for nk, c in out.items():
    if not nk.endswith('~robe') or 'hip' not in c['keys']:
        continue
    hk = [list(k) for k in c['keys']['hip']]
    if 'chest' in c['keys']:
        for k in c['keys']['chest']:
            k[1] = round(k[1] + _at(hk, k[0]) * (1 - ROBE_HIP), 2)
    for k in c['keys']['hip']:
        k[1] = round(k[1] * ROBE_HIP, 2)
for nk, c in out.items():
    bake_hair(c)
D = 'saga-assets/web2d/cutout/_clips'; os.makedirs(D, exist_ok=True)
json.dump(out, open(D + '/side.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump({'id': 'cutout_clips_side', 'ticket': 'K-0199',
           'generator': 'tools/char-forge/clips_to_cutout.py (Blender — 3D 동작 → 컷아웃 뼈 16 옆 2D 각도, 기준 = 모캡 서기 평균, 골반 앞뒤 이동 뺌, 무릎·팔꿈치 사람 범위, ~robe = 다리 0.35배) · k199_build.sh',
           'license': 'CMU Graphics Lab Motion Capture Database — 복사·수정·재배포 허가 불요(상업 포함) · 자체 키프레임(tools/char-forge/keyframes.py) · 바탕 자세 UAL(Quaternius, CC0)',
           'clips': len(out), 'sources': src}, open(D + '/side.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('K199_PACK', len(out), os.path.getsize(D + '/side.json') // 1024, 'KB')
E
PYTHONIOENCODING=utf-8 py tools/asset-place/place.py --item web2d-cutout --write 2>&1 | tail -1
