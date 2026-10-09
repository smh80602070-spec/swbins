# -*- coding: utf-8 -*-
"""K-0088 — 정본 BGM(saga-assets/bgm) 음량을 묶음(전투·보스·필드·마을·엔딩·이벤트·스팅어)마다 맞추고, 반복 곡의 앞뒤 무음을 자른다.

  py tools/asset-forge/bgmlevel.py            # 재기만(바꿀 양 표)
  py tools/asset-forge/bgmlevel.py --write    # 정본 OGG 를 고쳐 쓰고 .license.json 에 level 칸(한 번만 — 이미 있으면 건너뜀)
  py tools/asset-forge/bgmlevel.py --check    # 묶음 안 체감 음량(LUFS) 편차 ≤ 3 LU(올림 상한에 걸린 곡 제외) · 반복 곡 끝 무음 ≤ 0.5s · 피크 ≤ −0.5 dBFS

왜: K-0045(소넷)가 효과음에만 음량 규칙을 적용해 BGM 은 −11~−27 LUFS 로 제각각, 반복 곡(웹 `<audio loop>`) 끝에 무음이 최대 11초 붙어 끊겼다.
맞추기: 목표 = 묶음 중앙값 LUFS(가장 덜 바꾸는 값), 올림은 최대 +6dB(조용한 곡을 억지로 키우면 리미터가 소리를 뭉갠다).
피크: 1ms 블록 lookahead 리미터(천장 −1.5 dBFS — 인코딩 넘침 여유, 풀림 80ms). 반복 곡 = 이름에 battle·boss·field·town — 앞 무음은 다 자르고, 끝은 50ms 창 RMS −45 dBFS 아래
무음을 자르되 0.25s 남겨 30ms 페이드. 다시 굽기: 48kHz 스테레오 OGG Vorbis(원본 규격 그대로).
"""
import glob
import json
import os
import sys

import numpy as np
import pyloudnorm as pyln
import soundfile as sf

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
BGM = os.path.join(ROOT, 'saga-assets', 'bgm')
LOOP_KEYS = ('battle', 'boss', 'field', 'town')
MAX_UP = 6.0
CEIL = 10 ** (-1.5 / 20)   # Vorbis 인코딩이 0.5dB 남짓 넘친다 — --check 는 −0.5
SILENCE = 10 ** (-45 / 20)   # 50ms 창 RMS 기준(샘플 하나로 보면 인코딩 잡음·튐 하나에 끝이 걸린다)


def group(name):
    if name.startswith(('event', 'stinger')):
        return name.split('-')[0]
    return name.split('-')[1]


def is_loop(name):
    return any(k in name for k in LOOP_KEYS) and not name.startswith('stinger')


