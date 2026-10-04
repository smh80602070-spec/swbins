"""K-0045 효과음 — 무기 9 × (타격·피격) + 방어 · 발소리 6 지면 × 2 · UI 12 · 획득·이벤트 약 30 = 약 80종을 절차 생성(OGG).

  py tools/asset-forge/sfxset.py            # _out/sfx/<id>.ogg + <id>.license.json + sfx_list.json (같은 코드면 같은 소리)
  py tools/asset-forge/sfxset.py --check    # 목록 수 = 파일 수 · 음량 편차(RMS) ≤ 3dB(카테고리 안) · 용량(≤8MB) · .license.json 100%

sfxgen.py 의 합성 겹(tone·noise·chime, 같은 지수 엔벨로프)을 그대로 쓰고, 대역 소리는 두 로우패스의 차(밴드패스)로 만든다.
출력은 모노 44.1kHz Vorbis OGG(`soundfile`) — 카테고리마다 RMS 를 같은 값으로 맞추고 피크는 0.95 로 막는다.
BGM(보스·이벤트·엔딩·스팅어 25슬롯)은 이 도구가 아니라 `C:/swbins3/music-gen/batch_saga.py`(ACE-Step 1.5, MIT 상업 허용)로 `data/bgm-plan2.json` 을 생성한다(K-0045 메모).
"""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import sfxgen as S  # noqa: E402

OUT = os.path.join(HERE, '_out', 'sfx')
SR = S.SR
TARGET_RMS_DB = {'combat': -22.0, 'foot': -27.0, 'ui': -25.0, 'event': -23.0}
tone, noise, chime, mix = S.synth_tone, S.synth_noise, S.synth_chime, S._mix


def band(dur, lo, hi, gain, seed):
    n = max(1, int(dur * SR))
    a = noise(dur, hi, hi, 1.0, seed)
    b = noise(dur, lo, lo, 1.0, seed)
    sig = (a[:n] - b[:n])
    pk = np.max(np.abs(sig)) or 1.0
    return sig / pk * S._envelope(len(sig), SR, gain)


def shift(sig, ms):
    return np.pad(sig, (int(ms * SR / 1000), 0))


# ---------------------------------------------------------------- 전투(무기 9 × 타격·피격 + 방어)
def w_sword_hit(v):
    return mix(band(0.12, 1200, 6000, 0.5, 10 + v), tone(1800 + 120 * v, 900, 0.22, 'triangle', 0.25), tone(2600, 2200, 0.35, 'sine', 0.12))


def w_spear_hit(v):
    return mix(band(0.07, 800, 4000, 0.5, 20 + v), tone(420, 160, 0.1, 'sawtooth', 0.3), tone(210 - 20 * v, 90, 0.16, 'sine', 0.3))


def w_axe_hit(v):
    return mix(noise(0.14, 700, 120, 0.7, 30 + v), tone(110 - 10 * v, 50, 0.2, 'sine', 0.55), band(0.05, 1500, 5000, 0.3, 40 + v))


def w_dagger_hit(v):
    return mix(band(0.06, 2000, 7000, 0.45, 50 + v), tone(2200 - 150 * v, 1200, 0.07, 'triangle', 0.2))


def w_bow_hit(v):
    return mix(shift(band(0.05, 1500, 5000, 0.3, 60 + v), 60), tone(260, 120, 0.08, 'sawtooth', 0.25), tone(900, 300, 0.1, 'triangle', 0.12))


def w_staff_hit(v):
    return mix(noise(0.1, 500, 140, 0.5, 70 + v), tone(300 - 20 * v, 120, 0.2, 'sine', 0.4), chime([880, 1320], 0.04, 0.25, 'sine', 0.15))


def w_gun_hit(v):
    return mix(noise(0.07, 6000, 400, 0.8, 80 + v), tone(160, 55, 0.14, 'sine', 0.5), band(0.2, 300, 1500, 0.15, 90 + v))


def w_shield_hit(v):
    return mix(tone(520 + 40 * v, 480, 0.3, 'square', 0.18), tone(1040, 900, 0.3, 'sine', 0.18), band(0.08, 800, 5000, 0.4, 100 + v))


def w_gauntlet_hit(v):
    return mix(noise(0.08, 900, 150, 0.7, 110 + v), tone(140 - 10 * v, 70, 0.12, 'sine', 0.5))


