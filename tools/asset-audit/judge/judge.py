"""에셋 판정기(K-0069) — AI 가 뽑은 그림 묶음을 사람 없이 점수 매겨 상위만 남긴다.

  judge.sh score <폴더...> [--out <폴더>] [--keep 0.3] [--per-group 1] [--refs <폴더>] [--spec auto|icon|sprite|bg|tile|portrait|generic]
  judge.sh pick  <report.json> --dest <폴더> [--move]
  judge.sh selftest

점수 다섯 축(0~1) → 종합 0~100. 어느 축이든 **치명 결함**이면 점수와 무관하게 탈락(reason 에 적힌다).
  tech     기술 결함: 빈 그림·가장자리 잘림·흰 테(스티커 테)·배경 잔여 조각·흐림·중복(dHash)
  quality  CLIP 제로샷 품질(깨끗·선명 vs 흐림·글자·워터마크·잘림·잡동사니)
  fidelity .license.json 의 프롬프트(품질·스타일 꼬리표를 뺀 내용어)와 그림의 CLIP 유사도 — "나무를 시켰는데 나무인가"
  style    --refs 가 있으면 기준 그림체 중심과의 유사도, 없으면 묶음 중심과의 유사도(이탈 그림 탐지)
  group    같은 id 의 후보(altar_01·altar_02 …) 중 종합 1등만 통과(--per-group). 100장 뽑아 1장 고르기가 이 줄이다.

선택: C:\\swbins3\\judge-models\\sac+logos+ava1-l14-linearMSE.pth 가 있으면 LAION 미적 예측기도 quality 에 절반 섞는다(없으면 제로샷만).
출력: <out>/report.json·report.csv·sheet_accept.jpg·sheet_reject.jpg · 끝 줄 `JUDGE_OK 통과/전체` (종료 0) — 통과 0 이면 `JUDGE_FAIL`(종료 1).
토치가 없으면 --no-clip 으로 tech 만 돈다(판정 품질이 낮다고 report 에 적힌다).
"""
import argparse
import csv
import json
import os
import re
import shutil
import sys
import time

import numpy as np
from PIL import Image, ImageDraw

IMG_EXT = ('.png', '.webp', '.jpg', '.jpeg')
AESTHETIC_PTH = r'C:\swbins3\judge-models\sac+logos+ava1-l14-linearMSE.pth'
CLIP_ID = 'openai/clip-vit-large-patch14'

# 프롬프트에서 내용어가 아닌 꼬리표(품질·구도·스타일) — fidelity 계산 때 뺀다
TAIL = re.compile(r'\b(masterpiece|best quality|high score|great score|absurdres|highres|very aesthetic|newest|'
                  r'game icon|game asset|simple background|white background|plain background|transparent background|centered|'
                  r'single object|hand-painted|hand painted|no humans|still life|object focus|full body|isometric|'
                  r'front view|side view|back view|sprite|pixel art|2d|3d|render|concept art|illustration|detailed|'
                  r'soft shading|cel shading|flat colors?|thick outlines?|thin outlines?|clean lines?|storybook|watercolor|'
                  r'anime style|cartoon|digital painting|high quality|sharp focus|8k|4k)\b', re.I)
QUALITY_POS = ['a clean, sharp, well-drawn game asset illustration with a clear single subject',
               'a crisp professional digital painting, high quality']
QUALITY_NEG = ['a blurry, messy, low quality, deformed image',
               'an image with text, letters, watermark or signature',
               'a cropped image with the subject cut off at the edge',
               'a cluttered image with several unrelated objects']
NEG_FLAGS = ['blur', 'text', 'cropped', 'clutter']

SPEC = {  # 축 가중치(quality, fidelity, style, tech) · 치명 문턱
    'icon':     dict(w=(0.35, 0.30, 0.15, 0.20), touch=0.12, fringe=0.20, residue=0.12, text=0.45),   # fringe 0.30→0.20: K-0058 사람 × 공지판(0.23) 대조(10-05)
    'sprite':   dict(w=(0.30, 0.30, 0.20, 0.20), touch=0.12, fringe=0.20, residue=0.12, text=0.45),
    'portrait': dict(w=(0.40, 0.25, 0.20, 0.15), touch=0.60, fringe=0.50, residue=0.30, text=0.45),
    'bg':       dict(w=(0.40, 0.30, 0.20, 0.10), touch=1.10, fringe=1.10, residue=1.10, text=0.40),
    'tile':     dict(w=(0.35, 0.25, 0.30, 0.10), touch=1.10, fringe=1.10, residue=1.10, text=0.40),
    'generic':  dict(w=(0.35, 0.30, 0.15, 0.20), touch=0.25, fringe=0.40, residue=0.20, text=0.45),
}
GROUP_RE = re.compile(r'^(.*?)(?:[_-](?:v|var|c|s|r)?\d{1,3})?$', re.I)


