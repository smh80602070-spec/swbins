"""K-0188 — 왼쪽을 보는 사람을 오른쪽으로(엔진 cutout2d 는 기본 방향 = 오른쪽, facing 'left' 일 때만 거울).
손질한 관절을 버리지 않고 그대로 거울에 비춘다: side.png·side_bg.png·fill_img 좌우 뒤집기 + joints 의 모든 x → W-1-x(poly·weapon·drop/chest/hip_poly 포함) + flip.json 뒤집기.
  py tools/ai-art/k188/mirror_person.py <id> [<id> …]     → 그다음 k188_cutout.py cut … --fill sd · preview · publish.py
"""
import json
import os
import sys

from PIL import Image

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '_out', 'k188', 'p')
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))


def mx(v, W):
    if isinstance(v, list) and len(v) == 2 and all(isinstance(t, (int, float)) for t in v):
        return [W - 1 - v[0], v[1]]
    if isinstance(v, list):
        return [mx(t, W) for t in v]
    if isinstance(v, dict):
        return {k: (mx(t, W) if k not in ('w', 'side') else t) for k, t in v.items()}
    return v


def main():
    for i in sys.argv[1:]:
        d = os.path.join(P, i)
        W = Image.open(os.path.join(d, 'side.png')).width
        for f in ('side.png', 'side_bg.png'):
            p = os.path.join(d, f)
            if os.path.exists(p):
                Image.open(p).transpose(Image.FLIP_LEFT_RIGHT).save(p)
        jp = os.path.join(d, 'joints.json')
        j = json.load(open(jp))
        fill = j.get('fill_img')
        if fill and os.path.exists(os.path.join(ROOT, fill)):
            Image.open(os.path.join(ROOT, fill)).transpose(Image.FLIP_LEFT_RIGHT).save(os.path.join(ROOT, fill))
        out = {}
        for k, v in j.items():
            out[k] = v if k in ('foot', 'skirt', 'skirt_cut', 'fill_img', 'w') else mx(v, W)
        json.dump(out, open(jp, 'w'))
        json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), i + '.joints.json'), 'w'))   # K-0201 — 정본 관절도(옛 판은 작업본만 → 정본에서 다시 복사되면 뒤집기가 풀렸다, sg_huangzhong)
        fp = os.path.join(d, 'flip.json')
        fl = json.load(open(fp)).get('flip', False) if os.path.exists(fp) else False
        json.dump({'flip': not fl, 'mirrored': 'K-0188 오른쪽 보기로'}, open(fp, 'w'))
        print('MIRROR', i, 'W', W)


if __name__ == '__main__':
    main()