def hurt(base, v):
    return mix(noise(0.1, 500, 130, 0.45, 200 + v + int(base)), tone(base - 25 * v, base * 0.55, 0.18, 'sawtooth', 0.3), tone(base * 0.5, base * 0.3, 0.2, 'sine', 0.25))


WEAPON_HIT = {'sword': w_sword_hit, 'spear': w_spear_hit, 'axe': w_axe_hit, 'dagger': w_dagger_hit, 'bow': w_bow_hit, 'staff': w_staff_hit, 'gun': w_gun_hit,
              'shield': w_shield_hit, 'gauntlet': w_gauntlet_hit}
HURT_BASE = {'sword': 240, 'spear': 260, 'axe': 200, 'dagger': 280, 'bow': 250, 'staff': 230, 'gun': 270, 'shield': 210, 'gauntlet': 220}


# ---------------------------------------------------------------- 발소리(지면 6 × 2)
def foot(surface, v):
    r = v
    if surface == 'grass':
        return mix(band(0.09, 800, 3500, 0.35, 300 + r), noise(0.05, 400, 150, 0.15, 310 + r))
    if surface == 'dirt':
        return mix(noise(0.08, 900, 200, 0.4, 320 + r), tone(95 + 8 * r, 60, 0.07, 'sine', 0.2))
    if surface == 'stone':
        return mix(band(0.04, 1200, 6000, 0.45, 330 + r), tone(180 + 25 * r, 120, 0.06, 'triangle', 0.25), tone(1400, 1100, 0.07, 'sine', 0.07))
    if surface == 'wood':
        return mix(tone(150 + 20 * r, 90, 0.12, 'triangle', 0.4), band(0.05, 700, 3000, 0.3, 340 + r))
    if surface == 'sand':
        return mix(band(0.14, 1500, 6000, 0.3, 350 + r), noise(0.12, 2500, 800, 0.15, 355 + r))
    return mix(band(0.1, 2000, 7000, 0.25, 360 + r), noise(0.12, 1800, 600, 0.12, 365 + r), tone(70, 50, 0.08, 'sine', 0.1))   # snow


# ---------------------------------------------------------------- UI 12
def ui(name):
    f = {
        'click': lambda: tone(700, 640, 0.045, 'sine', 0.25),
        'confirm': lambda: chime([660, 880], 0.06, 0.2, 'sine', 0.3),
        'cancel': lambda: chime([660, 440], 0.06, 0.2, 'triangle', 0.28),
        'open': lambda: mix(tone(420, 760, 0.14, 'sine', 0.22), band(0.12, 1500, 5000, 0.12, 400)),
        'close': lambda: mix(tone(760, 400, 0.12, 'sine', 0.22), band(0.1, 1500, 5000, 0.1, 401)),
        'tab': lambda: tone(560, 620, 0.05, 'triangle', 0.22),
        'error': lambda: mix(tone(180, 150, 0.16, 'square', 0.18), tone(160, 130, 0.2, 'sawtooth', 0.12)),
        'toggle': lambda: mix(tone(520, 520, 0.03, 'sine', 0.25), shift(tone(740, 740, 0.04, 'sine', 0.2), 25)),
        'hover': lambda: tone(980, 1020, 0.025, 'sine', 0.12),
        'tick': lambda: tone(1240, 1180, 0.02, 'triangle', 0.18),
        'page': lambda: mix(band(0.16, 2500, 7500, 0.25, 402), band(0.08, 800, 3000, 0.1, 403)),
        'notify': lambda: chime([988, 1319, 1568], 0.07, 0.3, 'sine', 0.28),
    }[name]
    return f()