# ----------------------------------------------------------------------------- 파일
def list_images(dirs):
    out = []
    for d in dirs:
        if os.path.isfile(d) and d.lower().endswith(IMG_EXT):
            out.append(d); continue
        for root, _, files in os.walk(d):
            if os.path.basename(root).startswith('_judge'):
                continue
            for f in sorted(files):
                if f.lower().endswith(IMG_EXT) and not f.endswith('_sheet.jpg') and 'sheet' not in f.lower():
                    out.append(os.path.join(root, f))
    return out


def license_of(p):
    base = os.path.splitext(p)[0] + '.license.json'
    if os.path.exists(base):
        try:
            with open(base, encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return None
    return None


def content_words(prompt):
    if not prompt:
        return ''
    s = TAIL.sub(' ', prompt)
    s = re.sub(r'\(([^)]*):[0-9.]+\)', r'\1', s)          # (word:1.2) → word
    s = re.sub(r'[()\[\]{}]', ' ', s)
    words = [w.strip() for w in s.split(',') if w.strip()]
    return ', '.join(words[:12])


def guess_spec(p, img, lic):
    low = p.replace('\\', '/').lower()
    w, h = img.size
    if 'portrait' in low or 'bust' in low or 'face' in low:
        return 'portrait'
    if 'tile' in low or 'seamless' in low or 'pattern' in low:
        return 'tile'
    if 'bg' in low or 'background' in low or 'sky' in low or 'cutscene' in low or 'interior' in low or w >= 2.5 * h:
        return 'bg'
    if 'icon' in low:
        return 'icon'
    if img.mode == 'RGBA' or 'sprite' in low or 'moving' in low or 'static' in low or 'still' in low:
        return 'sprite'
    return 'generic'


# ----------------------------------------------------------------------------- 기술 결함(numpy 만)
def fg_mask(img):
    """전경 마스크(bool). RGBA 는 알파, RGB 는 가장자리 중앙값 배경색과의 거리."""
    a = np.asarray(img.convert('RGBA'), dtype=np.int16)
    alpha = a[..., 3]
    if img.mode in ('RGBA', 'LA') and (alpha < 250).mean() > 0.02:
        return alpha > 8, True
    rgb = a[..., :3]
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.abs(rgb - bg).sum(-1)
    return dist > 60, False


def strict_mask(img):
    """RGB 그림의 잘림 판정용 — 배경색과 뚜렷이 다른(합 120 넘는) 픽셀만. 그림자·번짐은 뺀다."""
    a = np.asarray(img.convert('RGB'), dtype=np.int16)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    return np.abs(a - bg).sum(-1) > 120


def label_components(mask):
    try:
        from scipy import ndimage
        lab, n = ndimage.label(mask)
        if n == 0:
            return n, np.zeros(0, dtype=np.int64)
        sizes = np.bincount(lab.ravel())[1:]
        return n, sizes
    except Exception:
        return -1, np.zeros(0)


def dhash(img, size=16):
    g = np.asarray(img.convert('L').resize((size + 1, size), Image.BILINEAR), dtype=np.int16)
    return np.packbits((g[:, 1:] > g[:, :-1]).ravel())


def hamming(a, b):
    return int(np.unpackbits(np.bitwise_xor(a, b)).sum())


def tech_metrics(img, spec):
    m = {}
    mask, has_alpha = fg_mask(img)
    h, w = mask.shape
    m['w'], m['h'], m['alpha'] = w, h, has_alpha
    m['opaque_frac'] = round(float(mask.mean()), 4)
    if spec in ('bg', 'tile'):
        m['border_touch'] = 0.0
        m['fringe'] = 0.0
        m['residue'] = 0.0
    else:
        tm = mask if has_alpha else strict_mask(img)
        border = np.concatenate([tm[0], tm[-1], tm[:, 0], tm[:, -1]])
        m['border_touch'] = round(float(border.mean()), 4)
        # 흰 테: 전경 가장자리 안쪽 2px 띠의 밝은(≥230) 비율 − 안쪽 전체 비율
        gray = np.asarray(img.convert('L'), dtype=np.int16)
        er = mask.copy()
        for _ in range(2):
            er = er & np.roll(er, 1, 0) & np.roll(er, -1, 0) & np.roll(er, 1, 1) & np.roll(er, -1, 1)
        ring = mask & ~er
        inner = er
        if has_alpha and ring.sum() > 20 and inner.sum() > 20:   # 흰 바탕 RGB 는 안티앨리어싱이 흰 테로 보여 알파 그림만 잰다
            ring_white = float((gray[ring] >= 230).mean())
            inner_white = float((gray[inner] >= 230).mean())
            m['fringe'] = round(max(0.0, ring_white - inner_white), 4)
        else:
            m['fringe'] = 0.0
        n, sizes = label_components(mask)
        if n > 0:
            main = sizes.max()
            m['islands'] = int(n)
            m['islands_small'] = int(((sizes >= 64) & (sizes < main)).sum())   # 알맹이 밖의 조각 수(64px 이상 — 반짝임·꽃잎은 안 센다)
            m['residue'] = round(float((sizes.sum() - main) / max(1, sizes.sum())), 4)
        else:
            m['islands'] = n
            m['residue'] = 0.0
    # 흐림: 전경 그레이 라플라시안 분산(크기 정규화) — 낮을수록 흐림
    g = np.asarray(img.convert('L').resize((min(w, 512), min(h, 512))), dtype=np.float32)
    lap = np.abs(4 * g[1:-1, 1:-1] - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:])
    small = mask if mask.shape == g.shape else np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).resize(g.shape[::-1])) > 127
    sel = small[1:-1, 1:-1]
    m['sharpness'] = round(float(lap[sel].mean()) if sel.sum() > 50 else float(lap.mean()), 2)
    m['contrast'] = round(float(g[small].std()) if small.sum() > 50 else float(g.std()), 2)
    return m


