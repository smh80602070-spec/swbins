"""K-0141 — 1만리 이야기 지역(saga-go/js/*.js) 코드 도형 2차: K-0125 재고에 남은 새 후보 58 → 정적 GLB 57(4 는 keep).
build_village.py 가 import 해서 VILLAGE 표에 붙인다(빌더·삼각형 예산·license 는 거기와 같다). 원점 = 바닥 가운데(옛 three 그룹 원점), 단위 m.

규칙(K-0125 와 같다): **정적 몸만** — 깜빡이(o.blink·led·lamp)·출렁(bob)·도는 것(spin)·숨기는 막(veil·pass·gate)·떠다니는 알(floater)·빛줄기는 웹 코드가 위에 얹는다.
옛 js 의 box/cyl/ball/cone/torus 를 **글자 그대로** 옮기려고 three 꼴 층(G)을 둔다 — 좌표·Euler XYZ 회전·비균일 scale 을 three 와 같이 받고,
마지막에 three(x, 위 y, z) → 여기(x, -z, y) 로 돌린다. 면은 도형 가운데에서 바깥을 보게 감는다.
장면 셋(하늘길·폭풍 눈·선대)은 놀이 판정(걷는 원판·난간·houseRects 벽)이 코드 숫자에 묶여 있어 **장식·받침만** GLB, 판정 몸은 코드.
  id(옛 js case)                                옛 크기(가로 × 깊이 × 높이 m) · 코드에 남는 것
  frost_hut_01(frost hut)                       4.8 × 4.8 × 4.2   움막(yaw 0.3 구움)
  frost_satdish_01(frost sat)                   3.4 × 3.4 × 1.6   떨어진 위성 접시·태양판
  snowman_01(frost snowman)                     1.4 × 1.4 × 2.6   눈사람
  frost_ice_cave_01(frost cave)                 6.2 × 1.8 × 3.1   얼음굴 어귀(반 고리 아치·고드름)
  crossing_tilted_gate_01(crossing tgate)       9 × 3.6 × 8.4     12° 기운 누각 성문 · 떠 있는 성벽 조각 넷 = 코드(bob)
  guard_robot_01(crossing guard)                1.2 × 1.2 × 2.4   멈춘 경비 기계 · 눈 등 = 코드(blink)
  crossing_dial_01(crossing dial)               1.8 × 0.7 × 1.3   떨어진 문자판
  roof_tile_shards_01(crossing tile)            1.6 × 0.9 × 0.3   기와 조각 셋
  crossing_pod_01(crossing pod)                 2.5 × 2.5 × 1.3   탈출 포드 · 등 = 코드
  ticket_machine_01(crossing ticket)            0.8 × 0.6 × 1.6   표 기계
  sword_helm_01(crossing helm)                  0.9 × 0.7 × 1.4   칼과 투구
  solar_farm_01(skyport farm)                   21 × 12 × 1.8     태양광 밭 12판·변전함 · 표시등 = 코드(led)
  phone_booth_01(skyport phone)                 1.1 × 1.1 × 2.3   낡은 공중전화
  courier_bot_01(skyport courier)               1.2 × 1.2 × 1.2   멈춘 배달 기계
  time_capsule_01(skyport capsule)              2 × 2 × 1.2       묻힌 시간 캡슐 · 등 = 코드
  bus_stop_01(skyport busstop)                  3.2 × 1.4 × 2.5   빈 정류장
  lattice_mast_01(skyport antenna)              1.2 × 1.2 × 8     격자 탑 · 꼭대기 등 = 코드
  cairn_01(skyport cairn)                       1.1 × 1.1 × 2.6   길가 돌탑
  sunken_lab_01(sunken lab)                     10 × 22 × 5.3     해저 기지 갑판·컨테이너·관제실·잔교 · 잠수정(bob)·창(blink) = 코드
  tewak_float_01(sunken tewak)                  0.9 × 0.9 × 0.7   테왁
  diving_helmet_01(sunken helmet)               0.9 × 0.9 × 0.9   녹슨 잠수 투구
  pearl_shell_01(sunken pearl)                  1 × 1 × 0.4       진주조개
  buoy_01(sunken buoy)                          1.2 × 1.2 × 1.4   부표 몸 · 출렁 = 코드가 GLB 루트를 흔듦, 등 = 코드
  turtle_stele_01(sunken turtle)                1.8 × 2.6 × 2     돌거북 비석
  sunken_plaque_01(sunken plaque)               2 × 0.9 × 0.5     떨어진 편액
  haetae_01(sunken haetae)                      1.2 × 0.9 × 1.45  해태상
  amber_pass_posts_01(amber pass)               22.4 × 1.2 × 4.4  호박 고개 경계 돌기둥 둘 · 결정 무더기·막(치우는 문) = 코드
  amber_elevated_rail_01(amber rail)            160 × 4 × 9.6     고가 선로·멈춘 전철 셋 · 반투명 결정 = 코드
  vending_machine_01(amber vend)                0.9 × 0.8 × 1.9   멈춘 자판기
  vault_pass_posts_01(vault pass)               6.6 × 48.6 × 14   고개 기둥 둘·장승 둘 · 막 = 코드(gate)
  vault_container_yard_01(vault yard)           ~104 × 92 × 11.3  창고·컨테이너 셋·갠트리 크레인
  vault_case_{feast,ship,train,palace}_01       1.7 × 1.7 × 2.6   굳은 순간 진열장(받침·테·속 모형) · 호박 유리판 = 코드(투명)
  dideul_mortar_01(vault mortar)                3 × 0.6 × 1.2     디딜방아
  sotdae_01(vault sotdae)                       0.7 × 0.2 × 5.3   솟대
  forklift_01(vault forklift)                   1.4 × 3.6 × 2.7   멈춘 지게차
  open_container_01(vault container)            6.9 × 3.4 × 2.65  문 열린 컨테이너
  seed_pod_01(vault seedpod)                    2.2 × 1 × 1       씨앗 포드 · 떠 있는 씨앗 = 코드(floater)
  case_shards_01(vault caseshard)               2.6 × 2.6 × 2.5   깨진 진열장 조각·물방울
  steel_pylon_01(vault pylon)                   1.6 × 1.6 × 10.3  강철 기둥 · 빛 구슬 = 코드(orb)
  fork_pass_posts_01(fork pass)                 48.6 × 0.6 × 14   고개 기둥 둘 · 막 = 코드(veil)
  lattice_stake_base_01(fork lattice)           1.4 × 1.4 × 0.95  격자 말뚝 받침 · 빛 격자 = 코드(frame)
  fork_signpost_01(fork junction)               3.2 × 3.2 × 3     세갈래 길목 팻말 · 하늘 틈·별까마귀 = 코드
  rail_works_tents_01(fork works)               11 × 6 × 2.1      선로 공사장 천막 둘·연장 궤
  laundry_line_01(fork laundry)                 4.1 × 0.9 × 2.2   멈춘 빨래
  survey_tripod_01(fork tripod)                 0.9 × 0.9 × 1.8   측량 삼각대
  rail_pile_01(fork rails)                      5 × 3 × 0.6       깔다 만 레일 더미
  fork_shards_01(fork shard)                    2 × 2 × 1.5       부러진 격자 조각
  stormeye_knot_01(stormeye buildKnot)          1.4 × 1.4 × 1.2   매듭 돌(새끼줄·종이 띠) · 연기·불꽃·빛줄기 = 코드
  skyroute_shrine_01(skyroute shrine)           9.8 × 6 × 4.2     하늘 사당 — 원점 = 원판 가운데(사당은 -r+5) · 원판·난간·방울 장대 = 코드
  skyroute_wreck_01(skyroute wreck)             ~33 × 16 × 7      비행선 잔해 조종실·기낭·꼬리·기관 — 원점 = 원판 가운데 · 프로펠러·풍향 날개 = 코드
  skyroute_orbit_01(skyroute orbit)             ~52 × 22 × 9      궤도 조각 태양 날개·안테나·씨앗 장치 — 원점 = 원판 가운데 · 빛 심 = 코드
  era_shipyard_01(era-sites build)              28 × 30 × 12.9    선대 유적 — 바닥판·기운 선대·늑골·용골·크레인·창고·용접대 · 불똥·날개 조각 = 코드
  era_post_station_01(era-sites buildStation)   16 × 18 × 6       역참 터 — 돌담 세 변·초가 마구간·구유·깃대·돌장승 둘 · 깃발 = 코드
  nightecho_ember_base_01(nightecho build)      2.2 × 2.2 × 0.3   보랏불 받침(돌 여덟·널돌, 새로) · 불꽃·빛무리·보랏빛 고리 = 코드
keep(재고 json 에 이유): crossing steps(섬돌 열다섯이 다 출렁·꼭대기 수정 돎) · crossing crystal(몸 통째 돎) ·
  amber cross(지름 44m 아스팔트 칠 = 땅 높이 맞춤, 신호등 깜빡·결정 치움) · skyisle(윗면·난간·밑 뿔이 ISLE_R·RAIL_H 판정과 한 몸, 남는 장식 = 받침 하나).
"""
import math

