"""K-0125 2단계 — 1만리 이야기 지역(saga-go/js/{frost,crossing,skyport,sunken,amber,vault,fork}.js)이 코드 상자로 짓던 랜드마크 20(1차).
build_village.py 가 import 해서 VILLAGE 표에 붙인다(빌더·삼각형 예산·license 는 거기와 같다). 원점 = 바닥 가운데, 앞 = -y, z 위, 단위 m.

규칙(티켓 K-0125 · 페이블 판단 10-16): **정적 몸만** — 도는 고리·바늘·빛줄기·여닫는 문·숨겼다 보이는 종 같은 부품은 웹 코드가 위에 얹는다.
비율은 옛 도형과 같게 — 웹은 AS.build(kind, seed, mul) 로 **높이**를 mul 에 맞추므로 가로:높이 비가 같아야 발자리가 그대로다.
옛 three 좌표(x, 위 y, z) → 여기 (x, -z, y). 옛 앞(+z) = 여기 앞(-y). 전체 퓨전 — 과거 몸에 현재·미래 한 점씩(빛 띠·전선·태양판).
  id(옛 js case)                      옛 크기(가로 × 깊이 × 높이 m)
  frost_fort_01(frost fort)           26 × 26 × 6.6     눈 성채 — 담 3.2·문루·망루 돌단
  frost_observatory_01(frost obs)     ~10 × 6.4 × 12.3  관측소 — 원통·돔·전파 탑(풍속계는 코드)
  frost_airship_wreck_01(frost ship)  23 × 6 × 6        추락 비행선 몸통(기울기·빛 날개는 코드)
  frost_cableway_01(frost cable)      16 × 2 × 9.2      삭도 탑 둘·줄·객차
  crossing_clocktower_01(clock)       3.4 × 3.4 × 16.2  시계탑(문자판 판만, 바늘은 코드)
  crossing_platform_01(platform)      6 × 60 × 4        간이역 — 선로·승강장·빛 지붕
  skyport_mooring_tower_01(port)      28 × 28 × 18      계류 탑·착륙판(도는 고리·빛 공은 코드)
  skyport_station_01(station)         20 × 6 × 3.7      승강장·녹슨 객차·간판
  sunken_palace_01(palace)            12 × 9 × 4.6      잠긴 정전(기단·기둥·맞배)
  sunken_lighthouse_01(lighthouse)    7.6 × 7.6 × 18.1  돌 등대(빛줄기는 코드)
  amber_clockshop_01(amber clock)     13.4 × 7.6 × 6.5  시계방(바늘은 코드)
  vault_seedvault_01(vault vault)     22.6 × 22.6 × 15  씨앗 금고 둥근 벽(남쪽 문 자리 비움 — 문은 코드)
  vault_granary_01(granary)           5.8 × 4.6 × 6     다락 곳간(문짝은 코드)
  fork_locomotive_01(loco)            8.6 × 3.2 × 5.5   멈춘 기관차(선로·김은 코드)
  statue_guard_01(statue ×4 지역)     3.2 × 3.2 × 4.75  창 든 석상(호박 고리는 코드)
  gate_light_pillars_01(gate ×3 지역) 9.8 × 2.6 × 12    빛 기둥 둘·경계비(보랏빛 막·돌문은 코드)
  castle_gate_01(fork gate)           35.5 × 4.2 × 7.6  성문 — 망루 둘·다리 지붕·담
  stone_pagoda_01(skyport temple)     4.2 × 4.2 × 6.95  삼층 돌탑
  bell_tower_01(fork tower)           5.2 × 6.8 × 10    돌 종탑 — 멈춘 종(격자 말뚝은 코드)
  drain_tower_01(amber tower)         16 × 14 × 18.3    배수 탑 — 합금 심·녹슨 다리·층판·크레인 팔(태엽 심장·호박 껍질은 코드)
"""
import math

from build_prop import tube, obox, gable, annulus
from wf_shapes import ball


