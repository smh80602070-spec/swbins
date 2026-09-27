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
