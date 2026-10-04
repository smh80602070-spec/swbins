"""char-forge 자체 키프레임 동작 — UAL 무료판에 없는 동작(README §4)을 코드로 짓는다.

동작 팩(UAL) 뼈대 위에 `Rig|CF_*` 동작을 만들어 두면 build.py `retarget` 과 verify.py 가 UAL 동작과 똑같이 다룬다
(쉼 방향 맞춤·골반 배율·땅 붙이기·파일 검증). 레시피 anims 에 `"climb": "CF_Climb_Loop"` 처럼 쓴다.

자세 하나 = 열쇠 프레임 하나. 캐릭터 좌표 (왼쪽, 앞, 위) — 몸 크기는 UAL 몸(골반 0.92m·어깨 1.44m) 기준 m:
- `base`   : 손가락·목 등 안 적은 뼈를 가져올 UAL 동작과 프레임(없으면 Idle_Loop 0)
- `pelvis` : 골반 이동 (왼, 앞, 위) · `yaw` : 골반을 위 축으로 도는 각(도, + = 왼쪽으로 돈다)
- `dirs`   : 뼈 → 가리킬 방향(기준 자식 쪽, rigmaps.REF_CHILD). 등뼈·목·쇄골·손·발
- `ik`     : `hand_l`·`foot_r` 등 → 손목·발목 자리. 두 마디(위팔·아래팔 / 허벅지·종아리)를 풀고 팔꿈치·무릎은 `pole` 쪽으로 굽는다
- `keep_world` : 뼈 이름들 — 골반·등뼈를 고친 뒤에도 `base` 동작의 **월드 방향**을 지킨다(안 적은 뼈는 부모 기준 회전을 지켜 등뼈를 세우면 같이 돈다)
좌우 대칭 자세는 `mirror(pose)` 로 뒤집는다. 난수 없음 — 같은 코드면 같은 곡선.
"""
import bpy
from mathutils import Matrix, Vector
import math
import rigmaps

FPS = 30
UP = (0.0, 0.0, 1.0)

# ---------- 자세 조각 ----------
STAND_FEET = {'foot_l': (0.10, 0.03, 0.104), 'foot_r': (-0.10, 0.03, 0.104)}  # 발목 높이 0.104 = 땅
POLE = {'hand_l': (1.0, -0.6, -0.5), 'hand_r': (-1.0, -0.6, -0.5),  # 팔꿈치: 바깥·뒤·아래
        'foot_l': (0.25, 1.0, 0.0), 'foot_r': (-0.25, 1.0, 0.0)}    # 무릎: 앞(조금 바깥)


def P(**kw):
    kw.setdefault('keep_world', ())
    kw.setdefault('dirs', {})
    kw.setdefault('ik', {})
    kw.setdefault('pole', {})
    return kw


def _flip(v):
    return (-v[0], v[1], v[2])


def _swap(n):
    return n[:-2] + ('_r' if n.endswith('_l') else '_l') if n.endswith(('_l', '_r')) else n


def mirror(p):
    q = dict(p)
    q['dirs'] = {_swap(k): _flip(v) for k, v in p['dirs'].items()}
    q['ik'] = {_swap(k): _flip(v) for k, v in p['ik'].items()}
    q['pole'] = {_swap(k): _flip(v) for k, v in p['pole'].items()}
    q['keep_world'] = tuple(_swap(n) for n in p['keep_world'])
    if 'pelvis' in p:
        q['pelvis'] = _flip(p['pelvis'])
    if 'yaw' in p:
        q['yaw'] = -p['yaw']
    return q


# ---------- 동작 ----------
def _climb():
    """벽 오르기(제자리) — 벽은 앞 0.30m. 한 손이 벽을 짚고 몸 쪽으로 내려오는 동안 다른 손이 벽에서 떨어져 위로 뻗는다.
    발도 같은 식으로 엇갈린다. 몸은 게임(CharacterController)이 올린다."""
    lean = {'pelvis': (0, 0.12, 1), 'spine_01': (0, 0.10, 1), 'spine_02': (0, 0.08, 1), 'spine_03': (0, 0.05, 1),
            'neck_01': (0, 0.02, 1), 'hand_l': (0.05, 0.15, 1), 'hand_r': (-0.05, 0.15, 1),
            'foot_l': (0, 1, -0.25), 'foot_r': (0, 1, -0.25)}
    pole = {'hand_l': (1, -0.4, -0.8), 'hand_r': (-1, -0.4, -0.8), 'foot_l': (0.5, 1, 0), 'foot_r': (-0.5, 1, 0)}
    a = P(base=('Idle_Loop', 0), pelvis=(0, 0.06, 0), dirs=lean, pole=pole,
          ik={'hand_l': (0.20, 0.30, 1.86), 'hand_r': (-0.24, 0.30, 1.44),
              'foot_l': (0.12, 0.24, 0.30), 'foot_r': (-0.13, 0.26, 0.62)})
    m = P(base=('Idle_Loop', 0), pelvis=(0, 0.06, 0.03), dirs=lean, pole=pole,
          ik={'hand_l': (0.21, 0.30, 1.64), 'hand_r': (-0.22, 0.14, 1.66),
              'foot_l': (0.12, 0.25, 0.44), 'foot_r': (-0.13, 0.12, 0.46)})
    b, mb = mirror(a), mirror(m)
    return True, [(0, a), (12, m), (24, b), (36, mb), (48, a)]


def _glide():
    """활공 — 몸을 앞으로 25° 눕히고 두 손은 머리 위 바깥으로(날개 손잡이), 다리는 뒤로 늘어뜨린다. 바람에 흔들린다."""
    d = {'pelvis': (0, 0.45, 1), 'spine_01': (0, 0.45, 1), 'spine_02': (0, 0.42, 1), 'spine_03': (0, 0.38, 1),
         'neck_01': (0, 0.10, 1), 'hand_l': (0.6, 0.2, 1), 'hand_r': (-0.6, 0.2, 1),
         'foot_l': (0, 0.35, -1), 'foot_r': (0, 0.45, -1)}
    pole = {'hand_l': (1, -0.3, -0.3), 'hand_r': (-1, -0.3, -0.3)}
    a = P(base=('Jump_Loop', 0), dirs=d, pole=pole,
          ik={'hand_l': (0.52, 0.28, 1.73), 'hand_r': (-0.52, 0.28, 1.73),
              'foot_l': (0.09, -0.20, 0.22), 'foot_r': (-0.10, -0.06, 0.32)})
    b = P(base=('Jump_Loop', 30), dirs=d, pole=pole, pelvis=(0, 0, 0.02),
          ik={'hand_l': (0.54, 0.25, 1.68), 'hand_r': (-0.54, 0.25, 1.68),
              'foot_l': (0.09, -0.08, 0.30), 'foot_r': (-0.10, -0.18, 0.24)})
    return True, [(0, a), (30, b), (60, a)]