from mathutils import Matrix, Vector

TB = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))      # three (x, y, z) → 여기 (x, -z, y)
PI = math.pi

# 재질 — 이름 → (자체 PBR 결, tile, 색, gain). K-0125 _m 과 같은 결 + 이 묶음이 더 쓰는 색. 쓰는 것만 칸을 만든다.
MATS = dict(
    st=('castle_wall_slates', 1.2, '#9a9ea6', 1.0), stD=('japanese_stone_wall', 1.2, '#6c7078', 1.0), jst=('japanese_stone_wall', 1.2, '#8f939b', 1.0),
    rock=('cliff_side', 1.2, '#6f6a64', 1.0), snow=('snow_02', 1.0, None, 1.0), wd=('brown_planks_03', 1.0, '#7a5838', 1.0),
    wdD=('black_painted_planks', 1.0, None, 1.0), roof=('grey_roof_tiles', 1.0, '#5a6270', 1.0), tile=('clay_roof_tiles', 1.0, '#8a4a36', 1.0),
    thatch=('thatch_roof_angled', 1.0, None, 1.0), red=('concrete_wall_001', 1.0, '#a8392e', 1.1), steel=('concrete_wall_001', 1.0, '#8d96a2', 1.1),
    steelD=('concrete_wall_001', 1.0, '#4c535c', 1.0), alloy=('corrugated_iron', 1.0, '#b7bec8', 1.0), rust=('corrugated_iron', 1.0, '#8a4e2c', 1.0),
    white=('grey_plaster', 1.0, '#eef0f2', 1.15), glow=('beige_wall_001', 1.0, '#9fe7ff', 1.5), amber=('beige_wall_001', 1.0, '#f0a83a', 1.3),
    dark=('black_painted_planks', 1.0, '#2a2d33', 1.0), panel=('concrete_wall_001', 1.0, '#2b3f5e', 1.2), yellow=('concrete_wall_001', 1.0, '#e0b43a', 1.1),
    pave=('cobblestone_floor_01', 1.0, '#8c9096', 1.0), concrete=('concrete_wall_001', 1.0, '#9a9a94', 1.0),
    orange=('concrete_wall_001', 1.0, '#e0782a', 1.1), carrot=('concrete_wall_001', 1.0, '#f08a2a', 1.2), ice=('grey_plaster', 1.0, '#bfe3f2', 1.2),
    crystal=('beige_wall_001', 1.0, '#c79bff', 1.4), lamp=('beige_wall_001', 1.0, '#ffd27a', 1.5), glass=('grey_plaster', 1.0, '#7fc6e0', 1.2),
    bronze=('corrugated_iron', 1.0, '#a07438', 1.1), canvas=('white_stucco', 1.0, '#d8c9a4', 1.0), paper=('white_stucco', 1.0, '#f4efe2', 1.1),
    straw=('thatch_roof_angled', 1.0, '#c8a860', 1.0), dial=('white_stucco', 1.0, '#e8e2cf', 1.0), train=('concrete_wall_001', 1.0, '#6a7f96', 1.0),
    trainB=('concrete_wall_001', 1.0, '#c8402e', 1.0), hull=('corrugated_iron', 1.0, '#5f6b78', 1.0), ember=('beige_wall_001', 1.0, '#ff8a3a', 1.5),
    water=('grey_plaster', 1.0, '#4f8fb8', 1.1), roofD=('grey_roof_tiles', 1.0, '#3e4652', 1.0), cA=('corrugated_iron', 1.0, '#b8402e', 1.0),
    cB=('corrugated_iron', 1.0, '#2e6ab8', 1.0), cC=('corrugated_iron', 1.0, '#3e8a4a', 1.0), shutter=('corrugated_iron', 1.0, '#8a9098', 1.0),
    cloth=('white_stucco', 1.0, '#e6dccb', 1.0), cloth0=('white_stucco', 1.0, '#c84a4a', 1.0), cloth1=('white_stucco', 1.0, '#4a7ac8', 1.0),
    cloth2=('white_stucco', 1.0, '#e0c050', 1.0), slate=('japanese_stone_wall', 1.2, '#55525a', 1.0), dirt=('cobblestone_floor_01', 1.0, '#9a8566', 1.0),
    totem=('japanese_stone_wall', 1.2, '#9a948a', 1.0), redW=('concrete_wall_001', 1.0, '#b8322a', 1.0), seedD=('beige_wall_001', 1.0, '#7ad07a', 1.3))