def _m(C):
    return dict(
        st=C.s('castle_wall_slates', 1.2, '#9a9ea6'), stD=C.s('japanese_stone_wall', 1.2, '#6c7078'), jst=C.s('japanese_stone_wall', 1.2, '#8f939b'),
        snow=C.s('snow_02', 1.0), wd=C.s('brown_planks_03', 1.0, '#7a5838'), wdD=C.s('black_painted_planks', 1.0),
        roof=C.s('grey_roof_tiles', 1.0, '#5a6270'), tile=C.s('clay_roof_tiles', 1.0, '#8a4a36'), thatch=C.s('thatch_roof_angled', 1.0),
        plaster=C.s('white_stucco', 1.0, '#e6e0d2'), red=C.s('concrete_wall_001', 1.0, '#a8392e', gain=1.1),
        steel=C.s('concrete_wall_001', 1.0, '#8d96a2', gain=1.1), steelD=C.s('concrete_wall_001', 1.0, '#4c535c'),
        alloy=C.s('corrugated_iron', 1.0, '#b7bec8'), rust=C.s('corrugated_iron', 1.0, '#8a4e2c'),
        white=C.s('grey_plaster', 1.0, '#eef0f2', gain=1.15), glow=C.s('beige_wall_001', 1.0, '#9fe7ff', gain=1.5),
        amber=C.s('beige_wall_001', 1.0, '#f0a83a', gain=1.3), dark=C.s('black_painted_planks', 1.0, '#2a2d33'),
        moss=C.s('aerial_grass_rock', 1.0, '#6d7d5a'), pave=C.s('cobblestone_floor_01', 1.0, '#8c9096'), rock=C.s('cliff_side', 1.2, '#6f6a64'),
        yellow=C.s('concrete_wall_001', 1.0, '#e0b43a', gain=1.1), panel=C.s('concrete_wall_001', 1.0, '#2b3f5e', gain=1.2))


def B(M, x, z3, y, w, d, h, slot, yaw=0, tile=1.0):
    """옛 three 상자(가운데 x·z3, 바닥 y, 크기 w·d·h) → 여기. 옛 앞(+z) = 여기 -y."""
    obox(M, (x, -z3, y), (w, d, h), yaw, slot, tile)


def T(M, x, z3, y0, y1, r0, r1, slot, n=10, caps=True):
    """옛 세운 원기둥(가운데 x·z3, y0 → y1)."""
    tube(M, (x, -z3, y0), (x, -z3, y1), r0, r1, slot, 1.0, n, caps)


def dome(M, c, r, slot, n=14, rings=3):
    """반구에 가까운 덮개 — 원뿔대 rings 칸."""
    x, y, z = c
    for i in range(rings):
        a0, a1 = math.pi / 2 * i / rings, math.pi / 2 * (i + 1) / rings
        tube(M, (x, y, z + r * math.sin(a0)), (x, y, z + r * math.sin(a1)), r * math.cos(a0), max(r * math.cos(a1), 0.0), slot, 1.0, n, caps=(i == 0))


# ---------------------------------------------------------------- frost

def frost_fort_01(C):
    M, m = C.M, _m(C)
    S, G, WT, H = 26.0, 5.0, 1.2, 3.2
    h, seg, gt = S / 2, (S - G) / 2, G / 2
    B(M, 0, -h, 0, S, WT, H, m['st']); B(M, -h, 0, 0, WT, S, H, m['st']); B(M, h, 0, 0, WT, S, H, m['st'])
    B(M, -gt - seg / 2, h, 0, seg, WT, H, m['st']); B(M, gt + seg / 2, h, 0, seg, WT, H, m['st'])
    for sx in (-1, 1):
        B(M, sx * (gt + 0.7), h, 0, 1.4, 1.4, 5.2, m['stD'])                       # 문루 기둥
    B(M, 0, h, 5.15, G + 3, 2.4, 0.5, m['wd'])                                    # 문루 마루
    gable(M, (0, -h, 5.65), (3.2, G + 4), 1.0, 90, m['roof'])                     # 문루 지붕
    B(M, -h + 4, -h + 4, 0, 5, 5, 2.2, m['stD'])                                  # 망루 돌단
    for zz, ww, dd, xx in ((-h, S + 0.4, WT + 0.4, 0), (0, WT + 0.4, S + 0.4, -h), (0, WT + 0.4, S + 0.4, h)):
        B(M, xx, zz, H, ww, dd, 0.2, m['snow'])                                   # 담 위 눈
    for k in range(-5, 6):                                                        # 성가퀴(앞 담 빼고)
        B(M, k * 2.2, -h, H + 0.2, 0.8, WT, 0.5, m['st'])
    tube(M, (-h + 4, h - 4, 2.2), (-h + 4, h - 4, 6.0), 0.06, 0.04, m['steel'], 1.0, 5)   # 퓨전: 망루 위 무선 안테나
    B(M, -h + 4, -h + 4, 2.2, 1.4, 0.1, 0.9, m['panel'], yaw=20)                   # 퓨전: 태양판


