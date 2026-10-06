"""물체 분리 마스크(u2net) — 흰 배경 위 그림자·받침 판을 물체와 가른다(K-0050 후속, 10-07).

    from seg_mask import object_mask      # PIL 이미지 → 0~1 float 마스크(원본 크기)

icon_pack.py 의 모서리 채우기 matte 는 흰 배경과 색이 다른 그림자(회색·파랑)를 물체로 남긴다. 이 마스크를 겹쳐 그림자를 지운다.
가중치: ~/.u2net/u2net.onnx(U^2-Net, Apache-2.0 — 도구만 쓰고 저장소·게임엔 안 들어간다, 로컬 전용).
실행기: onnxruntime(MIT) — 시스템 파이썬을 안 건드리게 git 밖 `tools/ai-art/_out/_pylib` 에 설치:
    py -m pip install --target tools/ai-art/_out/_pylib onnxruntime
"""
import os
import sys

import numpy as np
from PIL import Image

_LIB = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_out', '_pylib')
_MODEL = os.environ.get('U2NET_ONNX', os.path.join(os.path.expanduser('~'), '.u2net', 'u2net.onnx'))
_sess = None


def _session():
    global _sess
    if _sess is None:
        if os.path.isdir(_LIB) and _LIB not in sys.path:
            sys.path.append(_LIB)                      # 끝에 붙인다 — 시스템 numpy 가 먼저
        import onnxruntime as ort
        if not os.path.exists(_MODEL):
            raise SystemExit('u2net 가중치 없음: %s' % _MODEL)
        _sess = ort.InferenceSession(_MODEL, providers=['CPUExecutionProvider'])
    return _sess


def object_mask(im):
    """u2net 두드러짐 지도(0~1, 원본 크기)."""
    rgb = im.convert('RGB')
    x = np.asarray(rgb.resize((320, 320), Image.LANCZOS)).astype(np.float32)
    x = x / max(1.0, float(x.max()))
    x = (x - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    s = _session()
    y = s.run(None, {s.get_inputs()[0].name: x})[0][0, 0]
    y = (y - y.min()) / max(1e-6, float(y.max() - y.min()))
    m = Image.fromarray((y * 255).astype(np.uint8)).resize(rgb.size, Image.BILINEAR)
    return np.asarray(m).astype(np.float32) / 255.0
