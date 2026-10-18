"""K-0140 — Kaggle 쪽(GPU 노트북 스크립트). push_batch.py 가 올린 데이터셋(job.json · ai-art/gen.py · nodes/ · batches/ · init/)을 받아
이 PC 와 **같은 커밋의 ComfyUI + ComfyUI-GGUF + 우리 타일 노드**를 깔고, 배치가 쓰는 모델만 HF 에서 받아(로컬 파일과 바이트 크기가 같은 것만),
**같은 gen.py** 로 그린다(그래프·씨앗·license 가 로컬과 같다). 결과는 /kaggle/working/result.zip(_out/<배치 out>/*.png + .license.json) + times.json + run.log.
모델은 상업 허용 목록(gen.py MODELS)만 — 이 표에 없는 모델은 받지 않는다.
"""
import glob
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
import zipfile

W = '/kaggle/working'
os.environ['NO_PROXY'] = os.environ['no_proxy'] = '127.0.0.1,localhost'   # ComfyUI API 는 로컬 — 프록시 거치지 않게
T = '/tmp'
COMFY = T + '/comfyui'
LOG = open(W + '/run.log', 'a', encoding='utf-8')


def log(*a):
    s = time.strftime('%H:%M:%S ') + ' '.join(str(x) for x in a)
    print(s, flush=True)
    LOG.write(s + '\n'); LOG.flush()


def sh(cmd, cwd=None, check=True):
    log('$', cmd if isinstance(cmd, str) else ' '.join(cmd))
    r = subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str), capture_output=True, text=True)
    if r.returncode and check:
        log((r.stdout + r.stderr)[-3000:])
        raise SystemExit('명령 실패')
    return r.stdout


# gen.py MODELS 의 파일 → (HF 저장소, 바이트 크기, 놓을 폴더). 크기 = 이 PC C:\swbins3\comfyui\models 의 파일 크기(같은 파일만 받는다).
FILES = {
    'animagine-xl-4.0-opt.safetensors': ('cagliostrolab/animagine-xl-4.0', 6938350040, 'checkpoints'),
    'Illustrious-XL-v2.0.safetensors': ('OnomaAIResearch/Illustrious-XL-v2.0', 6938040674, 'checkpoints'),
    'sdxl-vae-fp16-fix.safetensors': ('madebyollin/sdxl-vae-fp16-fix', 334641162, 'vae'),
    'z-image-turbo-Q6_K.gguf': ('unsloth/Z-Image-Turbo-GGUF', 5910505536, 'unet'),
    'Qwen3-4B-Q8_0.gguf': ('Qwen/Qwen3-4B-GGUF', 4280404704, 'text_encoders'),
    'ae.safetensors': ('Comfy-Org/z_image_turbo', 335304388, 'vae'),
}
NEED = {'animagine-xl-4.0-opt': ['animagine-xl-4.0-opt.safetensors', 'sdxl-vae-fp16-fix.safetensors'],
        'Illustrious-XL-v2.0': ['Illustrious-XL-v2.0.safetensors', 'sdxl-vae-fp16-fix.safetensors'],
        'z-image-turbo': ['z-image-turbo-Q6_K.gguf', 'Qwen3-4B-Q8_0.gguf', 'ae.safetensors']}


def fetch(name):
    from huggingface_hub import HfApi, hf_hub_download
    repo, size, sub = FILES[name]
    dst = os.path.join(COMFY, 'models', sub, name)
    if os.path.exists(dst) and os.path.getsize(dst) == size:
        return
    info = HfApi().model_info(repo, files_metadata=True)
    cand = [s.rfilename for s in info.siblings if s.size == size]
    if not cand:
        raise SystemExit('%s: %s 에 크기 %d 인 파일이 없다 — 받지 않는다' % (name, repo, size))
    t0 = time.time()
    p = hf_hub_download(repo, cand[0], local_dir=T + '/hf')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.path.exists(dst):
        os.remove(dst)
    os.symlink(p, dst)
    log('모델', name, '←', repo, cand[0], '%.0f초' % (time.time() - t0))


