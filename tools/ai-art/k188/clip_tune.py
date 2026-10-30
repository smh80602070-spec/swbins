"""K-0207 — 앞·뒤 모션 팩의 공격 계열 클립 팔 진폭을 줄인다. 앞·뒤 시점에서 팔을 머리 위(최대 ≈148°)까지 올리면 소매 넓은 옷의 팔 조각이 판처럼 솟는다.
  py tools/ai-art/k188/clip_tune.py [front|back|all] [--knee 40] [--k 0.45] [--dry]
각 팔 뼈(armU*·armL*·hand*) 각도 a 를 |a|>knee 이면 knee + (|a|−knee)·k 로 압축(걷기·달리기는 최대 10° 라 그대로). 클립에 `"tuned": 1` 표시 — 멱등(이미 한 클립은 건너뜀).
공격 계열 = attack·strong·cast·skill·burst·axe_/dagger_/fist_/spear_/sword_/staff_heavy/bow_1·bow_heavy/gun_1/shield_bash/punch_combo (~robe 포함, *_idle 제외).
정본 saga-assets/web2d/cutout/_clips/<view>.json — 그 뒤 `py tools/asset-place/place.py --item web2d-cutout --write`(웹 shared 사본)."""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
CLIPS = os.path.join(ROOT, 'saga-assets', 'web2d', 'cutout', '_clips')
COMBAT = re.compile(r'^(attack|strong|cast|skill|burst|axe_|dagger_|fist_|spear_|sword_|staff_heavy|bow_1|bow_heavy|gun_1|shield_bash|punch_combo)')
ARM = re.compile(r'^(armU|armL|hand)')


def squash(a, knee, k):
    s = 1 if a >= 0 else -1
    return a if abs(a) <= knee else s * (knee + (abs(a) - knee) * k)


def tune(view, knee, k, dry):
    p = os.path.join(CLIPS, view + '.json')
    d = json.load(open(p, encoding='utf-8'))
    n = skipped = 0; before = after = 0.0
    for name, c in d.items():
        base = name.split('~')[0]
        if not COMBAT.match(base) or base.endswith('_idle') or not isinstance(c, dict) or 'keys' not in c:
            continue
        if c.get('tuned'):
            skipped += 1; continue
        for b, keys in c['keys'].items():
            if not ARM.match(b):
                continue
            for kv in keys:
                before = max(before, abs(kv[1])); kv[1] = round(squash(kv[1], knee, k), 2); after = max(after, abs(kv[1]))
        c['tuned'] = 1; n += 1
    if not dry:
        json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'CLIP_TUNE {view} 조정 {n} · 이미 한 것 {skipped} · 팔 최대 {before:.0f}° → {after:.0f}°' + (' (dry)' if dry else ''))


def main():
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    opt = lambda f, dflt: float(sys.argv[sys.argv.index(f) + 1]) if f in sys.argv else dflt
    views = ['front', 'back'] if not a or a[0] == 'all' else [a[0]]
    for v in views:
        tune(v, opt('--knee', 40.0), opt('--k', 0.45), '--dry' in sys.argv)


if __name__ == '__main__':
    main()
