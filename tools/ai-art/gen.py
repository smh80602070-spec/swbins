"""ai-art 생성기 — 배치(JSON)를 swbins3 의 ComfyUI API 로 한 장씩 만들고, 그림마다 `.license.json`(모델·라이선스·프롬프트·씨앗)을 남긴다.

  py tools/ai-art/gen.py tools/ai-art/batches/web_portraits_test.json [--dry] [--only id1,id2]

백엔드는 ComfyUI(`C:\\swbins3\\comfyui`, 포트 8188 · 2026-10-07 A1111 에서 이사). 모델은 두 계열:
  zimage — Z-Image-Turbo(Apache-2.0, GGUF Q6_K + Qwen3-4B 인코더). 8단계·CFG 1 고정, 부정 프롬프트 없음, 글은 문장형이 낫다. 범용·글자·사실풍.
  sdxl   — Animagine XL 4.0 Opt · Illustrious XL v2.0(애니). 태그형 프롬프트 + 품질 꼬리표(prompt_kit QUALITY), 부정 프롬프트 있음.
배치 JSON 형식은 그대로(model·defaults·items). sampler 는 A1111 이름("Euler a")도 받는다(SAMPLERS 로 옮김).

**PC 가 멈추지 않게(2026-09-29 사용자 지시)** — 순차 1장씩 · 장당 제한 시간 넘으면 중단(interrupt) · 시작 전 여유 RAM 점검 ·
픽셀 한도(MAX_PIXELS) 안에서만 · 장 사이 쉼 · 연속 실패 2번이면 통째로 멈춤 · 한 번에 최대 24장.
켜기·끄기는 `start_sd.ps1`·`stop_sd.ps1`(낮은 우선순위, PID 파일). 다른 무거운 일(Unity·Blender 배치)과 동시에 돌리지 않는다.

정책: 원작·실존 인물·작가 이름을 프롬프트에 쓰지 않는다(SAGA 이름 정책, `BLOCK` 정규식으로 막는다). 모델은 상업 허용으로 확인된 것만(`MODELS`, C:\\swbins3\\COMMERCIAL_SWAP_TODO.md).
"""
import argparse
import ctypes
import datetime
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import uuid
from urllib.parse import urlencode

API = os.environ.get('AI_ART_API', 'http://127.0.0.1:8188')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_out')
MAX_PIXELS = int(os.environ.get('AI_ART_MAX_PIXELS', 1_100_000))   # 1024² · 832×1216 — ComfyUI 는 넘치는 층을 스스로 내려 8GB 에서도 1MP 가 돈다(10-07 실측은 README)
MIN_FREE_GB = 6.0
PER_IMAGE_TIMEOUT = 480       # 초
PAUSE = 4
MAX_ITEMS = int(os.environ.get('AI_ART_MAX', 24))
CLIENT = 'saga-ai-art'

# 상업 허용으로 확인한 모델만 (COMMERCIAL_SWAP_TODO.md 2026-10-07). 파일은 C:\swbins3\comfyui\models\ 아래.
MODELS = {
    'z-image-turbo': {'license': 'Apache-2.0', 'kind': 'zimage', 'note': 'general',
                      'unet': 'z-image-turbo-Q6_K.gguf', 'clip': 'Qwen3-4B-Q8_0.gguf', 'vae': 'ae.safetensors',
                      'steps': 8, 'cfg': 1.0, 'sampler': 'res_multistep', 'scheduler': 'simple', 'shift': 3.0},
    'animagine-xl-4.0-opt': {'license': 'CreativeML OpenRAIL++-M', 'kind': 'sdxl', 'note': 'anime',
                             'ckpt': 'animagine-xl-4.0-opt.safetensors', 'vae': 'sdxl-vae-fp16-fix.safetensors'},
    'Illustrious-XL-v2.0': {'license': 'CreativeML OpenRAIL-M (저자 HF 토론 2025-04: 상업 가능, 폐쇄 파생 모델 수익화만 금지)', 'kind': 'sdxl', 'note': 'anime',
                            'ckpt': 'Illustrious-XL-v2.0.safetensors', 'vae': 'sdxl-vae-fp16-fix.safetensors'},
}
# A1111 이름 → ComfyUI (sampler, scheduler)
SAMPLERS = {'euler a': ('euler_ancestral', 'normal'), 'euler': ('euler', 'normal'), 'dpm++ 2m karras': ('dpmpp_2m', 'karras'),
            'dpm++ 2m sde karras': ('dpmpp_2m_sde', 'karras'), 'dpm++ sde karras': ('dpmpp_sde', 'karras'), 'ddim': ('ddim', 'ddim_uniform'),
            'res_multistep': ('res_multistep', 'simple')}
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


