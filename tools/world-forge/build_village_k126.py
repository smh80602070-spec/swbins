"""K-0126 새 마을·지물 12 — 1만리·2나락·5천하가 부르던 빌린 건물·소품 중 자체 짝이 없던 것(data/k126_pair_by_name.json 의 new:).
build_village.py 가 import 해서 VILLAGE 표에 붙인다(빌더·삼각형 예산·license 는 거기와 같다). 원점 = 바닥 가운데, 앞 = -y, 단위 m.
"""
import math

from mathutils import Vector

from build_prop import tube, obox, gable, node
from wf_shapes import ball


def _mats(C):
    return dict(
        st=C.s('castle_wall_slates', 1.4, '#a29d92'), dk=C.s('castle_wall_slates', 1.4, '#7f7a72'),
        brick=C.s('castle_wall_slates', 1.2, '#9a5b45'), jst=C.s('japanese_stone_wall', 1.2),
        wd=C.s('brown_planks_03', 1.0, '#7a5634'), dw=C.s('black_painted_planks', 1.0),
        tile=C.s('clay_roof_tiles', 1.4, '#7a3a2a'), btile=C.s('clay_roof_tiles', 1.4, '#3d4f7a'), gtile=C.s('clay_roof_tiles', 1.4, '#5a6a6e'),
        iron=C.s('concrete_wall_001', 1.0, '#3a3d44'), bronze=C.s('concrete_wall_001', 1.0, '#8c6a3a', gain=1.2),
        fire=C.s('clay_roof_tiles', 1.0, '#ff8a2a', gain=1.7), glow=C.s('beige_wall_001', 1.0, '#ffd37a', gain=1.4),
        mud=C.s('brown_mud', 1.5, '#7a5a3e'), cloth=C.s('white_stucco', 1.0, '#b5453a'))


def smithy_01(C):
    """대장간 — 돌 몸채 + 기와 박공 + 앞 처마(기둥 둘) 아래 화덕·모루·물통, 돌 굴뚝."""
    M, m = C.M, _mats(C)
    obox(M, (0, 0.6, 0), (5.2, 3.6, 0.3), 0, m['dk'], 1.2)
    obox(M, (0, 0.8, 0.3), (5.0, 3.2, 2.4), 0, m['st'], 1.2)
    gable(M, (0, 0.8, 2.7), (5.6, 3.8), 1.6, 90, m['tile'], 1.4)
    obox(M, (-0.9, -0.82, 0.3), (1.0, 0.12, 1.9), 0, m['dw'])                              # 문
    obox(M, (0, -1.6, 2.35), (5.2, 1.9, 0.12), 0, m['wd'])                                 # 앞 처마 판
    for sx in (-2.4, 2.4):
        tube(M, (sx, -2.45, 0.0), (sx, -2.45, 2.35), 0.12, 0.11, m['wd'], 1.0, 6)
    obox(M, (1.3, -1.4, 0.0), (1.4, 1.1, 0.9), 0, m['dk'], 1.0)                             # 화덕
    obox(M, (1.3, -1.4, 0.9), (0.9, 0.7, 0.12), 0, m['fire'])                              # 불
    obox(M, (1.3, 0.35, 2.4), (0.8, 0.8, 2.6), 0, m['dk'], 1.0)                             # 굴뚝(지붕 뚫고)
    obox(M, (-0.6, -1.9, 0.0), (0.35, 0.35, 0.55), 0, m['wd'])                             # 모루 받침
    obox(M, (-0.6, -1.9, 0.55), (0.75, 0.28, 0.22), 0, m['iron'])                          # 모루
    tube(M, (-0.98, -1.9, 0.66), (-1.22, -1.9, 0.7), 0.1, 0.02, m['iron'], 0.3, 6)         # 모루 뿔
    tube(M, (-1.9, -1.8, 0.0), (-1.9, -1.8, 0.6), 0.32, 0.34, m['wd'], 0.6, 8)              # 물통


def tower_square_01(C):
    """네모난 벽돌 탑 — 넓은 기단, 좁은 창, 위 총안 성가퀴."""
    M, m = C.M, _mats(C)
    obox(M, (0, 0, 0), (3.6, 3.6, 0.6), 0, m['dk'], 1.2)
    obox(M, (0, 0, 0.6), (3.0, 3.0, 8.2), 0, m['brick'], 1.0)
    obox(M, (0, 0, 8.8), (3.5, 3.5, 0.4), 0, m['dk'], 1.0)                                 # 처마 띠
    for k in range(4):
        for j in (-1, 0, 1):
            a = k * 90
            c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
            x, y = c * 1.55 - s * j * 1.1, s * 1.55 + c * j * 1.1
            obox(M, (x, y, 9.2), (0.55, 0.55, 0.7), a, m['brick'], 1.0)                   # 성가퀴
    for z in (2.6, 5.2, 7.2):
        obox(M, (0, -1.52, z), (0.28, 0.1, 0.9), 0, m['dw'])                               # 창 틈
        obox(M, (1.52, 0, z + 0.6), (0.1, 0.28, 0.9), 0, m['dw'])
    obox(M, (0, -1.52, 0.6), (1.0, 0.12, 1.9), 0, m['dw'])                                 # 문