def _block_pose(breath=0.0, push=0.0):
    return P(base=('Sword_Idle', 0), pelvis=(0, 0.02 - push * 0.08, -0.07 - breath - push * 0.03),
             dirs={'pelvis': (0, 0.10 - push * 0.2, 1), 'spine_01': (0, 0.18 - push * 0.3, 1),
                   'spine_02': (0, 0.16 - push * 0.3, 1), 'spine_03': (0, 0.12 - push * 0.3, 1), 'neck_01': (0, 0.10, 1),
                   'hand_l': (-0.25, 0.55, 0.8), 'hand_r': (0, 1, 0.25), 'foot_l': (0.05, 1, -0.6), 'foot_r': (-0.2, 1, -0.6)},
             pole={'hand_l': (1, 0.1, -0.7), 'hand_r': (-0.4, -1, -0.2), 'foot_l': (0.3, 1, 0), 'foot_r': (-0.3, 1, 0)},
             ik={'hand_l': (0.03, 0.38 - push * 0.10, 1.26 + push * 0.03), 'hand_r': (-0.25, 0.16 - push * 0.09, 1.03 - push * 0.02),
                 'foot_l': (0.16, 0.18, 0.104), 'foot_r': (-0.15, -0.20, 0.104)})


def _block():
    """방패 막기(도발) — 서기에서 무릎을 굽혀 낮추며 왼팔 방패를 얼굴 앞으로, 오른손 칼은 허리 옆에. 끝 자세를 숨 쉬며 붙든다."""
    ready = P(base=('Sword_Idle', 0), pelvis=(0, 0, -0.02),
              dirs={'hand_l': (0.1, 0.4, -1), 'hand_r': (0, 1, 0.1)},
              ik={'hand_l': (0.25, 0.10, 0.98), 'hand_r': (-0.25, 0.10, 0.99),
                  'foot_l': (0.12, 0.06, 0.104), 'foot_r': (-0.11, -0.04, 0.104)})
    return False, [(0, ready), (10, _block_pose()), (25, _block_pose(0.012)), (40, _block_pose())]


def _block_hit():
    """막기 중 맞음 — 방패째 뒤로 밀려 상체가 젖혀졌다 돌아온다. 발은 그 자리."""
    return False, [(0, _block_pose()), (4, _block_pose(push=1.0)), (10, _block_pose(push=0.45)), (20, _block_pose())]


def _bow_idle():
    """활 들고 서기 — 왼손은 활을 몸 앞 아래로, 오른손은 허리 옆."""
    d = {'hand_l': (0.05, 0.6, -0.8), 'hand_r': (0, 0.3, -1)}
    a = P(base=('Idle_Loop', 0), dirs=d, ik={'hand_l': (0.20, 0.16, 0.94), 'hand_r': (-0.23, 0.02, 0.95), **STAND_FEET})
    b = P(base=('Idle_Loop', 37), dirs=d, pelvis=(0, 0, -0.006),
          ik={'hand_l': (0.20, 0.17, 0.93), 'hand_r': (-0.23, 0.03, 0.94), **STAND_FEET})
    return True, [(0, a), (30, b), (60, a)]


def _bow_shoot():
    """활 쏘기 — 몸을 45° 틀어 왼어깨를 과녁(앞)으로, 왼팔을 곧게 뻗고 오른손으로 시위를 턱까지 당겨 멈췄다 놓는다."""
    feet = {'foot_l': (0.06, 0.12, 0.104), 'foot_r': (-0.15, -0.10, 0.104)}
    body = {'spine_01': (0, 0.02, 1), 'spine_02': (0, 0.0, 1), 'spine_03': (0, -0.02, 1), 'neck_01': (0, 0.05, 1)}
    pole = {'hand_l': (0.3, -0.2, -1), 'hand_r': (-0.2, -1, 0.3)}
    idle = P(base=('Idle_Loop', 0), dirs={'hand_l': (0.05, 0.6, -0.8), 'hand_r': (0, 0.3, -1)},
             ik={'hand_l': (0.20, 0.16, 0.94), 'hand_r': (-0.23, 0.02, 0.95), **STAND_FEET})
    nock = P(base=('Idle_Loop', 0), yaw=-40, dirs=dict(body, hand_l=(0, 1, 0.1), hand_r=(0.2, 1, 0)), pole=pole,
             ik={'hand_l': (0.10, 0.50, 1.38), 'hand_r': (0.0, 0.28, 1.38), **feet})
    draw = P(base=('Idle_Loop', 0), yaw=-45, dirs=dict(body, hand_l=(0, 1, 0.1), hand_r=(0.1, 1, 0.1)), pole=pole,
             ik={'hand_l': (0.06, 0.58, 1.44), 'hand_r': (-0.02, 0.06, 1.50), **feet})
    loose = P(base=('Idle_Loop', 0), yaw=-45, dirs=dict(body, hand_l=(0, 1, 0.1), hand_r=(-0.3, 0.4, 0.3)), pole=pole,
              ik={'hand_l': (0.06, 0.58, 1.43), 'hand_r': (-0.16, -0.10, 1.50), **feet})
    return False, [(0, idle), (8, nock), (18, draw), (26, draw), (30, loose), (40, loose)]