def call(path, data=None, timeout=30, raw=False):
    req = urllib.request.Request(API + path, data=json.dumps(data).encode() if data is not None else None,
                                 headers={'Content-Type': 'application/json'}, method='POST' if data is not None else 'GET')
    with urllib.request.urlopen(req, timeout=timeout) as r:
        b = r.read()
        return b if raw else json.loads(b or b'null')


def upload(path):
    """img2img 밑그림을 ComfyUI input 폴더로 올린다(multipart). 돌아오는 이름을 LoadImage 에 준다."""
    name = f'saga_{uuid.uuid4().hex}{os.path.splitext(path)[1]}'
    bnd = uuid.uuid4().hex
    body = (f'--{bnd}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\nContent-Type: application/octet-stream\r\n\r\n').encode() \
        + open(path, 'rb').read() + f'\r\n--{bnd}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--{bnd}--\r\n'.encode()
    req = urllib.request.Request(API + '/upload/image', data=body, headers={'Content-Type': f'multipart/form-data; boundary={bnd}'}, method='POST')
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())['name']


def up():
    try:
        call('/system_stats', timeout=5)
        return True
    except Exception:
        return False


def sampler_of(name, m):
    key = str(name or '').lower().strip()
    if m['kind'] == 'zimage':          # 증류 모델 — 샘플러·스케줄러 고정
        return m['sampler'], m['scheduler']
    return SAMPLERS.get(key, (key.replace(' ', '_') or 'euler_ancestral', 'normal'))


