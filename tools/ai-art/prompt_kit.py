"""프롬프트 조립 키트(K-0070) — 소넷은 **주제(영어 태그 몇 개)** 만 적고, 구도·배경·조명·그림체·부정어·크기·씨앗은 키트가 채운다.

  py tools/ai-art/prompt_kit.py build <입력.json> [--out tools/ai-art/batches/<이름>.json]   # gen.py 배치를 만든다
  py tools/ai-art/prompt_kit.py lint  <배치.json | 입력.json>                                 # 약한 프롬프트를 짚는다(끝 줄 LINT_OK/LINT_FAIL)
  py tools/ai-art/prompt_kit.py show  [--style B] [--spec icon]                               # 조립 결과 한 줄 미리 보기

입력(.json): {"name": "icons_food", "spec": "icon", "style": "B", "model": "animagine-xl-4.0-opt", "variants": 4,
              "items": [{"id": "fo_pine", "subject": "pine tree, snow on branches, wooden pot", "subject_ko": "눈 쌓인 소나무 분재"}]}
  - subject: 영어 danbooru 식 태그 5~8개, 명사 위주, 가장 중요한 것부터. 문장·형용사 나열·작가/원작 이름 금지.
  - subject_ko: 사용자가 한국어로 말한 그대로(기록용). 소넷이 subject 로 옮긴다 — 키트는 번역하지 않는다.
  - view(선택): front|side|back|three_quarter|top  · palette(선택): 그림체 팔레트 대신 쓸 색 묶음 · extra(선택): 덧붙일 태그.
  - spec(선택, 항목별): 파일의 spec 대신 쓸 규격 — 한 배치에 건물(sprite)·짐승(creature)·사람(character)을 섞을 때(그림체 시험).

규칙(페이블 프롬프트 요령을 코드로 고정한 것)
  1 순서 = 품질 꼬리표 → 주제 → 세부 → 구도/배경 → 그림체 → 조명. 모델이 앞쪽 태그를 더 세게 본다.
  2 태그는 짧게, 75단어 안(CLIP 한 덩이 77토큰). 넘치면 뒤 태그가 묽어진다.
  3 사물·지물엔 반드시 "no humans" · 배경엔 "scenery" · 2D 지물엔 바닥 그림자 금지(게임이 그림자를 따로 그린다).
  4 그림체 블록은 STYLES 한 곳 — 바꾸면 그 그림체로 만든 전부를 다시 뽑는다(K-0056 규칙).
  5 가중치 (tag:1.2) 는 주제 첫 태그 하나에만, 1.3 넘기지 않는다.
  6 부정어는 규격별 고정 + 그림체별 추가. 길게 늘리지 않는다(부정어도 토큰을 먹는다).
"""
import argparse
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from gen import BLOCK, MODELS, MAX_PIXELS  # noqa: E402  (금지어·허용 모델·픽셀 한도는 gen.py 가 정본)

QUALITY = {  # 모델별 품질 꼬리표(모델 카드 권장값)
    'animagine-xl-4.0-opt': 'masterpiece, high score, great score, absurdres',
    'Illustrious-XL-v2.0': 'masterpiece, best quality, very aesthetic, absurdres',
    'sd_xl_base_1.0': 'highly detailed, sharp focus, professional game art',
    'v1-5-pruned-emaonly': 'masterpiece, best quality, highly detailed',
}