# ---------------------------------------------------------------- 획득·이벤트
def event(name):
    f = {
        'coin': lambda: chime([1319, 1760], 0.045, 0.22, 'square', 0.18),
        'coin_big': lambda: chime([1047, 1319, 1568, 2093], 0.05, 0.4, 'square', 0.17),
        'item_pick': lambda: chime([784, 988, 1319], 0.05, 0.28, 'sine', 0.35),
        'levelup': lambda: mix(chime([523, 659, 784, 1047, 1319], 0.09, 0.8, 'triangle', 0.3), tone(262, 262, 0.7, 'sine', 0.15)),
        'quest_accept': lambda: chime([440, 554, 659], 0.1, 0.5, 'triangle', 0.28),
        'quest_done': lambda: chime([523, 659, 784, 1047], 0.1, 0.7, 'sine', 0.32),
        'chest_open': lambda: mix(tone(120, 220, 0.18, 'sawtooth', 0.2), shift(chime([784, 1047, 1319], 0.05, 0.3, 'sine', 0.25), 120), band(0.2, 1000, 4000, 0.1, 410)),
        'door_open': lambda: mix(tone(95, 130, 0.35, 'sawtooth', 0.22), band(0.3, 300, 1800, 0.18, 411)),
        'heal': lambda: mix(chime([659, 880, 1109, 1319], 0.06, 0.55, 'sine', 0.26), band(0.4, 3000, 8000, 0.05, 412)),
        'buff': lambda: chime([523, 698, 880], 0.07, 0.4, 'triangle', 0.26),
        'debuff': lambda: chime([440, 349, 262], 0.08, 0.4, 'sawtooth', 0.2),
        'death': lambda: mix(tone(220, 60, 0.6, 'sawtooth', 0.3), noise(0.5, 600, 90, 0.3, 413)),
        'crit': lambda: mix(band(0.1, 2500, 8000, 0.55, 414), tone(1500, 600, 0.25, 'triangle', 0.3), tone(90, 50, 0.2, 'sine', 0.4)),
        'dodge': lambda: band(0.22, 900, 6000, 0.3, 415),
        'jump': lambda: mix(tone(280, 520, 0.12, 'sine', 0.22), band(0.1, 1500, 6000, 0.08, 416)),
        'land': lambda: mix(tone(100, 55, 0.14, 'sine', 0.4), noise(0.1, 800, 150, 0.3, 417)),
        'splash': lambda: mix(band(0.3, 600, 5000, 0.35, 418), tone(300, 120, 0.15, 'sine', 0.15)),
        'whoosh': lambda: band(0.28, 500, 5000, 0.3, 419),
        'gacha_1': lambda: chime([523, 659], 0.08, 0.35, 'sine', 0.28),
        'gacha_2': lambda: chime([523, 659, 784], 0.08, 0.45, 'sine', 0.3),
        'gacha_3': lambda: chime([523, 659, 784, 988], 0.08, 0.6, 'triangle', 0.3),
        'gacha_4': lambda: mix(chime([523, 659, 784, 988, 1175], 0.09, 0.8, 'triangle', 0.3), tone(196, 196, 0.7, 'sine', 0.14)),
        'gacha_5': lambda: mix(chime([523, 659, 784, 1047, 1319, 1568], 0.1, 1.1, 'triangle', 0.3), tone(130, 261, 1.0, 'sine', 0.18), band(0.8, 3000, 9000, 0.06, 420)),
        'summon': lambda: mix(tone(200, 900, 0.5, 'sine', 0.25), band(0.5, 800, 6000, 0.12, 421)),
        'capture': lambda: mix(chime([880, 1109, 1319], 0.06, 0.4, 'sine', 0.3), tone(110, 110, 0.2, 'sine', 0.2)),
        'equip': lambda: mix(band(0.1, 1500, 6000, 0.3, 422), tone(320, 260, 0.1, 'triangle', 0.22)),
        'fish_bite': lambda: mix(tone(620, 520, 0.08, 'sine', 0.25), band(0.1, 1500, 5000, 0.15, 423)),
        'cook_done': lambda: chime([784, 988], 0.08, 0.3, 'sine', 0.3),
        'turn_start': lambda: mix(tone(330, 330, 0.18, 'triangle', 0.25), shift(tone(495, 495, 0.2, 'triangle', 0.25), 90)),
        'victory': lambda: chime([523, 659, 784, 1047, 784, 1047, 1319], 0.12, 1.2, 'triangle', 0.3),
        'defeat': lambda: chime([392, 349, 311, 262], 0.16, 1.0, 'triangle', 0.26),
    }[name]
    return f()


EVENTS = ['coin', 'coin_big', 'item_pick', 'levelup', 'quest_accept', 'quest_done', 'chest_open', 'door_open', 'heal', 'buff', 'debuff', 'death', 'crit', 'dodge', 'jump',
          'land', 'splash', 'whoosh', 'gacha_1', 'gacha_2', 'gacha_3', 'gacha_4', 'gacha_5', 'summon', 'capture', 'equip', 'fish_bite', 'cook_done', 'turn_start', 'victory', 'defeat']