def tower_pointy_01(C):
    """뾰족 지붕 둥근 탑 — 돌 원통 + 푸른 원뿔 지붕 + 처마 띠 + 창."""
    M, m = C.M, _mats(C)
    tube(M, (0, 0, 0), (0, 0, 0.5), 1.75, 1.7, m['dk'], 1.2, 12)
    tube(M, (0, 0, 0.5), (0, 0, 7.4), 1.45, 1.35, m['st'], 1.2, 12)
    tube(M, (0, 0, 7.3), (0, 0, 7.6), 1.62, 1.62, m['dw'], 1.0, 12)
    tube(M, (0, 0, 7.6), (0, 0, 11.4), 1.85, 0.05, m['btile'], 1.2, 12)
    tube(M, (0, 0, 11.3), (0, 0, 12.0), 0.06, 0.01, m['iron'], 0.3, 5)                     # 끝 쇠
    for z, a in ((2.4, -90), (4.6, 30), (6.3, 150)):
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        obox(M, (c * 1.42, s * 1.42, z), (0.45, 0.2, 0.75), a + 90, m['dw'])
    obox(M, (0, -1.42, 0.5), (0.95, 0.2, 1.8), 0, m['dw'])


def watchtower_01(C):
    """나무 망루 — 기둥 넷·엇갈린 버팀대·5m 마루·난간·작은 박공 지붕·사다리."""
    M, m = C.M, _mats(C)
    P = [(-1.1, -1.1), (1.1, -1.1), (1.1, 1.1), (-1.1, 1.1)]
    for x, y in P:
        tube(M, (x * 1.15, y * 1.15, 0), (x, y, 7.4), 0.13, 0.11, m['wd'], 1.0, 6)
    for i in range(4):
        (x0, y0), (x1, y1) = P[i], P[(i + 1) % 4]
        tube(M, (x0 * 1.1, y0 * 1.1, 0.6), (x1 * 1.02, y1 * 1.02, 4.6), 0.06, 0.06, m['wd'], 1.0, 4)   # 엇갈린 버팀대
        tube(M, (x0, y0, 2.6), (x1, y1, 2.6), 0.06, 0.06, m['wd'], 1.0, 4)
    obox(M, (0, 0, 5.0), (2.8, 2.8, 0.2), 0, m['wd'])                                     # 마루
    for i in range(4):
        (x0, y0), (x1, y1) = P[i], P[(i + 1) % 4]
        tube(M, (x0 * 1.22, y0 * 1.22, 6.0), (x1 * 1.22, y1 * 1.22, 6.0), 0.05, 0.05, m['dw'], 1.0, 4)  # 난간
    gable(M, (0, 0, 7.4), (3.2, 3.2), 1.1, 0, m['tile'], 1.2)
    for z in range(1, 10):
        tube(M, (-0.35, -1.5, z * 0.5), (0.35, -1.5, z * 0.5), 0.03, 0.03, m['wd'], 0.5, 4)   # 사다리 가로대
    for sx in (-0.35, 0.35):
        tube(M, (sx, -1.55, 0), (sx, -1.45, 5.0), 0.04, 0.04, m['wd'], 1.0, 4)


def tower_ruin_01(C):
    """무너진 둥근 탑 — 아래 원통 + 위로 갈수록 빠진 돌 덩이 둘레 + 둘레에 떨어진 돌."""
    M, m = C.M, _mats(C)
    tube(M, (0, 0, 0), (0, 0, 2.8), 1.7, 1.6, m['st'], 1.2, 12)
    rnd = [0.0, 1.2, 2.6, 3.8, 2.0, 0.6, 0.0, 1.8, 3.2, 4.4, 2.4, 0.9]                       # 칸마다 남은 높이
    for k, h in enumerate(rnd):
        if h <= 0:
            continue
        a = 360 * k / 12
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        obox(M, (c * 1.48, s * 1.48, 2.8), (0.82, 0.42, h), a + 90, m['dk'] if k % 2 else m['st'], 1.0)
    for x, y, sz in ((2.4, -1.0, 0.5), (-2.2, -1.6, 0.4), (1.2, 2.3, 0.6), (-2.6, 1.0, 0.35), (2.9, 0.8, 0.3)):
        obox(M, (x, y, 0), (sz * 1.3, sz, sz * 0.8), x * 40, m['st'], 1.0)
    obox(M, (0, -1.6, 0), (0.9, 0.3, 1.7), 0, m['dw'])