class _Mat:
    def __init__(self, C):
        self.C, self.k = C, {}

    def __getitem__(self, n):
        if n not in self.k:
            t, tile, tint, gain = MATS[n]
            self.k[n] = self.C.s(t, tile, tint, gain=gain)
        return self.k[n]


def _rot(r):
    return Matrix.Rotation(r[0], 4, 'X') @ Matrix.Rotation(r[1], 4, 'Y') @ Matrix.Rotation(r[2], 4, 'Z')      # three Euler XYZ


def _trs(p=(0, 0, 0), r=(0, 0, 0), s=(1, 1, 1)):
    return Matrix.Translation(Vector(p)) @ _rot(r) @ Matrix.Diagonal((s[0], s[1], s[2], 1.0))


class G:
    """three Group 꼴 — sub() 로 자식 그룹, 도형은 (재질, 크기…, x, y, z, r=Euler, s=scale) 를 three 인자 그대로."""

    def __init__(self, M, W=None):
        self.M, self.W = M, (W if W is not None else Matrix.Identity(4))

    def sub(self, p=(0, 0, 0), r=(0, 0, 0), s=(1, 1, 1)):
        return G(self.M, self.W @ _trs(p, r, s))

    def _poly(self, L, pts, ctr, slot):
        P = [(TB @ L @ Vector((v[0], v[1], v[2], 1.0))).to_3d() for v in pts]
        q = []
        for p in P:
            if not q or (p - q[-1]).length > 1e-6:
                q.append(p)
        if len(q) > 1 and (q[0] - q[-1]).length < 1e-6:
            q.pop()
        if len(q) < 3:
            return
        c = (TB @ L @ Vector((ctr[0], ctr[1], ctr[2], 1.0))).to_3d()
        n = Vector()
        for i in range(len(q)):                                                  # 뉴얼 법선(오목·작은 면에도 안정)
            a, b = q[i], q[(i + 1) % len(q)]
            n += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
        if n.length < 1e-12:
            return
        if n.dot(sum(q, Vector()) / len(q) - c) < 0:
            q.reverse()
        ax = max(range(3), key=lambda k: abs(n[k]))
        u, v = [(1, 2), (0, 2), (0, 1)][ax]
        self.M.face(q, [(p[u], p[v]) for p in q], slot)

    def box(self, slot, w, h, d, x, y, z, r=(0, 0, 0), s=(1, 1, 1)):
        L = self.W @ _trs((x, y, z), r, s)
        a, b, c = w / 2, h / 2, d / 2
        for ax in range(3):
            for sg in (-1, 1):
                k1, k2 = [k for k in range(3) if k != ax]
                f = []
                for e1, e2 in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                    v = [0, 0, 0]
                    v[ax], v[k1], v[k2] = sg, e1, e2
                    f.append((v[0] * a, v[1] * b, v[2] * c))
                self._poly(L, f, (0, 0, 0), slot)

    def cyl(self, slot, rt, rb, h, x, y, z, seg=12, r=(0, 0, 0), s=(1, 1, 1), caps=True, pre=None):
        L = self.W @ _trs((x, y, z), r, s) @ (pre if pre is not None else Matrix.Identity(4))
        ring = lambda rr, yy, k: (rr * math.sin(2 * PI * k / seg), yy, rr * math.cos(2 * PI * k / seg))
        for k in range(seg):
            self._poly(L, [ring(rb, -h / 2, k), ring(rb, -h / 2, k + 1), ring(rt, h / 2, k + 1), ring(rt, h / 2, k)], (0, 0, 0), slot)
        if caps:
            if rb > 0:
                self._poly(L, [ring(rb, -h / 2, k) for k in range(seg)], (0, h, 0), slot)
            if rt > 0:
                self._poly(L, [ring(rt, h / 2, k) for k in range(seg)], (0, -h, 0), slot)

    def cone(self, slot, rad, h, x, y, z, seg=8, r=(0, 0, 0), s=(1, 1, 1)):
        self.cyl(slot, 0.0, rad, h, x, y, z, seg, r, s)

    def disc(self, slot, rad, x, y, z, seg=20, r=(0, 0, 0), t=0.03):
        """CircleGeometry(XY 면, +z 를 봄) — 얇은 원판."""
        self.cyl(slot, rad, rad, t, x, y, z, seg, r, pre=Matrix.Rotation(PI / 2, 4, 'X'))

    def sphere(self, slot, rad, x, y, z, ws=12, hs=8, phi0=0.0, phil=2 * PI, th0=0.0, thl=PI, r=(0, 0, 0), s=(1, 1, 1)):
        L = self.W @ _trs((x, y, z), r, s)

        def P(i, j):
            ph, th = phi0 + phil * i / ws, th0 + thl * j / hs
            return (-rad * math.cos(ph) * math.sin(th), rad * math.cos(th), rad * math.sin(ph) * math.sin(th))
        for j in range(hs):
            for i in range(ws):
                self._poly(L, [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], (0, 0, 0), slot)

    def ball(self, slot, rad, x, y, z, s=(1, 1, 1), r=(0, 0, 0), ws=12, hs=8):
        self.sphere(slot, rad, x, y, z, ws, hs, r=r, s=s)

    def torus(self, slot, R, tr, x, y, z, rs=6, ts=14, arc=2 * PI, r=(0, 0, 0), s=(1, 1, 1)):
        L = self.W @ _trs((x, y, z), r, s)

        def P(i, j):
            u, v = arc * i / ts, 2 * PI * j / rs
            return ((R + tr * math.cos(v)) * math.cos(u), (R + tr * math.cos(v)) * math.sin(u), tr * math.sin(v))
        for i in range(ts):
            um = arc * (i + 0.5) / ts
            for j in range(rs):
                self._poly(L, [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], (R * math.cos(um), R * math.sin(um), 0), slot)

    def octa(self, slot, rad, x, y, z, r=(0, 0, 0), s=(1, 1, 1)):
        L = self.W @ _trs((x, y, z), r, s)
        X, Y, Z = (rad, 0, 0), (0, rad, 0), (0, 0, rad)
        neg = lambda v: tuple(-c for c in v)
        for a in (X, neg(X)):
            for b in (Y, neg(Y)):
                for c in (Z, neg(Z)):
                    self._poly(L, [a, b, c], (0, 0, 0), slot)

    def capsule(self, slot, rad, ln, x, y, z, r=(0, 0, 0), seg=10):
        g = self.sub((x, y, z), r)
        g.cyl(slot, rad, rad, ln, 0, 0, 0, seg, caps=False)
        g.sphere(slot, rad, 0, ln / 2, 0, seg, 4, thl=PI / 2)
        g.sphere(slot, rad, 0, -ln / 2, 0, seg, 4, th0=PI / 2, thl=PI / 2)


