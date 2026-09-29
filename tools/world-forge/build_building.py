"""world-forge 건물 생성기 — 레시피(JSON) 하나 = 건물 `.glb` 하나. Blender 헤드리스.

  blender -b --factory-startup -P tools/world-forge/build_building.py -- --recipe tools/world-forge/recipes/eu_house_01.json --out tools/world-forge/_out/eu_house_01.glb

레시피 칸:
  id, era(past|present|future), footprint [폭 x, 깊이 y] m, floors [{"h": 층 높이}…], seed
  walls {mat, tile_m, tint}  base {mat, h}  trim {mat, tint}  door {mat, w, h}  glass {color}
  windows {w, h, sill, gap, cols?}  — 층마다 앞·뒤·옆 벽에 gap 간격으로 자동 배치(문 자리는 비움)
  roof {type: gable|hip|flat, pitch_deg, overhang, mat, thick, curve(추녀 들림 m), ridge: "x"|"y", parapet(평지붕 난간 높이)}
  posts {every m, w}   — 기둥(한옥·목골)  ·  bands true  — 층 사이 띠  ·  chimney {x, y, w, h}
좌표: 바닥 중심이 원점이 아니라 (0,0)~(폭,깊이) 모서리 기준이고, 끝에 발 위치를 (0,0,0)로 옮겨 내보낸다(원점 = 바닥 앞 가운데).
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wf_common as W  # noqa: E402


def arg(name, default=None):
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return a[a.index(name) + 1] if name in a else default


def V(x, y, z):
    return Vector((x, y, z))


class Wall:
    """한 변 — A→B(시계 반대 둘레, 바깥은 오른쪽). u 를 따라 z0~z1, 구멍 목록 = [(u0,u1,v0,v1, kind)]."""

    def __init__(self, a, b):
        self.a, self.b = Vector(a), Vector(b)
        d = self.b - self.a
        self.L = d.length
        self.t = d / self.L
        self.n = V(self.t.y, -self.t.x, 0)     # 바깥
        self.up = V(0, 0, 1)

    def at(self, u, v, z0=0.0, depth=0.0):
        return self.a + self.t * u + self.n * depth + self.up * (z0 + v)


def wall_panels(M, w, z0, z1, holes, slot, tile, uoff=0.0):
    """구멍을 비운 벽 조각들 — 구멍 경계로 가로세로를 나눠 칸마다 면 하나."""
    H = z1 - z0
    us = sorted({0.0, w.L} | {h[0] for h in holes} | {h[1] for h in holes})
    vs = sorted({0.0, H} | {h[2] for h in holes} | {h[3] for h in holes})
    for i in range(len(us) - 1):
        for j in range(len(vs) - 1):
            ua, ub, va, vb = us[i], us[i + 1], vs[j], vs[j + 1]
            if ub - ua < 1e-4 or vb - va < 1e-4:
                continue
            cu, cv = (ua + ub) / 2, (va + vb) / 2
            if any(h[0] < cu < h[1] and h[2] < cv < h[3] for h in holes):
                continue
            M.quad(w.at(ua, va, z0), w.at(ub, va, z0), w.at(ub, vb, z0), w.at(ua, vb, z0), slot,
                   ((ua + uoff) / tile, (z0 + va) / tile), ((ub + uoff) / tile, (z0 + va) / tile),
                   ((ub + uoff) / tile, (z0 + vb) / tile), ((ua + uoff) / tile, (z0 + vb) / tile))


def opening_detail(M, w, z0, h, s_trim, s_glass, s_door, s_wall, tile, rec=0.16):
    """구멍 안쪽 — 옆·위·아래 두께면 + 창(유리·틀·가운데 살) 또는 문(판). kind = 'win'|'door'."""
    u0, u1, v0, v1, kind = h
    P = lambda u, v, d: w.at(u, v, z0, -d)
    fw = 0.07
    # 두께면(바깥에서 안으로 rec 만큼)
    M.quad(P(u0, v0, 0), P(u0, v1, 0), P(u0, v1, rec), P(u0, v0, rec), s_wall, (0, 0), (0, 1), (rec, 1), (rec, 0))      # 왼쪽
    M.quad(P(u1, v0, 0), P(u1, v0, rec), P(u1, v1, rec), P(u1, v1, 0), s_wall, (0, 0), (rec, 0), (rec, 1), (0, 1))      # 오른쪽
    M.quad(P(u0, v1, 0), P(u1, v1, 0), P(u1, v1, rec), P(u0, v1, rec), s_wall, (0, 0), (1, 0), (1, rec), (0, rec))      # 위
    if kind == 'win':
        M.quad(P(u0, v0, 0), P(u0, v0, rec), P(u1, v0, rec), P(u1, v0, 0), s_trim, (0, 0), (rec, 0), (rec, 1), (0, 1))  # 아래(문턱)
        # 유리
        M.quad(P(u0, v0, rec), P(u1, v0, rec), P(u1, v1, rec), P(u0, v1, rec), s_glass)
        # 바깥 틀 — 얇은 상자 넷 + 가운데 십자
        o = w.at(u0, v0, z0, 0.02)
        ut, vt, dt = w.t, w.up, -w.n
        M.box(w.at(u0 - fw, v0 - fw, z0, 0.0), ut * (u1 - u0 + 2 * fw), vt * fw, -dt * 0.05, s_trim, 0.5)        # 아래 틀
        M.box(w.at(u0 - fw, v1, z0, 0.0), ut * (u1 - u0 + 2 * fw), vt * fw, -dt * 0.05, s_trim, 0.5)             # 위 틀
        M.box(w.at(u0 - fw, v0, z0, 0.0), ut * fw, vt * (v1 - v0), -dt * 0.05, s_trim, 0.5)                      # 왼 틀
        M.box(w.at(u1, v0, z0, 0.0), ut * fw, vt * (v1 - v0), -dt * 0.05, s_trim, 0.5)                           # 오른 틀
        cu, cv = (u0 + u1) / 2, (v0 + v1) / 2
        M.box(w.at(cu - 0.02, v0, z0, -0.10), ut * 0.04, vt * (v1 - v0), -dt * 0.04, s_trim, 0.5)                # 세로 살
        M.box(w.at(u0, cv - 0.02, z0, -0.10), ut * (u1 - u0), vt * 0.04, -dt * 0.04, s_trim, 0.5)                # 가로 살
    else:
        # 문판 — 구멍 안쪽 rec-0.06 에 판, 바깥 틀
        M.quad(P(u0, v0, rec - 0.05), P(u1, v0, rec - 0.05), P(u1, v1, rec - 0.05), P(u0, v1, rec - 0.05), s_door,
               (0, 0), ((u1 - u0) / 1.0, 0), ((u1 - u0) / 1.0, (v1 - v0) / 1.0), (0, (v1 - v0) / 1.0))
        ut, vt, dt = w.t, w.up, -w.n
        M.box(w.at(u0 - fw, v1, z0, 0.0), ut * (u1 - u0 + 2 * fw), vt * fw * 1.4, -dt * 0.06, s_trim, 0.5)
        M.box(w.at(u0 - fw, v0, z0, 0.0), ut * fw, vt * (v1 - v0), -dt * 0.06, s_trim, 0.5)
        M.box(w.at(u1, v0, z0, 0.0), ut * fw, vt * (v1 - v0), -dt * 0.06, s_trim, 0.5)
        # 문턱 계단 한 단
        M.box(w.at(u0 - 0.15, 0, z0, 0.0), ut * (u1 - u0 + 0.3), vt * 0.12, -dt * 0.45, s_wall, 1.0)


def plan_openings(rc, wall_i, w, z0, fh, floor_i):
    """벽 하나·층 하나의 구멍 — 문(앞벽 0번 벽 1층 가운데)과 창을 gap 간격으로."""
    win = rc.get('windows', {})
    ww, wh, sill = win.get('w', 0.9), win.get('h', 1.25), win.get('sill', 0.9)
    gap = win.get('gap', 2.4)
    holes = []
    door = rc.get('door', {})
    if wall_i == door.get('wall', 0) and floor_i == 0 and door:
        dw, dh = door.get('w', 1.1), door.get('h', 2.15)
        cu = w.L * door.get('at', 0.5)
        holes.append((cu - dw / 2, cu + dw / 2, 0.0, dh, 'door'))
    if rc.get('posts'):   # 기둥이 있으면 창은 기둥 사이 가운데 — 폭은 칸 - 0.5
        npost = max(1, int(round(w.L / rc['posts'].get('every', 2.4))))
        span = w.L / npost
        for k in range(npost):
            cu = (k + 0.5) * span
            u0, u1 = cu - min(ww, span - 0.5) / 2, cu + min(ww, span - 0.5) / 2
            v0 = sill
            v1 = min(v0 + wh, fh - 0.35)
            if any(not (u1 < h[0] - 0.1 or u0 > h[1] + 0.1) for h in holes if h[4] == 'door'):
                continue
            if wall_i in win.get('skip_walls', []):
                continue
            holes.append((u0, u1, v0, v1, 'win'))
        return holes
    n = max(0, int((w.L - 0.6) // gap))
    if n:
        margin = (w.L - (n - 1) * gap) / 2 if n > 1 else w.L / 2
        for k in range(n):
            cu = margin + k * gap
            u0, u1 = cu - ww / 2, cu + ww / 2
            if u0 < 0.35 or u1 > w.L - 0.35:
                continue
            v0 = sill if not (win.get('ribbon') and floor_i > 0) else 0.6
            v1 = min(v0 + wh, fh - 0.35)
            if any(not (u1 < h[0] - 0.3 or u0 > h[1] + 0.3) for h in holes if h[4] == 'door'):
                continue
            if wall_i in win.get('skip_walls', []):
                continue
            holes.append((u0, u1, v0, v1, 'win'))
    return holes


def roof_planes(rc, w, d, z_eave):
    """지붕 평면 목록 — 각 평면 = (처마 선 A,B, 마루 선 C,D, 종류). 좌표는 3D. 겹처마(overhang)는 처마를 밖·아래로 민다."""
    r = rc['roof']
    typ = r['type']
    oh = r.get('overhang', 0.5)
    tanp = math.tan(math.radians(r.get('pitch_deg', 30)))
    x0, x1, y0, y1 = -oh, w + oh, -oh, d + oh
    ze = z_eave - oh * tanp * (0.0 if typ == 'flat' else 1.0)
    ridge_along_x = r.get('ridge', 'x' if w >= d else 'y') == 'x'
    planes = []
    if typ == 'gable':
        if ridge_along_x:
            ym = d / 2
            hr = (ym - y0) * tanp
            planes.append(((V(x0, y0, ze), V(x1, y0, ze)), (V(x0, ym, ze + hr), V(x1, ym, ze + hr)), 'front'))
            planes.append(((V(x1, y1, ze), V(x0, y1, ze)), (V(x1, ym, ze + hr), V(x0, ym, ze + hr)), 'back'))
        else:
            xm = w / 2
            hr = (xm - x0) * tanp
            planes.append(((V(x1, y0, ze), V(x1, y1, ze)), (V(x1 - (x1 - xm), y0, ze + hr), V(xm, y1, ze + hr)), 'right'))
            planes[-1] = ((V(x1, y0, ze), V(x1, y1, ze)), (V(xm, y0, ze + hr), V(xm, y1, ze + hr)), 'right')
            planes.append(((V(x0, y1, ze), V(x0, y0, ze)), (V(xm, y1, ze + hr), V(xm, y0, ze + hr)), 'left'))
    elif typ == 'hip':
        span = min(x1 - x0, y1 - y0)
        hr = span / 2 * tanp
        if ridge_along_x:
            a = x0 + span / 2
            b = x1 - span / 2
            ym = (y0 + y1) / 2
            R0, R1 = V(a, ym, ze + hr), V(b, ym, ze + hr)
            planes.append(((V(x0, y0, ze), V(x1, y0, ze)), (R0, R1), 'front'))
            planes.append(((V(x1, y1, ze), V(x0, y1, ze)), (R1, R0), 'back'))
            planes.append(((V(x1, y0, ze), V(x1, y1, ze)), (R1, R1), 'right'))
            planes.append(((V(x0, y1, ze), V(x0, y0, ze)), (R0, R0), 'left'))
        else:
            a = y0 + span / 2
            b = y1 - span / 2
            xm = (x0 + x1) / 2
            R0, R1 = V(xm, a, ze + hr), V(xm, b, ze + hr)
            planes.append(((V(x1, y0, ze), V(x1, y1, ze)), (R0, R1), 'right'))
            planes.append(((V(x0, y1, ze), V(x0, y0, ze)), (R1, R0), 'left'))
            planes.append(((V(x0, y0, ze), V(x1, y0, ze)), (R0, R0), 'front'))
            planes.append(((V(x1, y1, ze), V(x0, y1, ze)), (R1, R1), 'back'))
    return planes, ze, (x0, x1, y0, y1)


def build_roof(M, rc, w, d, z_eave, s_roof, s_trim, s_wall_gable):
    r = rc['roof']
    typ = r['type']
    tile = float(r.get('tile_m', 1.5))
    thick = r.get('thick', 0.12)
    if typ == 'flat':
        par = r.get('parapet', 0.0)
        oh = r.get('overhang', 0.0)
        x0, x1, y0, y1 = -oh, w + oh, -oh, d + oh
        z = z_eave
        M.quad(V(x0, y0, z), V(x1, y0, z), V(x1, y1, z), V(x0, y1, z), s_roof, (0, 0), ((x1 - x0) / tile, 0), ((x1 - x0) / tile, (y1 - y0) / tile), (0, (y1 - y0) / tile))
        M.box(V(x0, y0, z - thick), V(x1 - x0, 0, 0), V(0, 0, thick), V(0, y1 - y0, 0), s_trim, 1.0)
        if par > 0:
            pw = 0.18
            M.box(V(x0, y0, z), V(x1 - x0, 0, 0), V(0, 0, par), V(0, pw, 0), s_trim, 1.0)
            M.box(V(x0, y1 - pw, z), V(x1 - x0, 0, 0), V(0, 0, par), V(0, pw, 0), s_trim, 1.0)
            M.box(V(x0, y0 + pw, z), V(pw, 0, 0), V(0, 0, par), V(0, y1 - y0 - 2 * pw, 0), s_trim, 1.0)
            M.box(V(x1 - pw, y0 + pw, z), V(pw, 0, 0), V(0, 0, par), V(0, y1 - y0 - 2 * pw, 0), s_trim, 1.0)
        return z + par
    planes, ze, (x0, x1, y0, y1) = roof_planes(rc, w, d, z_eave)
    strips = int(r.get('strips', 6))
    curve = r.get('curve', 0.0)
    top = ze
    for (A, B), (C, D), side in planes:
        # 처마→마루로 strips 등분, 처마 쪽 곡선(들림)
        rows = []
        for k in range(strips + 1):
            t = k / strips
            lift = curve * (1.0 - t) ** 3 if curve else 0.0
            rows.append((A.lerp(C, t) + V(0, 0, lift), B.lerp(D, t) + V(0, 0, lift)))
        for k in range(strips):
            (a0, b0), (a1, b1) = rows[k], rows[k + 1]
            uv = lambda p, kk: ((p - A).dot((B - A).normalized()) / tile, (p - A).length / tile)
            if (a1 - b1).length < 1e-4:   # 삼각형 꼭대기
                M.face([a0, b0, a1], [uv(a0, k), uv(b0, k), uv(a1, k + 1)], s_roof)
            else:
                M.quad(a0, b0, b1, a1, s_roof, uv(a0, k), uv(b0, k), uv(b1, k + 1), uv(a1, k + 1))
            top = max(top, a1.z, b1.z)
        # 처마 끝 두께 띠(아래로)
        e0, e1 = rows[0]
        M.quad(e0, e1, e1 - V(0, 0, thick), e0 - V(0, 0, thick), s_trim, (0, 0), ((e1 - e0).length, 0), ((e1 - e0).length, thick), (0, thick))
        # 처마 아래면(어둡게 보이도록 같은 재질) — 벽 위 z_eave 높이로 덮는 얇은 면
    # 박공벽 삼각형(맞배)
    if typ == 'gable':
        ridge_x = r.get('ridge', 'x' if w >= d else 'y') == 'x'
        hr = None
        for (A, B), (C, D), side in planes[:1]:
            hr = C.z
        base = z_eave
        # 벽 위 삼각형 — 처마선(벽 높이)에서 마루 높이까지, 벽 폭
        ridge_z = max(p.z for pl in planes for p in pl[1])
        if ridge_x:
            for x, sgn in ((0.0, -1), (w, 1)):
                pts = [V(x, 0, base), V(x, d, base), V(x, d / 2, ridge_z - (ze - z_eave) * 0 - (planes[0][0][0].z - z_eave) * 0)]
                # 벽 위 삼각형은 처마 높이 z_eave 에서 (마루 높이 - 겹처마 낙차)까지
                rz = z_eave + (d / 2) * math.tan(math.radians(r.get('pitch_deg', 30)))
                pts = [V(x, 0, z_eave), V(x, d, z_eave), V(x, d / 2, rz)]
                if sgn > 0:
                    M.face(pts, [(p.y / tile, p.z / tile) for p in pts], s_wall_gable)
                else:
                    pts = [pts[1], pts[0], pts[2]]
                    M.face(pts, [(p.y / tile, p.z / tile) for p in pts], s_wall_gable)
        else:
            rz = z_eave + (w / 2) * math.tan(math.radians(r.get('pitch_deg', 30)))
            for y, sgn in ((0.0, 1), (d, -1)):
                pts = [V(0, y, z_eave), V(w, y, z_eave), V(w / 2, y, rz)]
                if sgn < 0:
                    pts = [pts[1], pts[0], pts[2]]
                M.face(pts, [(p.x / tile, p.z / tile) for p in pts], s_wall_gable)
    return top


def build(rc, out):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M = W.Mesh(rc['id'])
    wl, tr, rf = rc['walls'], rc.get('trim', {}), rc['roof']
    tile = wl.get('tile_m', 2.0)
    s_wall = M.slot_of('wall', W.pbr_material(wl['mat'], tile, wl.get('tint'), name='wall'))
    s_base = M.slot_of('base', W.pbr_material(rc['base']['mat'], rc['base'].get('tile_m', 2.0), rc['base'].get('tint'), name='base')) if rc.get('base') else s_wall
    s_trim = M.slot_of('trim', W.pbr_material(tr.get('mat', 'brown_planks_03'), tr.get('tile_m', 1.0), tr.get('tint'), name='trim'))
    s_roof = M.slot_of('roof', W.pbr_material(rf['mat'], rf.get('tile_m', 1.5), rf.get('tint'), name='roof'))
    s_glass = M.slot_of('glass', W.flat_material('glass', rc.get('glass', {}).get('color', '#8fb4c8'), rough=0.05, alpha=0.35))
    dm = rc.get('door', {})
    s_door = M.slot_of('door', W.pbr_material(dm.get('mat', 'black_painted_planks'), 1.0, dm.get('tint'), name='door')) if dm else s_trim

    w, d = rc['footprint']
    floors = rc['floors']
    base_h = rc.get('base', {}).get('h', 0.0)
    corners = [V(0, 0, 0), V(w, 0, 0), V(w, d, 0), V(0, d, 0)]
    walls = [Wall(corners[i], corners[(i + 1) % 4]) for i in range(4)]
    z = base_h
    # 기단
    if base_h > 0:
        for i, wal in enumerate(walls):
            hole = []
            door = rc.get('door', {})
            if door and i == door.get('wall', 0):
                cu = wal.L * door.get('at', 0.5)
                hole = [(cu - door.get('w', 1.1) / 2 - 0.15, cu + door.get('w', 1.1) / 2 + 0.15, 0.0, 0.0, 'step')]
            wall_panels(M, wal, 0.0, base_h, [], s_base, rc['base'].get('tile_m', 2.0))
        # 기단 윗면(뚜껑) — 벽 두께 없이 덮개로 막는다
        M.quad(V(0, 0, base_h), V(0, d, base_h), V(w, d, base_h), V(w, 0, base_h), s_base, (0, 0), (0, d), (w, d), (w, 0))
    for fi, fl in enumerate(floors):
        fh = fl['h']
        for i, wal in enumerate(walls):
            holes = plan_openings(rc, i, wal, z, fh, fi)
            wall_panels(M, wal, z, z + fh, holes, s_wall, tile, uoff=i * 3.1 + fi * 1.7)
            for h in holes:
                opening_detail(M, wal, z, h, s_trim, s_glass, s_door, s_wall, tile)
        if rc.get('bands') and fi < len(floors) - 1:
            bh = 0.16
            M.box(V(-0.06, -0.06, z + fh - bh / 2), V(w + 0.12, 0, 0), V(0, 0, bh), V(0, d + 0.12, 0), s_trim, 1.0)
        z += fh
    # 기둥·모서리
    po = rc.get('posts')
    zt = base_h
    zb = z
    if po:
        pw = po.get('w', 0.22)
        for i, wal in enumerate(walls):
            nposts = max(1, int(round(wal.L / po.get('every', 2.4))))
            for k in range(nposts + (1 if i >= 0 else 0)):
                u = wal.L * k / nposts
                if k == nposts:
                    continue
                if any(abs(u - (wal.L * rc.get('door', {}).get('at', 0.5))) < (rc.get('door', {}).get('w', 1.1) / 2 + 0.2) for _ in [0]) and i == rc.get('door', {}).get('wall', 0):
                    continue
                o = wal.at(u - pw / 2, 0, zt, 0.0) + wal.n * 0.0
                M.box(wal.at(u - pw / 2, 0, zt, -0.02), wal.t * pw, V(0, 0, zb - zt), wal.n * (pw + 0.02), s_trim, 1.0)
    for i in range(4):
        c = corners[i]
        cw = 0.16
        if rc.get('corners', True):
            M.box(V(c.x - cw / 2 + (0.02 if c.x == 0 else -0.02) * 0, c.y - cw / 2, zt), V(cw, 0, 0), V(0, 0, zb - zt), V(0, cw, 0), s_trim, 1.0)
    # 지붕
    top = build_roof(M, rc, w, d, z, s_roof, s_trim, s_wall)
    # 굴뚝
    ch = rc.get('chimney')
    if ch:
        M.box(V(ch['x'] - ch['w'] / 2, ch['y'] - ch['w'] / 2, base_h), V(ch['w'], 0, 0), V(0, 0, top + ch.get('h', 0.9) - base_h), V(0, ch['w'], 0), s_base, 1.5)
        M.box(V(ch['x'] - ch['w'] / 2 - 0.06, ch['y'] - ch['w'] / 2 - 0.06, top + ch.get('h', 0.9) - 0.1), V(ch['w'] + 0.12, 0, 0), V(0, 0, 0.1), V(0, ch['w'] + 0.12, 0), s_trim, 1.0)
    ob = M.build()
    # 원점 = 바닥 앞 가운데
    ob.location = (-w / 2, -0.0, 0)
    bpy.context.view_layer.update()
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    W.export_glb([ob], out, int(rc.get('tex_max', 1024)))
    lic = {'id': rc['id'], 'generator': 'tools/world-forge/build_building.py', 'blender': bpy.app.version_string,
           'license': 'CC0-1.0 (재질 사진 전부 Poly Haven CC0)',
           'inputs': sorted({f'polyhaven: {m.name}' for m in ob.data.materials}),
           'size_m': [w, d, round(top, 2)], 'tris': tris}
    json.dump(lic, open(os.path.splitext(out)[0] + '.license.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('WORLDFORGE', json.dumps({'id': rc['id'], 'tris': tris, 'size_m': lic['size_m']}))


if __name__ == '__main__':
    rc = json.load(open(arg('--recipe'), encoding='utf-8'))
    build(rc, arg('--out'))
