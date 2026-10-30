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
from gen import request_hash, existing_output, output_lock, save_output  # noqa: E402

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
        return [(f"{i['id']}_v{k + 1:02d}", dict(i, id=f"{i['id']}_v{k + 1:02d}",
                 seed=int(i['seed']) + k if 'seed' in i else -1)) for i in b['items'] for k in range(nv)]
    return [(i['id'], i) for i in b['items']]


def local_item(item):
    item = dict(item)
    ident = item['id']
    if not isinstance(ident, str) or not ident or any(c in ident for c in '/\\:\x00') or ident in ('.', '..'):
        raise ValueError('잘못된 id')
    for key in ('init_image', 'mask_image'):
        if item.get(key) and not os.path.isabs(item[key]):
            item[key] = os.path.join(ROOT, item[key])
    return item


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
        with open(path, encoding='utf-8') as f:
            b = json.load(f)
        nv = nv_arg or int(b.get('defaults', {}).get('variants', 1) or 1)
        if nv < 1:
            raise ValueError('variants는 양수여야 함')
        od = out_dir(b, path)
        keep = []
        for it in b['items']:
            states = []
            for vid, candidate in variant_ids({'items': [it]}, nv):
                fingerprint = request_hash(local_item(candidate), b['model'], b.get('defaults', {}))
                dst = os.path.join(od, vid + '.png')
                if os.path.lexists(dst + '.lock'):
                    raise ValueError('출력 잠금 존재: ' + vid)
                states.append(existing_output(dst, fingerprint))
            if all(s != 'missing' for s in states):
                if 'legacy' in states:
                    print('경고 옛 출력 입력 해시 미검증(보존)', it['id'])
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
        with open(os.path.join(d, fn), 'w', encoding='utf-8') as f:
            json.dump(b, f, ensure_ascii=False, indent=1)
        job['batches'].append({'file': fn, 'variants': nv})
        total += len(keep) * nv
    with open(os.path.join(d, 'job.json'), 'w', encoding='utf-8') as f:
        json.dump(job, f, ensure_ascii=False, indent=1)
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
    """새 결과의 입력·출력 해시를 확인한 뒤 배타적으로 저장한다. 오류는 원본 보존."""
    from i2i_meta import base_meta
    res = {}
    for path in batches:
        with open(path, encoding='utf-8') as f:
            b = json.load(f)
        nv = nv_arg or int(b.get('defaults', {}).get('variants', 1) or 1)
        if nv < 1:
            raise ValueError('variants는 양수여야 함')
        od = out_dir(b, path)
        rel = os.path.relpath(od, os.path.join(AI, '_out'))
        os.makedirs(od, exist_ok=True)
        counts = dict(placed=0, reused=0, legacy=0, missing=0, failed=0, expected=len(variant_ids(b, nv)))
        for vid, it in variant_ids(b, nv):
            src = os.path.join(got, rel, vid + '.png')
            dst = os.path.join(od, vid + '.png')
            try:
                item = local_item(it)
                fingerprint = request_hash(item, b['model'], b.get('defaults', {}))
                with output_lock(dst):
                    state = existing_output(dst, fingerprint)
                    if state != 'missing':
                        counts[state] += 1
                        if state == 'legacy':
                            print('경고 옛 출력 입력 해시 미검증(보존)', vid)
                        continue
                    state = existing_output(src, fingerprint)
                    if state == 'missing':
                        counts['missing'] += 1
                        continue
                    if state == 'legacy':
                        raise ValueError('원격 결과 입력 해시 없음 — 검증 불가, 배치하지 않음')
                    with open(os.path.splitext(src)[0] + '.license.json', encoding='utf-8') as f:
                        lic = json.load(f)
                    lic['remote'] = 'Kaggle T4 (tools/ai-art/remote, K-0140)'
                    if item.get('init_image'):
                        for k in ('base_body', 'base_license', 'base_inputs', 'init_model', 'init_model_license'):
                            lic.pop(k, None)
                        if item.get('meta'):
                            lic.update({'mode': 'img2img', 'init_image': os.path.basename(item['init_image']), 'denoise': lic.get('denoise')})
                            # 출처 부가 정보가 검증한 무결성 필드를 덮지 못하게 한다.
                            protected = {k: lic[k] for k in ('id', 'model', 'model_license', 'request_sha256', 'output_sha256')}
                            lic.update(item['meta'])
                            lic.update(protected)
                        else:
                            denoise = lic.get('denoise')
                            if denoise is None:
                                denoise = item.get('denoise', b.get('defaults', {}).get('denoise', 0.55))
                            lic.update(base_meta(item['init_image'], denoise))
                    with open(src, 'rb') as f:
                        save_output(dst, f.read(), lic)
                    counts['placed'] += 1
            except (OSError, ValueError, KeyError, TypeError) as e:
                counts['failed'] += 1
                print('실패', vid, e)
        res[os.path.basename(path)] = counts
    return res