def tech_score(m, spec):
    s = 1.0
    s -= min(0.4, m['fringe'] * 1.2)
    s -= min(0.3, m['residue'] * 2.0)
    s -= min(0.3, m['border_touch'] * 1.5) if spec not in ('bg', 'tile') else 0
    if m['sharpness'] < 6:
        s -= 0.3
    elif m['sharpness'] < 10:
        s -= 0.15
    if m['contrast'] < 18:
        s -= 0.15
    return max(0.0, round(s, 4))


# ----------------------------------------------------------------------------- CLIP
class Clip:
    def __init__(self, device=None):
        import torch
        from transformers import CLIPModel, CLIPProcessor, CLIPTokenizer, CLIPImageProcessor
        self.torch = torch
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        dtype = torch.float16 if self.device == 'cuda' else torch.float32
        self.model = CLIPModel.from_pretrained(CLIP_ID, local_files_only=True, torch_dtype=dtype).to(self.device).eval()
        # HF 캐시에 preprocessor_config.json 이 없을 수 있다(sd-webui 가 모델만 받음) → ViT-L/14 전처리 상수를 직접 적는다
        tok = CLIPTokenizer.from_pretrained(CLIP_ID, local_files_only=True)
        imp = CLIPImageProcessor(do_resize=True, size={'shortest_edge': 224}, resample=3, do_center_crop=True, crop_size={'height': 224, 'width': 224},
                                 do_rescale=True, do_normalize=True, image_mean=[0.48145466, 0.4578275, 0.40821073],
                                 image_std=[0.26862954, 0.26130258, 0.27577711])
        self.proc = CLIPProcessor(image_processor=imp, tokenizer=tok)
        self.aes = None
        if os.path.exists(AESTHETIC_PTH):
            try:
                sd = torch.load(AESTHETIC_PTH, map_location='cpu')
                sd = {k.split('layers.', 1)[1] if k.startswith('layers.') else k: v for k, v in sd.items()}   # 원본은 self.layers = Sequential
                layers = [torch.nn.Linear(768, 1024), torch.nn.Dropout(0.2), torch.nn.Linear(1024, 128), torch.nn.Dropout(0.2),
                          torch.nn.Linear(128, 64), torch.nn.Dropout(0.1), torch.nn.Linear(64, 16), torch.nn.Linear(16, 1)]
                self.aes = torch.nn.Sequential(*layers)
                self.aes.load_state_dict(sd)
                self.aes.eval()
            except Exception as e:  # 가중치가 안 맞으면 제로샷만
                print('WARN aesthetic head 못 읽음:', e)
                self.aes = None

    def _norm(self, x):
        return x / x.norm(dim=-1, keepdim=True)

    def images(self, pils, bs=16):
        out = []
        with self.torch.no_grad():
            for i in range(0, len(pils), bs):
                inp = self.proc(images=[p.convert('RGB') for p in pils[i:i + bs]], return_tensors='pt').to(self.device)
                if self.device == 'cuda':
                    inp['pixel_values'] = inp['pixel_values'].half()
                f = self.model.get_image_features(**inp)
                out.append(self._norm(f.float()).cpu())
        return self.torch.cat(out) if out else self.torch.zeros(0, 768)

    def texts(self, strs):
        with self.torch.no_grad():
            inp = self.proc(text=strs, return_tensors='pt', padding=True, truncation=True, max_length=77).to(self.device)
            f = self.model.get_text_features(**inp)
            return self._norm(f.float()).cpu()

    def aesthetic(self, img_emb):
        if self.aes is None:
            return None
        with self.torch.no_grad():
            return self.aes(img_emb).squeeze(-1)