DEFAULT_STYLE = 'C'   # 10-05 판정기는 P 를 추천했으나(K-0070 단계 5) 사용자가 거부권 "C" 를 씀 — K-0068 이 C 로 재생성
STYLES = {  # 그림체 블록 — 선·명암·색·조명. K-0068 의 B(현재)·P(먹선)·C(동화풍)
    'B': dict(name='부드러운 채색 + 얇은 윤곽(10-03~05 산출)',
              line='thin dark outline', shade='soft painterly shading', color='rich saturated colors, detailed texture',
              light='soft diffuse lighting', neg='sketch, monochrome, flat color, pixel art'),
    'P': dict(name='굵은 먹선 회화풍(기본, 판정기 10-05)',
              line='bold black ink outlines, varied line weight, sumi-e inspired linework', shade='painterly flat shading, visible brush strokes',
              color='muted earth tones with one accent color', light='flat lighting, no gloss',
              neg='thin lines, airbrush, glossy, photorealistic, 3d render, gradient shading'),
    'C': dict(name='부드러운 동화풍',
              line='soft rounded shapes, no hard outline', shade='soft watercolor shading, gentle gradients',
              color='warm pastel palette, cream highlights', light='warm afternoon light',
              neg='harsh outline, dark palette, gritty, photorealistic, neon'),
}

VIEWS = {'front': 'front view, facing viewer', 'side': 'side view, from side, full profile', 'back': 'from behind, back view',
         'three_quarter': 'three-quarter view', 'top': 'from above, top-down view'}

SPECS = {  # 규격 블록 — 구도·배경·크기·샘플러·부정어. 크기는 SDXL 8GB 한도(0.8MP) 안
    'icon': dict(block='no humans, still life, object focus, game icon, single object, centered, simple background, white background, no cast shadow',
                 neg='1girl, 1boy, human, hands, person, character, multiple objects, frame, border, box, text, signature, watermark, cropped, blurry, lowres, worst quality, low quality, ground shadow, gradient background, background scenery',
                 w=768, h=768, steps=28, cfg=5.5, view='three_quarter'),
    'sprite': dict(block='no humans, game sprite, full body, single object, centered, simple background, plain pastel gray-green background, no cast shadow',
                   neg='text, signature, watermark, cropped, blurry, lowres, worst quality, low quality, ground shadow, multiple objects, frame, border, bad anatomy',
                   w=768, h=768, steps=28, cfg=5.5, view='front'),
    'creature': dict(block='game sprite, full body, standing, single creature, centered, simple background, plain pastel gray-green background, no cast shadow',
                     neg='text, signature, watermark, cropped, blurry, lowres, worst quality, low quality, ground shadow, multiple creatures, human, frame, border, bad anatomy, extra limbs',
                     w=768, h=768, steps=28, cfg=5.5, view='side'),
    'character': dict(block='1other, solo, full body, standing, game character art, centered, simple background, plain pastel gray-green background, no cast shadow',
                      neg='text, signature, watermark, cropped, blurry, lowres, worst quality, low quality, bad anatomy, bad hands, extra fingers, extra limbs, multiple views, multiple people, frame, border, ground shadow',
                      w=640, h=896, steps=30, cfg=6.0, view='three_quarter'),
    'portrait': dict(block='1other, solo, bust portrait, upper body, looking at viewer, simple background, plain dark background',
                     neg='text, signature, watermark, cropped, blurry, lowres, worst quality, low quality, bad anatomy, bad hands, extra fingers, multiple views, full body',
                     w=640, h=896, steps=30, cfg=6.0, view='front'),
    'bg': dict(block='scenery, no humans, wide shot, game background, painterly, depth, atmospheric perspective',
               neg='text, signature, watermark, blurry, lowres, worst quality, low quality, people, character, frame, border, split screen',
               w=1216, h=640, steps=30, cfg=6.0, view=None),
    'tile': dict(block='seamless texture, tileable, top-down, flat even lighting, no cast shadow, uniform density',
                 neg='text, signature, watermark, blurry, lowres, worst quality, low quality, border, frame, object, character, vignette, perspective',
                 w=768, h=768, steps=28, cfg=5.0, view=None, tiling=True),
}


def seed_of(iid):
    return int(hashlib.md5(('kit:' + iid).encode()).hexdigest()[:8], 16)