def workflow(item, model, d, seed, dry=False):
    """배치 항목 하나 → ComfyUI API 그래프. 돌려주는 settings 는 license.json 에 적는다. dry 면 밑그림을 올리지 않는다."""
    m = MODELS[model]
    w, h = int(item.get('width', d.get('width', 1024))), int(item.get('height', d.get('height', 1024)))
    if w * h > MAX_PIXELS:
        raise ValueError(f'{item["id"]}: {w}x{h} 는 픽셀 한도({MAX_PIXELS}) 초과')
    if w % 16 or h % 16:
        raise ValueError(f'{item["id"]}: 크기는 16 의 배수')
    prompt = item['prompt'] if not d.get('prompt_prefix') else d['prompt_prefix'] + ', ' + item['prompt']
    neg = item.get('negative', d.get('negative', ''))
    steps = int(item.get('steps', d.get('steps', 28)))
    cfg = float(item.get('cfg', d.get('cfg', 5.0)))
    if m['kind'] == 'zimage':
        steps, cfg, neg = m['steps'], m['cfg'], ''
    steps = min(steps, 40)
    sampler, scheduler = sampler_of(item.get('sampler', d.get('sampler')), m)
    tiling = bool(item.get('tiling', d.get('tiling', False)))
    init = item.get('init_image')
    denoise = float(item.get('denoise', d.get('denoise', 0.55))) if init else 1.0
    g = {}
    if m['kind'] == 'zimage':
        g['1'] = {'class_type': 'UnetLoaderGGUF', 'inputs': {'unet_name': m['unet']}}
        g['2'] = {'class_type': 'ModelSamplingAuraFlow', 'inputs': {'model': ['1', 0], 'shift': m['shift']}}
        g['3'] = {'class_type': 'CLIPLoaderGGUF', 'inputs': {'clip_name': m['clip'], 'type': 'lumina2'}}
        g['4'] = {'class_type': 'VAELoader', 'inputs': {'vae_name': m['vae']}}
        g['5'] = {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['3', 0], 'text': prompt}}
        g['6'] = {'class_type': 'ConditioningZeroOut', 'inputs': {'conditioning': ['5', 0]}}
        model_ref, clip_ref, vae_ref = ['2', 0], ['3', 0], ['4', 0]
        latent_cls = 'EmptySD3LatentImage'
    else:
        g['1'] = {'class_type': 'CheckpointLoaderSimple', 'inputs': {'ckpt_name': m['ckpt']}}
        g['4'] = {'class_type': 'VAELoader', 'inputs': {'vae_name': m['vae']}}
        g['5'] = {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['1', 1], 'text': prompt}}
        g['6'] = {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['1', 1], 'text': neg}}
        model_ref, clip_ref, vae_ref = ['1', 0], ['1', 1], ['4', 0]
        latent_cls = 'EmptyLatentImage'
    # 이음매 타일(K-0020): 항상 넣어 켜고 끈다(공유 모듈의 패딩을 되돌리기 위해). zimage 는 VAE 만 돌아 타일이 안 된다 → sdxl 로 만든다
    g['7'] = {'class_type': 'SagaSeamlessTiling', 'inputs': {'model': model_ref, 'vae': vae_ref, 'enabled': tiling}}
    model_ref, vae_ref = ['7', 0], ['7', 1]
    if init:
        g['8'] = {'class_type': 'LoadImage', 'inputs': {'image': 'dry.png' if dry else upload(init)}}
        g['9'] = {'class_type': 'ImageScale', 'inputs': {'image': ['8', 0], 'upscale_method': 'lanczos', 'width': w, 'height': h, 'crop': 'center'}}
        g['10'] = {'class_type': 'VAEEncode', 'inputs': {'pixels': ['9', 0], 'vae': vae_ref}}
        latent = ['10', 0]
    else:
        g['10'] = {'class_type': latent_cls, 'inputs': {'width': w, 'height': h, 'batch_size': 1}}
        latent = ['10', 0]
    g['11'] = {'class_type': 'KSampler', 'inputs': {'model': model_ref, 'positive': ['5', 0], 'negative': ['6', 0], 'latent_image': latent,
                                                    'seed': seed, 'steps': steps, 'cfg': cfg, 'sampler_name': sampler, 'scheduler': scheduler, 'denoise': denoise}}
    last = ['11', 0]
    hr = float(item.get('hr', d.get('hr', 0)) or 0)        # 두 번째 단(hires): 잠재 공간에서 키워 디테일을 더한다
    if hr > 1.0 and not init:
        g['12'] = {'class_type': 'LatentUpscaleBy', 'inputs': {'samples': last, 'upscale_method': 'nearest-exact', 'scale_by': hr}}
        g['13'] = {'class_type': 'KSampler', 'inputs': {'model': model_ref, 'positive': ['5', 0], 'negative': ['6', 0], 'latent_image': ['12', 0],
                                                        'seed': seed, 'steps': int(item.get('hr_steps', d.get('hr_steps', 14 if m['kind'] == 'sdxl' else 6))),
                                                        'cfg': cfg, 'sampler_name': sampler, 'scheduler': scheduler,
                                                        'denoise': float(item.get('hr_denoise', d.get('hr_denoise', 0.45)))}}
        last = ['13', 0]
    # 타일 디코드: 한 번에 풀면 1MP fp 디코드가 2~3GB 를 먹어 8GB 에서 UNet 이 쫓겨나고 다음 장에 다시 올라온다(장당 +60~70초, 10-08 실측)
    g['14'] = {'class_type': 'VAEDecodeTiled', 'inputs': {'samples': last, 'vae': vae_ref, 'tile_size': 512, 'overlap': 64, 'temporal_size': 64, 'temporal_overlap': 8}}
    g['15'] = {'class_type': 'SaveImage', 'inputs': {'images': ['14', 0], 'filename_prefix': 'saga/' + re.sub(r'[^A-Za-z0-9_-]', '_', item['id'])}}
    settings = {'prompt': prompt, 'negative_prompt': neg, 'seed': seed, 'steps': steps, 'cfg_scale': cfg, 'sampler': f'{sampler}/{scheduler}',
                'size': [w, h], 'tiling': tiling, 'hr': hr if hr > 1.0 and not init else 0, 'denoise': denoise if init else None}
    return g, settings


