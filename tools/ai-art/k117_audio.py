"""K-0117 웹에 남은 빌린 mp3 11 → 자체 소리로 같은 이름 mp3 를 만든다.
  py tools/ai-art/k117_audio.py            # 만들기(멱등 — 다시 돌리면 덮어씀)
  py tools/ai-art/k117_audio.py --table    # 옛·새 길이·음량 표만

짝: data/k117_audio.json. 재료 = 자체 효과음 saga-assets/sfx(sfxset.py 코드 합성 CC0) · 자체 BGM saga-assets/bgm.
thunder 는 자체 효과음에 없어 여기서 코드로 합성한다(갈라지는 번쩍 + 길게 우르릉, 외부 입력 없음 CC0) —
MOSS(GPU)는 K-0118 SD 사슬과 겹쳐서 안 씀(10-17).
변환: imageio-ffmpeg 바이너리(이 PC 에 ffmpeg 없음). 음량은 옛 파일의 EBU R128 통합 음량에 맞춘다(효과음은 1패스, BGM 은 loudnorm).
결과: saga-assets/sfx/web-mp3/<옛 이름>.mp3 · saga-assets/bgm/web-mp3/<판>-<옛 이름>.mp3 + 옆 .license.json → asset-place 항목 sfx-web-mp3·bgm-web-mp3.
"""
import json
import math
import os
import random
import re
import struct
import subprocess
import sys
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
try:
    import imageio_ffmpeg
    FF = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FF = 'ffmpeg'
PAIRS = json.load(open(os.path.join(HERE, 'data', 'k117_audio.json'), encoding='utf-8'))
TMP = os.path.join(HERE, '_out', 'k117')


def ff(args):
    return subprocess.run([FF, '-hide_banner', '-nostdin'] + args, capture_output=True, text=True, encoding='utf-8', errors='replace')


def peak_db(path, key='max_volume'):
    r = ff(['-i', path, '-af', 'volumedetect', '-f', 'null', '-'])
    m = re.search(key + r': (-?[\d.]+) dB', r.stderr)
    return float(m.group(1)) if m else None


def probe(path):
    """(길이 초, 통합 음량 LUFS) — 0.4초 미만은 EBU 게이트에 걸려 -70 이 나오므로 효과음은 peak_db 로 맞춘다"""
    r = ff(['-i', path, '-af', 'ebur128', '-f', 'null', '-'])
    d = re.search(r'Duration: (\d+):(\d+):([\d.]+)', r.stderr)
    dur = int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3)) if d else 0.0
    i = re.findall(r'I:\s+(-?[\d.]+) LUFS', r.stderr)
    return dur, (float(i[-1]) if i else None)


def synth_thunder(path, dur=5.0, sr=44100, seed=20261017):
    """번쩍(0~0.15초 갈라지는 고음 잡음) + 우르릉(갈색 잡음, 느린 진폭 출렁임, 지수 감쇠). 결정적(씨앗 고정)."""
    rnd = random.Random(seed)
    n = int(dur * sr)
    out = [0.0] * n
    b = 0.0
    lp = 0.0
    # 우르릉 출렁임 마디(굴러가는 소리) — 0.25~0.6초 간격의 덩어리
    bumps = []
    t = 0.05
    while t < dur:
        bumps.append((t, rnd.uniform(0.5, 1.0) * math.exp(-t / 2.2)))
        t += rnd.uniform(0.25, 0.6)
    for k in range(n):
        tt = k / sr
        w = rnd.uniform(-1, 1)
        b = (b + 0.02 * w) / 1.02                      # 갈색 잡음
        lp += (b - lp) * 0.08                          # 더 낮게
        env = 0.0
        for bt, amp in bumps:
            if tt >= bt:
                x = tt - bt
                env += amp * (x / 0.04 if x < 0.04 else math.exp(-(x - 0.04) / 0.45))
        rumble = lp * 9.0 * env
        crack = 0.0
        if tt < 0.18:
            crack = w * (1 - tt / 0.18) ** 2 * 0.55 * (0.6 + 0.4 * math.sin(tt * 900))
        out[k] = rumble + crack
    fade = int(0.4 * sr)
    for k in range(fade):
        out[n - 1 - k] *= k / fade
    peak = max(abs(x) for x in out) or 1.0
    with wave.open(path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, x / peak * 0.9)) * 32767)) for x in out))


def main():
    os.makedirs(TMP, exist_ok=True)
    rows = []
    for p in PAIRS['items']:
        old = os.path.join(ROOT, p['old'])
        dst = os.path.join(ROOT, p['dst'])
        od, ol = probe(old)
        rows.append((p, od, ol, dst))
    if '--table' not in sys.argv:
        for p, od, ol, dst in rows:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if p['src'] == 'synth:thunder':
                src = os.path.join(TMP, 'thunder.wav')
                synth_thunder(src)
            else:
                src = os.path.join(ROOT, p['src'])
            if p['kind'] == 'bgm':          # 통합 음량을 옛과 같게(곡 사이 균형 유지), 넘치면 리미터
                sd, sl = probe(src)
                gain = (ol - sl) if (ol is not None and sl is not None) else 0.0
                args = ['-y', '-i', src, '-af', 'volume=%.2fdB,alimiter=limit=0.89' % gain, '-ar', '44100', '-ac', '2', '-b:a', '128k', dst]
            else:                           # 효과음 = 둘 다 0.4초 넘으면 LUFS, 아니면 평균 음량(mean_volume)을 옛과 같게
                sd, sl = probe(src)
                if ol is not None and sl is not None and ol > -69 and sl > -69:
                    gain = ol - sl
                else:
                    om, sm = peak_db(old, 'mean_volume'), peak_db(src, 'mean_volume')
                    gain = (om - sm) if (om is not None and sm is not None) else 0.0
                args = ['-y', '-i', src, '-af', 'volume=%.2fdB,alimiter=limit=0.95' % gain, '-ar', '44100', '-ac', '1', '-b:a', '128k', dst]
            r = ff(args)
            if r.returncode or not os.path.exists(dst):
                print('FAIL', p['old'], r.stderr[-300:])
                continue
            lic = {'id': os.path.splitext(os.path.basename(dst))[0], 'ticket': 'K-0117', 'generator': 'tools/ai-art/k117_audio.py',
                   'source': p['src'], 'replaces': p['old'],
                   'license': 'CC0-1.0 (자체 — ' + ('코드 합성 천둥, 외부 입력 없음' if p['src'].startswith('synth:') else '자체 소리 ' + os.path.basename(p['src']) + ' 를 mp3 로 옮김') + ')',
                   'encoder': 'ffmpeg (imageio-ffmpeg) libmp3lame 128k'}
            src_lic = os.path.splitext(src)[0] + '.license.json'
            if os.path.exists(src_lic):
                lic['source_license'] = json.load(open(src_lic, encoding='utf-8'))
            json.dump(lic, open(os.path.splitext(dst)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('| 옛 파일 | 옛 길이 | 옛 LUFS | 옛 peak | 새 재료 | 새 길이 | 새 LUFS | 새 peak |')
    print('|---|---|---|---|---|---|---|---|')
    for p, od, ol, dst in rows:
        nd, nl = probe(dst) if os.path.exists(dst) else (0, None)
        print('| %s | %.2f | %s | %s | %s | %.2f | %s | %s |' % (p['old'].split('/')[1] + '/' + os.path.basename(p['old']), od, ol, peak_db(os.path.join(ROOT, p['old'])),
                                                        os.path.basename(p['src']), nd, nl, peak_db(dst) if os.path.exists(dst) else None))
    print('K117_DONE')


if __name__ == '__main__':
    main()