def _kneel():
    """무릎 꿇은 포로(제자리) — 두 무릎을 모아 땅에 대고 허벅지는 곧추, 정강이·발등은 뒤로 땅에 눕힌다. 두 손은 등 뒤로 모은다.
    고개를 떨군 채 숨 쉬며 좌우로 조금 흔들린다. 무릎 관절 중심은 땅 위 5~6cm(무릎뼈가 땅에 닿는다)."""
    def k(breath, sway):
        return P(base=('Idle_Loop', 0), pelvis=(0, -0.06, -0.485 - breath),
                 dirs={'pelvis': (0, 0.04, 1), 'spine_01': (sway * 0.3, 0.06, 1), 'spine_02': (sway * 0.5, 0.04, 1),
                       'spine_03': (sway, 0.03, 1), 'neck_01': (sway, 0.38 + breath * 4, 1),
                       'hand_l': (-0.2, -0.3, -1), 'hand_r': (0.2, -0.3, -1), 'foot_l': (0.02, -1, -0.15), 'foot_r': (-0.02, -1, -0.15),
                       'clavicle_l': (1, -0.4, 0), 'clavicle_r': (-1, -0.4, 0)},
                 pole={'hand_l': (1, -0.7, 0.1), 'hand_r': (-1, -0.7, 0.1), 'foot_l': (0.1, 1, -0.6), 'foot_r': (-0.1, 1, -0.6)},
                 ik={'hand_l': (0.07, -0.25, 0.54 - breath), 'hand_r': (-0.07, -0.25, 0.56 - breath),
                     'foot_l': (0.11, -0.45, 0.08), 'foot_r': (-0.11, -0.45, 0.08)})
    return True, [(0, k(0, 0)), (30, k(0.010, 0.03)), (60, k(0, 0)), (90, k(0.010, -0.03)), (120, k(0, 0))]


def _heal():
    """치유·되살림 시전 — 두 손을 가슴 앞에 모았다가 머리 위로 들어 올려 기운을 모으고(몸이 조금 젖혀진다),
    무릎을 굽히며 앞 아래로 두 손바닥을 펼쳐 내린다. 발은 그 자리."""
    feet = {'foot_l': (0.14, 0.08, 0.104), 'foot_r': (-0.14, -0.08, 0.104)}
    # 바탕 Idle_Loop 은 오른어깨를 12cm 뒤로 뺀 짝다리라 두 손 시전에선 쇄골을 좌우 같게 편다
    fdir = {'foot_l': (0.05, 1, -0.6), 'foot_r': (-0.05, 1, -0.6), 'clavicle_l': (1, -0.3, 0), 'clavicle_r': (-1, -0.3, 0)}
    idle = P(base=('Idle_Loop', 0), pelvis=(0, 0, -0.03), dirs=dict(fdir, hand_l=(0.05, 0.3, -1), hand_r=(-0.05, 0.3, -1)),
             ik={'hand_l': (0.28, 0.02, 0.90), 'hand_r': (-0.28, 0.02, 0.90), **feet})
    gather = P(base=('Idle_Loop', 0), pelvis=(0, 0, -0.06),
               dirs=dict(fdir, spine_03=(0, 0.06, 1), neck_01=(0, 0.20, 1), hand_l=(-0.6, 0.5, 0.6), hand_r=(0.6, 0.5, 0.6)),
               pole={'hand_l': (1, -0.3, -0.6), 'hand_r': (-1, -0.3, -0.6)},
               ik={'hand_l': (0.07, 0.30, 1.18), 'hand_r': (-0.07, 0.30, 1.18), **feet})
    raised = P(base=('Idle_Loop', 0), pelvis=(0, -0.01, -0.02),
               dirs=dict(fdir, spine_01=(0, -0.04, 1), spine_02=(0, -0.08, 1), spine_03=(0, -0.10, 1), neck_01=(0, -0.25, 1),
                         hand_l=(0.2, 0.2, 1), hand_r=(-0.2, 0.2, 1)),
               pole={'hand_l': (1, 0, -0.4), 'hand_r': (-1, 0, -0.4)},
               ik={'hand_l': (0.22, 0.16, 1.80), 'hand_r': (-0.22, 0.16, 1.80), **feet})
    raised2 = dict(raised, ik={'hand_l': (0.24, 0.15, 1.82), 'hand_r': (-0.24, 0.15, 1.82), **feet})
    release = P(base=('Idle_Loop', 0), pelvis=(0, 0.03, -0.10),
                dirs=dict(fdir, spine_01=(0, 0.12, 1), spine_02=(0, 0.16, 1), spine_03=(0, 0.18, 1), neck_01=(0, 0.30, 1),
                          hand_l=(0.2, 1, -0.3), hand_r=(-0.2, 1, -0.3)),
                pole={'hand_l': (1, -0.5, -0.5), 'hand_r': (-1, -0.5, -0.5)},
                ik={'hand_l': (0.26, 0.46, 1.06), 'hand_r': (-0.26, 0.46, 1.06), **feet})
    return False, [(0, idle), (12, gather), (28, raised), (38, raised2), (50, release), (62, release), (80, idle)]


def _guard_pose(b=0.0):
    # 두 팔은 Sword_Idle 의 월드 방향 그대로(09-27) — 오른손을 허리 앞 ik 로 끌면 위팔이 쉼 대비 94° 꺾여(Sword_Idle 36°)
    # 어깨 뒤 살이 지느러미처럼 조끼·전포 등을 뚫었다(황건 두목·성 경비·성 파수병·맨몸 잡졸). 팔을 부모 기준으로만 두면 등뼈를 세울 때 앞으로 들렸다
    return P(base=('Sword_Idle', 0), pelvis=(0, 0, -0.02 - b),
             dirs={'pelvis': (0, 0.04, 1), 'spine_01': (0, 0.06, 1), 'spine_02': (0, 0.05, 1), 'spine_03': (0, 0.03, 1),
                   'neck_01': (0, 0.04, 1),
                   'foot_l': (0.08, 1, -0.55), 'foot_r': (-0.08, 1, -0.55)},
             keep_world=('upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r'),
             ik={'foot_l': (0.12, 0.05, 0.104), 'foot_r': (-0.12, -0.04, 0.104)})


def _guard_idle():
    """칼 쥐고 서기(좁은 자세) — Sword_Idle 손가락·어깨를 받되 발은 어깨너비로 모은다. 긴 옷자락·갑옷 치마가
    Sword_Idle 의 넓게 벌린 다리를 따라 부풀지 않게(천 시뮬레이션이 없다). 오른손 칼은 허리 앞, 왼손은 옆."""
    return True, [(0, _guard_pose()), (30, _guard_pose(0.008)), (60, _guard_pose())]


def _strafe_pose(lx, lz, rx, rz, px):
    """옆걸음 자세 — 칼 쥔 대기(_guard_pose)의 팔·몸을 받고 발만 옆으로. 좌표는 (왼쪽, 앞, 위), 발목 높이 0.104 = 땅."""
    p = _guard_pose()
    p['ik'] = {'foot_l': (lx, 0.03, lz), 'foot_r': (rx, 0.03, rz)}
    p['pelvis'] = (px, 0.0, -0.03)
    return p


