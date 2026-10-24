"""K-0140 — 이 PC 쪽. SD 배치(gen.py 배치 json)를 Kaggle GPU 로 돌리고 결과를 로컬과 같은 `tools/ai-art/_out/<배치 out>/` 에 놓는다.

  py tools/ai-art/remote/push_batch.py <배치.json>… [--variants N] [--state <상태파일>] [--poll 120] [--no-push]

- 올리기: 비공개 데이터셋 `<계정>/saga-k140-job` = job.json · ai-art/gen.py·i2i_meta.py · nodes/saga_seamless.py(C:\\swbins3 ComfyUI 의 우리 노드) ·
  batches/<배치>.json(밑그림 경로를 init/… 로) · init/(밑그림·마스크). **로컬에 이미 다 있는 항목은 빼고** 올린다(멱등 — 끊기면 다시 돌리면 된다).
- 노트북 `<계정>/saga-k140-sd`(비공개, GPU T4·인터넷) = remote/sd_kaggle.py — 같은 커밋 ComfyUI + 같은 gen.py.
- 받기: result.zip 을 풀어 **없는 그림만** 놓고, license 에 `remote` 칸을 붙인다. 밑그림 그림(img2img)은 출처 칸을 이 PC 의 원래 경로로 다시 쓴다(i2i_meta).
- 상태파일 꼴은 run_all.sh 와 같다(`chunk n: ok/fail` · `done`). 계정 이름은 `kaggle config view` 에서, 토큰은 %USERPROFILE%\\.kaggle (커밋 금지).
- 무료 한도(주 30h)는 사용자 계정 — 걸린 시간은 times.json·상태파일에 남긴다. 같은 배치를 로컬 사슬과 동시에 돌리지 말 것(같은 _out).
"""
import atexit
import glob
import hashlib
import json
import os
import shutil
import sys
import tempfile
import time
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
AI = os.path.dirname(HERE)
ROOT = os.path.abspath(os.path.join(AI, '..', '..'))
sys.path.insert(0, os.path.join(AI, 'remote3d'))
sys.path.insert(0, AI)
from run_kaggle import kg, user  # noqa: E402  (요청마다 다시 보내는 kaggle CLI 감싸개 · 계정 이름)

DS, KN, ACC = 'saga-k140-job', 'saga-k140-sd', 'NvidiaTeslaT4'
COMFY = os.environ.get('SWBINS3_COMFY', r'C:\swbins3\comfyui')


def git_sha(d):
    head = open(os.path.join(d, '.git', 'HEAD')).read().strip()
    if head.startswith('ref:'):
        ref = head.split(' ', 1)[1]
        p = os.path.join(d, '.git', ref)
        if os.path.exists(p):
            return open(p).read().strip()
        for line in open(os.path.join(d, '.git', 'packed-refs')):
            if line.strip().endswith(ref):
                return line.split()[0]
    return head


def variant_ids(b, nv):
    if nv > 1:
        return [(f"{i['id']}_v{k + 1:02d}", i) for i in b['items'] for k in range(nv)]
    return [(i['id'], i) for i in b['items']]


def out_dir(b, path):
    return os.path.join(AI, '_out', b.get('out', os.path.splitext(os.path.basename(path))[0]))