def _g(C):
    return G(C.M), _Mat(C)


# ---------------------------------------------------------------- frost

def frost_hut_01(C):
    g, m = _g(C)
    h = g.sub(r=(0, 0.3, 0))
    h.box(m['wd'], 4, 2.4, 4, 0, 1.2, 0)
    h.cone(m['snow'], 3.4, 1.8, 0, 3.3, 0, 4, r=(0, PI / 4, 0))
    h.box(m['dark'], 1, 1.6, 0.1, 0, 0.8, 2.02)
    h.box(m['glow'], 0.7, 0.5, 0.05, 1.2, 1.5, 2.02)                                      # 퓨전: 빛 창
    h.cyl(m['steelD'], 0.12, 0.12, 1.4, -1.1, 3.4, -1.0, 6)                               # 난로 굴뚝


def frost_satdish_01(C):
    g, m = _g(C)
    g.sphere(m['steel'], 1.6, 0, 0.9, 0, 16, 6, thl=PI / 3, r=(2.3, 0, 0))
    g.box(m['panel'], 3, 0.1, 1.2, 1.8, 0.3, 0.6, r=(0, 0.4, 0))
    g.box(m['glow'], 0.3, 0.3, 0.3, 0, 0.3, 0)


def snowman_01(C):
    g, m = _g(C)
    for rr, yy in ((0.7, 0.6), (0.5, 1.55), (0.35, 2.25)):
        g.ball(m['snow'], rr, 0, yy, 0)
    g.cone(m['carrot'], 0.07, 0.35, 0, 2.25, 0.45, 8, r=(PI / 2, 0, 0))
    g.box(m['red'], 0.9, 0.12, 0.12, 0, 1.95, 0)
    for sx in (-0.12, 0.12):
        g.ball(m['dark'], 0.05, sx, 2.35, 0.31, ws=6, hs=4)


def frost_ice_cave_01(C):
    g, m = _g(C)
    g.torus(m['stD'], 2.2, 0.9, 0, 0, 0, 8, 14, PI)
    g.box(m['dark'], 3.2, 2, 0.2, 0, 1, -0.3)
    for i in range(4):
        g.cone(m['ice'], 0.15, 0.7, -1.2 + i * 0.8, 2.3, 0.2, 6, r=(PI, 0, 0))


# ---------------------------------------------------------------- crossing

def crossing_tilted_gate_01(C):
    g, m = _g(C)
    gg = g.sub(r=(0, 0, 0.21))
    gg.box(m['st'], 2, 4, 2.4, -3, 2, 0); gg.box(m['st'], 2, 4, 2.4, 3, 2, 0); gg.box(m['st'], 8, 1.2, 2.4, 0, 4.6, 0)
    for i in range(4):
        gg.box(m['red'], 0.25, 2, 0.25, -2.8 + i * 1.86, 6.2, 0)
    gg.box(m['roof'], 9, 0.35, 3.6, 0, 7.3, 0); gg.box(m['roof'], 6.4, 0.9, 2.2, 0, 7.9, 0)


def guard_robot_01(C):
    g, m = _g(C)
    g.box(m['steelD'], 1.0, 0.2, 1.0, 0, 0.1, 0)
    g.box(m['alloy'], 1.2, 1.4, 1.2, 0, 0.9, 0)
    g.ball(m['alloy'], 0.5, 0, 1.9, 0)
    g.box(m['dark'], 0.5, 0.12, 0.05, 0, 1.0, 0.61)


def crossing_dial_01(C):
    g, m = _g(C)
    g.disc(m['dial'], 0.9, 0, 0.4, 0, 20, r=(-1.2, 0, 0))
    g.box(m['dark'], 0.06, 0.02, 0.6, 0, 0.45, 0, r=(0, 0.5, 0))


def roof_tile_shards_01(C):
    g, m = _g(C)
    for i in range(3):
        g.box(m['roof'], 0.6, 0.08, 0.4, i * 0.5 - 0.5, 0.05 + i * 0.05, (i % 2) * 0.3, r=(0, i, 0.2))


def crossing_pod_01(C):
    g, m = _g(C)
    g.ball(m['alloy'], 0.9, 0, 0.6, 0, s=(1, 0.8, 1.4), r=(0, 0, 0.4))
    g.ball(m['glass'], 0.3, -0.2, 0.75, 0.95, ws=8, hs=6)


def ticket_machine_01(C):
    g, m = _g(C)
    g.box(m['panel'], 0.8, 1.6, 0.6, 0, 0.8, 0)
    g.box(m['glow'], 0.5, 0.3, 0.05, 0, 1.3, 0.31)
    g.box(m['dark'], 0.3, 0.05, 0.05, 0, 0.9, 0.31)


def sword_helm_01(C):
    g, m = _g(C)
    sw = g.sub((0, 0.7, 0), (0, 0, 0.15))
    sw.box(m['alloy'], 0.08, 1.4, 0.2, 0, 0, 0)
    sw.box(m['bronze'], 0.45, 0.06, 0.12, 0, 0.45, 0)
    sw.box(m['wdD'], 0.07, 0.3, 0.07, 0, 0.63, 0)
    g.ball(m['bronze'], 0.35, 0.5, 0.25, 0.2, s=(1, 0.7, 1))


# ---------------------------------------------------------------- skyport

SUB_OFF = (10.5, 0)


def solar_farm_01(C):
    g, m = _g(C)
    for j in range(3):
        for i in range(4):
            px, pz = -7.5 + i * 5, -5 + j * 5
            g.box(m['dark'], 0.15, 1.2, 0.15, px, 0.6, pz)
            g.box(m['panel'], 4, 0.08, 2.4, px, 1.3, pz, r=(-0.45, 0, 0))
    g.box(m['alloy'], 1.2, 1.6, 1.0, SUB_OFF[0], 0.8, SUB_OFF[1])
    g.box(m['dark'], 0.05, 0.9, 0.6, SUB_OFF[0] - 0.62, 0.9, SUB_OFF[1])


def phone_booth_01(C):
    g, m = _g(C)
    g.box(m['red'], 1, 2.2, 1, 0, 1.1, 0)
    g.box(m['glow'], 0.7, 1.2, 0.05, 0, 1.3, 0.51)
    g.box(m['dark'], 1.1, 0.1, 1.1, 0, 2.25, 0)


def courier_bot_01(C):
    g, m = _g(C)
    g.box(m['alloy'], 1.2, 0.9, 0.9, 0, 0.75, 0)
    for i in range(4):
        g.cyl(m['dark'], 0.2, 0.2, 0.15, -0.45 if i < 2 else 0.45, 0.2, 0.5 if i % 2 else -0.5, 8, r=(PI / 2, 0, 0))
    g.box(m['glow'], 0.5, 0.2, 0.05, 0, 0.9, 0.47)


