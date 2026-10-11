"""K-0095 — 이 PC 쪽. 입력 그림을 Kaggle 비공개 데이터셋으로 올리고 trellis_batch.py 를 GPU 노트북으로 밀어 넣은 뒤,
상태를 지켜보다 끝나면 결과(GLB·times.json·로그)를 받아 GLB 마다 .license.json 을 쓴다.

  py tools/ai-art/remote3d/run_kaggle.py --in <그림 폴더(*.png + 같은 이름 .license.json)> --out tools/ai-art/_out/remote3d [--poll 300] [--no-push]

- 계정 이름은 `kaggle config view` 에서 읽는다(저장소에 안 적는다). 토큰은 %USERPROFILE%\\.kaggle\\access_token — 커밋 금지.
- 데이터셋 `<계정>/saga-k95-input`(비공개, 있으면 새 판) · 노트북 `<계정>/saga-k95-trellis`(비공개, GPU T4·인터넷 켬).
- `--no-push` 는 밀어 넣지 않고 지켜보기·받기만(끊긴 뒤 이어 받기). 데이터셋이 이미 있으면 그대로 쓴다(그림을 바꿨으면 `--reupload`).
"""
import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DS, KN = 'saga-k95-input', 'saga-k95-trellis'
ACC = 'NvidiaTeslaT4'


# 10-11 api.kaggle.com TLS 가 네 번에 한 번꼴로 끊긴다(SSLEOFError) — 받기는 요청 수십 개라 명령째 다시 해도 못 넘는다.
# 그래서 요청 하나하나를 다시 보낸다(HTTPAdapter.send 를 감싸 SSL·연결 오류면 최대 8번).
_WRAP = '''
import sys, time, requests.adapters as A
_send = A.HTTPAdapter.send
def send(self, req, **kw):
    for i in range(8):
        try:
            return _send(self, req, **kw)
        except (A.SSLError, A.ConnectionError):
            if i == 7:
                raise
            time.sleep(2 + 2 * i)
A.HTTPAdapter.send = send
from kaggle.cli import main
sys.argv = ['kaggle'] + sys.argv[1:]
main()
'''


def kg(*args, check=True):
    r = subprocess.run([sys.executable, '-c', _WRAP, *args], capture_output=True, text=True, encoding='utf-8', errors='replace',
                       env=dict(os.environ, PYTHONUTF8='1', PYTHONIOENCODING='utf-8'))   # 로그 받기가 cp949 로 깨진다(10-10)
    out = (r.stdout + r.stderr).strip()
    if check and r.returncode:
        sys.exit('kaggle %s 실패: %s' % (' '.join(args), out[-800:]))
    return out


def user():
    for line in kg('config', 'view').splitlines():
        if 'username:' in line:
            return line.split(':', 1)[1].strip()
    sys.exit('kaggle 계정 이름을 못 읽음 — kaggle config view')


def push(src, u, reupload):
    d = tempfile.mkdtemp(prefix='k95ds_')
    for f in glob.glob(os.path.join(src, '*.png')):
        shutil.copy(f, d)
    json.dump({'title': 'saga k95 input', 'id': '%s/%s' % (u, DS), 'licenses': [{'name': 'CC0-1.0'}]},
              open(os.path.join(d, 'dataset-metadata.json'), 'w'))
    st = kg('datasets', 'status', '%s/%s' % (u, DS), check=False)
    if 'ready' in st.lower():
        if reupload:
            print(kg('datasets', 'version', '-p', d, '-m', 'k95 input', '-r', 'zip'))
    else:
        print(kg('datasets', 'create', '-p', d, '-r', 'zip'))       # 기본 비공개
    for _ in range(40):                                               # 데이터셋 처리가 끝나야 노트북이 붙일 수 있다
        if 'ready' in kg('datasets', 'status', '%s/%s' % (u, DS), check=False).lower():
            break
        time.sleep(15)
    k = tempfile.mkdtemp(prefix='k95kn_')
    shutil.copy(os.path.join(HERE, 'trellis_batch.py'), k)
    meta = json.load(open(os.path.join(HERE, 'kernel-metadata.json'), encoding='utf-8'))
    meta.update(id='%s/%s' % (u, KN), dataset_sources=['%s/%s' % (u, DS)])
    json.dump(meta, open(os.path.join(k, 'kernel-metadata.json'), 'w'), indent=1)
    print(kg('kernels', 'push', '-p', k, '--accelerator', ACC))


def main():
    a = sys.argv[1:]
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    src, out = os.path.abspath(opt('--in', '.')), os.path.abspath(opt('--out', os.path.join(ROOT, 'tools', 'ai-art', '_out', 'remote3d')))
    poll = int(opt('--poll', '300'))
    os.makedirs(out, exist_ok=True)
    u = user()
    t0 = time.time()
    if '--no-push' not in a:
        push(src, u, '--reupload' in a)
    while True:
        st = kg('kernels', 'status', '%s/%s' % (u, KN), check=False)
        print(time.strftime('%H:%M:%S'), st[-160:], flush=True)
        low = st.lower()
        if 'max retries' in low or 'sslerror' in low or 'connectionpool' in low:   # 망 끊김(10-11 SSLEOFError) — 커널은 계속 돈다, 다시 묻는다
            time.sleep(60)
            continue
        if 'kernelworkerstatus.' in low and ('complete' in low or 'error' in low or 'cancel' in low):
            break
        time.sleep(poll)
    print(kg('kernels', 'output', '%s/%s' % (u, KN), '-p', out, '-o', check=False)[-600:])
    times = {}
    tj = glob.glob(os.path.join(out, '**', 'times.json'), recursive=True)
    if tj:
        times = json.load(open(tj[0], encoding='utf-8'))
    for g in glob.glob(os.path.join(out, '**', '*.glb'), recursive=True):
        iid = os.path.splitext(os.path.basename(g))[0]
        if os.path.dirname(g) != out:
            shutil.move(g, os.path.join(out, iid + '.glb'))
            g = os.path.join(out, iid + '.glb')
        lic_in = os.path.join(src, iid + '.license.json')
        json.dump({'id': iid, 'generator': 'TRELLIS (microsoft/TRELLIS, Kaggle T4) — tools/ai-art/remote3d', 'model': 'microsoft/TRELLIS-image-large',
                   'model_license': 'MIT', 'input_image': os.path.relpath(os.path.join(src, iid + '.png'), ROOT).replace('\\', '/'),
                   'input_license': json.load(open(lic_in, encoding='utf-8')) if os.path.exists(lic_in) else '(입력 license 없음)',
                   'seed': 1, 'simplify': 0.95, 'texture_size': 1024, 'times': times.get('items', {}).get(iid), 'date': time.strftime('%Y-%m-%d'),
                   'note': '시험(K-0095) — 게임 폴더에 넣지 않는다'},
                  open(os.path.join(out, iid + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    n = len(glob.glob(os.path.join(out, '*.glb')))
    print('K95_RUN 기다린 %d분 · GLB %d' % ((time.time() - t0) / 60, n))
    if not n:
        sys.exit('GLB 0 — 받기 실패면 `--no-push` 로 다시 받는다')


if __name__ == '__main__':
    main()