def _strafe_l():
    """왼쪽 옆걸음(잠금 겨눔 이동) — 왼발이 옆으로 나가 딛고, 오른발이 따라 붙는다. 두 걸음이 한 바퀴. 몸은 게임이 옮긴다.
    딛은 발은 몸 기준으로 반대(오른)쪽으로 미끄러지고 든 발은 빠르게 왼쪽으로 간다."""
    k0 = _strafe_pose(0.12, 0.104, -0.12, 0.104, 0.0)
    k1 = _strafe_pose(0.30, 0.20, -0.12, 0.104, -0.02)    # 왼발 듦
    k2 = _strafe_pose(0.30, 0.104, -0.14, 0.104, 0.05)    # 왼발 딛음, 체중 왼쪽
    k3 = _strafe_pose(0.22, 0.104, 0.06, 0.20, 0.05)      # 오른발 듦(따라 붙는 중)
    k4 = _strafe_pose(0.20, 0.104, 0.02, 0.104, 0.02)     # 오른발 딛음
    return True, [(0, k0), (10, k1), (20, k2), (30, k3), (40, k4), (48, k0)]


def _strafe_r():
    """오른쪽 옆걸음 — 왼쪽 옆걸음의 좌우 대칭."""
    loop, keys = _strafe_l()
    return loop, [(f, mirror(p)) for f, p in keys]


# ---------- 전투 동작 추가 (K-0029) ----------
# 좌표 = (왼쪽, 앞, 위) m, 오른손잡이. 몸을 오른쪽으로 틀면(yaw -) 왼발·왼어깨가 앞이다.
def _spear_idle():
    """창 들고 서기 — 몸을 옆으로 틀고 오른손은 허리 뒤에서 자루를, 왼손은 앞에서 받친다. 숨 쉬며 흔들린다."""
    feet = {'foot_l': (0.16, 0.18, 0.104), 'foot_r': (-0.16, -0.16, 0.104)}

    def k(b):
        return P(base=('Idle_Loop', 0), yaw=-30, pelvis=(0, 0, -0.04 - b),
                 dirs={'spine_03': (0, 0.05, 1), 'neck_01': (0, 0.05, 1)},
                 pole={'hand_l': (0.6, -0.2, -1), 'hand_r': (-0.4, -1, -0.3)},
                 ik={'hand_l': (0.12, 0.50, 1.18), 'hand_r': (-0.22, 0.14, 1.02), **feet})
    return True, [(0, k(0)), (30, k(0.010)), (60, k(0))]


def _spear_thrust():
    """창 찌르기 — 두 손을 뒤로 당겨 무게를 뒷발에 싣고(준비), 앞발로 내딛으며 두 손을 곧게 앞으로 뻗어 찌른 뒤 되돌린다."""
    feet = {'foot_l': (0.16, 0.18, 0.104), 'foot_r': (-0.16, -0.16, 0.104)}
    pole = {'hand_l': (0.6, -0.2, -1), 'hand_r': (-0.4, -1, -0.3)}
    ready = P(base=('Idle_Loop', 0), yaw=-30, pelvis=(0, -0.05, -0.04), pole=pole,
              ik={'hand_l': (0.12, 0.50, 1.18), 'hand_r': (-0.22, 0.14, 1.02), **feet})
    wind = P(base=('Idle_Loop', 0), yaw=-42, pelvis=(0, -0.12, -0.10),
             dirs={'spine_01': (0, -0.08, 1), 'spine_02': (0, -0.10, 1), 'spine_03': (0, -0.10, 1)}, pole=pole,
             ik={'hand_l': (0.08, 0.30, 1.14), 'hand_r': (-0.26, -0.12, 1.02),
                 'foot_l': (0.16, 0.14, 0.104), 'foot_r': (-0.16, -0.22, 0.104)})
    thrust = P(base=('Idle_Loop', 0), yaw=-18, pelvis=(0, 0.22, -0.14),
               dirs={'spine_01': (0, 0.14, 1), 'spine_02': (0, 0.18, 1), 'spine_03': (0, 0.16, 1), 'neck_01': (0, 0.08, 1)}, pole=pole,
               ik={'hand_l': (0.10, 0.84, 1.20), 'hand_r': (-0.12, 0.52, 1.16),
                   'foot_l': (0.16, 0.42, 0.104), 'foot_r': (-0.16, -0.22, 0.104)})
    return False, [(0, ready), (8, wind), (13, thrust), (18, thrust), (30, ready)]


def _axe_chop():
    """도끼 내려찍기 — 두 손을 머리 뒤로 높이 들고 몸을 뒤로 젖혔다가(준비), 체중을 실어 앞으로 쏟아지며 찍어 내리고 숙인 채 멈춘다."""
    feet = {'foot_l': (0.15, 0.12, 0.104), 'foot_r': (-0.15, -0.14, 0.104)}
    pole = {'hand_l': (0.8, -0.3, -0.2), 'hand_r': (-0.8, -0.3, -0.2)}
    idle = P(base=('Idle_Loop', 0), pelvis=(0, 0, -0.03),
             ik={'hand_l': (0.12, 0.30, 1.05), 'hand_r': (-0.18, 0.20, 1.00), **feet}, pole=pole)
    up = P(base=('Idle_Loop', 0), pelvis=(0, -0.08, -0.04),
           dirs={'spine_01': (0, -0.10, 1), 'spine_02': (0, -0.16, 1), 'spine_03': (0, -0.20, 1), 'neck_01': (0, -0.15, 1)}, pole=pole,
           ik={'hand_l': (0.10, -0.02, 1.98), 'hand_r': (-0.12, -0.10, 1.90), **feet})
    chop = P(base=('Idle_Loop', 0), pelvis=(0, 0.18, -0.20),
             dirs={'spine_01': (0, 0.25, 1), 'spine_02': (0, 0.35, 1), 'spine_03': (0, 0.35, 1), 'neck_01': (0, 0.20, 1)}, pole=pole,
             ik={'hand_l': (0.10, 0.58, 0.82), 'hand_r': (-0.12, 0.52, 0.80),
                 'foot_l': (0.15, 0.30, 0.104), 'foot_r': (-0.15, -0.16, 0.104)})
    return False, [(0, idle), (10, up), (14, up), (19, chop), (30, chop), (44, idle)]