def time_capsule_01(C):
    g, m = _g(C)
    g.ball(m['dirt'], 1.0, 0, 0, 0, s=(1, 0.3, 1))
    g.cyl(m['alloy'], 0.45, 0.45, 1.6, 0, 0.4, 0, 12, r=(0, 0, 0.5))


def bus_stop_01(C):
    g, m = _g(C)
    for sx in (-1.4, 1.4):
        g.box(m['alloy'], 0.1, 2.4, 0.1, sx, 1.2, 0)
    g.box(m['panel'], 3.2, 0.12, 1.4, 0, 2.45, 0.3)
    g.box(m['wd'], 2.4, 0.1, 0.5, 0, 0.5, 0.3)
    for sx in (-1.0, 1.0):
        g.box(m['dark'], 0.08, 0.45, 0.4, sx, 0.22, 0.3)
    g.box(m['glow'], 0.6, 0.4, 0.04, -1.4, 2.0, 0.08)                                    # 노선 표


def lattice_mast_01(C):
    g, m = _g(C)
    for i in range(4):
        g.box(m['rust'], 0.12, 8, 0.12, -0.4 if i < 2 else 0.4, 4, 0.4 if i % 2 else -0.4, r=(0, 0, 0.05 if i < 2 else -0.05))
    for yy in (1.5, 3.5, 5.5, 7.3):
        k = 0.4 - 0.05 * yy / 8 * 4 * 0.5
        for zz in (-k, k):
            g.box(m['rust'], 2 * k, 0.06, 0.06, 0, yy, zz)
        for xx in (-k, k):
            g.box(m['rust'], 0.06, 0.06, 2 * k, xx, yy, 0)


def cairn_01(C):
    g, m = _g(C)
    for i in range(5):
        g.ball(m['st'], 0.55 - i * 0.08, 0, 0.35 + i * 0.5, 0, s=(1, 0.6, 1))


# ---------------------------------------------------------------- sunken

def sunken_lab_01(C):
    g, m = _g(C)
    g.box(m['alloy'], 10, 0.5, 8, 0, 0.25, 0)
    g.box(m['orange'], 2.4, 2.4, 5.6, -3, 1.7, -2); g.box(m['rust'], 2.4, 2.4, 5.6, -3, 4.1, -2)
    g.box(m['alloy'], 3.2, 2.8, 3, 3.2, 1.9, -2.5)
    g.box(m['wd'], 2, 0.2, 14, 0, 0.35, 11)
    for i in range(4):
        g.cyl(m['wd'], 0.15, 0.15, 1.6, 0.9 if i % 2 else -0.9, -0.3, 6 + i * 3, 6)


def tewak_float_01(C):
    g, m = _g(C)
    g.ball(m['orange'], 0.45, 0, 0.35, 0, s=(1, 0.8, 1))
    g.box(m['dark'], 0.9, 0.05, 0.9, 0, 0.12, 0)


def diving_helmet_01(C):
    g, m = _g(C)
    g.cyl(m['rust'], 0.34, 0.42, 0.14, 0, 0.07, 0, 12)
    g.ball(m['rust'], 0.45, 0, 0.45, 0)
    g.ball(m['glass'], 0.2, 0, 0.5, 0.38, ws=8, hs=6)


def pearl_shell_01(C):
    g, m = _g(C)
    g.ball(m['st'], 0.5, 0, 0.15, 0, s=(1, 0.35, 1))
    g.ball(m['lamp'], 0.12, 0, 0.3, 0.1, ws=8, hs=6)


def buoy_01(C):
    g, m = _g(C)
    g.cyl(m['red'], 0.4, 0.6, 1.4, 0, 0.7, 0, 10)
    g.cyl(m['white'], 0.53, 0.56, 0.2, 0, 0.75, 0, 10)


def turtle_stele_01(C):
    g, m = _g(C)
    g.ball(m['stD'], 0.9, 0, 0.35, 0, s=(1, 0.45, 1.3))
    g.ball(m['stD'], 0.25, 0, 0.35, 1.25, ws=8, hs=6)
    g.box(m['st'], 1, 1.6, 0.25, 0, 1.2, 0)


def sunken_plaque_01(C):
    g, m = _g(C)
    g.box(m['wd'], 2, 0.8, 0.12, 0, 0.1, 0, r=(-1.4, 0, 0))
    g.box(m['lamp'], 1.6, 0.05, 0.5, 0, 0.18, 0)


def haetae_01(C):
    g, m = _g(C)
    g.box(m['st'], 1.2, 0.6, 0.8, 0, 0.3, 0)
    g.ball(m['st'], 0.45, 0, 1, 0.2)
    g.box(m['st'], 0.5, 0.6, 0.5, 0, 0.6, -0.1)


# ---------------------------------------------------------------- amber

PASS_HALF = 9


def amber_pass_posts_01(C):
    g, m = _g(C)
    for i in (-1, 1):
        g.box(m['st'], 1.2, 4, 1.2, i * (PASS_HALF + 1.6), 2, 0)
        g.box(m['stD'], 1.5, 0.35, 1.5, i * (PASS_HALF + 1.6), 4.17, 0)


def amber_elevated_rail_01(C):
    g, m = _g(C)
    g.box(m['st'], 160, 0.8, 4, 0, 6, 0)
    for i in range(-3, 4):
        g.box(m['st'], 1.6, 6, 1.6, i * 22, 3, 0)
    for i in range(3):
        g.box(m['train'], 9, 3, 3, -20 + i * 10, 7.8, 0)
        g.box(m['alloy'], 8, 0.6, 3.1, -20 + i * 10, 8.4, 0)
    for sz in (-0.75, 0.75):
        g.box(m['steelD'], 160, 0.12, 0.15, 0, 6.46, sz)                                   # 선로


def vending_machine_01(C):
    g, m = _g(C)
    g.box(m['alloy'], 0.9, 1.9, 0.8, 0, 0.95, 0)
    g.box(m['panel'], 0.7, 0.9, 0.05, 0, 1.2, 0.42)
    g.box(m['dark'], 0.5, 0.15, 0.05, 0, 0.35, 0.42)


# ---------------------------------------------------------------- vault

GATE_HALF = 24
WAREHOUSE = (12, 7, 8)
CONTAINERS = ((-53, -43), (38, -38), (43, 43))
GANTRY_Z = -43


def vault_pass_posts_01(C):
    g, m = _g(C)
    for i in (-1, 1):
        g.box(m['alloy'], 0.6, 14, 0.6, 0, 7, i * GATE_HALF)
    for i in range(2):
        zz = 3 - i * 5
        g.box(m['st'], 0.6, 0.4, 0.6, 6, 0.2, zz); g.box(m['wd'], 0.45, 2.6, 0.45, 6, 1.7, zz); g.box(m['redW'], 0.55, 0.6, 0.5, 6, 3.1, zz)