def generate(item, model, d):
    model = item.get('model', model)      # 항목마다 모델을 바꿀 수 있다(그림체 시험 — 상업 허용 목록 MODELS 안에서만)
    if model not in MODELS or MODELS[model].get('nc'):
        raise ValueError(f'{item["id"]}: 모델 {model} 은 허용 목록 밖이거나 비상업')
    seed = int(item.get('seed', d.get('seed', -1)))
    if seed < 0:
        seed = int.from_bytes(os.urandom(4), 'little')
    g, settings = workflow(item, model, d, seed)
    t0 = time.time()
    r = call('/prompt', {'prompt': g, 'client_id': CLIENT}, timeout=60)
    if r.get('node_errors'):
        raise RuntimeError(f'{item["id"]}: 그래프 오류 {json.dumps(r["node_errors"], ensure_ascii=False)[:400]}')
    pid = r['prompt_id']
    while True:
        time.sleep(2)
        h = call(f'/history/{pid}', timeout=15).get(pid)
        if h:
            st = h.get('status', {})
            if st.get('status_str') == 'error':
                msg = [e for e in st.get('messages', []) if e[0] == 'execution_error']
                raise RuntimeError(f'{item["id"]}: 실행 오류 {json.dumps(msg, ensure_ascii=False)[:600]}')
            outs = h.get('outputs', {}).get('15', {}).get('images', [])
            if outs:
                o = outs[0]
                png = call('/view?' + urlencode({'filename': o['filename'], 'subfolder': o.get('subfolder', ''), 'type': o.get('type', 'output')}), timeout=60, raw=True)
                try:   # ComfyUI output 폴더에 복사본을 남기지 않는다(정본은 _out)
                    os.remove(os.path.join(COMFY_OUT, o.get('subfolder', ''), o['filename']))
                except OSError:
                    pass
                return png, settings, model, time.time() - t0
            raise RuntimeError(f'{item["id"]}: 결과 없음')
        if time.time() - t0 > PER_IMAGE_TIMEOUT:
            try:
                call('/interrupt', {}, timeout=5)
            except Exception:
                pass
            raise TimeoutError(f'{item["id"]}: {PER_IMAGE_TIMEOUT}s 초과 — 중단(interrupt)')


