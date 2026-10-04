"""K-0067 — 하늘 파노라마에 해·달을 실제로 그리고 `sky_markers.json` 을 그림에서 읽은 값으로 (U-0041 후속).

  py tools/ai-art/sky_sun.py apply     # _out/sky_final 의 12장(2048×1024)에 해(새벽·낮·노을)·달(밤) 원반 + 빛무리를 합성 → _out/sky_sun/ (원본은 그대로)
  py tools/ai-art/sky_sun.py check     # 합성본에서 가장 밝은 번짐을 측정해 표식과 ≤2° 인지 + .license.json 100%

투영 = 등장방형 2:1. 이미지 좌표 u(왼→오 0~1)·v(위→아래 0~1) 와 방위·고도는 `az = u·360` · `el = 90 − v·180` 로 묶는다(0 = 북·90 = 동·180 = 남·270 = 서).
유니티 `Skybox/Panoramic` 은 자기 규약(_Rotation)으로 `sun_uv` 에서 방위를 다시 구하면 된다 — 표식에 uv 를 같이 적는다.
해·달 원반은 구면 각거리로 그려 위쪽(고도 높음)에서도 원이다(등장방형 가로 늘어짐 보정). 합성은 screen 이라 구름·실루엣 밑으로 눌리지 않는다.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_out')
FINAL = os.path.join(OUT, 'sky_final')
DST = os.path.join(OUT, 'sky_sun')
W, H = 2048, 1024
# 시간대 → (방위, 고도, 원반 반지름°, 빛무리 σ°, 색, 빛무리 세기)
BODY = {
    'dawn': (95, 8, 2.6, 14, (1.00, 0.86, 0.62), 0.85),
    'noon': (180, 62, 2.4, 11, (1.00, 0.97, 0.86), 0.70),
    'sunset': (265, 5, 3.0, 16, (1.00, 0.68, 0.38), 0.90),
    'night': (205, 42, 3.2, 8, (0.92, 0.94, 1.00), 0.55),
}
MOON2 = (140, 27, 1.6, 5, (0.85, 0.90, 1.00), 0.35)          # 미래 밤의 작은 둘째 달
TIMES = ('dawn', 'noon', 'sunset', 'night')
MOODS = ('past', 'present', 'future')
_lon = (np.arange(W, dtype=np.float32) + 0.5) / W * 2 * math.pi
_lat = (0.5 - (np.arange(H, dtype=np.float32) + 0.5) / H) * math.pi
LON, LAT = np.meshgrid(_lon, _lat)
DIRS = np.stack([np.cos(LAT) * np.sin(LON), np.cos(LAT) * np.cos(LON), np.sin(LAT)], axis=-1)    # x=동 · y=북 · z=위 (방위 0 = 북 = u 0)


def dir_of(az, el):
    a, e = math.radians(az), math.radians(el)
    return np.array([math.cos(e) * math.sin(a), math.cos(e) * math.cos(a), math.sin(e)], dtype=np.float32)


def layer(az, el, rad, sigma, color, glow):
    """원반(구면 각거리 rad° 안은 꽉 참, 가장자리 0.8° 부드럽게) + 가우시안 빛무리 → (H, W, 3) 가산용 층과 알파."""
    cosang = np.clip(DIRS @ dir_of(az, el), -1, 1)
    ang = np.degrees(np.arccos(cosang))
    disc = np.clip((rad - ang) / 0.8 + 0.5, 0, 1)
    halo = np.exp(-(ang / sigma) ** 2) * glow
    col = np.array(color, dtype=np.float32)
    return disc, halo, col


def composite(img, specs):
    base = np.asarray(img.convert('RGB')).astype(np.float32) / 255.0
    out = base
    for sp in specs:
        disc, halo, col = layer(*sp)
        glow_rgb = col[None, None, :] * halo[..., None]
        out = 1 - (1 - out) * (1 - np.clip(glow_rgb, 0, 1))                # screen — 빛무리
        core = np.clip(disc, 0, 1)[..., None]
        out = out * (1 - core) + (col * 0.12 + 0.88)[None, None, :] * core  # 원반은 거의 흰 심 + 살짝 색
    return Image.fromarray(np.clip(out * 255, 0, 255).astype(np.uint8))


def uv_of(az, el):
    return round((az % 360) / 360, 4), round((90 - el) / 180, 4)


def lic_of(sid, extra):
    p = os.path.join(FINAL, sid + '.license.json')
    d = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
    d.update(extra)
    return d


# 시간대별로 해·달이 설 수 있는 범위(방위 ±·고도 범위) — 그림에 이미 밝은 점(행성·별·구름 덩이)이 있으면 그 자리를 피해 옮긴다
RANGE = {'dawn': (12, (6, 12)), 'noon': (35, (52, 70)), 'sunset': (12, (4, 9)), 'night': (35, (36, 56))}


def pick_position(base_path, t):
    """기본 자리 둘레에 원본 그림의 작고 밝은 점이 약하면(<40) 그대로, 아니면 범위 안에서 그런 점이 가장 약한 자리로 옮긴다."""
    az0, el0 = BODY[t][0], BODY[t][1]
    a = dog(base_path)
    h, w = a.shape

    def local(az, el, win=9):
        xs = ((np.arange(w) + 0.5) / w * 360 - az + 180) % 360 - 180
        ys = 90 - (np.arange(h) + 0.5) / h * 180 - el
        m = (np.abs(xs)[None, :] <= win) & (np.abs(ys)[:, None] <= win)
        return float(a[m].max())
    if local(az0, el0) < 40:
        return az0, el0
    daz, (e0, e1) = RANGE[t]
    best = None
    for az in range(int(az0 - daz), int(az0 + daz) + 1, 3):
        for el in range(e0, e1 + 1, 2):
            s = local(az, el) + 0.15 * abs(az - az0)
            if best is None or s < best[0]:
                best = (s, az, el)
    return best[1], best[2]


def apply():
    os.makedirs(DST, exist_ok=True)
    markers = {}
    for t in TIMES:
        for m in MOODS:
            sid = f'{t}_{m}'
            _az, _el, rad, sg, col, gl = BODY[t]
            az, el = pick_position(os.path.join(FINAL, f'sky_{sid}.webp'), t)
            specs = [(az, el, rad, sg, col, gl)]
            if t == 'night' and m == 'future':
                specs.append(MOON2)
            img = composite(Image.open(os.path.join(FINAL, f'sky_{sid}.webp')), specs)
            full = os.path.join(DST, f'sky_{sid}.webp')
            small = os.path.join(DST, f'sky_{sid}_1k.webp')
            img.save(full, 'WEBP', quality=84, method=6)
            img.resize((1024, 512), Image.LANCZOS).save(small, 'WEBP', quality=80, method=6)
            u, v = uv_of(az, el)
            key = 'moon' if t == 'night' else 'sun'
            mk = {f'{key}_az': az, f'{key}_el': el, f'{key}_uv': [u, v], 'drawn': True}
            if key == 'moon':                                                 # 유니티 조명 코드는 sun_* 를 읽으니 달 위치를 조명 방향으로도 적는다(은은한 달빛)
                mk.update({'sun_az': az, 'sun_el': el, 'sun_uv': [u, v], 'light': 'moon'})
            if t == 'night' and m == 'future':
                mk['moon2'] = {'az': MOON2[0], 'el': MOON2[1], 'uv': list(uv_of(MOON2[0], MOON2[1]))}
            mk['moons'] = 2 if (t == 'night' and m == 'future') else (1 if t == 'night' else 0)
            markers[sid] = mk
            for name, size in ((f'sky_{sid}', [W, H]), (f'sky_{sid}_1k', [1024, 512])):
                d = lic_of(f'sky_{sid}' if name.endswith(sid) else f'sky_{sid}_1k',
                           {'id': name, 'size': size, 'sun_composite': 'tools/ai-art/sky_sun.py apply (해·달 원반+빛무리 코드 합성, K-0067)'})
                json.dump(d, open(os.path.join(DST, name + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump({'note': '해·달 위치 표식 — 그림에 실제로 그려 넣은 자리(K-0067). 방위각 0=북 90=동 180=남 270=서, 고도 0=지평선, 등장방형 2:1 에서 az=u·360 · el=90−v·180. 밤은 달이 조명(light:moon). sun_uv 로 유니티가 자기 규약의 방위를 구한다.',
               'skies': markers}, open(os.path.join(DST, 'sky_markers.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('APPLY sky', len(markers))


def dog(path):
    im = Image.open(path).convert('L').resize((1024, 512), Image.LANCZOS)
    return np.asarray(im.filter(ImageFilter.GaussianBlur(3))).astype(np.float32) - np.asarray(im.filter(ImageFilter.GaussianBlur(28))).astype(np.float32)


def peak(a, az=None, el=None, win=14):
    """작고 밝은 점의 자리 — (3px 흐림 − 28px 흐림) 의 argmax. az/el 이 있으면 그 둘레 ±win° 창 안에서만(별·도시 불빛 같은 다른 밝은 점을 뺀다)."""
    h, w = a.shape
    if az is not None:
        xs = ((np.arange(w) + 0.5) / w * 360 - az + 180) % 360 - 180
        ys = 90 - (np.arange(h) + 0.5) / h * 180 - el
        a = np.where((np.abs(xs)[None, :] <= win) & (np.abs(ys)[:, None] <= win), a, -1e9)
    y, x = np.unravel_index(np.argmax(a), a.shape)
    return (x + 0.5) / w * 360, 90 - (y + 0.5) / h * 180, float(a[y, x])


def check():
    """표식 둘레 ±14° 안의 가장 밝은 점이 표식과 ≤2.5° 인지(그림에서 읽은 값) + 그 점이 그림 전체에서도 으뜸인지 알린다(으뜸이 아니면 별·불빛이 더 밝은 것 — 표식은 해·달 자리 그대로)."""
    bad = []
    mk = json.load(open(os.path.join(DST, 'sky_markers.json'), encoding='utf-8'))['skies']
    for sid, v in mk.items():
        key = 'moon' if 'night' in sid else 'sun'
        a = dog(os.path.join(DST, f'sky_{sid}.webp'))
        az, el, val = peak(a, v[f'{key}_az'], v[f'{key}_el'])
        gaz, gel, gval = peak(a)
        daz = abs((az - v[f'{key}_az'] + 180) % 360 - 180)
        dele = abs(el - v[f'{key}_el'])
        top = '으뜸' if val >= gval - 1 else f'전체 으뜸은 {gaz:.0f}°/{gel:.0f}°({gval:.0f}>{val:.0f})'
        print(f'{sid:15s} 표식 {v[key + "_az"]:>3}/{v[key + "_el"]:>3}  측정 {az:6.1f}/{el:5.1f}  오차 {daz:3.1f}/{dele:3.1f}  세기 {val:5.1f}  {top}')
        if daz > 2.5 or dele > 2.5 or val < 25:
            bad.append(sid)
        for name in (f'sky_{sid}', f'sky_{sid}_1k'):
            for ext in ('.license.json', '.webp'):
                if not os.path.exists(os.path.join(DST, name + ext)):
                    bad.append('없음 ' + name + ext)
    print('SKYSUN_FAIL' if bad else 'SKYSUN_OK', bad if bad else '')
    return 1 if bad else 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'apply':
        apply()
    elif cmd == 'check':
        sys.exit(check())
    else:
        print(__doc__)