def stone_arch_01(C):
    """돌 아치 문 — 기둥 둘 + 반원 홍예석 9 + 이맛돌, 폭 4m·키 5m."""
    M, m = C.M, _mats(C)
    W, R, D = 1.9, 1.5, 0.8
    for sx in (-1, 1):
        obox(M, (sx * W, 0, 0), (1.0, D + 0.2, 0.4), 0, m['dk'], 1.0)
        obox(M, (sx * W, 0, 0.4), (0.8, D, 2.6), 0, m['st'], 1.0)
    zc = 3.0
    n = 9
    for k in range(n):
        a0, a1 = math.pi * k / n, math.pi * (k + 1) / n
        p = lambda r, a: Vector((math.cos(a) * r, D / 2, zc + math.sin(a) * r))   # 깊이를 -y 로 — u×v 가 바깥(w) 쪽인 오른손계
        o = p(R, a0)
        u = p(R, a1) - o
        w = p(R + 0.8, a0) - o
        M.box(o, u, Vector((0, -D, 0)), w, m['dk'] if k == n // 2 else m['st'], 1.0)
    obox(M, (0, 0, zc + R + 0.75), (W * 2 + 0.9, D + 0.1, 0.35), 0, m['dk'], 1.0)         # 위 갓돌


def pavilion_01(C):
    """정자 — 돌 기단(팔각) · 기둥 여섯 · 육각 기와 지붕 · 꼭대기 장식 · 난간."""
    M, m = C.M, _mats(C)
    tube(M, (0, 0, 0), (0, 0, 0.45), 2.6, 2.5, m['jst'], 1.2, 8)
    obox(M, (0, -2.75, 0), (1.0, 0.6, 0.22), 0, m['jst'], 1.0)                              # 디딤돌
    for k in range(6):
        a = 2 * math.pi * k / 6 + math.pi / 6
        tube(M, (math.cos(a) * 2.0, math.sin(a) * 2.0, 0.45), (math.cos(a) * 2.0, math.sin(a) * 2.0, 2.9), 0.12, 0.11, m['wd'], 1.0, 6)
        b = 2 * math.pi * (k + 1) / 6 + math.pi / 6
        if k != 4:
            tube(M, (math.cos(a) * 2.0, math.sin(a) * 2.0, 1.0), (math.cos(b) * 2.0, math.sin(b) * 2.0, 1.0), 0.05, 0.05, m['dw'], 1.0, 4)
    tube(M, (0, 0, 2.85), (0, 0, 3.05), 2.55, 2.55, m['dw'], 1.0, 6)
    tube(M, (0, 0, 3.05), (0, 0, 4.7), 3.0, 0.15, m['gtile'], 1.2, 6)
    tube(M, (0, 0, 4.6), (0, 0, 5.2), 0.18, 0.02, m['bronze'], 0.4, 6)


def bell_pavilion_01(C):
    """종각 — 돌 기단 · 기둥 넷 · 들보 · 매달린 청동 종 · 네모뿔 기와 지붕."""
    M, m = C.M, _mats(C)
    obox(M, (0, 0, 0), (4.2, 4.2, 0.5), 0, m['jst'], 1.2)
    for x, y in ((-1.6, -1.6), (1.6, -1.6), (1.6, 1.6), (-1.6, 1.6)):
        tube(M, (x, y, 0.5), (x, y, 4.0), 0.16, 0.15, m['wd'], 1.0, 6)
    obox(M, (0, 0, 3.7), (3.6, 0.3, 0.3), 0, m['dw'])                                     # 들보
    tube(M, (0, 0, 3.7), (0, 0, 3.4), 0.05, 0.05, m['iron'], 0.3, 4)
    tube(M, (0, 0, 3.4), (0, 0, 1.9), 0.42, 0.68, m['bronze'], 0.6, 12)                    # 종
    tube(M, (0, 0, 1.9), (0, 0, 1.78), 0.7, 0.7, m['bronze'], 0.6, 12)
    obox(M, (0, 0, 4.0), (4.0, 4.0, 0.25), 0, m['dw'])
    tube(M, (0, 0, 4.25), (0, 0, 6.2), 3.4, 0.12, m['gtile'], 1.2, 4)                       # 네모뿔(45도)


def wayside_shrine_01(C):
    """길가 사당 — 돌 받침 + 작은 나무 감실(박공) + 앞 공물대·작은 등."""
    M, m = C.M, _mats(C)
    obox(M, (0, 0, 0), (1.3, 1.1, 0.3), 0, m['jst'], 1.0)
    obox(M, (0, 0, 0.3), (0.9, 0.8, 0.9), 0, m['jst'], 1.0)
    obox(M, (0, 0.05, 1.2), (0.85, 0.7, 0.75), 0, m['wd'])
    obox(M, (0, -0.31, 1.3), (0.5, 0.06, 0.55), 0, m['dw'])                                # 감실 문 안
    obox(M, (0, -0.34, 1.45), (0.18, 0.04, 0.24), 0, m['glow'])                            # 안의 빛
    gable(M, (0, 0.05, 1.95), (1.1, 1.0), 0.45, 0, m['tile'], 1.0)
    obox(M, (0, -0.75, 0), (0.6, 0.3, 0.45), 0, m['jst'], 1.0)                              # 공물대
    tube(M, (0.18, -0.75, 0.45), (0.18, -0.75, 0.6), 0.04, 0.035, m['glow'], 0.3, 6)


def earth_lodge_01(C):
    """흙집(한증막) — 반구 흙 둔덕 + 앞 굴 입구 + 꼭대기 연기 구멍 테."""
    M, m = C.M, _mats(C)
    n = 7
    for i in range(n):
        a0, a1 = math.pi / 2 * i / n, math.pi / 2 * (i + 1) / n
        tube(M, (0, 0, 2.2 * math.sin(a0)), (0, 0, 2.2 * math.sin(a1)), 3.0 * math.cos(a0) + 0.05, max(0.25, 3.0 * math.cos(a1)), m['mud'], 1.5, 12, caps=(i == n - 1))
    tube(M, (0, 0, 2.15), (0, 0, 2.35), 0.32, 0.28, m['wd'], 0.5, 8)                       # 연기 구멍 테
    obox(M, (0, -2.9, 0), (1.3, 1.6, 1.3), 0, m['mud'], 1.2)                               # 굴 입구
    obox(M, (0, -3.72, 0), (0.75, 0.08, 1.0), 0, m['dw'])
    for sx in (-0.62, 0.62):
        tube(M, (sx, -3.72, 0), (sx, -3.72, 1.35), 0.07, 0.06, m['wd'], 1.0, 5)
    obox(M, (0, -3.72, 1.3), (1.5, 0.16, 0.14), 0, m['wd'])


def spike_trap_01(C):
    """가시 덫 바닥 — 2×2m 쇠 판 + 구멍 테 + 가시 4×4(바닥 원점, 위로 0.5m)."""
    M, m = C.M, _mats(C)
    obox(M, (0, 0, 0), (2.0, 2.0, 0.12), 0, m['dk'], 1.0)
    obox(M, (0, 0, 0.12), (1.8, 1.8, 0.04), 0, m['iron'])
    for i in range(4):
        for j in range(4):
            x, y = -0.66 + i * 0.44, -0.66 + j * 0.44
            tube(M, (x, y, 0.14), (x, y, 0.62 - 0.06 * ((i + j) % 2)), 0.07, 0.0, m['iron'], 0.3, 5)


def torch_wall_01(C):
    """벽 횃불 — 벽(y=0)에 붙는 쇠 판 + 앞(-y)으로 나온 팔 + 불 그릇 + 불꽃. 원점 = 벽에 붙는 판 아래 가운데."""
    M, m = C.M, _mats(C)
    obox(M, (0, 0.03, 0), (0.22, 0.06, 0.42), 0, m['iron'])
    tube(M, (0, 0.0, 0.2), (0, -0.32, 0.36), 0.03, 0.03, m['iron'], 0.3, 5)
    tube(M, (0, -0.36, 0.18), (0, -0.36, 0.5), 0.045, 0.05, m['wd'], 0.4, 6)               # 횃대
    tube(M, (0, -0.36, 0.45), (0, -0.36, 0.6), 0.07, 0.12, m['iron'], 0.4, 8)              # 불 그릇
    tube(M, (0, -0.36, 0.58), (0, -0.36, 0.95), 0.1, 0.0, C.glow('glow_fire'), 1.0, 6)   # K-0155 불꽃 (옛 m['fire'])
    node('light_point', (0, -0.36, 0.67))


K126 = {f.__name__: f for f in (smithy_01, tower_square_01, tower_pointy_01, watchtower_01, tower_ruin_01, stone_arch_01, pavilion_01,
                                 bell_pavilion_01, wayside_shrine_01, earth_lodge_01, spike_trap_01, torch_wall_01)}