def build(batches, nv_arg):
    d = tempfile.mkdtemp(prefix='k140ds_')
    atexit.register(shutil.rmtree, d, True)  # 끝나면 지움 — 안 지워 Temp 에 211개 21GB 쌓였던 일(10-25)
    for sub in ('ai-art', 'nodes', 'batches', 'init'):
        os.makedirs(os.path.join(d, sub))
    for f in ('gen.py', 'i2i_meta.py'):
        shutil.copy(os.path.join(AI, f), os.path.join(d, 'ai-art', f))
    shutil.copy(os.path.join(COMFY, 'custom_nodes', 'saga_seamless.py'), os.path.join(d, 'nodes'))
    shutil.copy(os.path.join(COMFY, 'custom_nodes', 'ComfyUI-GGUF', 'ops.py'), os.path.join(d, 'nodes', 'gguf_ops.py'))   # 로컬 saga 고침 포함
    job = {'comfy_sha': git_sha(COMFY), 'gguf_sha': git_sha(os.path.join(COMFY, 'custom_nodes', 'ComfyUI-GGUF')), 'batches': []}
    total = 0
    for path in batches:
        b = json.load(open(path, encoding='utf-8'))
        nv = nv_arg or int(b.get('defaults', {}).get('variants', 1) or 1)
        od = out_dir(b, path)
        keep = []
        for it in b['items']:
            ids = [v for v, _ in variant_ids({'items': [it]}, nv)]
            if all(os.path.exists(os.path.join(od, v + '.png')) for v in ids):
                continue
            it = dict(it)
            for k in ('init_image', 'mask_image'):
                if it.get(k):
                    src = it[k] if os.path.isabs(it[k]) else os.path.join(ROOT, it[k])
                    name = hashlib.md5(it[k].encode()).hexdigest()[:8] + '_' + os.path.basename(src)
                    shutil.copy(src, os.path.join(d, 'init', name))
                    it[k] = 'init/' + name
            keep.append(it)
        if not keep:
            print('다 있음 —', os.path.basename(path))
            continue
        b['items'] = keep
        b['out'] = os.path.relpath(od, os.path.join(AI, '_out')).replace('\\', '/')
        fn = 'batches/' + os.path.basename(path)
        json.dump(b, open(os.path.join(d, fn), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        job['batches'].append({'file': fn, 'variants': nv})
        total += len(keep) * nv
    json.dump(job, open(os.path.join(d, 'job.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return d, job, total


def push(d, u):
    json.dump({'title': 'saga k140 job', 'id': '%s/%s' % (u, DS), 'licenses': [{'name': 'CC0-1.0'}]},
              open(os.path.join(d, 'dataset-metadata.json'), 'w'))
    st = kg('datasets', 'status', '%s/%s' % (u, DS), check=False)
    if 'ready' in st.lower() or 'pending' in st.lower():
        print(kg('datasets', 'version', '-p', d, '-m', 'k140 job', '-r', 'zip'))
    else:
        print(kg('datasets', 'create', '-p', d, '-r', 'zip'))
    time.sleep(20)
    for _ in range(60):
        if 'ready' in kg('datasets', 'status', '%s/%s' % (u, DS), check=False).lower():
            break
        time.sleep(15)
    k = tempfile.mkdtemp(prefix='k140kn_')
    atexit.register(shutil.rmtree, k, True)  # 끝나면 지움 — 안 지워 Temp 에 211개 21GB 쌓였던 일(10-25)
    shutil.copy(os.path.join(HERE, 'sd_kaggle.py'), k)
    meta = json.load(open(os.path.join(HERE, 'kernel-metadata.json'), encoding='utf-8'))
    meta.update(id='%s/%s' % (u, KN), dataset_sources=['%s/%s' % (u, DS)])
    json.dump(meta, open(os.path.join(k, 'kernel-metadata.json'), 'w'), indent=1)
    print(kg('kernels', 'push', '-p', k, '--accelerator', ACC))


def place(batches, nv_arg, got):
    """받은 _out 을 로컬로 — 없는 그림만. 돌려주는 값: 배치마다 (놓음, 기대)."""
    from i2i_meta import base_meta
    res = {}
    for path in batches:
        b = json.load(open(path, encoding='utf-8'))
        nv = nv_arg or int(b.get('defaults', {}).get('variants', 1) or 1)
        od = out_dir(b, path)
        rel = os.path.relpath(od, os.path.join(AI, '_out'))
        os.makedirs(od, exist_ok=True)
        n = 0
        for vid, it in variant_ids(b, nv):
            src = os.path.join(got, rel, vid + '.png')
            dst = os.path.join(od, vid + '.png')
            if os.path.exists(dst) or not os.path.exists(src):
                continue
            shutil.copy(src, dst)
            lic = json.load(open(os.path.join(got, rel, vid + '.license.json'), encoding='utf-8'))
            lic['remote'] = 'Kaggle T4 (tools/ai-art/remote, K-0140) — 같은 ComfyUI 커밋·같은 gen.py'
            if it.get('init_image'):
                for k in ('base_body', 'base_license', 'base_inputs', 'init_model', 'init_model_license'):
                    lic.pop(k, None)
                if it.get('meta'):
                    lic.update({'mode': 'img2img', 'init_image': os.path.basename(it['init_image']), 'denoise': lic.get('denoise')})
                    lic.update(it['meta'])
                else:
                    lic.update(base_meta(it['init_image'], lic.get('denoise') or it.get('denoise', b.get('defaults', {}).get('denoise', 0.55))))
            json.dump(lic, open(os.path.join(od, vid + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            n += 1
        res[os.path.basename(path)] = (n, len(variant_ids(b, nv)))
    return res


def main():
    a = sys.argv[1:]
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    vals = {opt(k) for k in ('--variants', '--state', '--poll')}
    batches = [os.path.abspath(x) for x in a if x.endswith('.json') and x not in vals]
    nv = int(opt('--variants', '0'))
    state = opt('--state')
    poll = int(opt('--poll', '120'))
    w = (lambda s: open(state, 'a', encoding='utf-8').write(s + '\n')) if state else (lambda s: None)
    u = user()
    t0 = time.time()
    if '--no-push' not in a:
        d, job, total = build(batches, nv)
        if not job['batches']:
            print('올릴 것 없음'); w('chunk 1: 0 ok, 0 fail'); w('done'); return
        print('원격 %d장 · ComfyUI %s · GGUF %s' % (total, job['comfy_sha'][:8], job['gguf_sha'][:8]))
        w('원격(Kaggle) %d장 올림 %s' % (total, time.strftime('%H:%M')))
        push(d, u)
        time.sleep(30)
    while True:
        st = kg('kernels', 'status', '%s/%s' % (u, KN), check=False)
        print(time.strftime('%H:%M:%S'), st[-140:], flush=True)
        low = st.lower()
        if 'max retries' in low or 'sslerror' in low or 'connectionpool' in low:
            time.sleep(60); continue
        if 'kernelworkerstatus.' in low and ('complete' in low or 'error' in low or 'cancel' in low):
            break
        time.sleep(poll)
    got = tempfile.mkdtemp(prefix='k140out_')
    atexit.register(shutil.rmtree, got, True)  # 끝나면 지움 — 안 지워 Temp 에 211개 21GB 쌓였던 일(10-25)
    print(kg('kernels', 'output', '%s/%s' % (u, KN), '-p', got, '-o', check=False)[-300:])
    keep = os.path.join(AI, '_out', 'remote_sd')
    os.makedirs(keep, exist_ok=True)
    for f in ('times.json', 'run.log', 'comfy0.log', 'comfy1.log'):
        for p in glob.glob(os.path.join(got, '**', f), recursive=True):
            shutil.copy(p, os.path.join(keep, f))
    z = glob.glob(os.path.join(got, '**', 'result.zip'), recursive=True)
    if not z:
        tail = open(os.path.join(keep, 'run.log'), encoding='utf-8', errors='replace').read()[-1500:] if os.path.exists(os.path.join(keep, 'run.log')) else ''
        w('chunk 1: 0 ok, 0 fail'); w('원격 결과 없음 — _out/remote_sd/run.log'); w('done')
        sys.exit('result.zip 없음 — 로그 끝:\n' + tail)
    zipfile.ZipFile(z[0]).extractall(os.path.join(got, 'res'))
    res = place(batches, nv, os.path.join(got, 'res'))
    times = json.load(open(os.path.join(keep, 'times.json'), encoding='utf-8')) if os.path.exists(os.path.join(keep, 'times.json')) else {}
    for k, (n, want) in res.items():
        tb = times.get('batches', {}).get(k, {})
        w('chunk 1: %d ok, %d fail' % (n, tb.get('fail', 0)))
        print('%s 놓음 %d / 기대 %d · 원격 %s' % (k, n, want, tb))
    msg = '원격 왕복 %d분 · 설치 %s초 · 모델 %s초 · GPU %s' % ((time.time() - t0) / 60, times.get('install_sec'), times.get('models_sec'), times.get('gpu'))
    print(msg); w(msg); w('done')
    print('K140_PUSH_DONE')


if __name__ == '__main__':
    main()
