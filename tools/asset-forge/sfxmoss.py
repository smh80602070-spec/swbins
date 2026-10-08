# -*- coding: utf-8 -*-
"""K-0085 — MOSS-SoundEffect 로 다시 만든 효과음을 CLAP 으로 지금 판과 비교해 이긴 것만 같은 이름으로 갈아 끼운다.

  C:\\swbins3\\voice-gen\\venv_qwen\\Scripts\\python.exe tools/asset-forge/sfxmoss.py [--write]
  (토치·transformers 가 든 swbins3 파이썬으로 돈다 — CLAP laion/larger_clap_general, Apache-2.0)

입력: 계획 tools/asset-forge/data/sfx_moss_plan.json · MOSS 판 C:\\swbins3\\sfx-gen\\out\\saga-sfx\\<id>.wav · 지금 판 saga-assets/sfx/sfx_<id>.ogg
채점·교체는 같은 판: MOSS 판을 시작점(최고치 10% 넘는 첫 자리 − 5ms)부터 지금 길이로 자르고 페이드·음량 맞춘 것.
판정: 자기 프롬프트 유사도 MOSS > 지금 이고, 52 프롬프트 중 자기 등수가 지금 판 이하(같거나 앞)면 교체.
교체: 44.1kHz 모노 · 길이 = 지금 duration_ms(끝 30ms 페이드) · RMS = 지금 rms_db → 같은 이름 OGG + license 갱신.
보고: tools/asset-forge/data/sfx_moss_report.json(id 마다 두 판 유사도·등수·교체 여부).
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
import torch
import torchaudio.functional as AF

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
PLAN = os.path.join(ROOT, 'tools', 'asset-forge', 'data', 'sfx_moss_plan.json')
REPORT = os.path.join(ROOT, 'tools', 'asset-forge', 'data', 'sfx_moss_report.json')
SFX = os.path.join(ROOT, 'saga-assets', 'sfx')
MOSS = os.environ.get('SAGA_MOSS_SRC', r'C:\swbins3\sfx-gen\out\saga-sfx')


def load(path, sr_out):
    w, sr = sf.read(path, dtype='float32', always_2d=True)
    w = torch.from_numpy(w.mean(1))
    return (AF.resample(w, sr, sr_out) if sr != sr_out else w).numpy()


def fit(w, sr, lic):
    """게임에 들어갈 꼴 — 시작점 맞추기 · 지금 길이 · 끝 30ms 페이드 · 지금 RMS."""
    a = np.abs(w)
    on = max(0, int(np.argmax(a > a.max() * 0.1)) - int(sr * 0.005))
    n = int(sr * lic['duration_ms'] / 1000)
    w = w[on:on + n].copy()
    w = np.pad(w, (0, max(0, n - len(w))))
    f = min(len(w), int(sr * 0.03))
    w[-f:] *= np.linspace(1, 0, f)
    rms = np.sqrt(np.mean(w ** 2)) + 1e-9
    return np.clip(w * (10 ** (lic['rms_db'] / 20) / rms), -0.98, 0.98).astype(np.float32)


def lic_of(k):
    return json.load(open(os.path.join(SFX, f'sfx_{k}.license.json'), encoding='utf-8'))


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    write = '--write' in sys.argv
    plan = json.load(open(PLAN, encoding='utf-8'))['items']
    ids = [k for k in plan if os.path.exists(os.path.join(MOSS, k + '.wav'))]
    from transformers import ClapModel, ClapProcessor
    m = ClapModel.from_pretrained('laion/larger_clap_general').eval()
    proc = ClapProcessor.from_pretrained('laion/larger_clap_general')
    keys = list(plan)
    with torch.no_grad():
        te = m.get_text_features(**proc(text=[plan[k] for k in keys], return_tensors='pt', padding=True))
        te = getattr(te, 'pooler_output', te)
        te = te / te.norm(dim=-1, keepdim=True)

        def score(wav48, i):
            ae = m.get_audio_features(**proc(audios=[wav48], sampling_rate=48000, return_tensors='pt'))
            ae = getattr(ae, 'pooler_output', ae)
            s = (ae / ae.norm(dim=-1, keepdim=True) @ te.T)[0].numpy()
            return float(s[i]), int((s > s[i]).sum()) + 1

        rep = {}
        for k in ids:
            i = keys.index(k)
            lic = lic_of(k)
            sr = lic.get('sample_rate', 44100)
            w = fit(load(os.path.join(MOSS, k + '.wav'), sr), sr, lic)
            ms, mr = score(AF.resample(torch.from_numpy(w), sr, 48000).numpy(), i)
            cs, cr = score(load(os.path.join(SFX, f'sfx_{k}.ogg'), 48000), i)
            rep[k] = {'moss': round(ms, 3), 'moss_rank': mr, 'cur': round(cs, 3), 'cur_rank': cr, 'replace': ms > cs and mr <= cr}
    won = [k for k, r in rep.items() if r['replace']]
    print(f'SFXMOSS 비교 {len(rep)} · 교체 {len(won)} · 유지 {len(rep) - len(won)} · 평균 유사도 MOSS {np.mean([r["moss"] for r in rep.values()]):.3f} 지금 {np.mean([r["cur"] for r in rep.values()]):.3f}')
    if write:
        for k in won:
            dst = os.path.join(SFX, f'sfx_{k}.ogg')
            lp = os.path.join(SFX, f'sfx_{k}.license.json')
            lic = lic_of(k)
            sr = lic.get('sample_rate', 44100)
            w = fit(load(os.path.join(MOSS, k + '.wav'), sr), sr, lic)
            sf.write(dst, w, sr, format='OGG', subtype='VORBIS')
            lic.update({'generator': 'C:/swbins3/sfx-gen/moss_trial.py --plan (MOSS-SoundEffect v2, 창 10초·시작점 자르기) + tools/asset-forge/sfxmoss.py(시작점·길이 맞춘 판으로 채점)',
                        'model': 'OpenMOSS-Team/MOSS-SoundEffect-v2.0', 'license': 'Apache-2.0 (모델·코드) — AI 생성, 원작 효과음 모사 없음',
                        'prompt': plan[k], 'clap': rep[k], 'rms_db': round(float(20 * np.log10(np.sqrt(np.mean(w ** 2)) + 1e-9)), 1)})
            json.dump(lic, open(lp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        json.dump({'note': 'K-0085 — CLAP(laion/larger_clap_general) 자기 프롬프트 유사도·등수, replace = MOSS 판으로 갈아 끼움', 'items': rep},
                  open(REPORT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('SFXMOSS_OK 교체', len(won), ':', ', '.join(won))
    return 0


if __name__ == '__main__':
    sys.exit(main())