def frost_observatory_01(C):
    M, m = C.M, _m(C)
    T(M, 0, 0, 0, 5, 3.2, 3.0, m['white'], 18)
    dome(M, (0, 0, 5), 3.0, m['steel'], 18, 4)
    B(M, 0, 3.05, 0, 1.4, 0.2, 2.2, m['dark'])                                    # 문
    tube(M, (0, -3.0, 6.5), (0, -2.4, 7.4), 0.35, 0.3, m['steelD'], 1.0, 8)       # 망원경 틈(앞)
    T(M, 4.2, 0, 0, 12, 0.18, 0.12, m['steel'], 6)                                # 전파 탑
    for i in range(4):
        tube(M, (3.6, 0, 2 + i * 2.6), (4.8, 0, 2 + i * 2.6), 0.05, 0.05, m['steel'], 1.0, 4)
    T(M, 4.2, 0, 12, 12.3, 0.08, 0.08, m['dark'], 6)                              # 풍속계 축(돌개는 코드)
    B(M, -3.6, 0, 0, 1.2, 1.8, 1.0, m['wd'])                                      # 장작 궤(옛 것 한 점)


def frost_airship_wreck_01(C):
    M, m = C.M, _m(C)
    tube(M, (-9, 0, 2.2), (9, 0, 2.2), 2.2, 2.6, m['steel'], 1.0, 16)             # 몸통(꼬리 → 머리)
    tube(M, (9, 0, 2.2), (10.6, 0, 2.2), 2.6, 1.2, m['steel'], 1.0, 16)           # 머리 둥근 끝
    tube(M, (10.6, 0, 2.2), (11.4, 0, 2.2), 1.2, 0.0, m['steelD'], 1.0, 16)
    for sy in (-2.62, 2.62):
        obox(M, (0, sy, 2.1), (17, 0.2, 0.18), 0, m['glow'])                      # 옆 빛 띠
    obox(M, (-9.5, 0, 2.6), (3, 0.25, 3.4), 0, m['steelD'])                       # 꼬리 날개(세로)
    obox(M, (-9.5, 0, 2.3), (3, 6, 0.25), 0, m['steelD'])                         # 꼬리 날개(가로)
    obox(M, (1.5, 0, -0.1), (5, 1.8, 0.4), 0, m['wd'])                            # 바닥 곤돌라 — 옛 나무 배
    for x in (-0.5, 1.5, 3.5):
        tube(M, (x, 0, 0.3), (x, 0, 0.9), 0.06, 0.06, m['dark'], 1.0, 4)           # 매단 줄


def frost_cableway_01(C):
    M, m = C.M, _m(C)
    for sx in (-7, 7):
        B(M, sx, 0, 0, 0.5, 0.5, 9, m['steel'])
        B(M, sx, 0, 9 - 0.15, 2, 0.3, 0.3, m['steel'])
        B(M, sx, 0, 0, 1.6, 1.6, 0.4, m['stD'])                                   # 받침
    tube(M, (-7, 0, 8.7), (7, 0, 8.7), 0.03, 0.03, m['dark'], 1.0, 4)
    tube(M, (1.5, 0, 7.75), (1.5, 0, 8.7), 0.04, 0.04, m['steel'], 1.0, 4)
    B(M, 1.5, 0, 6.25, 1.8, 1.4, 1.5, m['red'])                                   # 객차
    B(M, 1.5, 0.71, 6.85, 1.2, 0.04, 0.6, m['glow'])                              # 창(퓨전 빛)


# ---------------------------------------------------------------- crossing

def crossing_clocktower_01(C):
    M, m = C.M, _m(C)
    Hh, Hc = 1.5, 16.0
    B(M, 0, 0, 0, Hh * 2, Hh * 2, Hc, m['st'])
    B(M, 0, 0, Hc - 0.15, Hh * 2 + 0.4, Hh * 2 + 0.4, 0.3, m['stD'])
    B(M, 0, 0, 0, Hh * 2 + 0.6, Hh * 2 + 0.6, 0.8, m['stD'])                      # 받침
    for a in range(4):                                                            # 네 면 문자판 판(빛 — 바늘은 코드)
        yaw = a * 90
        dx, dy = math.sin(math.radians(yaw)) * (Hh + 0.02), -math.cos(math.radians(yaw)) * (Hh + 0.02)
        tube(M, (dx, dy, Hc - 3), (dx * 1.02, dy * 1.02, Hc - 3), 1.05, 1.05, m['glow'], 1.0, 16)
    B(M, 0, 1.52, 0, 1.2, 0.1, 2.2, m['wdD'])                                     # 문