COMFY_OUT = os.environ.get('AI_ART_COMFY_OUT', r'C:\swbins3\comfyui\output')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('batch')
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--only', default='')
    ap.add_argument('--variants', type=int, default=0, help='항목마다 후보 N장(id_v01…, 씨앗 +k). 0 이면 배치 defaults.variants(없으면 1)')
    ap.add_argument('--judge', action='store_true', help='끝나면 판정기(tools/asset-audit/judge)로 묶음마다 1장만 남긴 보고를 만든다(K-0069)')
    a = ap.parse_args()
    b = json.load(open(a.batch, encoding='utf-8'))
    model = b['model']
    if model not in MODELS:
        sys.exit(f'모델 {model} — 상업 허용 확인 목록(MODELS)에 없다: {", ".join(MODELS)}')
    d = b.get('defaults', {})
    out_dir = os.path.join(OUT, b.get('out', os.path.splitext(os.path.basename(a.batch))[0]))
    nv = a.variants or int(d.get('variants', 1) or 1)
    src = [i for i in b['items'] if not a.only or i['id'] in a.only.split(',')]
    if nv > 1:    # 100장 뽑아 1장 고르기(K-0069): 후보 N장을 id_v01… 로, 씨앗은 +k. 판정기가 묶음(id) 안에서 1등만 남긴다
        src = [dict(i, id=f"{i['id']}_v{k + 1:02d}", seed=(int(i['seed']) + k) if 'seed' in i else -1) for i in src for k in range(nv)]
    items = [i for i in src if not os.path.exists(os.path.join(out_dir, i['id'] + '.png'))][:MAX_ITEMS]   # 있는 그림은 셈에서 뺀다
    for i in items:
        txt = i['prompt'] + ' ' + d.get('prompt_prefix', '')
        m = BLOCK.search(txt)
        if m:
            sys.exit(f'{i["id"]}: 프롬프트에 금지어 "{m.group(0)}" — 원작·실존 인물·작가 이름은 쓰지 않는다')
    print(f'배치 {os.path.basename(a.batch)} · 모델 {model} · {len(items)}장 · 여유 RAM {free_gb():.1f}GB')
    if a.dry:
        for i in items[:3]:
            workflow(i, i.get('model', model), d, 0, dry=True)       # 크기·모델 검사만
        return
    if free_gb() < MIN_FREE_GB:
        sys.exit(f'여유 RAM {free_gb():.1f}GB < {MIN_FREE_GB}GB — 다른 무거운 일을 끄고 다시')
    if not up():
        sys.exit('ComfyUI 가 안 떠 있다 — powershell -ExecutionPolicy Bypass -File tools/ai-art/start_sd.ps1')
    os.makedirs(out_dir, exist_ok=True)
    try:    # 배치 시작마다 앞 배치의 모델을 RAM·VRAM 에서 내린다 — 두 계열(SDXL 6.6GB + Z-Image 10GB)이 RAM 에 같이 남으면 페이지 파일로 밀려 48s/it 까지 떨어졌다(10-07)
        call('/free', {'unload_models': True, 'free_memory': True}, timeout=30)
    except Exception:
        pass
    fails = 0
    for n, it in enumerate(items):
        p = os.path.join(out_dir, it['id'] + '.png')
        if os.path.exists(p):
            print('건너뜀(있음)', it['id'])
            continue
        if free_gb() < MIN_FREE_GB:
            print('여유 RAM 부족 — 중단'); break
        try:
            png, s, used, secs = generate(it, model, d)
        except Exception as e:      # noqa
            fails += 1
            print('실패', it['id'], e)
            if fails >= 2:
                print('연속 실패 2번 — 통째로 멈춘다'); break
            continue
        fails = 0
        open(p, 'wb').write(png)
        lic = {'id': it['id'], 'generator': 'tools/ai-art/gen.py (ComfyUI)', 'model': used, 'model_license': MODELS[used]['license'],
               'prompt': s['prompt'], 'negative_prompt': s['negative_prompt'], 'seed': s['seed'],
               'steps': s['steps'], 'cfg_scale': s['cfg_scale'], 'sampler': s['sampler'], 'size': s['size'],
               'seconds': round(secs, 1), 'date': datetime.date.today().isoformat(),
               'note': 'AI 생성 — 저작권 보호가 약하다(사람의 창작 기여가 적으면). 상업 사용은 모델 라이선스 허용 범위 안.'}
        if it.get('init_image'):
            if it.get('meta'):        # 펫 등 공방 몸이 아닌 밑그림 — 배치가 출처(meta)를 직접 준다
                lic.update({'mode': 'img2img', 'init_image': os.path.basename(it['init_image']), 'denoise': s['denoise']})
                lic.update(it['meta'])
            else:
                from i2i_meta import base_meta
                lic.update(base_meta(it['init_image'], s['denoise']))
        json.dump(lic, open(os.path.splitext(p)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'ok {it["id"]} {secs:.0f}s seed {lic["seed"]}')
        if n < len(items) - 1:
            time.sleep(PAUSE)
    if a.judge:
        import subprocess
        judge = os.path.join(HERE, '..', 'asset-audit', 'judge', 'judge.sh')
        print('== 판정기', out_dir)
        subprocess.call(['bash', judge, 'score', out_dir, '--per-group', '1'])


if __name__ == '__main__':
    main()