def compose(item, spec, style, model):
    spec = item.get('spec') or spec
    if spec not in SPECS:
        sys.exit(f"{item.get('id')}: 모르는 spec {spec}")
    sp, st = SPECS[spec], STYLES[style]
    subj = item['subject'].strip().rstrip(',')
    first, _, rest = subj.partition(',')
    subj = f'({first.strip()}:1.15)' + (', ' + rest.strip() if rest.strip() else '')   # 규칙 5 — 첫 태그만 살짝
    view = VIEWS.get(item.get('view') or sp['view'] or '', '')
    color = item.get('palette') or st['color']
    parts = [subj, item.get('extra', ''), view, sp['block'], st['line'], st['shade'], color, st['light']]
    prompt = ', '.join(p for p in parts if p)
    neg = sp['neg'] + ', ' + st['neg']
    return prompt, neg


def build(args):
    src = json.load(open(args.src, encoding='utf-8'))
    spec, style, model = src.get('spec', 'icon'), src.get('style', DEFAULT_STYLE), src.get('model', 'animagine-xl-4.0-opt')
    if spec not in SPECS or style not in STYLES or model not in MODELS:
        sys.exit(f'spec {spec} / style {style} / model {model} 중 모르는 값')
    sp = SPECS[spec]
    items = []
    for it in src['items']:
        if not it.get('subject'):
            sys.exit(f"{it.get('id')}: subject 없음 — subject_ko 를 영어 태그로 옮겨 적는다")
        prompt, neg = compose(it, spec, style, model)
        row = {'id': it['id'], 'seed': it.get('seed', seed_of(it['id'])), 'prompt': prompt, 'negative': neg}
        if it.get('subject_ko'):
            row['subject_ko'] = it['subject_ko']
        if it.get('init_image'):   # 이미지→이미지 밑그림(3D 렌더 등) — gen.py 가 그대로 받는다(K-0056 정적 지물 방식)
            row['init_image'] = it['init_image']
            row['denoise'] = float(it.get('denoise', 0.6))
        if it.get('width') and it.get('height'):
            row['width'], row['height'] = it['width'], it['height']
        elif it.get('spec') and it['spec'] != spec:   # 항목별 규격 — 크기·단계·cfg 도 그 규격을 따른다
            isp = SPECS[it['spec']]
            row.update(width=isp['w'], height=isp['h'], steps=isp['steps'], cfg=isp['cfg'], spec=it['spec'])
        items.append(row)
    batch = {'model': model, 'out': src.get('out', src.get('name', os.path.splitext(os.path.basename(args.src))[0])),
             'kit': {'spec': spec, 'style': style, 'style_name': STYLES[style]['name']},
             'defaults': {'prompt_prefix': QUALITY.get(model, ''), 'width': sp['w'], 'height': sp['h'], 'steps': sp['steps'], 'cfg': sp['cfg'],
                          'sampler': 'Euler a', 'negative': sp['neg'], 'variants': int(src.get('variants', 1))},
             'items': items}
    if sp.get('tiling'):
        batch['defaults']['tiling'] = True
    out = args.out or os.path.join(HERE, 'batches', batch['out'] + '.json')
    json.dump(batch, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'배치 {out} · {len(items)}항목 × 후보 {batch["defaults"]["variants"]} · {spec}/{style} · {sp["w"]}x{sp["h"]}')
    return lint_batch(batch, out)


HANGUL = re.compile(r'[가-힣]')
CONFLICT = [({'white background', 'simple background'}, {'scenery', 'landscape', 'cityscape'}),
            ({'no humans'}, {'1girl', '1boy', '1other', 'solo'}),
            ({'pixel art'}, {'painterly', 'watercolor'}),
            ({'monochrome'}, {'colorful', 'saturated colors'})]
NEG_MUST = ('text', 'watermark')


def tags_of(s):
    return [t.strip().lower().strip('()').split(':')[0] for t in s.split(',') if t.strip()]


