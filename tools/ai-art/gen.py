"""ai-art 생성기 — 배치(JSON)를 swbins3 의 sd-webui API 로 한 장씩 만들고, 그림마다 `.license.json`(모델·라이선스·프롬프트·씨앗)을 남긴다.

  py tools/ai-art/gen.py tools/ai-art/batches/web_portraits_test.json [--dry] [--only id1,id2]

**PC 가 멈추지 않게(2026-09-29 사용자 지시)** — 순차 1장씩 · 장당 제한 시간 넘으면 중단(interrupt) · 시작 전 여유 RAM 점검 ·
SDXL 은 0.8MP(768×1024) 안에서만(1024px 은 공유 메모리로 넘쳐 한 장 5분 이상) · 장 사이 쉼 · 연속 실패 2번이면 통째로 멈춤 · 한 번에 최대 24장.
켜기·끄기는 `start_sd.ps1`·`stop_sd.ps1`(낮은 우선순위, PID 파일). 다른 무거운 일(Unity·Blender 배치)과 동시에 돌리지 않는다.

정책: 원작·실존 인물·작가 이름을 프롬프트에 쓰지 않는다(SAGA 이름 정책, `BLOCK` 정규식으로 막는다). 모델은 상업 허용으로 확인된 것만(`MODELS`, C:\\swbins3\\COMMERCIAL_SWAP_TODO.md).
"""
import argparse
import base64
import ctypes
import datetime
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.request

API = 'http://127.0.0.1:7860'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_out')
MAX_PIXELS = 800_000          # 768x1024 = 786k — SDXL 이 VRAM 8GB 안에 든다
MIN_FREE_GB = 6.0
PER_IMAGE_TIMEOUT = 480       # 초
PAUSE = 8
MAX_ITEMS = int(os.environ.get('AI_ART_MAX', 24))   # 러너는 8 — sd-webui 파이썬이 장수가 늘수록 RAM 을 12GB 넘게 쥔다(09-29 관찰), 묶음마다 껐다 켠다

# 상업 허용으로 확인한 모델만 (COMMERCIAL_SWAP_TODO.md 2026-09-28)
MODELS = {
    'animagine-xl-4.0-opt': {'license': 'CreativeML OpenRAIL++-M', 'sdxl': True, 'note': 'anime'},
    'sd_xl_base_1.0': {'license': 'CreativeML OpenRAIL++-M', 'sdxl': True, 'note': 'general'},
    'v1-5-pruned-emaonly': {'license': 'CreativeML OpenRAIL-M', 'sdxl': False, 'note': 'fallback'},
    # K-0013 점검용 — 비교 배치(model_compare_*)에만 쓴다. 게임 폴더에 넣기 전 사용자 판정 필요
    'Illustrious-XL-v2.0': {'license': 'CreativeML OpenRAIL-M (HF 태그, 버전별 재확인 필요)', 'sdxl': True, 'note': 'anime-compare'},
    'NoobAI-XL-v1.1': {'license': 'Fair AI Public License 1.0-SD 변형 — 생성물 상업 사용 금지(NC)', 'sdxl': True, 'note': 'anime-compare-NC', 'nc': True},
}
BLOCK = re.compile(r'(genshin|honkai|pokemon|pok[eé]mon|final fantasy|zelda|diablo|maplestory|animal crossing|naruto|one piece|ghibli|'
                   r'\bin the style of\b|by [a-z]+ [a-z]+\b|greg rutkowski|artgerm|makoto shinkai|hayao|sejong|yi sun|napoleon|caesar|genghis)', re.I)


def free_gb():
    class MS(ctypes.Structure):
        _fields_ = [('dwLength', ctypes.c_ulong), ('dwMemoryLoad', ctypes.c_ulong), ('ullTotalPhys', ctypes.c_ulonglong),
                    ('ullAvailPhys', ctypes.c_ulonglong), ('ullTotalPageFile', ctypes.c_ulonglong), ('ullAvailPageFile', ctypes.c_ulonglong),
                    ('ullTotalVirtual', ctypes.c_ulonglong), ('ullAvailVirtual', ctypes.c_ulonglong), ('sullAvailExtendedVirtual', ctypes.c_ulonglong)]
    s = MS(); s.dwLength = ctypes.sizeof(MS)
    ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(s))
    return s.ullAvailPhys / 2 ** 30