def _dagger_slash(flip=False):
    """단검 베기 — 오른손이 어깨 높이 뒤에서 대각으로 빠르게 가로질러 내려가고, 왼손은 가슴 앞을 지킨다(B 는 반대 방향)."""
    feet = {'foot_l': (0.14, 0.16, 0.104), 'foot_r': (-0.16, -0.10, 0.104)}
    pole = {'hand_l': (0.6, -0.4, -0.5), 'hand_r': (-0.6, -0.5, -0.2)}
    guard = {'hand_l': (0.16, 0.30, 1.22)}
    idle = P(base=('Idle_Loop', 0), yaw=-20, pelvis=(0, 0, -0.07), pole=pole,
             ik={'hand_r': (-0.22, 0.28, 1.12), **guard, **feet})
    if not flip:
        a = P(base=('Idle_Loop', 0), yaw=-50, pelvis=(0, -0.06, -0.10), pole=pole,
              dirs={'spine_03': (-0.1, 0, 1)},
              ik={'hand_r': (-0.42, 0.02, 1.62), **guard, **feet})
        b = P(base=('Idle_Loop', 0), yaw=22, pelvis=(0, 0.14, -0.13), pole=pole,
              dirs={'spine_01': (0, 0.10, 1), 'spine_02': (0, 0.14, 1), 'spine_03': (0.1, 0.14, 1)},
              ik={'hand_r': (0.22, 0.52, 0.96), **guard,
                  'foot_l': (0.14, 0.30, 0.104), 'foot_r': (-0.16, -0.10, 0.104)})
    else:
        a = P(base=('Idle_Loop', 0), yaw=30, pelvis=(0, -0.04, -0.10), pole=pole,
              ik={'hand_r': (0.30, 0.20, 1.18), **guard, **feet})
        b = P(base=('Idle_Loop', 0), yaw=-48, pelvis=(0, 0.14, -0.12), pole=pole,
              dirs={'spine_01': (0, 0.10, 1), 'spine_02': (0, 0.12, 1), 'spine_03': (-0.1, 0.12, 1)},
              ik={'hand_r': (-0.50, 0.42, 1.18), **guard,
                  'foot_l': (0.14, 0.30, 0.104), 'foot_r': (-0.16, -0.10, 0.104)})
    return False, [(0, idle), (6, a), (10, b), (14, b), (24, idle)]


def _dagger_slash_a():
    return _dagger_slash(False)


def _dagger_slash_b():
    return _dagger_slash(True)


def _sword_slash_b():
    """검 되베기 — 오른손 칼을 왼쪽 아래에서 어깨 높이로 뒤집어 올려 베며 오른쪽으로 쓸어 가고 몸이 따라 돈다."""
    feet = {'foot_l': (0.15, 0.14, 0.104), 'foot_r': (-0.15, -0.14, 0.104)}
    pole = {'hand_l': (0.6, -0.3, -0.5), 'hand_r': (-0.7, -0.5, -0.2)}
    ready = P(base=('Sword_Idle', 0), pelvis=(0, 0, -0.04),
              keep_world=('upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r'),
              ik={'foot_l': (0.13, 0.05, 0.104), 'foot_r': (-0.13, -0.05, 0.104)})
    back = P(base=('Idle_Loop', 0), yaw=38, pelvis=(0, -0.04, -0.09), pole=pole,
             ik={'hand_r': (0.42, 0.30, 1.10), 'hand_l': (0.12, 0.28, 1.14), **feet})
    cut = P(base=('Idle_Loop', 0), yaw=-52, pelvis=(0, 0.14, -0.12), pole=pole,
            dirs={'spine_01': (0, 0.10, 1), 'spine_02': (0, 0.12, 1), 'spine_03': (-0.1, 0.12, 1)},
            ik={'hand_r': (-0.55, 0.48, 1.22), 'hand_l': (0.02, 0.36, 1.18),
                'foot_l': (0.15, 0.30, 0.104), 'foot_r': (-0.15, -0.14, 0.104)})
    return False, [(0, ready), (7, back), (12, cut), (17, cut), (30, ready)]


def _victory():
    """승리 — 숨을 모은 뒤 두 팔을 V 로 번쩍 들며 가슴을 펴고 살짝 뛰어 오르듯 서 있다가 내려온다."""
    feet = {'foot_l': (0.16, 0.04, 0.104), 'foot_r': (-0.16, 0.0, 0.104)}
    pole = {'hand_l': (1, -0.1, -0.2), 'hand_r': (-1, -0.1, -0.2)}
    idle = P(base=('Idle_Loop', 0), pelvis=(0, 0, -0.06),
             ik={'hand_l': (0.28, 0.04, 0.92), 'hand_r': (-0.28, 0.04, 0.92), **feet})
    up = P(base=('Idle_Loop', 0), pelvis=(0, 0, 0.0),
           dirs={'spine_01': (0, -0.04, 1), 'spine_02': (0, -0.08, 1), 'spine_03': (0, -0.10, 1), 'neck_01': (0, -0.10, 1),
                 'clavicle_l': (1, -0.2, 0.2), 'clavicle_r': (-1, -0.2, 0.2)}, pole=pole,
           ik={'hand_l': (0.55, 0.10, 2.0), 'hand_r': (-0.55, 0.10, 2.0), **feet})
    up2 = dict(up, pelvis=(0, 0, 0.03))
    return False, [(0, idle), (10, up), (16, up2), (24, up), (50, up), (66, idle)]