def limit(w, sr):
    """1ms 블록 lookahead 리미터 — 천장 CEIL, 즉시 잡고 80ms 로 풀림."""
    blk = max(1, sr // 1000)
    n = (len(w) + blk - 1) // blk
    pad = np.pad(np.abs(w).max(1), (0, n * blk - len(w)))
    need = np.minimum(1.0, CEIL / np.maximum(pad.reshape(n, blk).max(1), 1e-9))
    need = np.minimum(need, np.concatenate([need[1:], [1.0]]))          # 한 블록 앞을 미리 본다
    rel = np.exp(-1.0 / 80)                                              # 블록(1ms) 단위 풀림 80ms
    g = np.empty(n)
    cur = 1.0
    for i in range(n):
        cur = need[i] if need[i] < cur else min(need[i], cur + (1 - rel) * (1 - cur))
        g[i] = cur
    gs = np.interp(np.arange(n * blk), (np.arange(n) + 0.5) * blk, g)[:len(w)]
    out = w * gs[:, None]
    return np.clip(out, -CEIL, CEIL)


def sound_span(w, sr):
    """소리가 있는 [처음, 끝) 샘플 — 50ms 창 RMS(채널 중 큰 쪽)가 SILENCE 를 넘는 창들."""
    h = max(1, int(sr * 0.05))
    n = len(w) // h
    if n == 0:
        return 0, len(w)
    rms = np.sqrt((w[:n * h] ** 2).reshape(n, h, -1).mean(1)).max(1)
    on = np.nonzero(rms > SILENCE)[0]
    if not len(on):
        return 0, len(w)
    return on[0] * h, min(len(w), (on[-1] + 1) * h)


def trim(w, sr):
    s0, s1 = sound_span(w, sr)
    end = min(len(w), s1 + int(sr * 0.25))
    out = w[s0:end].copy()
    f = min(len(out), int(sr * 0.03))
    out[-f:] *= np.linspace(1, 0, f)[:, None]
    return out, s0 / sr, (len(w) - end) / sr


def measure():
    rows = {}
    for p in sorted(glob.glob(os.path.join(BGM, '*.ogg'))):
        name = os.path.basename(p)[:-4]
        w, sr = sf.read(p, always_2d=True)
        a = np.abs(w).max(1)
        s1 = sound_span(w, sr)[1]
        rows[name] = {'path': p, 'sr': sr, 'lufs': float(pyln.Meter(sr).integrated_loudness(w)),
                      'peak_db': float(20 * np.log10(a.max() + 1e-9)),
                      'tail_s': float((len(w) - s1) / sr), 'group': group(name), 'loop': is_loop(name)}
    tg = {}
    for g in sorted({r['group'] for r in rows.values()}):
        tg[g] = float(np.median([r['lufs'] for r in rows.values() if r['group'] == g]))
    for r in rows.values():
        r['target'] = tg[r['group']]
        r['gain'] = min(MAX_UP, r['target'] - r['lufs'])
        r['capped'] = r['target'] - r['lufs'] > MAX_UP
    return rows, tg


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    rows, tg = measure()
    if '--check' in sys.argv:
        bad = []
        for g in tg:
            v = [r['lufs'] for n, r in rows.items() if r['group'] == g and not _lic(n).get('level', {'capped': r['capped']})['capped']]
            if v and max(v) - min(v) > 3.0:
                bad.append(f'{g} 체감 음량 편차 {max(v) - min(v):.1f} LU > 3')
        for n, r in rows.items():
            if r['loop'] and r['tail_s'] > 0.5:
                bad.append(f'{n} 반복 곡 끝 무음 {r["tail_s"]:.1f}s')
            if r['peak_db'] > -0.5:
                bad.append(f'{n} 피크 {r["peak_db"]:.1f} dBFS')
        print('BGM %d곡 · 묶음 %d' % (len(rows), len(tg)))
        print('BGM_FAIL' if bad else 'BGM_OK')
        for b in bad:
            print(' -', b)
        return 1 if bad else 0
    write = '--write' in sys.argv
    for n, r in rows.items():
        lic = _lic(n)
        done = 'level' in lic
        print(f"{n:24s} {r['group']:8s} {r['lufs']:6.1f} → {r['target']:6.1f} LUFS ({r['gain']:+.1f}dB{' 상한' if r['capped'] else ''})"
              f"{' 끝무음 %.1fs' % r['tail_s'] if r['loop'] else ''}{' (이미 맞춤)' if done else ''}")
        if not write or done:
            continue
        w, sr = sf.read(r['path'], always_2d=True)
        head = tail = 0.0
        w = w * 10 ** (r['gain'] / 20)
        if r['loop']:          # 음량을 맞춘 뒤 자른다(낮추면 −50 dB 바로 위 꼬리가 무음 아래로 내려간다)
            w, head, tail = trim(w, sr)
        w = limit(w, sr)
        tmp = r['path'] + '.tmp.ogg'
        with sf.SoundFile(tmp, 'w', sr, w.shape[1], format='OGG', subtype='VORBIS') as f:
            for i in range(0, len(w), 16384):          # 한 번에 크게 쓰면 libsndfile OGG 가 조용히 죽는다(0초 파일)
                f.write(w[i:i + 16384])
        if sf.info(tmp).frames != len(w):
            raise SystemExit(f'{n}: 쓴 길이가 다르다 — 원본 그대로 둔다')
        os.replace(tmp, r['path'])
        after = float(pyln.Meter(sr).integrated_loudness(w))
        lic['level'] = {'by': 'tools/asset-forge/bgmlevel.py (K-0088)', 'lufs_before': round(r['lufs'], 1), 'lufs_after': round(after, 1),
                        'group_target': round(r['target'], 1), 'gain_db': round(r['gain'], 1), 'capped': r['capped'],
                        'trim_head_s': round(head, 2), 'trim_tail_s': round(tail, 2), 'ceiling_dbfs': -1.5}
        lic['duration_s'] = round(len(w) / sr, 2)
        lp = r['path'][:-4] + '.license.json'
        with open(lp, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(lic, f, ensure_ascii=False, indent=1)
            f.write('\n')
    if write:
        print('BGMLEVEL_OK')
    return 0


def _lic(name):
    return json.load(open(os.path.join(BGM, name + '.license.json'), encoding='utf-8'))


if __name__ == '__main__':
    sys.exit(main())