def crossing_platform_01(C):
    M, m = C.M, _m(C)
    L, P = 60.0, 3.2
    for sx in (-0.75, 0.75):
        B(M, sx, 0, 0, 0.15, L, 0.12, m['steelD'])                                # 선로(남북)
    for i in range(20):
        B(M, 0, -L / 2 + 1.5 + i * 3, 0, 2.2, 0.3, 0.06, m['wd'])                  # 침목
    B(M, P, 0, 0, 3.4, 18, 0.8, m['st'])                                          # 승강장
    for i in range(4):
        B(M, P + 1.2, -7 + i * 4.6, 0.8, 0.15, 0.15, 3.0, m['alloy'])
    B(M, P + 0.4, 0, 3.77, 2.8, 16, 0.06, m['glow'])                               # 빛 지붕
    B(M, P + 1.4, 5, 0.8, 0.12, 0.12, 2.2, m['wd'])
    B(M, P + 1.4, 5, 2.65, 0.1, 2.2, 0.7, m['plaster'])                           # 한지 역명판(옛것)
    B(M, P + 1.6, -4, 1.25, 0.1, 1.6, 1.1, m['panel'])                            # 전광판


# ---------------------------------------------------------------- skyport

def skyport_mooring_tower_01(C):
    M, m = C.M, _m(C)
    T(M, 0, 0, 0, 0.1, 14, 14, m['pave'], 24)
    T(M, 0, 0, 0, 0.35, 9.3, 9, m['alloy'], 24)
    annulus(M, (0, 0, 0.35), 8.3, 8.5, 0.05, m['glow'], 1.0, 32)                  # 착륙판 테 빛
    B(M, 0, 0, 0, 2.4, 2.4, 18, m['alloy'])
    for z in (6, 12):
        B(M, 0, 0, z, 3.2, 3.2, 0.3, m['steelD'])
    B(M, 0, 0, 17.6, 3.0, 3.0, 0.4, m['steelD'])                                  # 꼭대기 서는 판(빛 공은 코드)
    for sx in (-1, 1):
        B(M, sx * 6.2, 0, 0.35, 0.4, 0.4, 2.2, m['wd'])                           # 옛 계류 말뚝 둘
        tube(M, (sx * 6.2, 0, 2.4), (sx * 1.3, 0, 8.0), 0.03, 0.03, m['dark'], 1.0, 4)


def skyport_station_01(C):
    M, m = C.M, _m(C)
    B(M, 0, 0, 0, 20, 4, 0.8, m['st'])                                            # 승강장
    B(M, 0, -3.4, 0.1, 12, 2.8, 3.0, m['rust'])                                   # 녹슨 객차
    gable(M, (0, 3.4, 3.1), (3.0, 12.2), 0.35, 90, m['rust'])                     # 객차 둥근 지붕 대신 낮은 박공
    for i in range(5):
        B(M, -4.8 + i * 2.4, -1.98, 1.75, 1.4, 0.05, 0.9, m['dark'])               # 창(켜지는 빛은 코드)
    for sx in (-1, 1):
        T(M, 6.05, -3.4 + sx * 0.8, 1.15, 1.25, 0.28, 0.28, m['dark'], 10)
    B(M, 7, 1.4, 0, 0.2, 0.2, 3.0, m['wd'])
    B(M, 7, 1.4, 2.75, 3.0, 0.12, 0.9, m['panel'])                                # 간판
    B(M, 7, 1.47, 3.14, 2.6, 0.13, 0.12, m['glow'])