def up(port=8188):
    try:
        urllib.request.urlopen('http://127.0.0.1:%d/system_stats' % port, timeout=5).read()
        return True
    except Exception:
        return False


def main():
    t_all = time.time()
    job_p = glob.glob('/kaggle/input/**/job.json', recursive=True)
    if not job_p:
        raise SystemExit('job.json 없음 — 데이터셋이 안 붙었다')
    IN = os.path.dirname(job_p[0])
    job = json.load(open(job_p[0], encoding='utf-8'))
    log('입력', IN, json.dumps(job, ensure_ascii=False)[:400])
    sh('nvidia-smi --query-gpu=name,memory.total --format=csv', check=False)
    # 1 ComfyUI — 이 PC 와 같은 커밋
    t0 = time.time()
    for d, url, sha in ((COMFY, 'https://github.com/Comfy-Org/ComfyUI.git', job['comfy_sha']),
                        (COMFY + '/custom_nodes/ComfyUI-GGUF', 'https://github.com/city96/ComfyUI-GGUF.git', job['gguf_sha'])):
        os.makedirs(d, exist_ok=True)
        sh(['git', 'init', '-q'], cwd=d)
        sh(['git', 'fetch', '-q', '--depth', '1', url, sha], cwd=d)
        sh(['git', 'checkout', '-q', 'FETCH_HEAD'], cwd=d)
    # 이 PC 의 GGUF ops.py 에는 saga 고침(2026-10-07, ComfyUI 가 Linear 에 넘기는 input_act 등)이 있다 — 없으면 Z-Image 가 전부 실패(10-18 2·3판)
    gop = os.path.join(IN, 'nodes', 'gguf_ops.py')
    if os.path.exists(gop):
        shutil.copy(gop, COMFY + '/custom_nodes/ComfyUI-GGUF/ops.py')
    gguf_used = sh(['git', 'rev-parse', 'HEAD'], cwd=COMFY + '/custom_nodes/ComfyUI-GGUF').strip() + (' + saga ops.py' if os.path.exists(gop) else '')
    log('GGUF 노드', gguf_used)
    import re   # torch·torchvision·torchaudio 만 뺀다(Kaggle 것 그대로) — torchsde 같은 이웃 이름은 남긴다(1판 오류)
    req = [l for l in open(COMFY + '/requirements.txt').read().splitlines()
           if l.strip() and not l.startswith('#') and re.match(r'[A-Za-z0-9_.-]+', l.strip()).group(0).lower() not in ('torch', 'torchvision', 'torchaudio')]
    open(T + '/req.txt', 'w').write('\n'.join(req + ['gguf>=0.13.0', 'huggingface_hub']))
    sh([sys.executable, '-m', 'pip', 'install', '-q', '-r', T + '/req.txt'])
    shutil.copy(os.path.join(IN, 'nodes', 'saga_seamless.py'), COMFY + '/custom_nodes/saga_seamless.py')
    t_install = time.time() - t0
    # 2 모델 — 배치가 쓰는 것만
    t0 = time.time()
    models = sorted({json.load(open(os.path.join(IN, b['file']), encoding='utf-8'))['model'] for b in job['batches']})
    for m in models:
        for f in NEED[m]:
            fetch(f)
    t_models = time.time() - t0
    # 3 ComfyUI 띄우기 — GPU 마다 하나(T4 두 장이면 둘, 포트 8188·8189). 항목을 GPU 수로 나눠 gen.py 를 나란히 돌린다
    ngpu = max(1, len([l for l in sh('nvidia-smi -L', check=False).splitlines() if l.startswith('GPU')]))
    srvs = []
    for g in range(ngpu):
        srvs.append(subprocess.Popen([sys.executable, 'main.py', '--listen', '127.0.0.1', '--port', str(8188 + g), '--cuda-device', str(g),
                                      '--output-directory', T + '/comfy_out%d' % g, '--disable-auto-launch'], cwd=COMFY,
                                     stdout=open(W + '/comfy%d.log' % g, 'w'), stderr=subprocess.STDOUT))
    for _ in range(180):
        if all(up(8188 + g) or s_.poll() is not None for g, s_ in enumerate(srvs)):
            break
        time.sleep(2)
    srvs = [s_ for g, s_ in enumerate(srvs) if s_.poll() is None and up(8188 + g)]
    if not srvs:
        raise SystemExit('ComfyUI 안 뜸 — comfy0.log')
    ngpu = len(srvs)
    log('ComfyUI 뜸 ×%d' % ngpu)
    # 4 같은 gen.py — 배치 json 의 init/… 를 데이터셋 절대 경로로, 항목을 GPU 수만큼 나눈 조각 배치로(같은 out)
    A = W + '/ai-art'
    os.makedirs(A + '/batches', exist_ok=True)
    for f in ('gen.py', 'i2i_meta.py'):
        shutil.copy(os.path.join(IN, 'ai-art', f), A)
    per = {}
    for b in job['batches']:
        d = json.load(open(os.path.join(IN, b['file']), encoding='utf-8'))
        for it in d['items']:
            for k in ('init_image', 'mask_image'):
                if it.get(k):
                    it[k] = os.path.join(IN, it[k])
        base = os.path.splitext(os.path.basename(b['file']))[0]
        parts = []
        for g in range(ngpu):
            dg = dict(d, items=d['items'][g::ngpu])
            if not dg['items']:
                continue
            bp = os.path.join(A, 'batches', '%s__g%d.json' % (base, g))
            json.dump(dg, open(bp, 'w', encoding='utf-8'), ensure_ascii=False)
            parts.append((g, bp))
        t0 = time.time()
        n_ok = n_fail = 0
        for chunk in range(1, 200):
            procs = []
            for g, bp in parts:
                env = dict(os.environ, AI_ART_API='http://127.0.0.1:%d' % (8188 + g), AI_ART_COMFY_OUT=T + '/comfy_out%d' % g,
                           AI_ART_MAX='24', PYTHONIOENCODING='utf-8')
                cmd = [sys.executable, A + '/gen.py', bp] + (['--variants', str(b['variants'])] if b.get('variants') else [])
                procs.append(subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env))
            ok = fail = 0
            for p_ in procs:
                out = p_.communicate()[0]
                o, f_ = out.count(chr(10) + 'ok ') + out.startswith('ok '), out.count('실패 ')
                ok += o
                fail += f_
                if not o and (f_ or 'Traceback' in out):
                    log(out[-1500:])
            n_ok += ok
            n_fail += fail
            log('%s chunk %d: %d ok, %d fail' % (base, chunk, ok, fail))
            if not ok:
                break
        sec = time.time() - t0
        per[base + '.json'] = {'ok': n_ok, 'fail': n_fail, 'sec': round(sec), 'gpus': ngpu,
                               'sec_per_image': round(sec / max(1, n_ok), 1), 'gpu_sec_per_image': round(sec * ngpu / max(1, n_ok), 1)}
    for s_ in srvs:
        s_.terminate()
    # 5 결과
    with zipfile.ZipFile(W + '/result.zip', 'w', zipfile.ZIP_STORED) as z:
        for p in glob.glob(A + '/_out/**/*', recursive=True):
            if os.path.isfile(p):
                z.write(p, os.path.relpath(p, A + '/_out'))
    shutil.rmtree(A)
    json.dump({'gguf_sha': gguf_used, 'comfy_sha': job['comfy_sha'], 'install_sec': round(t_install), 'models_sec': round(t_models), 'total_sec': round(time.time() - t_all), 'batches': per,
               'gpu': sh('nvidia-smi --query-gpu=name --format=csv,noheader', check=False).strip()}, open(W + '/times.json', 'w'), indent=1)
    log('K140_DONE', json.dumps(per, ensure_ascii=False))


if __name__ == '__main__':
    main()