def flatten_alpha(img):
    """CLIP 에 넣을 때 투명을 중간 회색으로 깔아 배경색이 점수를 흔들지 않게."""
    if img.mode in ('RGBA', 'LA'):
        bg = Image.new('RGBA', img.size, (128, 128, 128, 255))
        return Image.alpha_composite(bg, img.convert('RGBA')).convert('RGB')
    return img.convert('RGB')


# ----------------------------------------------------------------------------- 판정
def score(args):
    t0 = time.time()
    paths = list_images(args.dirs)
    if not paths:
        print('JUDGE_FAIL 그림 없음'); return 1
    out = args.out or os.path.join(os.path.dirname(paths[0]) if len(args.dirs) == 1 and os.path.isdir(args.dirs[0]) else '.', '_judge')
    if len(args.dirs) == 1 and os.path.isdir(args.dirs[0]) and not args.out:
        out = os.path.join(args.dirs[0], '_judge')
    os.makedirs(out, exist_ok=True)

    rows, pils, hashes = [], [], []
    for p in paths:
        try:
            img = Image.open(p); img.load()
        except Exception as e:
            rows.append(dict(path=p, error=str(e), decision='reject', reason='읽기 실패')); pils.append(None); hashes.append(None); continue
        lic = license_of(p)
        spec = args.spec if args.spec != 'auto' else guess_spec(p, img, lic)
        m = tech_metrics(img, spec)
        row = dict(path=p, file=os.path.basename(p), spec=spec, id=(lic or {}).get('id') or os.path.splitext(os.path.basename(p))[0],
                   prompt=content_words((lic or {}).get('prompt')), tech=m, tech_score=tech_score(m, spec))
        rows.append(row); pils.append(img); hashes.append(dhash(img))

    # 중복(dHash ≤ 6): 먼저 온 것만 남긴다
    seen = []
    for i, h in enumerate(hashes):
        if h is None or rows[i]['tech']['opaque_frac'] < 0.01:
            continue
        dup = next((j for j in seen if hamming(hashes[j], h) <= 6), None)
        rows[i]['dup_of'] = rows[dup]['file'] if dup is not None else None
        if dup is None:
            seen.append(i)

    clip = None
    if not args.no_clip:
        try:
            clip = Clip(args.device)
        except Exception as e:
            print('WARN CLIP 못 켬 → tech 만:', e)
    if clip is not None:
        ok = [i for i, p in enumerate(pils) if p is not None]
        emb = clip.images([flatten_alpha(pils[i]) for i in ok])
        tq = clip.texts(QUALITY_POS + QUALITY_NEG)
        logits = 100.0 * emb @ tq.T
        prob = logits.softmax(-1)
        q_pos = prob[:, :len(QUALITY_POS)].sum(-1)
        aes = clip.aesthetic(emb)
        # 기준 그림체
        ref_c = None
        if args.refs:
            rp = list_images([args.refs])
            if rp:
                rimgs = []
                for r in rp:
                    try:
                        im = Image.open(r); im.load(); rimgs.append(flatten_alpha(im))
                    except Exception:
                        pass
                if rimgs:
                    re_ = clip.images(rimgs)
                    ref_c = re_.mean(0); ref_c = ref_c / ref_c.norm()
        batch_c = emb.mean(0); batch_c = batch_c / batch_c.norm()
        # 프롬프트 일치
        prompts = [rows[i]['prompt'] for i in ok]
        fid = [None] * len(ok)
        idx = [k for k, s in enumerate(prompts) if s]
        if idx:
            te = clip.texts(['a picture of ' + prompts[k] for k in idx])
            sims = (emb[idx] * te).sum(-1)
            for k, s in zip(idx, sims.tolist()):
                fid[k] = s
        for k, i in enumerate(ok):
            r = rows[i]
            r['quality'] = round(float(q_pos[k]), 4)
            r['flags'] = {NEG_FLAGS[j]: round(float(prob[k, len(QUALITY_POS) + j]), 3) for j in range(len(QUALITY_NEG))}
            if aes is not None:
                a = float(aes[k]); r['aesthetic'] = round(a, 3)
                r['quality'] = round(0.5 * r['quality'] + 0.5 * max(0.0, min(1.0, (a - 3.5) / 3.5)), 4)
            # CLIP 유사도는 0.15~0.35 대역이 보통 — 0.12~0.32 를 0~1 로 편다
            r['fidelity'] = round(max(0.0, min(1.0, (fid[k] - 0.12) / 0.20)), 4) if fid[k] is not None else None
            r['style_batch'] = round(float(emb[k] @ batch_c), 4)
            r['style_ref'] = round(float(emb[k] @ ref_c), 4) if ref_c is not None else None
            st = r['style_ref'] if ref_c is not None else r['style_batch']
            r['style'] = round(max(0.0, min(1.0, (st - 0.5) / 0.4)), 4)
    else:
        for r in rows:
            r.setdefault('quality', None); r.setdefault('fidelity', None); r.setdefault('style', None); r.setdefault('flags', {})

    # 종합·치명
    for r in rows:
        if r.get('error'):
            r['score'] = 0; continue
        sp = SPEC[r['spec']]
        wq, wf, ws, wt = sp['w']
        parts, wsum = 0.0, 0.0
        for v, w in ((r.get('quality'), wq), (r.get('fidelity'), wf), (r.get('style'), ws), (r['tech_score'], wt)):
            if v is not None:
                parts += v * w; wsum += w
        r['score'] = round(100 * parts / wsum, 1) if wsum else 0
        m = r['tech']; why = []
        if m['opaque_frac'] < 0.01: why.append('빈 그림')
        if m['border_touch'] > sp['touch']: why.append('가장자리 잘림 %.2f' % m['border_touch'])
        if m['fringe'] > sp['fringe']: why.append('흰 테 %.2f' % m['fringe'])
        if m['residue'] > sp['residue'] and m.get('islands_small', 0) >= 4:   # 비율·개수 둘 다 넘어야 잔여(장식 조각은 봐준다)
            why.append('배경 조각 %.2f/%d개' % (m['residue'], m.get('islands_small', 0)))
        if r.get('dup_of'): why.append('중복(' + r['dup_of'] + ')')
        fl = r.get('flags') or {}
        if fl.get('text', 0) > sp['text']: why.append('글자·워터마크 %.2f' % fl['text'])
        if r.get('fidelity') is not None and r['fidelity'] < 0.08: why.append('프롬프트와 다름')   # 온돌·장판 같은 낯선 단어는 유사도가 낮게 나와 문턱을 낮게 둔다
        r['fatal'] = why

    # 묶음(id 후보) 안에서 상위 N — 치명 없는 것 중 점수순
    groups = {}
    for r in rows:
        if r.get('error'):
            r['decision'], r['reason'] = 'reject', '읽기 실패'; continue
        g = GROUP_RE.match(r['id']).group(1) or r['id']
        r['group'] = g
        groups.setdefault(g, []).append(r)
    kept_total = 0
    for g, rs in groups.items():
        good = sorted([r for r in rs if not r['fatal']], key=lambda r: -r['score'])
        n_keep = max(1, int(round(len(good) * args.keep))) if args.per_group <= 0 else args.per_group
        for k, r in enumerate(good):
            if k < n_keep and r['score'] >= args.min_score:
                r['decision'], r['reason'] = 'accept', ('묶음 %d/%d' % (k + 1, len(rs)))
                kept_total += 1
            else:
                r['decision'], r['reason'] = 'reject', ('묶음 %d위 (상위 %d만)' % (k + 1, n_keep) if r['score'] >= args.min_score else '점수 %.0f < %d' % (r['score'], args.min_score))
        for r in rs:
            if r['fatal']:
                r['decision'], r['reason'] = 'reject', ' · '.join(r['fatal'])

    rep = dict(generated=time.strftime('%Y-%m-%d %H:%M'), dirs=args.dirs, out=out, n=len(rows), accepted=kept_total,
               clip=clip is not None, aesthetic_head=bool(clip and clip.aes is not None), refs=args.refs, keep=args.keep,
               per_group=args.per_group, seconds=round(time.time() - t0, 1), rows=rows)
    with open(os.path.join(out, 'report.json'), 'w', encoding='utf-8') as f:
        json.dump(rep, f, ensure_ascii=False, indent=1)
    with open(os.path.join(out, 'report.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(['file', 'decision', 'score', 'quality', 'fidelity', 'style', 'tech', 'fringe', 'touch', 'residue', 'sharp', 'reason'])
        for r in rows:
            m = r.get('tech') or {}
            w.writerow([r.get('file', r['path']), r['decision'], r.get('score'), r.get('quality'), r.get('fidelity'), r.get('style'),
                        r.get('tech_score'), m.get('fringe'), m.get('border_touch'), m.get('residue'), m.get('sharpness'), r['reason']])
    sheet([(r, pils[i]) for i, r in enumerate(rows) if r['decision'] == 'accept'], os.path.join(out, 'sheet_accept.jpg'))
    sheet([(r, pils[i]) for i, r in enumerate(rows) if r['decision'] == 'reject'], os.path.join(out, 'sheet_reject.jpg'))
    rej = {}
    for r in rows:
        if r['decision'] == 'reject':
            k = r['reason'].split(' ')[0]
            rej[k] = rej.get(k, 0) + 1
    print('판정 %d장 → 통과 %d · 탈락 %d  (CLIP %s · 미적 예측기 %s · %.0f초)' % (len(rows), kept_total, len(rows) - kept_total,
          '켬' if clip else '끔', '켬' if rep['aesthetic_head'] else '없음', rep['seconds']))
    print('탈락 이유:', ', '.join('%s %d' % kv for kv in sorted(rej.items(), key=lambda kv: -kv[1])) or '-')
    print('보고:', os.path.join(out, 'report.csv'), '·', os.path.join(out, 'sheet_accept.jpg'))
    print(('JUDGE_OK %d/%d' if kept_total else 'JUDGE_FAIL %d/%d') % (kept_total, len(rows)))
    return 0 if kept_total else 1


def sheet(items, path, cell=160, cols=8, limit=200):
    items = items[:limit]
    if not items:
        Image.new('RGB', (cell, 40), (40, 40, 40)).save(path, quality=80); return
    rows_n = (len(items) + cols - 1) // cols
    im = Image.new('RGB', (cols * cell, rows_n * (cell + 28)), (30, 30, 30))
    d = ImageDraw.Draw(im)
    for k, (r, pil) in enumerate(items):
        x, y = (k % cols) * cell, (k // cols) * (cell + 28)
        if pil is not None:
            t = flatten_alpha(pil).copy(); t.thumbnail((cell - 4, cell - 4))
            im.paste(t, (x + 2 + (cell - 4 - t.width) // 2, y + 2 + (cell - 4 - t.height) // 2))
        cap = '%s %.0f' % (r.get('file', '?')[:18], r.get('score') or 0)
        d.text((x + 3, y + cell + 2), cap, fill=(230, 230, 230))
        why = (r.get('reason') or '')[:26]
        d.text((x + 3, y + cell + 14), why, fill=(255, 150, 150) if r['decision'] == 'reject' else (150, 255, 150))
    im.save(path, quality=82)


def pick(args):
    with open(args.report, encoding='utf-8') as f:
        rep = json.load(f)
    os.makedirs(args.dest, exist_ok=True)
    n = 0
    for r in rep['rows']:
        if r['decision'] != 'accept':
            continue
        src = r['path']
        for s in (src, os.path.splitext(src)[0] + '.license.json'):
            if os.path.exists(s):
                (shutil.move if args.move else shutil.copy2)(s, os.path.join(args.dest, os.path.basename(s)))
        n += 1
    with open(os.path.join(args.dest, 'judge_pick.json'), 'w', encoding='utf-8') as f:
        json.dump(dict(report=os.path.abspath(args.report), picked=n, at=time.strftime('%Y-%m-%d %H:%M')), f, ensure_ascii=False, indent=1)
    print('PICK_OK %d → %s' % (n, args.dest))
    return 0


def selftest(args):
    """합성 그림 여섯: 정상·빈·잘림·흰 테·조각·중복 → 기대 판정과 같으면 SELFTEST_OK."""
    import tempfile
    d = tempfile.mkdtemp(prefix='judge_')
    def save(name, im):
        im.save(os.path.join(d, name))
    base = Image.new('RGBA', (256, 256), (0, 0, 0, 0)); dr = ImageDraw.Draw(base)
    dr.ellipse((60, 60, 196, 196), fill=(200, 60, 40, 255)); dr.ellipse((90, 90, 150, 150), fill=(250, 200, 80, 255))
    save('ok_01.png', base)
    save('ok_02.png', base.rotate(3))                       # 중복(거의 같음)
    save('empty_01.png', Image.new('RGBA', (256, 256), (0, 0, 0, 0)))
    cut = Image.new('RGBA', (256, 256), (0, 0, 0, 0)); ImageDraw.Draw(cut).ellipse((-80, 60, 120, 260), fill=(60, 120, 200, 255)); save('cut_01.png', cut)
    fr = base.copy(); ImageDraw.Draw(fr).ellipse((60, 60, 196, 196), outline=(255, 255, 255, 255), width=4); save('fringe_01.png', fr)
    res = base.copy(); dd = ImageDraw.Draw(res)
    for i in range(8):
        dd.rectangle((5 + i * 30, 215, 29 + i * 30, 250), fill=(90, 90, 90, 255))   # 25×36 조각 여덟 = 비율 ≈ 0.33
    save('residue_01.png', res)
    ns = argparse.Namespace(dirs=[d], out=os.path.join(d, '_judge'), keep=1.0, per_group=0, refs=None, spec='sprite',
                            no_clip=True, device=None, min_score=0)
    score(ns)
    with open(os.path.join(d, '_judge', 'report.json'), encoding='utf-8') as f:
        rows = {r['file']: r for r in json.load(f)['rows']}
    exp = {'ok_01.png': 'accept', 'ok_02.png': 'reject', 'empty_01.png': 'reject', 'cut_01.png': 'reject',
           'fringe_01.png': 'reject', 'residue_01.png': 'reject'}
    bad = [k for k, v in exp.items() if rows[k]['decision'] != v]
    for k in exp:
        print(' ', k, rows[k]['decision'], rows[k]['reason'])
    print('SELFTEST_OK' if not bad else 'SELFTEST_FAIL ' + ' '.join(bad))
    return 0 if not bad else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('score'); s.add_argument('dirs', nargs='+'); s.add_argument('--out'); s.add_argument('--keep', type=float, default=0.3)
    s.add_argument('--per-group', type=int, default=0, help='id 묶음마다 남길 수(0 이면 --keep 비율)')
    s.add_argument('--min-score', type=float, default=0); s.add_argument('--refs'); s.add_argument('--spec', default='auto', choices=['auto'] + list(SPEC))
    s.add_argument('--no-clip', action='store_true'); s.add_argument('--device'); s.set_defaults(fn=score)
    p = sub.add_parser('pick'); p.add_argument('report'); p.add_argument('--dest', required=True); p.add_argument('--move', action='store_true'); p.set_defaults(fn=pick)
    t = sub.add_parser('selftest'); t.set_defaults(fn=selftest)
    a = ap.parse_args()
    sys.exit(a.fn(a))


if __name__ == '__main__':
    main()