def _taunt():
    """도발(K-0066) — 숨을 들이켜 몸을 젖히며 왼팔 방패를 머리 위로 치켜들었다가 가슴을 펴고 버틴 뒤 내린다. 오른손 칼은 허리 옆, 발은 그 자리(한 번 재생)."""
    feet = {'foot_l': (0.18, 0.06, 0.104), 'foot_r': (-0.16, -0.04, 0.104)}
    fdir = {'foot_l': (0.05, 1, -0.6), 'foot_r': (-0.05, 1, -0.6)}
    idle = P(base=('Sword_Idle', 0), pelvis=(0, 0, -0.02),
             dirs=dict(fdir, hand_l=(0.1, 0.3, -1), hand_r=(0, 1, 0.1)),
             ik={'hand_l': (0.25, 0.08, 0.96), 'hand_r': (-0.25, 0.10, 0.99), **feet})
    wind = P(base=('Sword_Idle', 0), pelvis=(0, 0.02, -0.07),
             dirs=dict(fdir, spine_02=(0, 0.10, 1), spine_03=(0, 0.12, 1), neck_01=(0, 0.14, 1), hand_l=(0.2, 0.5, -0.6), hand_r=(0, 1, 0.1)),
             ik={'hand_l': (0.30, 0.18, 0.88), 'hand_r': (-0.25, 0.10, 0.99), **feet})
    up = P(base=('Sword_Idle', 0), pelvis=(0, -0.01, 0.0),
           dirs=dict(fdir, spine_01=(0, -0.04, 1), spine_02=(0, -0.08, 1), spine_03=(0, -0.12, 1), neck_01=(0, -0.20, 1),
                     clavicle_l=(1, -0.2, 0.2), hand_l=(0.25, 0.2, 1), hand_r=(0, 1, 0.1)),
           pole={'hand_l': (1, -0.1, -0.2)},
           ik={'hand_l': (0.42, 0.14, 1.98), 'hand_r': (-0.25, 0.10, 0.99), **feet})
    up2 = dict(up, pelvis=(0, -0.01, 0.025), ik={'hand_l': (0.44, 0.14, 2.02), 'hand_r': (-0.25, 0.10, 0.99), **feet})
    return False, [(0, idle), (8, wind), (16, up), (22, up2), (30, up), (44, up2), (58, idle)]


def _stun_loop():
    """기절·비틀 — 무릎이 풀려 낮아지고 상체가 앞으로 처져 머리가 떨궈지며, 두 팔은 늘어져 좌우로 천천히 휘청인다."""
    def k(sway, dip):
        return P(base=('Idle_Loop', 0), pelvis=(sway * 0.05, 0.02, -0.14 - dip),
                 dirs={'pelvis': (sway, 0.08, 1), 'spine_01': (sway * 1.5, 0.22, 1), 'spine_02': (sway * 2, 0.30, 1),
                       'spine_03': (sway * 2, 0.28, 1), 'neck_01': (sway, 0.55, 1)},
                 pole={'hand_l': (1, -0.5, 0), 'hand_r': (-1, -0.5, 0)},
                 ik={'hand_l': (0.26 + sway * 0.05, 0.16, 0.62), 'hand_r': (-0.26 + sway * 0.05, 0.12, 0.62),
                     'foot_l': (0.18, 0.04, 0.104), 'foot_r': (-0.18, -0.04, 0.104)})
    return True, [(0, k(0.0, 0)), (20, k(0.12, 0.02)), (40, k(0.0, 0)), (60, k(-0.12, 0.02)), (80, k(0.0, 0))]


def _hit_back():
    """뒤에서 맞음 — 등을 맞아 가슴이 앞으로 튀어 나가고 머리가 젖혀지며 팔이 뒤로 휘둘린 뒤 비틀거리며 돌아온다."""
    feet = {'foot_l': (0.14, 0.06, 0.104), 'foot_r': (-0.14, -0.04, 0.104)}
    pole = {'hand_l': (1, -0.3, -0.3), 'hand_r': (-1, -0.3, -0.3)}
    idle = P(base=('Idle_Loop', 0), ik={'hand_l': (0.26, 0.04, 0.90), 'hand_r': (-0.26, 0.04, 0.90), **feet}, pole=pole)
    hit = P(base=('Idle_Loop', 0), pelvis=(0, 0.10, -0.06),
            dirs={'pelvis': (0, -0.10, 1), 'spine_01': (0, -0.22, 1), 'spine_02': (0, -0.30, 1), 'spine_03': (0, -0.34, 1),
                  'neck_01': (0, -0.45, 1)}, pole=pole,
            ik={'hand_l': (0.34, -0.22, 1.00), 'hand_r': (-0.34, -0.22, 1.00),
                'foot_l': (0.14, 0.18, 0.104), 'foot_r': (-0.14, -0.04, 0.104)})
    return False, [(0, idle), (4, hit), (9, hit), (22, idle)]


def _mantle():
    """턱 넘어 오르기(0.4s) — 두 손이 턱 위(앞 0.30m·높이 1.78m)를 잡고 매달린 데서 몸을 끌어올려 팔을 펴 밀고, 한 발씩 올라서 선다.
    몸 위치는 게임(CharacterController)이 옮긴다 — 클립은 몸 안 자세만."""
    lean = {'pelvis': (0, 0.14, 1), 'spine_01': (0, 0.14, 1), 'spine_02': (0, 0.10, 1), 'spine_03': (0, 0.06, 1), 'neck_01': (0, 0.0, 1),
            'foot_l': (0, 1, -0.3), 'foot_r': (0, 1, -0.3)}
    pole = {'hand_l': (1, -0.5, -0.6), 'hand_r': (-1, -0.5, -0.6), 'foot_l': (0.4, 1, 0), 'foot_r': (-0.4, 1, 0)}
    hang = P(base=('Idle_Loop', 0), pelvis=(0, 0.10, 0.0), dirs=lean, pole=pole,
             ik={'hand_l': (0.22, 0.30, 1.78), 'hand_r': (-0.22, 0.30, 1.78), 'foot_l': (0.12, 0.16, 0.34), 'foot_r': (-0.12, 0.14, 0.30)})
    pull_dirs = dict(lean, spine_01=(0, 0.32, 1), spine_02=(0, 0.34, 1), spine_03=(0, 0.28, 1), neck_01=(0, 0.1, 1))
    pull = P(base=('Idle_Loop', 0), pelvis=(0, 0.20, 0.28), dirs=pull_dirs, pole=pole,
             ik={'hand_l': (0.24, 0.34, 1.50), 'hand_r': (-0.24, 0.34, 1.50), 'foot_l': (0.12, 0.12, 0.56), 'foot_r': (-0.12, 0.10, 0.62)})
    push = P(base=('Idle_Loop', 0), pelvis=(0, 0.26, 0.46), dirs=dict(pull_dirs, spine_01=(0, 0.40, 1), spine_02=(0, 0.40, 1)), pole=pole,
             ik={'hand_l': (0.26, 0.30, 1.08), 'hand_r': (-0.26, 0.30, 1.08), 'foot_l': (0.12, 0.04, 0.70), 'foot_r': (-0.12, 0.18, 0.78)})
    stand = P(base=('Idle_Loop', 0), pelvis=(0, 0.10, 0.0),
              ik={'hand_l': (0.26, 0.04, 0.90), 'hand_r': (-0.26, 0.04, 0.90), **STAND_FEET})
    return False, [(0, hang), (4, pull), (8, push), (12, stand)]