def vault_container_yard_01(C):
    g, m = _g(C)
    W_, H_, D_ = WAREHOUSE
    g.box(m['concrete'], W_, H_, D_, 0, H_ / 2, 0)
    g.box(m['steelD'], W_ + 0.4, 0.4, D_ + 0.4, 0, H_ + 0.2, 0)
    g.box(m['shutter'], 4, 4.5, 0.1, -2.5, 2.25, D_ / 2 + 0.06); g.box(m['white'], 1, 2.2, 0.1, 3.5, 1.1, D_ / 2 + 0.06)
    cols = ('cA', 'cB', 'cC')
    for ci, c in enumerate(CONTAINERS):
        cg = g.sub((c[0], 0, c[1]), (0, 0.3 * ci, 0))
        for lv in range(2):
            cg.box(m[cols[(ci + lv) % 3]], 6, 2.6, 2.4, 0, 1.3 + lv * 2.6, lv * 0.3)
    for i in (-1, 1):
        g.box(m['yellow'], 0.5, 11, 0.5, i * 6, 5.5, GANTRY_Z)
    g.box(m['yellow'], 12.5, 0.6, 0.6, 0, 11, GANTRY_Z); g.box(m['steelD'], 0.06, 4, 0.06, 1.5, 9, GANTRY_Z)


def _case(C, shape):
    g, m = _g(C)
    g.box(m['steelD'], 1.7, 0.4, 1.7, 0, 0.2, 0)
    for sx in (-0.78, 0.78):                                                              # 유리판 테(판은 코드 — 투명 호박)
        for sz in (-0.78, 0.78):
            g.box(m['steelD'], 0.06, 2.2, 0.06, sx, 1.5, sz)
    g.box(m['steelD'], 1.66, 0.08, 1.66, 0, 2.6, 0)
    s = g.sub((0, 0.8, 0))
    if shape == 'feast':
        s.box(m['wd'], 1, 0.1, 0.6, 0, 0.3, 0)
        for i in range(3):
            s.box(m['ember'], 0.18, 0.25, 0.18, -0.4 + i * 0.4, 0.9, 0)
    elif shape == 'ship':
        s.box(m['hull'], 1, 0.25, 0.35, 0, 0.6, 0, r=(0, 0, -0.5)); s.box(m['alloy'], 0.1, 0.5, 0.1, 0.1, 0.9, 0, r=(0, 0, -0.5))
    elif shape == 'train':
        s.box(m['train'], 1.1, 0.4, 0.4, 0, 0.3, 0); s.box(m['trainB'], 1.12, 0.1, 0.42, 0, 0.2, 0)
    elif shape == 'palace':
        s.box(m['tile'], 0.9, 0.35, 0.6, 0, 0.2, 0); s.box(m['roofD'], 1.2, 0.12, 0.8, 0, 0.5, 0); s.box(m['water'], 1.3, 0.05, 1.3, 0, 0.05, 0)


def vault_case_feast_01(C):
    _case(C, 'feast')


def vault_case_ship_01(C):
    _case(C, 'ship')


def vault_case_train_01(C):
    _case(C, 'train')


def vault_case_palace_01(C):
    _case(C, 'palace')


def dideul_mortar_01(C):
    g, m = _g(C)
    g.box(m['wd'], 0.3, 0.8, 0.3, 0, 0.4, 0)
    g.box(m['wd'], 3, 0.2, 0.25, 0.4, 0.85, 0, r=(0, 0, 0.12))
    g.box(m['st'], 0.6, 0.4, 0.6, -1.1, 0.2, 0)


def sotdae_01(C):
    g, m = _g(C)
    g.box(m['wd'], 0.12, 5, 0.12, 0, 2.5, 0)
    g.box(m['wd'], 0.6, 0.15, 0.18, 0.1, 5.1, 0, r=(0, 0, 0.2))
    g.box(m['wd'], 0.12, 0.16, 0.1, 0.42, 5.24, 0, r=(0, 0, 0.5))                         # 오리 머리


def forklift_01(C):
    g, m = _g(C)
    g.box(m['yellow'], 1.4, 1, 2.2, 0, 0.8, 0); g.box(m['steelD'], 1.2, 1.4, 0.1, 0, 2, -0.4)
    g.box(m['steelD'], 0.12, 0.08, 1.4, -0.4, 0.2, 1.7); g.box(m['steelD'], 0.12, 0.08, 1.4, 0.4, 0.2, 1.7); g.box(m['steelD'], 0.1, 2.6, 0.1, 0, 1.4, 1.1)
    for sx in (-0.72, 0.72):
        for sz in (-0.7, 0.7):
            g.cyl(m['dark'], 0.3, 0.3, 0.2, sx, 0.3, sz, 10, r=(0, 0, PI / 2))


def open_container_01(C):
    g, m = _g(C)
    g.box(m['rust'], 6, 2.6, 0.1, 0, 1.3, -1.2); g.box(m['rust'], 6, 2.6, 0.1, 0, 1.3, 1.2); g.box(m['rust'], 6, 0.1, 2.4, 0, 2.6, 0)
    g.box(m['rust'], 0.1, 2.5, 1.2, 3.4, 1.25, 1.6, r=(0, 0.9, 0))
    g.box(m['rust'], 0.1, 2.6, 2.4, -3, 1.3, 0)                                            # 막힌 뒤 끝
    g.box(m['steelD'], 6, 0.1, 2.4, 0, 0.05, 0)


def seed_pod_01(C):
    g, m = _g(C)
    g.capsule(m['alloy'], 0.5, 1.2, 0, 0.5, 0, r=(0, 0, 1.3))
    g.box(m['seedD'], 0.9, 0.06, 0.3, 0, 0.5, 0.48)


def case_shards_01(C):
    g, m = _g(C)
    for i in range(3):
        g.box(m['amber'], 0.9 - i * 0.2, 1.4 - i * 0.3, 0.06, i * 0.6 - 0.6, 0.6, (i % 2) * 0.3, r=(0.3 * i, 0.8 * i, 0.4))
    for i in range(6):
        g.box(m['amber'], 0.05, 0.18, 0.05, math.cos(i * 1.9) * 1.2, 1.2 + (i % 3) * 0.5, math.sin(i * 1.9) * 1.2)


PYLON_H = 10


def steel_pylon_01(C):
    g, m = _g(C)
    g.box(m['steel'], 1.2, PYLON_H, 1.2, 0, PYLON_H / 2, 0)
    for yy in (3, 6):
        g.box(m['steelD'], 1.6, 0.3, 1.6, 0, yy, 0)
    g.box(m['dark'], 1, 0.3, 1, 0, PYLON_H + 0.15, 0)


# ---------------------------------------------------------------- fork

