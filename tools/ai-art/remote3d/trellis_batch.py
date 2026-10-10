"""K-0095 — Kaggle GPU(T4) 에서 도는 쪽. TRELLIS(MIT)로 입력 그림 → GLB. 이 파일은 kaggle kernels push 로 올라간다(이 PC 에선 안 돈다).

입력: 붙은 데이터셋(/kaggle/input/**)의 *.png · 출력: /kaggle/working/out/<id>.glb + times.json
Kaggle 기본 환경(10-10 실측: Python 3.13 · torch 2.11 cu128 · nvcc 12.8)은 TRELLIS 의존(xformers·spconv·kaolin 바퀴)이 없다 →
uv 로 Python 3.11 가상환경(/tmp/venv)을 만들어 TRELLIS README 시험판(torch 2.4.0 cu121)을 깔고, 생성은 그 파이썬으로 돌린다.
설치·클론은 /tmp 에(작업 폴더에 두면 결과 받기가 GB 단위가 된다). T4 = sm75 → flash-attn 불가, ATTN_BACKEND=xformers · SPCONV_ALGO=native.
"""
import json
import os
import subprocess
import time

T0 = time.time()
OUT = '/kaggle/working/out'
os.makedirs(OUT, exist_ok=True)
TIMES = os.path.join(OUT, 'times.json')
times = {'steps': {}, 'items': {}}
V = '/tmp/venv'
ACT = 'source %s/bin/activate && ' % V


def sh(cmd, step=None):
    t = time.time()
    print('$', cmd, flush=True)
    r = subprocess.run(['bash', '-c', cmd])
    print('rc', r.returncode, '%.0fs' % (time.time() - t), flush=True)
    if step:                                 # 파일을 다시 읽어 합친다 — gen.py 가 쓴 items 를 덮지 않게(10-10 4판에서 비었음)
        cur = json.load(open(TIMES)) if os.path.exists(TIMES) else times
        cur.setdefault('steps', {})[step] = {'rc': r.returncode, 'sec': round(time.time() - t)}
        times.update(cur)
        json.dump(cur, open(TIMES, 'w'), indent=1)
    return r.returncode


os.environ['TORCH_CUDA_ARCH_LIST'] = '7.5'
os.environ['MAX_JOBS'] = '4'
sh('nvidia-smi --query-gpu=name,memory.total --format=csv; nvcc --version | tail -1; python -V')
sh('pip install -q uv && uv venv -q --seed -p 3.11 %s && %s/bin/python -V' % (V, V), 'venv')
sh(ACT + 'pip install -q torch==2.4.0 torchvision==0.19.0 --index-url https://download.pytorch.org/whl/cu121', 'torch')
sh('cd /tmp && git clone -q --recurse-submodules https://github.com/microsoft/TRELLIS.git', 'clone')
for flag in ('--basic', '--spconv'):
    sh(ACT + 'cd /tmp/TRELLIS && . ./setup.sh %s > /tmp/setup%s.log 2>&1; tail -2 /tmp/setup%s.log' % (flag, flag, flag), 'setup' + flag)
# setup.sh 표에 torch 2.4.0+cu121 의 xformers·kaolin 이 없다(10-10 2판) → xformers 는 짝 판을 직접, kaolin 은 아래 대역
sh(ACT + 'pip install -q xformers==0.0.27.post2 --index-url https://download.pytorch.org/whl/cu121', 'xformers')
# nvdiffrast 새 판은 빌드 격리 안에서 torch 를 못 찾는다 → --no-build-isolation
sh(ACT + 'pip install -q ninja && git clone -q https://github.com/NVlabs/nvdiffrast.git /tmp/nvdiffrast && pip install -q --no-build-isolation /tmp/nvdiffrast', 'nvdiffrast')
# mip-splatting 가우시안 래스터(to_glb 의 질감 굽기) — setup.sh --mipgaussian 은 빌드 격리에서 torch 를 못 찾아 실패(10-10 3판)
sh(ACT + 'git clone -q --recursive https://github.com/autonomousvision/mip-splatting.git /tmp/mip && '
   'pip install -q --no-build-isolation /tmp/mip/submodules/diff-gaussian-rasterization/', 'mipgaussian')
sh(ACT + 'python -c "import torch,xformers,spconv,nvdiffrast.torch,diff_gaussian_rasterization;print(torch.__version__,torch.cuda.is_available())"', 'imports')

GEN = r'''
import glob, json, os, sys, time
TIMES = %r
times = json.load(open(TIMES))
sys.path.insert(0, '/tmp/TRELLIS')
os.environ['ATTN_BACKEND'] = 'xformers'
os.environ['SPCONV_ALGO'] = 'native'
try:
    import kaolin  # noqa
except Exception as ex:                      # FlexiCubes 는 kaolin 의 check_tensor 하나만 쓴다 — 바퀴가 없으면 빈 함수로
    print('kaolin 없음 -> check_tensor 대역', repr(ex), flush=True)
    os.makedirs('/tmp/stub/kaolin/utils', exist_ok=True)
    open('/tmp/stub/kaolin/__init__.py', 'w').close()
    open('/tmp/stub/kaolin/utils/__init__.py', 'w').close()
    open('/tmp/stub/kaolin/utils/testing.py', 'w').write('def check_tensor(*a, **k):\n    return True\n')
    sys.path.insert(0, '/tmp/stub')
    times['kaolin_stub'] = True
from PIL import Image
t = time.time()
from trellis.pipelines import TrellisImageTo3DPipeline
from trellis.utils import postprocessing_utils
pipe = TrellisImageTo3DPipeline.from_pretrained('microsoft/TRELLIS-image-large')
pipe.cuda()
times['steps']['load_model'] = {'sec': round(time.time() - t)}
json.dump(times, open(TIMES, 'w'), indent=1)
for f in sorted(glob.glob('/kaggle/input/**/*.png', recursive=True)):
    iid = os.path.splitext(os.path.basename(f))[0]
    dst = os.path.join(os.path.dirname(TIMES), iid + '.glb')
    if os.path.exists(dst):
        continue
    t = time.time()
    try:
        res = pipe.run(Image.open(f), seed=1)
        t1 = time.time()
        glb = postprocessing_utils.to_glb(res['gaussian'][0], res['mesh'][0], simplify=0.95, texture_size=1024)
        glb.export(dst)
        times['items'][iid] = {'gen_sec': round(t1 - t), 'glb_sec': round(time.time() - t1), 'bytes': os.path.getsize(dst)}
    except Exception as ex:
        import traceback; traceback.print_exc()
        times['items'][iid] = {'error': repr(ex)[:400]}
    print('ITEM', iid, times['items'][iid], flush=True)
    json.dump(times, open(TIMES, 'w'), indent=1)
''' % TIMES
open('/tmp/gen.py', 'w').write(GEN)
sh(ACT + 'python /tmp/gen.py', 'gen')
times = json.load(open(TIMES))
times['total_sec'] = round(time.time() - T0)
json.dump(times, open(TIMES, 'w'), indent=1)
print('K95_DONE', json.dumps(times), flush=True)