def stone_pagoda_01(C):
    M, m = C.M, _m(C)
    B(M, 0, 0, 0, 4.2, 4.2, 0.5, m['stD'])
    for i in range(3):
        s, yb = 3.4 - i * 0.8, 0.5 + i * 1.9
        B(M, 0, 0, yb, s, s, 1.4, m['jst'])
        B(M, 0, 0, yb + 1.4, s + 0.9, s + 0.9, 0.3, m['stD'])                    # 옥개석
    T(M, 0, 0, 6.2, 6.6, 0.25, 0.18, m['stD'], 8)
    ball(M, (0, 0, 6.6), 0.35, m['jst'], 8)                                       # 보주


# ---------------------------------------------------------------- sunken

def sunken_palace_01(C):
    M, m = C.M, _m(C)
    B(M, 0, 0, 0, 12, 9, 0.25, m['st'])                                           # 낮은 기단
    for i in range(3):
        B(M, 0, 5 + i, -0.1 - i * 0.25, 4, 1, 0.25, m['moss'])                    # 잠긴 돌계단
    for i in range(4):
        B(M, -3.3 + i * 2.2, 1.2, 0.25, 0.35, 0.35, 3.2, m['red'])                # 앞 기둥
    B(M, 0, -1.3, 0.25, 8, 4.4, 3.0, m['wd'])                                     # 정전 몸
    gable(M, (0, 0.3, 3.25), (5.6, 9.6), 1.3, 90, m['roof'])                      # 맞배 지붕
    B(M, 0, 3.6, 0, 3.0, 1.2, 0.5, m['moss'])                                     # 이끼 덮인 디딤
    B(M, 4.9, -2.8, 0.25, 0.6, 0.6, 1.4, m['steel'])                              # 퓨전: 잠수 장비 함


def sunken_lighthouse_01(C):
    M, m = C.M, _m(C)
    T(M, 0, 0, 0, 1, 3.8, 3.2, m['rock'], 14)                                     # 바위 받침
    T(M, 0, 0, 1, 15, 1.7, 1.4, m['white'], 12)                                   # 15m 돌탑
    for i in range(3):
        T(M, 0, 0, 2.7 + i * 4.5, 3.3 + i * 4.5, 1.6, 1.52, m['red'], 12)        # 붉은 띠
    T(M, 0, 0, 15, 15.25, 2.0, 2.0, m['stD'], 16)                                 # 난간 판
    for k in range(8):
        a = 2 * math.pi * k / 8
        tube(M, (math.cos(a) * 1.85, math.sin(a) * 1.85, 15.25), (math.cos(a) * 1.85, math.sin(a) * 1.85, 15.9), 0.04, 0.04, m['steelD'], 1.0, 4)
    T(M, 0, 0, 15.25, 16.7, 0.7, 0.7, m['glow'], 10)                              # 등실 유리(불빛은 코드)
    T(M, 0, 0, 16.7, 18.1, 1.2, 0.0, m['roof'], 10)                               # 갓
    B(M, 0, 1.75, 1, 0.9, 0.2, 1.8, m['wdD'])                                     # 문


# ---------------------------------------------------------------- amber

def amber_clockshop_01(C):
    M, m = C.M, _m(C)
    B(M, 0, 0, 0, 10, 7, 4.4, m['plaster'])
    B(M, 0, 0, 4.45, 10.6, 7.6, 0.5, m['tile'])
    gable(M, (0, 0, 4.95), (7.6, 10.6), 1.1, 90, m['tile'])
    B(M, 2.4, 3.55, 0, 1.4, 0.2, 2.6, m['dark'])                                  # 문
    B(M, -2.2, 3.55, 1.8, 2.6, 0.15, 1.6, m['alloy'])                             # 쇼윈도
    tube(M, (0, -3.55, 5.6), (0, -3.85, 5.6), 0.9, 0.9, m['plaster'], 1.0, 16)    # 처마 시계 판(바늘은 코드)
    B(M, -6.4, 0, 0, 1.1, 0.9, 3.2, m['wd'])                                      # 서쪽 괘종시계
    ball(M, (-6.4, -0.5, 2.4), 0.3, m['amber'], 8)
    B(M, 0, 3.6, 4.1, 3.6, 0.1, 0.35, m['glow'])                                  # 퓨전: 빛 간판 띠


