#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
프록시젠 — SAGA-DESIGN.md §7.2 3번(procgen.py). 좌표·씨앗만으로 소품 GLB를
찍어낸다(원본 에셋 없이 코드가 그린다는 원칙 그대로, PLAN.md 103-1/103-3).

지금 찍는 것: rock(노이즈 구체 바위) · stele(비석) · fence(울타리 한 칸) ·
wall(돌담 한 칸) · tree(나무, 몸통+수관) — 여기까지 정점색 —, 그리고 마을 소품
house·tower·lamp·well·market·scare·grass·reed(부품마다 재질 색, 사가만리 deco 종류).
전부 저폴리·flat shaded — 트라이앵글
몇십 개로 128px 실루엣에서 구별되면 충분하다(103-5 판정 절차, 3단계).

씨앗(seed)이 같으면 결과가 완전히 같다(재생성 가능해야 한다는 103-1 규칙).
파일명 관례 `<kind>_s<seed>_<nn>.glb`의 `<nn>`은 `batch` 명령이 매기는
일련번호일 뿐, 모양에는 영향을 주지 않는다(seed만 모양을 결정한다).

무엇을 안 하나: 팔레트 스냅(palette.py snap-glb 몫, 이 스크립트 다음
단계), 씬에 배치하는 것(그 판의 `*_builder.gd`/`density_report.gd`
빈 칸 목록을 보고 사람/세션이 어디에 몇 개 놓을지 판단).
"""

import argparse
import os

import numpy as np
import trimesh

FORGE_DIR = os.path.dirname(os.path.abspath(__file__))


def _rng(seed):
    return np.random.default_rng(seed)


def _export(mesh, out_path):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    mesh.export(out_path)
    geoms = list(mesh.geometry.values()) if isinstance(mesh, trimesh.Scene) else [mesh]
    print("생성 verts=%d faces=%d -> %s" % (sum(len(g.vertices) for g in geoms), sum(len(g.faces) for g in geoms), out_path))
    return mesh


def _concat_colored(mesh_color_pairs):
    """trimesh.util.concatenate는 서로 다른 vertex_colors를 안정적으로 안 섞어
    준다 — 파트별 RGBA를 직접 펼쳐 붙인다(UV는 안 만든다, saga-unity의
    트라이플레이너 재질이 위치·법선만 본다). process=False로 정점을 안
    합쳐 각진 저폴리 실루엣을 그대로 남긴다."""
    verts, faces, colors = [], [], []
    offset = 0
    for mesh, rgba in mesh_color_pairs:
        v = mesh.vertices
        verts.append(v)
        faces.append(mesh.faces + offset)
        colors.append(np.tile(np.array(rgba, dtype=np.uint8), (len(v), 1)))
        offset += len(v)
    merged = trimesh.Trimesh(
        vertices=np.concatenate(verts, axis=0),
        faces=np.concatenate(faces, axis=0),
        vertex_colors=np.concatenate(colors, axis=0),
        process=False,
    )
    merged.fix_normals()
    return merged


def make_rock(seed, radius=0.5, subdivisions=1, noise=0.3):
    """이코사구를 뒤틀어 노이즈 바위를 만든다 — 정점을 법선 방향으로
    씨앗 난수만큼 밀어낸다(스무딩 없음, 각진 저폴리 그대로 남긴다).
    회색 정점색을 입힌다(saga-unity Saga/VertexColorTriplanarLit의
    바탕색 — 트라이플레이너 디테일 텍스처가 그 위에 곱혀진다)."""
    mesh = trimesh.creation.icosphere(subdivisions=subdivisions, radius=radius)
    rng = _rng(seed)
    jitter = 1.0 + rng.uniform(-noise, noise, size=len(mesh.vertices))
    mesh.vertices = mesh.vertices * jitter[:, None]
    # 위아래로도 살짝 눌러 완전한 구 티를 없앤다(바위는 보통 한쪽이 낮다).
    mesh.vertices[:, 1] *= 0.75 + rng.uniform(0.0, 0.2)
    gray = 0.42 + rng.uniform(-0.05, 0.05)
    return _concat_colored([(mesh, (int(gray * 255), int(gray * 255), int(gray * 255), 255))])


def make_stele(seed, height=1.6, width=0.4, depth=0.18):
    """비석 — 사각 기둥 몸통 + 네모뿔 지붕(옛 유물·묘비류 실루엣)."""
    rng = _rng(seed)
    w = width * rng.uniform(0.85, 1.15)
    d = depth * rng.uniform(0.85, 1.15)
    h = height * rng.uniform(0.85, 1.15)
    cap_h = h * 0.18
    body = trimesh.creation.box(extents=(w, h - cap_h, d))
    body.apply_translation((0, (h - cap_h) / 2.0, 0))
    cap = trimesh.creation.cone(radius=max(w, d) * 0.62, height=cap_h, sections=4)
    cap.apply_translation((0, h - cap_h, 0))
    mesh = trimesh.util.concatenate([body, cap])
    mesh.fix_normals()
    return mesh


def make_fence(seed, length=2.0, height=0.9, posts=2):
    """울타리 한 칸 — 기둥 posts개 + 가로대 2단. 반복 배치는 씬 쪽 몫."""
    rng = _rng(seed)
    post_w = 0.08 * rng.uniform(0.9, 1.1)
    parts = []
    for i in range(posts):
        x = -length / 2.0 + i * (length / max(1, posts - 1)) if posts > 1 else 0.0
        p = trimesh.creation.box(extents=(post_w, height, post_w))
        p.apply_translation((x, height / 2.0, 0))
        parts.append(p)
    for frac in (0.55, 0.9):
        rail = trimesh.creation.box(extents=(length, 0.06, 0.04))
        rail.apply_translation((0, height * frac, 0))
        parts.append(rail)
    mesh = trimesh.util.concatenate(parts)
    mesh.fix_normals()
    return mesh


def make_wall(seed, length=2.0, height=1.0, thickness=0.3, rows=3, cols=4):
    """돌담 한 칸 — 블록을 벽돌쌓기(줄마다 반 칸 어긋남)로 놓고 씨앗
    난수로 크기·위치를 살짝 흔든다(완전한 규칙 격자는 인공적으로 보인다)."""
    rng = _rng(seed)
    block_w = length / cols
    block_h = height / rows
    parts = []
    for r in range(rows):
        offset = block_w / 2.0 if r % 2 == 1 else 0.0
        n = cols if r % 2 == 0 else cols + 1
        for c in range(n):
            x = -length / 2.0 + offset + c * block_w - (block_w / 2.0 if r % 2 == 1 else 0.0)
            if x < -length / 2.0 - block_w * 0.4 or x > length / 2.0 + block_w * 0.4:
                continue
            jw = block_w * rng.uniform(0.82, 0.98)
            jh = block_h * rng.uniform(0.85, 1.05)
            jd = thickness * rng.uniform(0.9, 1.05)
            block = trimesh.creation.box(extents=(jw, jh, jd))
            y = r * block_h + block_h / 2.0
            block.apply_translation((x, y, rng.uniform(-0.01, 0.01)))
            parts.append(block)
    mesh = trimesh.util.concatenate(parts)
    mesh.fix_normals()
    return mesh


def make_tree(seed, trunk_height=3.0, trunk_radius=0.35, canopy_radius=1.6):
    """나무 — 저폴리 몸통(육각 기둥) + 수관. 씨앗으로 세 형태 중 하나를
    고른다(0=둥근 다발 활엽수, 1=원뿔형 침엽수, 2=성긴 다발 — 버드나무류).
    UV는 안 만든다 — 몸통은 갈색, 수관은 초록 정점색을 입혀 두고
    saga-unity의 Saga/VertexColorTriplanarLit이 트라이플레이너 바크
    디테일 텍스처를 그 위에 곱한다(PLAN.md 102-4, 03-1)."""
    rng = _rng(seed)
    th = trunk_height * rng.uniform(0.8, 1.3)
    tr = trunk_radius * rng.uniform(0.8, 1.2)
    trunk = trimesh.creation.cylinder(radius=tr, height=th, sections=6)
    trunk.apply_translation((0, th / 2.0, 0))
    trunk_rgba = (
        int((0.32 + rng.uniform(-0.04, 0.04)) * 255),
        int((0.21 + rng.uniform(-0.03, 0.03)) * 255),
        int((0.12 + rng.uniform(-0.02, 0.02)) * 255),
        255,
    )
    canopy_rgba = (
        int((0.12 + rng.uniform(-0.03, 0.05)) * 255),
        int((0.30 + rng.uniform(-0.05, 0.08)) * 255),
        int((0.11 + rng.uniform(-0.03, 0.03)) * 255),
        255,
    )
    parts = [(trunk, trunk_rgba)]

    form = int(rng.integers(0, 3))
    cr = canopy_radius * rng.uniform(0.85, 1.25)
    if form == 0:
        n = int(rng.integers(3, 6))
        for _ in range(n):
            ang = rng.uniform(0, 2 * np.pi)
            rad = rng.uniform(0, cr * 0.45)
            c = trimesh.creation.icosphere(subdivisions=0, radius=cr * rng.uniform(0.55, 0.85))
            c.apply_translation((np.cos(ang) * rad, th * 0.92 + th * 0.15 * rng.uniform(-1, 1), np.sin(ang) * rad))
            parts.append((c, canopy_rgba))
    elif form == 1:
        levels = int(rng.integers(2, 4))
        for i in range(levels):
            frac = i / max(1, levels - 1)
            y = th * (0.55 + frac * 0.55)
            r = cr * (1.0 - frac * 0.65) * rng.uniform(0.9, 1.1)
            cone = trimesh.creation.cone(radius=r, height=th * 0.32, sections=6)
            cone.apply_translation((0, y, 0))
            parts.append((cone, canopy_rgba))
    else:
        n = int(rng.integers(2, 4))
        for _ in range(n):
            ang = rng.uniform(0, 2 * np.pi)
            rad = rng.uniform(cr * 0.2, cr * 0.6)
            y = th * rng.uniform(0.75, 1.05)
            c = trimesh.creation.icosphere(subdivisions=0, radius=cr * rng.uniform(0.4, 0.65))
            c.apply_translation((np.cos(ang) * rad, y, np.sin(ang) * rad))
            parts.append((c, canopy_rgba))

    return _concat_colored(parts)


# ── 마을 소품(재질 색) ─────────────────────────────────────────────
# 사가만리 3D 배치(`land.js` deco) 종류 중 두 트랙에 모델이 없던 것 — 집·탑·등롱·우물·장터·허수아비·풀·갈대.
# 위 바위·나무처럼 정점색으로 칠하면 게임 코드의 전용 셰이더(Unity `Saga/VertexColorTriplanarLit`)가 있어야 색이 난다.
# 이것들은 배치표 씬(tools/scene-layout)에 **그대로** 서므로, 부품마다 glTF 기본 재질(baseColorFactor)을 붙인다 —
# Godot·Unity(glTFast)·three.js 모두 기본 임포트만으로 색이 나온다. 같은 색 부품은 한 덩이로 합쳐 그리기 호출을 줄인다.
# 치수는 미터, 바닥 가운데가 원점(+y 위, 정면 +z). 기본 크기는 웹 편집기 기본값(집 8×7m 키 5m, 탑 키 18m …)과 맞춘다.

def _rgb(r, g, b, rng=None, j=0.0):
    if rng is not None and j:
        r, g, b = (min(1.0, max(0.0, c + rng.uniform(-j, j))) for c in (r, g, b))
    return (int(r * 255), int(g * 255), int(b * 255), 255)


def _box(w, h, d, x=0.0, y=0.0, z=0.0):
    """바닥면이 y 에 놓인 상자(가운데 x·z)"""
    m = trimesh.creation.box(extents=(w, h, d))
    m.apply_translation((x, y + h / 2.0, z))
    return m


def _hull(points):
    return trimesh.convex.convex_hull(np.array(points, dtype=float))


def _upright(mesh):
    """trimesh 원통·원뿔·고리는 z 축으로 선다 — x 축으로 -90° 돌려 +y 로 세운다(원뿔 꼭지 +z → +y)"""
    mesh.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, (1, 0, 0)))
    return mesh


def _tilt(mesh, ax, az):
    """바닥 원점 기준으로 x·z 축으로 기울인다(풀잎·갈대)"""
    mesh.apply_transform(trimesh.transformations.rotation_matrix(ax, (1, 0, 0)))
    mesh.apply_transform(trimesh.transformations.rotation_matrix(az, (0, 0, 1)))
    return mesh


def _colored_scene(mesh_color_pairs):
    """같은 색 부품끼리 합쳐 색마다 재질 하나 — trimesh.Scene(GLB 로 내보내면 프리미티브·재질이 색 수만큼)"""
    groups = {}
    for mesh, rgba in mesh_color_pairs:
        groups.setdefault(tuple(rgba), []).append(mesh)
    scene = trimesh.Scene()
    for i, (rgba, meshes) in enumerate(sorted(groups.items())):
        m = trimesh.util.concatenate(meshes)
        m.fix_normals()
        mat = trimesh.visual.material.PBRMaterial(
            name="c%02d" % i, baseColorFactor=list(rgba), metallicFactor=0.0, roughnessFactor=0.9)
        m.visual = trimesh.visual.TextureVisuals(material=mat)
        scene.add_geometry(m, geom_name="part%02d" % i)
    return scene


def _gable(x0, x1, z_half, y_eave, y_ridge, t=0.25):
    """x 방향으로 뻗은 박공지붕 — 두께 t 인 두 경사판(처마 z=±z_half, 용마루 z=0)"""
    out = []
    for s in (-1, 1):
        out.append(_hull([
            (x0, y_eave, s * z_half), (x1, y_eave, s * z_half), (x0, y_ridge, 0), (x1, y_ridge, 0),
            (x0, y_eave + t, s * z_half), (x1, y_eave + t, s * z_half), (x0, y_ridge + t, 0), (x1, y_ridge + t, 0)]))
    return out


def _eave_roof(w_eave, w_top, y0, h):
    """사방으로 처지는 지붕(누각 층 지붕) — 아래 넓은 네모에서 위 좁은 네모로"""
    a, b = w_eave / 2.0, w_top / 2.0
    pts = [(sx * a, y0, sz * a) for sx in (-1, 1) for sz in (-1, 1)] + \
          [(sx * b, y0 + h, sz * b) for sx in (-1, 1) for sz in (-1, 1)] + \
          [(sx * a, y0 + 0.18, sz * a) for sx in (-1, 1) for sz in (-1, 1)]
    return _hull(pts)


def make_house(seed, width=8.0, depth=7.0, height=5.0):
    """기와집 — 돌 기단 · 흰(또는 황토) 벽 · 모서리 나무 기둥 · 앞 문·창 · 처마가 나온 박공 기와지붕"""
    rng = _rng(seed)
    W = width * rng.uniform(0.92, 1.08)
    D = depth * rng.uniform(0.92, 1.08)
    H = height * rng.uniform(0.95, 1.05)
    plinth_h, wall_h = 0.4, H * 0.56
    top = plinth_h + wall_h
    plaster = [_rgb(0.90, 0.87, 0.80, rng, 0.03), _rgb(0.80, 0.68, 0.50, rng, 0.03)][int(rng.integers(0, 2))]
    wood = _rgb(0.36, 0.22, 0.13, rng, 0.03)
    stone = _rgb(0.55, 0.54, 0.52, rng, 0.03)
    tile = [_rgb(0.22, 0.24, 0.28, rng, 0.02), _rgb(0.35, 0.20, 0.16, rng, 0.02)][int(rng.integers(0, 2))]
    dark = _rgb(0.12, 0.09, 0.07)
    paper = _rgb(0.93, 0.90, 0.78)
    parts = [(_box(W + 0.6, plinth_h, D + 0.6), stone), (_box(W, wall_h, D, y=plinth_h), plaster)]
    for x in (-W / 2, 0.0, W / 2):
        for z in (-D / 2, D / 2):
            parts.append((_box(0.32, wall_h, 0.32, x=x, y=plinth_h, z=z), wood))
    parts.append((_box(W + 0.2, 0.25, D + 0.2, y=top - 0.25), wood))                 # 도리
    parts.append((_box(1.3, wall_h * 0.78, 0.08, y=plinth_h, z=D / 2 + 0.02), dark))  # 문
    for x in (-W * 0.3, W * 0.3):
        parts.append((_box(1.1, 0.8, 0.08, x=x, y=plinth_h + wall_h * 0.45, z=D / 2 + 0.02), paper))
    ov = 0.9
    for m in _gable(-W / 2 - ov, W / 2 + ov, D / 2 + ov, top - 0.1, H - 0.25):
        parts.append((m, tile))
    parts.append((_box(W + 2 * ov + 0.3, 0.3, 0.45, y=H - 0.3), tile))            # 용마루
    for s in (-1, 1):                                                               # 용마루 끝 치미
        parts.append((_box(0.35, 0.5, 0.5, x=s * (W / 2 + ov + 0.1), y=H - 0.3), tile))
    return _colored_scene(parts)


def make_tower(seed, width=7.0, height=18.0):
    """누각 — 돌 기단 위에 세 층, 층마다 처마 지붕, 꼭대기 뾰족 지붕과 장식대"""
    rng = _rng(seed)
    W = width * rng.uniform(0.92, 1.08)
    H = height * rng.uniform(0.95, 1.05)
    stone = _rgb(0.52, 0.51, 0.49, rng, 0.03)
    wood = _rgb(0.55, 0.16, 0.12, rng, 0.04)       # 붉은 칠 기둥
    wall = _rgb(0.88, 0.84, 0.74, rng, 0.03)
    tile = _rgb(0.20, 0.30, 0.28, rng, 0.03)       # 청록 기와
    gold = _rgb(0.78, 0.62, 0.25)
    base_h = H * 0.11
    parts = [(_box(W + 1.0, base_h, W + 1.0), stone)]
    y = base_h
    tier_h = H * 0.2
    roof_h = H * 0.065
    bw = W
    for i in range(3):
        parts.append((_box(bw * 0.8, tier_h, bw * 0.8, y=y), wall))
        for sx in (-1, 1):
            for sz in (-1, 1):
                parts.append((_box(0.35, tier_h, 0.35, x=sx * bw * 0.4, y=y, z=sz * bw * 0.4), wood))
        y += tier_h
        parts.append((_eave_roof(bw * 1.25, bw * 0.7, y, roof_h), tile))
        y += roof_h * 0.7
        bw *= 0.8
    cap_h = max(0.8, H - y - 0.8)
    parts.append((_hull([(sx * bw * 0.55, y, sz * bw * 0.55) for sx in (-1, 1) for sz in (-1, 1)] + [(0, y + cap_h, 0)]), tile))
    parts.append((_box(0.18, 0.9, 0.18, y=y + cap_h - 0.1), gold))
    return _colored_scene(parts)


def make_lamp(seed, height=3.4):
    """등롱 — 돌 받침 · 나무 기둥 · 따뜻한 빛 등 상자 · 지붕 갓"""
    rng = _rng(seed)
    H = height * rng.uniform(0.95, 1.05)
    stone = _rgb(0.50, 0.49, 0.47, rng, 0.03)
    wood = _rgb(0.30, 0.19, 0.11, rng, 0.03)
    glow = [_rgb(1.0, 0.78, 0.40), _rgb(0.92, 0.30, 0.20)][int(rng.integers(0, 2))]
    roof = _rgb(0.18, 0.16, 0.15)
    lamp_h = H * 0.18
    post_top = H - lamp_h - H * 0.08
    return _colored_scene([
        (_box(0.7, 0.3, 0.7), stone),
        (_box(0.18, post_top - 0.3, 0.18, y=0.3), wood),
        (_box(0.6, 0.08, 0.6, y=post_top - 0.08), wood),
        (_box(0.5, lamp_h, 0.5, y=post_top), glow),
        (_hull([(sx * 0.48, post_top + lamp_h, sz * 0.48) for sx in (-1, 1) for sz in (-1, 1)] + [(0, H, 0)]), roof),
    ])


def make_well(seed, radius=1.0):
    """우물 — 돌 테두리(둥근 담) · 물 · 두 기둥과 들보 · 작은 박공 지붕 · 두레박"""
    rng = _rng(seed)
    R = radius * rng.uniform(0.92, 1.08)
    stone = _rgb(0.56, 0.55, 0.52, rng, 0.03)
    water = _rgb(0.14, 0.27, 0.36)
    wood = _rgb(0.34, 0.22, 0.12, rng, 0.03)
    tile = _rgb(0.24, 0.24, 0.27, rng, 0.02)
    ring_h = 0.8
    ring = _upright(trimesh.creation.annulus(r_min=R * 0.72, r_max=R, height=ring_h, sections=14))
    ring.apply_translation((0, ring_h / 2.0, 0))
    disc = _upright(trimesh.creation.cylinder(radius=R * 0.72, height=0.05, sections=14))
    disc.apply_translation((0, ring_h * 0.7, 0))
    post_h = 2.3
    parts = [(ring, stone), (disc, water)]
    for s in (-1, 1):
        parts.append((_box(0.16, post_h, 0.16, x=s * (R + 0.05)), wood))
    parts.append((_box(2 * R + 0.4, 0.14, 0.14, y=post_h - 0.4), wood))
    for m in _gable(-R - 0.35, R + 0.35, 0.85, post_h - 0.05, post_h + 0.55, t=0.12):
        parts.append((m, tile))
    parts.append((_box(0.3, 0.3, 0.3, y=post_h - 1.2), wood))                       # 두레박
    return _colored_scene(parts)


def make_market(seed, width=3.6, depth=2.3):
    """장터 좌판 — 네 기둥 · 앞 판대 · 뒤 선반 · 줄무늬 천 지붕 · 판대 위 물건(과일 바구니 등)"""
    rng = _rng(seed)
    W = width * rng.uniform(0.92, 1.08)
    D = depth * rng.uniform(0.92, 1.08)
    wood = _rgb(0.40, 0.26, 0.14, rng, 0.03)
    cloth_a = [_rgb(0.80, 0.22, 0.18), _rgb(0.20, 0.36, 0.62), _rgb(0.26, 0.50, 0.30)][int(rng.integers(0, 3))]
    cloth_b = _rgb(0.93, 0.90, 0.82)
    goods = [_rgb(0.90, 0.45, 0.15), _rgb(0.85, 0.75, 0.20), _rgb(0.55, 0.20, 0.45), _rgb(0.45, 0.62, 0.25)]
    post_h = 2.4
    parts = []
    for sx in (-1, 1):
        for sz in (-1, 1):
            parts.append((_box(0.12, post_h + (0.3 if sz < 0 else 0.0), 0.12, x=sx * W / 2, z=sz * D / 2), wood))
    parts.append((_box(W, 0.85, 0.7, z=D / 2 - 0.35), wood))                        # 앞 판대
    parts.append((_box(W, 0.1, 0.5, y=1.3, z=-D / 2 + 0.3), wood))                  # 뒤 선반
    n = 6                                                                             # 줄무늬 천 — 앞이 낮은 외쪽 경사
    for i in range(n):
        x0 = -W / 2 - 0.2 + i * (W + 0.4) / n
        x1 = x0 + (W + 0.4) / n
        parts.append((_hull([(x0, post_h + 0.3, -D / 2 - 0.2), (x1, post_h + 0.3, -D / 2 - 0.2), (x0, post_h - 0.1, D / 2 + 0.4), (x1, post_h - 0.1, D / 2 + 0.4),
                             (x0, post_h + 0.38, -D / 2 - 0.2), (x1, post_h + 0.38, -D / 2 - 0.2), (x0, post_h - 0.02, D / 2 + 0.4), (x1, post_h - 0.02, D / 2 + 0.4)]),
                      cloth_a if i % 2 == 0 else cloth_b))
    for k in range(int(rng.integers(3, 6))):
        c = trimesh.creation.icosphere(subdivisions=0, radius=rng.uniform(0.14, 0.22))
        c.apply_translation((rng.uniform(-W / 2 + 0.3, W / 2 - 0.3), 0.85 + 0.15, D / 2 - 0.35 + rng.uniform(-0.15, 0.15)))
        parts.append((c, goods[int(rng.integers(0, len(goods)))]))
    return _colored_scene(parts)


def make_scare(seed, height=2.2):
    """허수아비 — 장대 · 가로대 · 헝겊 옷 · 짚 머리 · 삿갓"""
    rng = _rng(seed)
    H = height * rng.uniform(0.95, 1.05)
    wood = _rgb(0.42, 0.30, 0.18, rng, 0.03)
    straw = _rgb(0.82, 0.70, 0.40, rng, 0.03)
    cloth = [_rgb(0.30, 0.38, 0.55), _rgb(0.55, 0.30, 0.25), _rgb(0.45, 0.45, 0.35)][int(rng.integers(0, 3))]
    head = trimesh.creation.icosphere(subdivisions=1, radius=0.2)
    head.apply_translation((0, H * 0.83, 0))
    hat = _upright(trimesh.creation.cone(radius=0.38, height=0.28, sections=10))
    hat.apply_translation((0, H * 0.83 + 0.12, 0))
    return _colored_scene([
        (_box(0.08, H * 0.85, 0.08), wood),
        (_box(1.4, 0.07, 0.07, y=H * 0.66), wood),
        (_box(0.62, 0.55, 0.26, y=H * 0.46), cloth),
        (_box(1.2, 0.18, 0.2, y=H * 0.62), cloth),
        (head, straw), (hat, straw),
    ])


def _blade(h, r):
    """풀잎 하나 — 세모뿔(바닥 원점, 위로 h). trimesh cone 은 +z 로 서므로 +y 로 세운다"""
    return _upright(trimesh.creation.cone(radius=r, height=h, sections=3))


def make_grass(seed, height=1.0):
    """풀덤불 — 가는 세모 잎 열둘 남짓을 사방으로 기울여 한 포기로"""
    rng = _rng(seed)
    greens = [_rgb(0.30, 0.52, 0.20, rng, 0.03), _rgb(0.42, 0.60, 0.24, rng, 0.03)]
    parts = []
    for _ in range(int(rng.integers(10, 16))):
        b = _blade(height * rng.uniform(0.55, 1.0), rng.uniform(0.04, 0.07))
        _tilt(b, rng.uniform(-0.45, 0.45), rng.uniform(-0.45, 0.45))
        b.apply_translation((rng.uniform(-0.2, 0.2), 0, rng.uniform(-0.2, 0.2)))
        parts.append((b, greens[int(rng.integers(0, 2))]))
    return _colored_scene(parts)


def make_reed(seed, height=1.6):
    """갈대 — 곧은 줄기 여럿 끝에 갈색 이삭"""
    rng = _rng(seed)
    stem = _rgb(0.55, 0.60, 0.35, rng, 0.03)
    plume = _rgb(0.60, 0.48, 0.32, rng, 0.03)
    parts = []
    for _ in range(int(rng.integers(6, 11))):
        h = height * rng.uniform(0.75, 1.05)
        ax, az = rng.uniform(-0.18, 0.18), rng.uniform(-0.18, 0.18)
        ox, oz = rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25)
        s = _box(0.035, h * 0.85, 0.035)
        p = _box(0.08, h * 0.2, 0.08, y=h * 0.8)
        for m in (s, p):
            _tilt(m, ax, az)
            m.apply_translation((ox, 0, oz))
        parts.append((s, stem))
        parts.append((p, plume))
    return _colored_scene(parts)


KINDS = {
    "rock": make_rock,
    "stele": make_stele,
    "fence": make_fence,
    "wall": make_wall,
    "tree": make_tree,
    "house": make_house,
    "tower": make_tower,
    "lamp": make_lamp,
    "well": make_well,
    "market": make_market,
    "scare": make_scare,
    "grass": make_grass,
    "reed": make_reed,
}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    for kind in KINDS:
        p = sub.add_parser(kind, help="%s GLB 1개 생성" % kind)
        p.add_argument("--seed", type=int, required=True)
        p.add_argument("--out", required=True)

    p_batch = sub.add_parser("batch", help="같은 kind로 씨앗 연속 생성, <kind>_s<seed>_<nn>.glb 이름 규칙")
    p_batch.add_argument("kind", choices=sorted(KINDS.keys()))
    p_batch.add_argument("--count", type=int, required=True)
    p_batch.add_argument("--seed-start", type=int, default=1)
    p_batch.add_argument("--out-dir", required=True)

    args = ap.parse_args()
    if args.cmd in KINDS:
        mesh = KINDS[args.cmd](args.seed)
        _export(mesh, args.out)
    elif args.cmd == "batch":
        fn = KINDS[args.kind]
        for nn in range(1, args.count + 1):
            seed = args.seed_start + nn - 1
            mesh = fn(seed)
            out_path = os.path.join(args.out_dir, "%s_s%d_%02d.glb" % (args.kind, seed, nn))
            _export(mesh, out_path)


if __name__ == "__main__":
    main()
