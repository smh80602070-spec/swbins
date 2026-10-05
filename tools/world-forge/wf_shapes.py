"""world-forge 곡면 도우미(10-06) — 무기(build_weapon)·장비(build_equip)가 같이 쓴다. 상자·원통 조립이 "허접" 판정을 받아 만든 것.
loft = 높이마다 마름모 단면을 이은 날 · plate = 윤곽 → 가장자리가 얇은 판 · ball = 둥근 덩이 · surf = 점 격자 면(바깥 법선 자동) · ring = 타원 고리·부분 호.
면은 버텍스를 공유하지 않으므로(Mesh.face) 바깥에서 보아 반시계로 감는다.
"""
import math

from mathutils import Vector

from build_prop import tube


def loft(M, secs, slot, tile=0.4):
    """날 — 높이(z)마다 단면 (z, cx, w, t) 를 이어 붙인다. 단면 = 날(±x 끝이 날카로움)·등(±y) 네 점의 마름모.
    cx = 단면 가운데 x(휘는 날), w = 반폭, t = 반두께. 마지막 단면 w=0 이면 끝이 한 점(날끝). 바깥에서 보아 반시계."""
    rings = []
    for z, cx, w, t in secs:
        rings.append([Vector((cx + w, 0, z)), Vector((cx, t, z)), Vector((cx - w, 0, z)), Vector((cx, -t, z))])
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        z0, z1 = secs[i][0] / tile, secs[i + 1][0] / tile
        tip = secs[i + 1][2] < 1e-5
        for k in range(4):
            k2 = (k + 1) % 4
            u0, u1 = k * 0.05, (k + 1) * 0.05
            if tip:
                M.face([a[k], a[k2], b[0]], [(u0, z0), (u1, z0), ((u0 + u1) / 2, z1)], slot)
            else:
                M.quad(a[k], a[k2], b[k2], b[k], slot, (u0, z0), (u1, z0), (u1, z1), (u0, z1))
        if tip:
            break
    r0 = rings[0]
    M.face([r0[3], r0[2], r0[1], r0[0]], [(0, 0), (0.05, 0), (0.05, 0.05), (0, 0.05)], slot)       # 밑면(아래에서 보아 반시계)


def plate(M, outline, o, U, V, tc, slot, bevel=0.02, te=0.003, tile=0.4):
    """판 — (U, V) 평면의 윤곽(반시계)을 가운데 두께 ±tc, 가장자리 ±te 로 돌출(가장자리로 갈수록 얇아지는 날·판).
    bevel = 가장자리에서 안쪽 평평한 면까지 거리(m). 오목한 윤곽(초승달 도끼날)도 꼭짓점별 안쪽 이동이라 괜찮다."""
    o, U, V = Vector(o), Vector(U).normalized(), Vector(V).normalized()
    N = U.cross(V).normalized()
    if sum(outline[i - 1][0] * outline[i][1] - outline[i][0] * outline[i - 1][1] for i in range(len(outline))) < 0:
        outline = list(reversed(outline))                                                       # 시계 방향으로 줘도 반시계로
    n = len(outline)
    P = [Vector(p) for p in outline]
    Q = []
    for i in range(n):
        p0, p1, p2 = P[i - 1], P[i], P[(i + 1) % n]
        e0, e1 = (p1 - p0).normalized(), (p2 - p1).normalized()
        n0, n1 = Vector((-e0.y, e0.x)), Vector((-e1.y, e1.x))        # 왼쪽 = 안쪽(반시계)
        m = (n0 + n1)
        m = m.normalized() if m.length > 1e-6 else n0
        c = max(0.35, m.dot(n0))
        Q.append(p1 + m * (bevel / c))
    w = lambda p, h: o + U * p.x + V * p.y + N * h
    uv = lambda p: (p.x / tile, p.y / tile)
    M.face([w(q, tc) for q in Q], [uv(q) for q in Q], slot)                                     # 윗면
    M.face([w(q, -tc) for q in reversed(Q)], [uv(q) for q in reversed(Q)], slot)               # 아랫면
    for i in range(n):
        j = (i + 1) % n
        M.quad(w(P[i], te), w(P[j], te), w(Q[j], tc), w(Q[i], tc), slot, uv(P[i]), uv(P[j]), uv(Q[j]), uv(Q[i]))
        M.quad(w(Q[i], -tc), w(Q[j], -tc), w(P[j], -te), w(P[i], -te), slot, uv(Q[i]), uv(Q[j]), uv(P[j]), uv(P[i]))
        M.quad(w(P[i], -te), w(P[j], -te), w(P[j], te), w(P[i], te), slot, uv(P[i]), uv(P[j]), (uv(P[j])[0], uv(P[j])[1] + 0.02), (uv(P[i])[0], uv(P[i])[1] + 0.02))


def ball(M, c, r, slot, n=6):
    """둥근 덩이(손잡이 끝·보석 받침) — 원뿔대 세 칸으로 구에 가깝게."""
    x, y, z = c
    tube(M, (x, y, z - r), (x, y, z - r * 0.5), r * 0.35, r * 0.87, slot, 0.3, n)
    tube(M, (x, y, z - r * 0.5), (x, y, z + r * 0.5), r * 0.87, r * 0.87, slot, 0.3, n, caps=False)
    tube(M, (x, y, z + r * 0.5), (x, y, z + r), r * 0.87, r * 0.35, slot, 0.3, n)


def surf(M, rows, centers, slot, closed=True, tile=0.3):
    """점 격자(rows[i][j]) 를 사각형으로 잇는다. centers[i] = 그 줄의 안쪽 기준점 — 첫 면 법선이 안쪽을 보면 열 순서를 뒤집는다(면이 따로 놀아 법선 재계산이 안 되므로)."""
    rows = [[Vector(p) for p in r] for r in rows]
    nc = len(rows[0])
    a, b, d = rows[0][0], rows[0][1], rows[1][0]
    nrm = (b - a).cross(d - a)
    if nrm.dot(a - Vector(centers[0])) < 0:
        rows = [list(reversed(r)) for r in rows]
    cols = nc if closed else nc - 1
    for i in range(len(rows) - 1):
        for j in range(cols):
            j2 = (j + 1) % nc
            p0, p1, p2, p3 = rows[i][j], rows[i][j2], rows[i + 1][j2], rows[i + 1][j]
            u0, u1 = j / cols / tile, (j + 1) / cols / tile
            v0, v1 = i / tile * 0.2, (i + 1) / tile * 0.2
            M.quad(p0, p1, p2, p3, slot, (u0, v0), (u1, v0), (u1, v1), (u0, v1))


def ring(axis, c, rx, ry, n=14, a0=-math.pi, a1=math.pi, closed=True):
    """axis 'z'(가로 고리, 앞 = -y)·'x'(팔 방향)·'y'. 각도 a0~a1(닫힘이면 끝 점 빼고). rx·ry = 두 반지름."""
    cnt = n if closed else n + 1
    pts = []
    for k in range(cnt):
        t = a0 + (a1 - a0) * k / (n if closed else n)
        u, v = math.sin(t) * rx, -math.cos(t) * ry          # t=0 → 앞(-y 또는 +z)
        if axis == 'z':
            pts.append((c[0] + u, c[1] + v, c[2]))
        elif axis == 'x':
            pts.append((c[0], c[1] + u, c[2] - v))           # x 축 고리: t=0 → 위(+z)
        else:
            pts.append((c[0] + u, c[1], c[2] - v))
    return pts