UIS = ['click', 'confirm', 'cancel', 'open', 'close', 'tab', 'error', 'toggle', 'hover', 'tick', 'page', 'notify']
SURF = ['grass', 'dirt', 'stone', 'wood', 'sand', 'snow']


def plan():
    P = []
    for w, fn in WEAPON_HIT.items():
        for v in (0, 1):
            P.append((f'sfx_{w}_hit_{v + 1}', 'combat', (lambda fn=fn, v=v: fn(v))))
        for v in (0, 1):
            P.append((f'sfx_{w}_hurt_{v + 1}', 'combat', (lambda w=w, v=v: hurt(HURT_BASE[w], v))))
    P.append(('sfx_block', 'combat', lambda: w_shield_hit(2)))
    for s in SURF:
        for v in (0, 1):
            P.append((f'sfx_step_{s}_{v + 1}', 'foot', (lambda s=s, v=v: foot(s, v))))
    for u in UIS:
        P.append((f'sfx_ui_{u}', 'ui', (lambda u=u: ui(u))))
    for e in EVENTS:
        P.append((f'sfx_{e}', 'event', (lambda e=e: event(e))))
    return P


def rms_db(sig):
    return 20 * np.log10(np.sqrt(np.mean(sig ** 2)) + 1e-9)


def normalize(sig, cat):
    """연성 리미터(tanh)로 파고율을 줄인 뒤 카테고리 RMS 에 맞춘다 — 충격음이 피크 제한에 걸려 작아지는 걸 막는다."""
    sig = np.asarray(sig, dtype=np.float64)
    sig = sig / (np.max(np.abs(sig)) or 1.0)
    sig = np.tanh(2.6 * sig) / np.tanh(2.6)
    gain = 10 ** ((TARGET_RMS_DB[cat] - rms_db(sig)) / 20)
    out = sig * gain
    pk = np.max(np.abs(out))
    if pk > 0.95:
        out = out / pk * 0.95
    return out


def build():
    import soundfile as sf
    os.makedirs(OUT, exist_ok=True)
    items = []
    for sid, cat, fn in plan():
        sig = normalize(fn(), cat)
        p = os.path.join(OUT, sid + '.ogg')
        sf.write(p, sig.astype('float32'), SR, format='OGG', subtype='VORBIS')
        lic = {'id': sid, 'generator': 'tools/asset-forge/sfxset.py', 'license': 'CC0-1.0 (코드 합성 — 외부 입력 없음)', 'category': cat, 'duration_ms': round(len(sig) / SR * 1000),
               'rms_db': round(rms_db(sig), 1), 'sample_rate': SR, 'channels': 1}
        json.dump(lic, open(os.path.join(OUT, sid + '.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        items.append({'id': sid, 'category': cat, 'duration_ms': lic['duration_ms']})
    json.dump({'note': 'K-0045 효과음 목록 — 카테고리 안 RMS 같은 값, 라운드로빈은 _1·_2 변형', 'count': len(items), 'items': items},
              open(os.path.join(OUT, 'sfx_list.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('SFX', len(items), '→', OUT)


def check():
    import soundfile as sf
    bad = []
    total = 0
    by = {}
    P = plan()
    for sid, cat, _ in P:
        p = os.path.join(OUT, sid + '.ogg')
        if not os.path.exists(p):
            bad.append('없음 ' + sid)
            continue
        total += os.path.getsize(p)
        if not os.path.exists(os.path.join(OUT, sid + '.license.json')):
            bad.append('license 없음 ' + sid)
        data, sr = sf.read(p)
        by.setdefault(cat, []).append(rms_db(data))
    for cat, v in by.items():
        spread = max(v) - min(v)
        print(f'{cat}: {len(v)}종 RMS {min(v):.1f}~{max(v):.1f} dB (편차 {spread:.1f})')
        if spread > 3.0:
            bad.append(f'{cat} 음량 편차 {spread:.1f}dB > 3')
    mb = total / 1048576
    print(f'SFX {len(P)}종 · 합계 {mb:.2f}MB (≤8MB)')
    if mb > 8:
        bad.append('용량 8MB 초과')
    print('SFX_FAIL' if bad else 'SFX_OK')
    for b in bad[:20]:
        print(' -', b)
    return 1 if bad else 0


if __name__ == '__main__':
    if '--check' in sys.argv:
        sys.exit(check())
    build()