def drain_tower_01(C):
    M, m = C.M, _m(C)
    B(M, 0, 0, 0, 6, 6, 12, m['alloy'])                                           # 심 기둥 6×12
    for k in range(4):
        a = k * math.pi / 2
        T(M, math.cos(a) * 5, math.sin(a) * 5, 0, 18, 0.14, 0.14, m['rust'], 6)
    B(M, 0, 0, 5.8, 14, 14, 0.4, m['rust'])                                       # 층판 둘
    B(M, 0, 0, 14.8, 10, 10, 0.4, m['rust'])
    B(M, 6, 0, 17.75, 16, 0.5, 0.5, m['rust'])                                    # 크레인 팔
    B(M, 14, 0, 15, 0.6, 0.6, 3.0, m['dark'])                                     # 매단 추
    B(M, 0, 3.02, 0, 1.6, 0.1, 2.4, m['dark'])                                    # 문
    for z in (3, 9):
        B(M, 0, 3.03, z, 6.0, 0.08, 0.25, m['amber'])                             # 호박 줄무늬(굳은 거리 표)


# ---------------------------------------------------------------- vault

def vault_seedvault_01(C):
    M, m = C.M, _m(C)
    R, H, N = 11.0, 12.0, 16
    segW = 2 * R * math.sin(math.pi / N) + 0.5
    for i in range(1, N):                                                         # 남쪽(i=0) 문 자리 비움 — 문은 코드
        a = 2 * math.pi * i / N
        x, z3 = -math.sin(a) * R, math.cos(a) * R
        yaw = -math.degrees(a)
        obox(M, (x, -z3, 0), (segW, 0.7, H), yaw, m['alloy'])
        obox(M, (x * 1.003, -z3 * 1.003, H - 1.12), (segW, 0.75, 0.25), yaw, m['glow'])
    T(M, 0, 0, H, H + 0.5, R + 0.3, R + 0.3, m['steelD'], 24)                     # 지붕 판
    tube(M, (0, 0, H + 0.5), (0, 0, H + 1.6), R * 0.95, R * 0.62, m['steel'], 1.0, 20)   # 낮은 돔(옛 반구 → 높이 2.5 로 눌러 끝 15)
    tube(M, (0, 0, H + 1.6), (0, 0, H + 3.0), R * 0.62, 0.0, m['steel'], 1.0, 20)
    for sx in (-1, 1):
        B(M, sx * 3.0, R + 0.4, 0, 0.6, 0.6, H, m['steelD'])                      # 문 기둥


def vault_granary_01(C):
    M, m = C.M, _m(C)
    for i in range(4):
        B(M, 2 if i % 2 else -2, -1.6 if i < 2 else 1.6, 0, 0.5, 0.5, 1.0, m['jst'])   # 돌 굽
    B(M, 0, 0, 0.2 + 0.8, 5, 4, 4.2, m['wd'])
    gable(M, (0, 0, 5.2), (4.6, 5.8), 1.6, 90, m['thatch'])
    B(M, 0, 2.03, 1.0, 1.6, 0.05, 2.2, m['dark'])                                 # 문 뒤 어둠(문짝은 코드)
    B(M, 0, 2.6, 0, 1.2, 1.2, 1.0, m['wd'])                                       # 디딤
    B(M, -2.55, 0, 2.5, 0.08, 1.2, 0.8, m['panel'])                               # 퓨전: 습도계 판


# ---------------------------------------------------------------- fork

def fork_locomotive_01(C):
    M, m = C.M, _m(C)
    L, Hh, D = 8.0, 3.6, 3.0
    B(M, 0, 0, 0.3, L, D, Hh, m['steelD'])
    B(M, 0, 0, 0.78, L + 0.1, D + 0.1, 0.25, m['red'])                            # 붉은 띠
    B(M, -2.2, 0, Hh + 0.3, 2.6, 3.1, 1.6, m['steel'])                            # 기관실
    T(M, 2.6, 0, Hh + 0.3, Hh + 1.9, 0.45, 0.55, m['dark'], 10)                   # 굴뚝(김은 코드)
    for x in (-2.8, -0.9, 1.0, 2.9):
        for y in (-1.55, 1.55):
            tube(M, (x, y, 0.55), (x + 0.0, y * 1.06, 0.55), 0.55, 0.55, m['dark'], 1.0, 12)   # 바퀴
    B(M, 4.15, 0, 0.3, 0.3, 3.2, 0.6, m['yellow'])                                # 앞 범퍼
    B(M, -2.2, -1.56, Hh + 1.0, 1.2, 0.05, 0.7, m['glow'])                        # 퓨전: 기관실 빛 창