def fork_pass_posts_01(C):
    g, m = _g(C)
    for i in (-1, 1):
        g.box(m['alloy'], 0.6, 14, 0.6, i * GATE_HALF, 7, 0)


def lattice_stake_base_01(C):
    g, m = _g(C)
    g.box(m['stD'], 1.4, 0.8, 1.4, 0, 0.4, 0)
    g.box(m['steelD'], 1.0, 0.1, 1.0, 0, 0.85, 0)
    for i in range(4):
        a = i * PI / 2 + PI / 4
        g.cyl(m['steel'], 0.07, 0.07, 0.12, math.cos(a) * 0.6, 0.95, math.sin(a) * 0.6, 6)   # 빛 격자 다리 꽂는 자리


def fork_signpost_01(C):
    g, m = _g(C)
    g.box(m['wd'], 0.3, 3, 0.3, 0, 1.5, 0)
    for k in range(3):
        yaw = (PI, 0, PI / 2)[k]
        g.box(m['wd'], 1.6, 0.35, 0.08, -math.cos(yaw) * 0.8, 2.4 - k * 0.4, math.sin(yaw) * 0.8, r=(0, yaw, 0))
    g.box(m['glow'], 0.22, 0.22, 0.32, 0, 3.05, 0)                                        # 퓨전: 꼭대기 빛 표지


def rail_works_tents_01(C):
    g, m = _g(C)
    for k in range(2):
        t = g.sub((k * 7 - 3.5, 0, k * 1.5))
        for s in (-1, 1):
            t.box(m['canvas'], 4, 0.08, 2.4, 0, 1.1, s * 0.85, r=(s * 0.9, 0, 0))
        for dx in (-1.9, 1.9):
            t.box(m['wd'], 0.08, 2, 0.08, dx, 1, 0)
    g.box(m['steelD'], 2, 0.8, 1, 0.5, 0.4, 3)


def laundry_line_01(C):
    g, m = _g(C)
    for dx in (-2, 2):
        g.box(m['wd'], 0.12, 2.2, 0.12, dx, 1.1, 0)
    g.box(m['dark'], 4, 0.03, 0.03, 0, 2.1, 0)
    for k in range(3):
        g.box(m['cloth%d' % k], 0.8, 0.9, 0.04, -1.2 + k * 1.2, 1.6, 0.25, r=(-0.9, 0, 0))


def survey_tripod_01(C):
    g, m = _g(C)
    for k in range(3):
        ta = k * PI * 2 / 3
        g.box(m['yellow'], 0.06, 1.6, 0.06, math.cos(ta) * 0.35, 0.75, math.sin(ta) * 0.35, r=(-math.sin(ta) * 0.25, 0, math.cos(ta) * 0.25))   # 옛 js 는 부호가 거꾸로(위로 벌어짐) — 위에서 모이게
    g.box(m['steelD'], 0.4, 0.25, 0.25, 0, 1.65, 0)
    g.cyl(m['glass'], 0.06, 0.06, 0.12, 0.26, 1.67, 0, 8, r=(0, 0, PI / 2))


def rail_pile_01(C):
    g, m = _g(C)
    for k in range(4):
        g.box(m['steel'], 5, 0.14, 0.14, 0, 0.1 + k * 0.15, k * 0.2 - 0.3)
    for k in range(3):
        g.box(m['wdD'], 0.3, 0.2, 2.4, -1.6 + k * 1.6, 0.1, 1.8)


def fork_shards_01(C):
    g, m = _g(C)
    for k in range(3):
        g.box(m['glow'], 0.12, 2.2 - k * 0.5, 0.12, k * 0.5 - 0.5, 0.4, (k % 2) * 0.4, r=(1.2, k * 0.7, 0.2))
    g.box(m['amber'], 0.35, 0.35, 0.35, 0.2, 0.25, 0.3)


# ---------------------------------------------------------------- 장면(판정 몸은 코드)

def stormeye_knot_01(C):
    g, m = _g(C)
    g.cyl(m['st'], 0.5, 0.62, 1.2, 0, 0.6, 0, 10)
    g.torus(m['straw'], 0.58, 0.07, 0, 0.75, 0, 6, 16, r=(PI / 2, 0, 0))
    for i in range(3):
        a = i * 2.09
        g.box(m['paper'], 0.12, 0.34, 0.03, math.sin(a) * 0.6, 0.45, math.cos(a) * 0.6, r=(0, a, 0))


def skyroute_shrine_01(C):
    g, m = _g(C)
    R = 18
    g.box(m['st'], 9, 0.5, 6, 0, 0.25, -R + 5)
    for i in range(4):
        g.cyl(m['red'], 0.2, 0.2, 3, -3.4 + i * 2.27, 2, -R + 7.4, 8)
    g.box(m['wd'], 8, 2.6, 4, 0, 1.8, -R + 5)
    g.box(m['roof'], 9.8, 0.3, 3.2, 0, 3.6, -R + 4.1, r=(0.5, 0, 0))
    g.box(m['roof'], 9.8, 0.3, 3.2, 0, 3.6, -R + 5.9, r=(-0.5, 0, 0))


def skyroute_wreck_01(C):
    g, m = _g(C)
    g.box(m['steel'], 5, 3, 4, 5, 1.5, -4, r=(0, 0.3, 0))
    g.box(m['glow'], 3.2, 1, 0.08, 5.6, 2.2, -1.9, r=(0, 0.3, 0))
    g.sphere(m['cloth'], 7, -4, 3.5, 4, 20, 10, phil=PI * 1.4, r=(0, 0, 0.35), s=(1.8, 0.8, 1))
    g.box(m['orange'], 0.3, 4, 3, -12, 2, 4, r=(0, 0.2, 0)); g.box(m['orange'], 3, 0.3, 5, -12, 0.4, 4, r=(0, 0.2, 0))
    g.cyl(m['steel'], 0.08, 0.08, 5, -2, 2.5, -8, 6)                                      # 풍향계 대(날개는 코드)
    g.cyl(m['steelD'], 0.3, 0.3, 0.6, 9, 2.2, -4, 8, r=(0, 0, PI / 2))                    # 프로펠러 축(날은 코드)
    ex, ez = 8, 3                                                                         # 비행선 기관(25장 지키기 자리)
    g.box(m['steel'], 2.4, 1.4, 1.8, ex, 0.7, ez - 1.6)
    g.cyl(m['orange'], 0.5, 0.5, 1.9, ex, 0.7, ez - 1.6, 10, r=(PI / 2, 0, 0))