def call(path, data=None, timeout=30, method=None):
    req = urllib.request.Request(API + path, data=json.dumps(data).encode() if data is not None else None,
                                 headers={'Content-Type': 'application/json'}, method=method or ('POST' if data is not None else 'GET'))
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read() or b'null')


def up():
    try:
        call('/sdapi/v1/options', timeout=5)
        return True
    except Exception:
        return False


def generate(item, model, d):
    model = item.get('model', model)      # 항목마다 모델을 바꿀 수 있다(그림체 시험 — 상업 허용 목록 MODELS 안에서만)
    if model not in MODELS or MODELS[model].get('nc'):
        raise ValueError(f'{item["id"]}: 모델 {model} 은 허용 목록 밖이거나 비상업')
    w, h = item.get('width', d.get('width', 768)), item.get('height', d.get('height', 1024))
    if w * h > MAX_PIXELS and MODELS[model]['sdxl']:
        raise ValueError(f'{item["id"]}: {w}x{h} 는 SDXL 안전 한도({MAX_PIXELS}px) 초과')
    body = {
        'prompt': item['prompt'] if not d.get('prompt_prefix') else d['prompt_prefix'] + ', ' + item['prompt'],
        'negative_prompt': item.get('negative', d.get('negative', '')),
        'seed': item.get('seed', d.get('seed', -1)),
        'steps': min(int(item.get('steps', d.get('steps', 28))), 40),
        'cfg_scale': item.get('cfg', d.get('cfg', 5.0)),
        'sampler_name': item.get('sampler', d.get('sampler', 'Euler a')),
        'width': w, 'height': h, 'batch_size': 1, 'n_iter': 1,
        'override_settings': {'sd_model_checkpoint': model},
        'override_settings_restore_afterwards': True,
        'send_images': True, 'save_images': False,
        'tiling': bool(item.get('tiling', d.get('tiling', False))),   # 순환 패딩: 좌우·상하가 이어지는 그림(K-0020 바닥 타일)
    }
    hr = float(item.get('hr', d.get('hr', 0)) or 0)       # hires 배율(예: 1.33 → 768 이 1024) — 첫 단은 한도 안, 둘째 단에서 디테일을 더한다
    if hr > 1.0 and not item.get('init_image'):
        body.update({'enable_hr': True, 'hr_scale': hr, 'hr_upscaler': item.get('hr_upscaler', d.get('hr_upscaler', 'Latent')),
                     'hr_second_pass_steps': int(item.get('hr_steps', d.get('hr_steps', 14))),
                     'denoising_strength': float(item.get('hr_denoise', d.get('hr_denoise', 0.45)))})
    result = {}
    ep = '/sdapi/v1/txt2img'
    if item.get('init_image'):       # 이미지→이미지: 모델 렌더(_out/busts)의 머리색·옷·실루엣을 남기고 그림체만 바꾼다
        ep = '/sdapi/v1/img2img'
        body['init_images'] = [base64.b64encode(open(item['init_image'], 'rb').read()).decode('ascii')]
        body['denoising_strength'] = float(item.get('denoise', d.get('denoise', 0.55)))
        body['resize_mode'] = 0

    def run():
        try:
            result['r'] = call(ep, body, timeout=PER_IMAGE_TIMEOUT + 60)
        except Exception as e:      # noqa
            result['e'] = e
    t = threading.Thread(target=run, daemon=True)
    t0 = time.time()
    t.start()
    while t.is_alive():
        t.join(timeout=5)
        if time.time() - t0 > PER_IMAGE_TIMEOUT:
            try:
                call('/sdapi/v1/interrupt', {}, timeout=5)
            except Exception:
                pass
            raise TimeoutError(f'{item["id"]}: {PER_IMAGE_TIMEOUT}s 초과 — 중단(interrupt)')
    if 'e' in result:
        raise result['e']
    r = result['r']
    info = json.loads(r.get('info', '{}'))
    return base64.b64decode(r['images'][0]), body, info, time.time() - t0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('batch')
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--only', default='')
    a = ap.parse_args()
    b = json.load(open(a.batch, encoding='utf-8'))
    model = b['model']
    if model not in MODELS:
        sys.exit(f'모델 {model} — 상업 허용 확인 목록(MODELS)에 없다')
    if MODELS[model].get('nc') and not str(b.get('out', '')).startswith('model_compare_'):
        sys.exit(f'모델 {model} 은 비상업(NC) — 점검 배치(out 이 model_compare_ 로 시작) 밖에서는 쓰지 않는다(K-0013)')
    d = b.get('defaults', {})
    out_dir =os.path.join(OUT, b.get('out', os.path.splitext(os.path.basename(a.batch))[0]))
    items = [i for i in b['items'] if (not a.only or i['id'] in a.only.split(',')) and not os.path.exists(os.path.join(out_dir, i['id'] + '.png'))][:MAX_ITEMS]   # 있는 그림은 셈에서 뺀다
    for i in items:
        txt = i['prompt'] + ' ' + d.get('prompt_prefix', '')
        m = BLOCK.search(txt)
        if m:
            sys.exit(f'{i["id"]}: 프롬프트에 금지어 "{m.group(0)}" — 원작·실존 인물·작가 이름은 쓰지 않는다')
    print(f'배치 {os.path.basename(a.batch)} · 모델 {model} · {len(items)}장 · 여유 RAM {free_gb():.1f}GB')
    if a.dry:
        return
    if free_gb() < MIN_FREE_GB:
        sys.exit(f'여유 RAM {free_gb():.1f}GB < {MIN_FREE_GB}GB — 다른 무거운 일을 끄고 다시')
    if not up():
        sys.exit('sd-webui 가 안 떠 있다 — powershell -ExecutionPolicy Bypass -File tools/ai-art/start_sd.ps1')
    out = os.path.join(OUT, b.get('out', os.path.splitext(os.path.basename(a.batch))[0]))
    os.makedirs(out, exist_ok=True)
    fails = 0
    for n, it in enumerate(items):
        p = os.path.join(out, it['id'] + '.png')
        if os.path.exists(p):
            print('건너뜀(있음)', it['id'])
            continue
        if free_gb() < MIN_FREE_GB:
            print('여유 RAM 부족 — 중단'); break
        try:
            png, body, info, secs = generate(it, model, d)
        except Exception as e:      # noqa
            fails += 1
            print('실패', it['id'], e)
            if fails >= 2:
                print('연속 실패 2번 — 통째로 멈춘다'); break
            continue
        fails = 0
        open(p, 'wb').write(png)
        lic = {'id': it['id'], 'generator': 'tools/ai-art/gen.py', 'model': it.get('model', model), 'model_license': MODELS[it.get('model', model)]['license'],
               'prompt': body['prompt'], 'negative_prompt': body['negative_prompt'], 'seed': info.get('seed', body['seed']),
               'steps': body['steps'], 'cfg_scale': body['cfg_scale'], 'sampler': body['sampler_name'], 'size': [body['width'], body['height']],
               'seconds': round(secs, 1), 'date': datetime.date.today().isoformat(),
               'note': 'AI 생성 — 저작권 보호가 약하다(사람의 창작 기여가 적으면). 상업 사용은 모델 라이선스 허용 범위 안.'}
        if body.get('init_images'):
            if it.get('meta'):        # 펫 등 공방 몸이 아닌 밑그림 — 배치가 출처(meta)를 직접 준다
                lic.update({'mode': 'img2img', 'init_image': os.path.basename(it['init_image']), 'denoise': body['denoising_strength']})
                lic.update(it['meta'])
            else:
                from i2i_meta import base_meta
                lic.update(base_meta(it['init_image'], body['denoising_strength']))
        json.dump(lic, open(os.path.splitext(p)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'ok {it["id"]} {secs:.0f}s seed {lic["seed"]}')
        if n < len(items) - 1:
            time.sleep(PAUSE)


if __name__ == '__main__':
    main()