def main(argv=None):
    a = sys.argv[1:] if argv is None else argv
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    vals = {opt(k) for k in ('--variants', '--state', '--poll')}
    batches = [os.path.abspath(x) for x in a if x.endswith('.json') and x not in vals]
    nv = int(opt('--variants', '0'))
    state = opt('--state')
    poll = int(opt('--poll', '120'))
    def w(s):
        if state:
            with open(state, 'a', encoding='utf-8') as f:
                f.write(s + '\n')
    if not batches or nv < 0 or poll < 1 or len({os.path.basename(p) for p in batches}) != len(batches):
        print('실패 배치 없음/동명 배치/잘못된 옵션')
        w('failed: invalid arguments')
        return 1
    u = user()
    t0 = time.time()
    if '--no-push' not in a:
        try:
            d, job, total = build(batches, nv)
        except (OSError, ValueError, KeyError) as e:
            print('실패 사전 검사', e); w('failed: preflight'); return 1
        if not job['batches']:
            print('올릴 것 없음'); w('chunk 1: 0 ok, 0 fail'); w('done'); return 0
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
    if len(z) != 1:
        tail = ''
        current_logs = glob.glob(os.path.join(got, '**', 'run.log'), recursive=True)
        if current_logs:
            with open(current_logs[0], encoding='utf-8', errors='replace') as f:
                tail = f.read()[-1500:]
        w('chunk 1: 0 ok, 1 fail'); w('failed: result.zip 없음')
        print('result.zip 없음 — 로그 끝:\n' + tail)
        return 1
    try:
        with zipfile.ZipFile(z[0]) as archive:
            archive.extractall(os.path.join(got, 'res'))
        res = place(batches, nv, os.path.join(got, 'res'))
        # 이전 실행의 keep/times.json을 현재 실행 결과로 쓰지 않는다.
        current_times = glob.glob(os.path.join(got, '**', 'times.json'), recursive=True)
        if len(current_times) != 1:
            raise ValueError('현재 times.json 누락/중복')
        with open(current_times[0], encoding='utf-8') as f:
            times = json.load(f)
        if not isinstance(times, dict) or not isinstance(times.get('batches'), dict):
            raise ValueError('times.json 형식 오류')
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as e:
        print('실패 원격 결과', e); w('failed: invalid remote result'); return 1
    failed = 'complete' not in low or 'error' in low or 'cancel' in low or times.get('status') != 'complete'
    for k, counts in res.items():
        tb = times.get('batches', {}).get(k, {})
        # 로컬에서 전부 재사용한 배치는 이번 원격 보고에 없을 수 있다.
        remote_bad = not isinstance(tb, dict) or (bool(tb) and (tb.get('status') != 'complete' or tb.get('fail') != 0))
        if counts['placed'] and not tb:
            remote_bad = True
        errors = counts['failed'] + counts['missing']
        verified = counts['placed'] + counts['reused'] + counts['legacy']
        failed = failed or remote_bad or errors > 0 or verified != counts['expected']
        w('chunk 1: %d ok, %d fail' % (counts['placed'], errors + int(remote_bad)))
        print('%s 결과 %s · 원격 %s' % (k, counts, tb))
    msg = '원격 왕복 %d분 · 설치 %s초 · 모델 %s초 · GPU %s' % ((time.time() - t0) / 60, times.get('install_sec'), times.get('models_sec'), times.get('gpu'))
    print(msg); w(msg)
    if failed:
        w('failed: incomplete remote result'); print('K140_PUSH_FAILED'); return 1
    w('done')
    print('K140_PUSH_DONE')
    return 0


if __name__ == '__main__':
    sys.exit(main())