def skyroute_orbit_01(C):
    g, m = _g(C)
    R = 16
    for i in (-1, 1):
        g.cyl(m['steel'], 0.15, 0.15, 6, i * (R + 2), 1.5, 0, 6, r=(0, 0, PI / 2))
        g.box(m['panel'], 8, 0.12, 5, i * (R + 6), 1.5, 0)
    g.cyl(m['steel'], 0.12, 0.2, 9, 0, 4.5, -R + 3, 6)
    for i in range(3):
        sa = i * PI * 2 / 3
        g.cyl(m['alloy'], 0.9, 1.2, 1.6, math.sin(sa) * 9, 0.8, -math.cos(sa) * 9, 10)


CRANE_TOP, LEG_HALF, BEAM_W = 12.6, 0.55, 1.2
YP = dict(slab=(0, 0, 28, 22), slip=(0, 14, 8, 16), legA=(-7.5, 12), legB=(7.5, 12), shed=(-8, -6, 9, 7, 5), weld=(5, -2))


def era_shipyard_01(C):
    g, m = _g(C)
    g.box(m['concrete'], YP['slab'][2], 0.3, YP['slab'][3], 0, 0.15, 0)
    g.box(m['wd'], YP['slip'][2], 0.3, YP['slip'][3], 0, -0.6, YP['slip'][1], r=(0.12, 0, 0))
    for i in range(5):
        g.torus(m['rust'], 3.1, 0.18, 0, 0.2, 8 + i * 2.4, 6, 14, PI)
    g.box(m['rust'], 0.4, 0.4, 11, 0, 0.3, 12.8)
    for lg in (YP['legA'], YP['legB']):
        g.box(m['yellow'], LEG_HALF * 2, CRANE_TOP, LEG_HALF * 2, lg[0], CRANE_TOP / 2, lg[1])
    lz = YP['legA'][1]
    g.box(m['yellow'], 17, 0.6, BEAM_W, 0, CRANE_TOP - 0.3, lz)
    g.box(m['dark'], 1.4, 1.2, 1.6, 3.5, CRANE_TOP - 1.2, lz)
    g.box(m['steel'], 0.06, 6, 0.06, 3.5, CRANE_TOP - 4.6, lz)
    for i in range(6):
        g.box(m['dark'], 0.08, 0.08, LEG_HALF * 2 + 0.05, YP['legA'][0] + LEG_HALF + 0.02, 1.2 + i * 2, lz)
    sx, sz, sw, sd, sh = YP['shed']
    g.box(m['rust'], sw, sh, sd, sx, sh / 2, sz)
    g.box(m['roof'], sw + 0.6, 0.35, sd + 0.6, sx, sh + 0.17, sz)
    g.box(m['dark'], 3, 3.2, 0.1, sx, 1.6, sz + sd / 2 + 0.05)
    g.box(m['steel'], 1.8, 0.9, 1.1, YP['weld'][0], 0.45, YP['weld'][1])


YARD_HALF, WALL_H, WALL_T = (8, 7), 1.4, 0.6
STABLE = dict(x=-4.5, y=-3.5, w=6, d=4, h=2.6)
STP = dict(trough=(-4.5, -0.8), flag=(4, -5), totemA=(10, -16), totemB=(14, -16))


def era_post_station_01(C):
    g, m = _g(C)
    hx, hy = YARD_HALF
    g.box(m['dirt'], hx * 2, 0.06, hy * 2, 0, 0.03, 0)
    g.box(m['st'], hx * 2, WALL_H, WALL_T, 0, WALL_H / 2, -hy)
    g.box(m['st'], WALL_T, WALL_H, hy * 2, -hx, WALL_H / 2, 0)
    g.box(m['st'], hx * 2, WALL_H, WALL_T, 0, WALL_H / 2, hy)
    S = STABLE
    g.box(m['wd'], S['w'], S['h'], 0.3, S['x'], S['h'] / 2, S['y'] - S['d'] / 2 + 0.3)
    for i in range(3):
        g.box(m['wd'], 0.25, S['h'], 0.25, S['x'] - S['w'] / 2 + 0.2 + i * (S['w'] - 0.4) / 2, S['h'] / 2, S['y'] + S['d'] / 2 - 0.2)
    g.cone(m['thatch'], math.hypot(S['w'], S['d']) / 2 + 0.6, 1.5, S['x'], S['h'] + 0.7, S['y'], 4, r=(0, PI / 4, 0), s=(1, 1, S['d'] / S['w']))
    g.box(m['wd'], 2.2, 0.5, 0.7, STP['trough'][0], 0.25, STP['trough'][1])
    g.box(m['wd'], 0.14, 6, 0.14, STP['flag'][0], 3, STP['flag'][1])
    for j, k in enumerate(('totemA', 'totemB')):
        t = STP[k]
        g.box(m['totem'], 0.7, 2.2, 0.6, t[0], 1.1, t[1])
        g.ball(m['totem'], 0.5, t[0], 2.6, t[1], s=(1, 1.2, 0.9))
        g.box(m['wd'] if j else m['redW'], 0.9, 0.12, 0.1, t[0], 2.95, t[1] - 0.3)


def nightecho_ember_base_01(C):
    g, m = _g(C)
    g.cyl(m['slate'], 0.8, 0.85, 0.08, 0, 0.04, 0, 10)
    for i in range(8):
        a = i * PI / 4
        g.ball(m['stD'], 0.2 + (i % 3) * 0.03, math.cos(a) * 1.0, 0.12, math.sin(a) * 1.0, s=(1, 0.7, 1), ws=7, hs=5)
    g.box(m['dark'], 0.5, 0.1, 0.5, 0, 0.12, 0, r=(0, 0.4, 0))                             # 불 자리 숯돌


K141 = {f.__name__: f for f in (
    frost_hut_01, frost_satdish_01, snowman_01, frost_ice_cave_01,
    crossing_tilted_gate_01, guard_robot_01, crossing_dial_01, roof_tile_shards_01, crossing_pod_01, ticket_machine_01, sword_helm_01,
    solar_farm_01, phone_booth_01, courier_bot_01, time_capsule_01, bus_stop_01, lattice_mast_01, cairn_01,
    sunken_lab_01, tewak_float_01, diving_helmet_01, pearl_shell_01, buoy_01, turtle_stele_01, sunken_plaque_01, haetae_01,
    amber_pass_posts_01, amber_elevated_rail_01, vending_machine_01,
    vault_pass_posts_01, vault_container_yard_01, vault_case_feast_01, vault_case_ship_01, vault_case_train_01, vault_case_palace_01,
    dideul_mortar_01, sotdae_01, forklift_01, open_container_01, seed_pod_01, case_shards_01, steel_pylon_01,
    fork_pass_posts_01, lattice_stake_base_01, fork_signpost_01, rail_works_tents_01, laundry_line_01, survey_tripod_01, rail_pile_01, fork_shards_01,
    stormeye_knot_01, skyroute_shrine_01, skyroute_wreck_01, skyroute_orbit_01, era_shipyard_01, era_post_station_01, nightecho_ember_base_01)}