def castle_gate_01(C):
    M, m = C.M, _m(C)
    for dx in (-4, 4):
        B(M, dx, 0, 0, 3, 3, 6, m['st'])
        B(M, dx, 0, 6, 3.6, 3.6, 0.5, m['tile'])
    B(M, 0, 0, 6.1, 11.5, 3.2, 1.0, m['wd'])                                      # 다리 마루
    gable(M, (0, 0, 7.1), (4.2, 12.5), 0.5, 90, m['tile'])
    B(M, 0, 1.65, 5.15, 4, 0.2, 0.9, m['wdD'])                                    # 현판
    for dx in (-11.5, 11.5):
        B(M, dx, 0, 0, 12, 1.4, 4.5, m['st'])                                     # 담
    for dx in (-3.2, 3.2):
        B(M, dx, 3.2, 0, 0.45, 0.45, 2.6, m['wd'])
        B(M, dx, 3.2, 2.4, 0.55, 0.5, 0.6, m['red'])                              # 등롱
    B(M, 5.6, 1.6, 0, 0.12, 0.12, 2.0, m['steel'])                                # 퓨전: 카메라 기둥
    B(M, 5.6, 1.6, 2.0, 0.3, 0.4, 0.2, m['dark'])


def bell_tower_01(C):
    M, m = C.M, _m(C)
    W_, H = 5.0, 10.0
    B(M, 0, 0, 0, W_, W_, H, m['st'])
    for z in (3, 6.5):
        B(M, 0, 0, z - 0.15, W_ + 0.2, W_ + 0.2, 0.3, m['wd'])
    tube(M, (0, -(W_ / 2 + 0.8), H - 1.75), (0, -(W_ / 2 + 1.0), H - 3.2), 0.5, 0.9, m['stD'], 1.0, 12)   # 울리다 멈춘 종
    B(M, 0, W_ / 2 + 0.5, H - 1.7, 0.2, 1.4, 0.2, m['wd'])                        # 종 걸이
    B(M, 0, W_ / 2 + 0.03, 0, 1.4, 0.1, 2.4, m['wdD'])                            # 문
    B(M, 2.53, 0, 7.5, 0.06, 1.0, 1.0, m['panel'])                                # 퓨전: 시보 스피커


# ---------------------------------------------------------------- 여러 지역

def statue_guard_01(C):
    M, m = C.M, _m(C)
    B(M, 0, 0, 0, 3.2, 3.2, 1.2, m['stD'])                                        # 받침
    B(M, 0, 0, 1.2, 2.4, 2.4, 0.2, m['jst'])
    T(M, 0, 0, 1.2, 3.8, 0.7, 0.5, m['jst'], 10)                                  # 몸
    ball(M, (0, 0, 4.2), 0.55, m['jst'], 10)                                      # 머리
    B(M, 0, 0, 3.15, 2.4, 0.4, 0.3, m['jst'])                                     # 팔
    tube(M, (1.1, -0.1, 1.4), (1.1, -0.1, 4.55), 0.07, 0.07, m['wdD'], 1.0, 6)    # 창 자루
    tube(M, (1.1, -0.1, 4.55), (1.1, -0.1, 4.75), 0.12, 0.0, m['steel'], 1.0, 6)  # 창 날


def gate_light_pillars_01(C):
    M, m = C.M, _m(C)
    for sx in (-4, 4):
        B(M, sx, 0, 0, 1, 1, 5, m['alloy'])
        T(M, sx, 0, 0, 12, 0.9, 0.9, m['glow'], 14)                               # 빛 기둥(옛 pillar)
        B(M, sx, 0, 0, 2.0, 2.0, 0.4, m['stD'])                                   # 주춧돌(옛 것)
    B(M, 7, 2, 0, 1.6, 1, 0.4, m['stD'])                                          # 경계비
    B(M, 7, 2, 0.4, 1.1, 0.5, 2.6, m['jst'])


K125 = {f.__name__: f for f in (
    frost_fort_01, frost_observatory_01, frost_airship_wreck_01, frost_cableway_01,
    crossing_clocktower_01, crossing_platform_01, skyport_mooring_tower_01, skyport_station_01, stone_pagoda_01,
    sunken_palace_01, sunken_lighthouse_01, amber_clockshop_01, drain_tower_01,
    vault_seedvault_01, vault_granary_01, fork_locomotive_01, castle_gate_01, bell_tower_01,
    statue_guard_01, gate_light_pillars_01)}