def _burst():
    """폭발 시전(0.8s) — 무릎을 굽혀 두 손을 가슴 앞에 모아 기운을 죄고, 몸을 활처럼 펴며 두 팔을 양옆 위로 활짝 벌려 터뜨린 뒤 숨을 고른다."""
    feet = {'foot_l': (0.20, 0.04, 0.104), 'foot_r': (-0.20, 0.04, 0.104)}
    fdir = {'foot_l': (0.10, 1, -0.6), 'foot_r': (-0.10, 1, -0.6), 'clavicle_l': (1, -0.3, 0), 'clavicle_r': (-1, -0.3, 0)}
    idle = P(base=('Idle_Loop', 0), pelvis=(0, 0, -0.02), dirs=dict(fdir, hand_l=(0.05, 0.3, -1), hand_r=(-0.05, 0.3, -1)),
             ik={'hand_l': (0.28, 0.02, 0.90), 'hand_r': (-0.28, 0.02, 0.90), **feet})
    crouch = P(base=('Idle_Loop', 0), pelvis=(0, 0.04, -0.16),
               dirs=dict(fdir, spine_01=(0, 0.20, 1), spine_02=(0, 0.22, 1), spine_03=(0, 0.20, 1), neck_01=(0, 0.20, 1), hand_l=(-0.5, 0.6, 0.5), hand_r=(0.5, 0.6, 0.5)),
               pole={'hand_l': (1, -0.2, -0.6), 'hand_r': (-1, -0.2, -0.6)},
               ik={'hand_l': (0.06, 0.28, 1.02), 'hand_r': (-0.06, 0.28, 1.02), **feet})
    burst = P(base=('Idle_Loop', 0), pelvis=(0, -0.02, 0.03),
              dirs=dict(fdir, spine_01=(0, -0.10, 1), spine_02=(0, -0.16, 1), spine_03=(0, -0.20, 1), neck_01=(0, -0.30, 1), hand_l=(1, 0.1, 0.7), hand_r=(-1, 0.1, 0.7)),
              pole={'hand_l': (0.3, -0.5, -1), 'hand_r': (-0.3, -0.5, -1)},
              ik={'hand_l': (0.82, 0.05, 1.82), 'hand_r': (-0.82, 0.05, 1.82), **feet})
    hold = dict(burst, ik={'hand_l': (0.86, 0.04, 1.86), 'hand_r': (-0.86, 0.04, 1.86), **feet})
    return False, [(0, idle), (8, crouch), (14, burst), (22, hold), (34, idle)]


def _plunge():
    """낙하 공격 자세(루프) — 몸이 앞으로 기울고 두 손을 머리 위에 모아 무기를 아래로 겨누고, 다리는 곧게 모아 늘어뜨린다. 바람에 약간 떤다."""
    d = {'pelvis': (0, 0.35, 1), 'spine_01': (0, 0.30, 1), 'spine_02': (0, 0.25, 1), 'spine_03': (0, 0.18, 1), 'neck_01': (0, 0.20, 1),
         'hand_l': (0.05, 0.2, 1), 'hand_r': (-0.05, 0.2, 1), 'foot_l': (0.02, 0.1, -1), 'foot_r': (-0.02, 0.1, -1)}
    pole = {'hand_l': (1, -0.2, -0.3), 'hand_r': (-1, -0.2, -0.3), 'foot_l': (0.1, 1, 0), 'foot_r': (-0.1, 1, 0)}
    a = P(base=('Jump_Loop', 0), dirs=d, pole=pole,
          ik={'hand_l': (0.10, 0.22, 1.98), 'hand_r': (-0.10, 0.22, 1.98), 'foot_l': (0.08, -0.04, 0.16), 'foot_r': (-0.08, -0.06, 0.12)})
    b = P(base=('Jump_Loop', 30), dirs=d, pole=pole, pelvis=(0, 0, 0.02),
          ik={'hand_l': (0.12, 0.20, 2.00), 'hand_r': (-0.12, 0.20, 2.00), 'foot_l': (0.08, -0.07, 0.13), 'foot_r': (-0.08, -0.03, 0.17)})
    return True, [(0, a), (14, b), (28, a)]


CLIPS = {
    'CF_Guard_Idle_Loop': _guard_idle,
    'CF_Climb_Loop': _climb,
    'CF_Glide_Loop': _glide,
    'CF_Shield_Block': _block,
    'CF_Shield_Block_Hit': _block_hit,
    'CF_Bow_Idle_Loop': _bow_idle,
    'CF_Bow_Shoot': _bow_shoot,
    'CF_Kneel_Loop': _kneel,
    'CF_Heal': _heal,
    'CF_Strafe_L_Loop': _strafe_l,
    'CF_Strafe_R_Loop': _strafe_r,
    'CF_Spear_Idle_Loop': _spear_idle,
    'CF_Spear_Thrust': _spear_thrust,
    'CF_Axe_Chop': _axe_chop,
    'CF_Dagger_Slash_A': _dagger_slash_a,
    'CF_Dagger_Slash_B': _dagger_slash_b,
    'CF_Sword_Slash_B': _sword_slash_b,
    'CF_Victory': _victory,
    'CF_Taunt': _taunt,
    'CF_Stun_Loop': _stun_loop,
    'CF_Hit_Back': _hit_back,
    'CF_Mantle': _mantle,
    'CF_Burst': _burst,
    'CF_Plunge_Loop': _plunge,
}


# ---------- 굽기 ----------
def _world(v, axes):
    L, F, U = axes
    return L * v[0] + F * v[1] + U * v[2]


def _aim(arm, pb, target_dir):
    """pb 를 기준 자식 방향이 target_dir(월드)을 가리키게 최소 회전(비틀림 없음)."""
    child = rigmaps.REF_CHILD[pb.name]
    mw = arm.matrix_world
    h = mw @ pb.head
    c = mw @ arm.pose.bones[child].head
    cur = (c - h).normalized()
    q = cur.rotation_difference(target_dir.normalized())
    M = mw @ pb.matrix
    rot = q.to_matrix() @ M.to_3x3()
    new = Matrix.Translation(M.translation) @ rot.to_4x4()
    pb.matrix = mw.inverted() @ new
    bpy.context.view_layer.update()