def lint_batch(batch, label):
    bad, warn = 0, 0
    d = batch.get('defaults', {})
    for it in batch['items']:
        full = (d.get('prompt_prefix', '') + ', ' + it['prompt']).strip(', ')
        tags = tags_of(full)
        iid = it['id']
        m = BLOCK.search(full)
        if m:
            print(f'FAIL {iid}: 금지어 "{m.group(0)}"'); bad += 1
        if HANGUL.search(it['prompt']):
            print(f'FAIL {iid}: 프롬프트에 한글 — subject 를 영어 태그로'); bad += 1
        n = len(full.split())
        if n > 75:
            print(f'WARN {iid}: {n}단어 > 75 — 뒤 태그가 묽어진다, 세부 태그를 줄인다'); warn += 1
        dup = {t for t in tags if tags.count(t) > 1}
        if dup:
            print(f'WARN {iid}: 중복 태그 {sorted(dup)}'); warn += 1
        ts = set(tags)
        for a, b in CONFLICT:
            if ts & a and ts & b:
                print(f'WARN {iid}: 충돌 {sorted(ts & a)} ↔ {sorted(ts & b)}'); warn += 1
        heavy = re.findall(r':(\d\.\d+)\)', it['prompt'])
        if any(float(x) > 1.3 for x in heavy) or len(heavy) > 2:
            print(f'WARN {iid}: 가중치 {heavy} — 1.3 아래, 두 개 이하'); warn += 1
        neg = (it.get('negative') or d.get('negative') or '').lower()
        miss = [k for k in NEG_MUST if k not in neg]
        if miss:
            print(f'WARN {iid}: 부정어에 {miss} 없음'); warn += 1
        w, h = it.get('width', d.get('width', 768)), it.get('height', d.get('height', 768))
        if w * h > MAX_PIXELS:
            print(f'FAIL {iid}: {w}x{h} > SDXL 8GB 한도'); bad += 1
        if len(tags) < 6:
            print(f'WARN {iid}: 태그 {len(tags)}개 — 주제·세부가 너무 적다(5~8개 권장)'); warn += 1
    print(f'{label}: {len(batch["items"])}항목 · FAIL {bad} · WARN {warn}')
    print('LINT_OK' if not bad else 'LINT_FAIL')
    return 0 if not bad else 1


def lint(args):
    b = json.load(open(args.src, encoding='utf-8'))
    if not isinstance(b, dict) or 'items' not in b:
        print(f'{args.src}: gen.py 배치가 아니다(items 없음) — 건너뜀'); print('LINT_OK'); return 0
    if 'items' in b and b['items'] and 'subject' in b['items'][0]:   # 입력 파일이면 조립해서 본다
        spec, style, model = b.get('spec', 'icon'), b.get('style', 'B'), b.get('model', 'animagine-xl-4.0-opt')
        items = []
        for it in b['items']:
            p, n = compose(it, spec, style, model)
            items.append({'id': it['id'], 'prompt': p, 'negative': n})
        b = {'defaults': {'prompt_prefix': QUALITY.get(model, ''), 'width': SPECS[spec]['w'], 'height': SPECS[spec]['h']}, 'items': items}
    return lint_batch(b, args.src)


def show(args):
    p, n = compose({'id': 'demo', 'subject': 'pine tree, snow on branches, wooden pot'}, args.spec, args.style, 'animagine-xl-4.0-opt')
    print('prompt  :', QUALITY['animagine-xl-4.0-opt'] + ', ' + p)
    print('negative:', n)
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    b = sub.add_parser('build'); b.add_argument('src'); b.add_argument('--out'); b.set_defaults(fn=build)
    l = sub.add_parser('lint'); l.add_argument('src'); l.set_defaults(fn=lint)
    s = sub.add_parser('show'); s.add_argument('--style', default=DEFAULT_STYLE, choices=list(STYLES)); s.add_argument('--spec', default='icon', choices=list(SPECS)); s.set_defaults(fn=show)
    a = ap.parse_args()
    sys.exit(a.fn(a))


if __name__ == '__main__':
    main()