def _two_bone(arm, upper, lower, end, target, pole):
    """두 마디 IK — upper 머리에서 end 머리가 target 에 오게 upper·lower 방향을 정한다."""
    mw = arm.matrix_world
    B = arm.data.bones
    a = ((mw @ B[lower].head_local) - (mw @ B[upper].head_local)).length
    b = ((mw @ B[end].head_local) - (mw @ B[lower].head_local)).length
    H = mw @ arm.pose.bones[upper].head
    d_vec = target - H
    d = max(1e-4, min(d_vec.length, (a + b) * 0.999))
    u = d_vec.normalized()
    cos_a = max(-1.0, min(1.0, (a * a + d * d - b * b) / (2 * a * d)))
    alpha = math.acos(cos_a)
    p = pole - u * pole.dot(u)
    p = p.normalized() if p.length > 1e-6 else Vector((0, 0, 1))
    K = H + (u * math.cos(alpha) + p * math.sin(alpha)) * a
    T = H + u * d
    _aim(arm, arm.pose.bones[upper], K - H)
    _aim(arm, arm.pose.bones[lower], T - (mw @ arm.pose.bones[lower].head))


def _sample_base(arm, acts, name, frame):
    act = acts[name]
    arm.animation_data.action = act
    if act.slots:
        arm.animation_data.action_slot = act.slots[0]
    f0, f1 = act.frame_range
    bpy.context.scene.frame_set(int(f0 + (frame % max(1, int(f1 - f0)))))
    out = {}
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        out[pb.name] = (pb.location.copy(), pb.rotation_quaternion.copy())
    return out


def add(arm, names):
    """arm(UAL 뼈대)에 names 중 CF_* 동작을 지어 `Rig|<이름>` 으로 더한다. 만든 동작 목록을 돌려준다."""
    names = [n for n in names if n in CLIPS]
    if not names:
        return []
    bpy.context.scene.render.fps = FPS
    arm.animation_data_create()
    acts = {a.name.split('|')[-1]: a for a in bpy.data.actions if a.name.startswith('Rig|')}
    keep_action, keep_slot = arm.animation_data.action, arm.animation_data.action_slot
    mw0 = arm.matrix_world.copy()
    B = arm.data.bones
    fwd = (mw0 @ B['ball_l'].head_local) - (mw0 @ B['foot_l'].head_local)
    fwd.z = 0
    F = fwd.normalized()
    U = Vector(UP)
    L = U.cross(F).normalized()
    if L.dot((mw0 @ B['foot_l'].head_local) - (mw0 @ B['foot_r'].head_local)) < 0:  # 왼발 쪽이 왼쪽
        L = -L
    axes = (L, F, U)
    origin = mw0 @ B['root'].head_local
    rest_pelvis = mw0 @ B['pelvis'].head_local
    made = []
    for name in names:
        loop, keys = CLIPS[name]()
        poses = []
        for f, p in keys:
            bn, bf = p.get('base', ('Idle_Loop', 0))
            poses.append((f, p, _sample_base(arm, acts, bn, bf)))
        act = bpy.data.actions.new('Rig|' + name)
        act.use_fake_user = True
        arm.animation_data.action = act
        prev_q = {}
        for f, p, base in poses:
            bpy.context.scene.frame_set(f)
            for pb in arm.pose.bones:
                pb.location, pb.rotation_quaternion = base[pb.name]
            bpy.context.view_layer.update()
            mw = arm.matrix_world
            kept = {n: (mw @ arm.pose.bones[n].matrix).to_3x3() for n in p['keep_world']}
            pel = arm.pose.bones['pelvis']
            M = mw @ pel.matrix
            t = rest_pelvis + _world(p.get('pelvis', (0, 0, 0)), axes)
            rot = Matrix.Rotation(math.radians(p.get('yaw', 0.0)), 3, U) @ M.to_3x3()
            pel.matrix = mw.inverted() @ (Matrix.Translation(t) @ rot.to_4x4())
            bpy.context.view_layer.update()
            for bone in ('pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'clavicle_l', 'clavicle_r'):
                if bone in p['dirs']:
                    _aim(arm, arm.pose.bones[bone], _world(p['dirs'][bone], axes))
            for n in p['keep_world']:   # 부모 먼저 적는다 — 자식은 부모를 되돌린 뒤의 머리 자리에서 방향만
                pb = arm.pose.bones[n]
                M = mw @ pb.matrix
                pb.matrix = mw.inverted() @ (Matrix.Translation(M.translation) @ kept[n].to_4x4())
                bpy.context.view_layer.update()
            for s in ('l', 'r'):
                for end, up_, lo_, dflt in ((f'hand_{s}', f'upperarm_{s}', f'lowerarm_{s}', POLE[f'hand_{s}']),
                                            (f'foot_{s}', f'thigh_{s}', f'calf_{s}', POLE[f'foot_{s}'])):
                    if end in p['ik']:
                        tgt = origin + _world(p['ik'][end], axes)
                        _two_bone(arm, up_, lo_, end, tgt, _world(p['pole'].get(end, dflt), axes))
                    if end in p['dirs']:
                        _aim(arm, arm.pose.bones[end], _world(p['dirs'][end], axes))
            for pb in arm.pose.bones:
                # 열쇠 사이는 쿼터니언 성분별 보간이다 — 앞 열쇠와 부호가 반대면 사이 프레임이 먼 길로 돈다(활 쏘기 84°/프레임, 09-25)
                q = pb.rotation_quaternion.copy()
                if pb.name in prev_q and prev_q[pb.name].dot(q) < 0:
                    q.negate()
                    pb.rotation_quaternion = q
                prev_q[pb.name] = q
                pb.keyframe_insert('rotation_quaternion', frame=f, group=pb.name)
                if pb.name in ('root', 'pelvis'):
                    pb.keyframe_insert('location', frame=f, group=pb.name)
        made.append(act)
    arm.animation_data.action = keep_action
    if keep_slot is not None:
        try:
            arm.animation_data.action_slot = keep_slot
        except (AttributeError, RuntimeError):
            pass
    return made
