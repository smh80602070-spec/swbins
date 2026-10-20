"""K-0151 — 원신식 얼굴 그림자 SDF 한 장(VRoid 얼굴 살갗 UV 공용) — 고돗 cel_toon.gdshader face_sdf 자리.

    blender -b --factory-startup -P tools/char-forge/face_sdf_bake.py -- --body <VRoid .glb(절대)> --out <face_sdf.png(절대)> [--mix 0.55] [--size 1024] [--sheet <시트.png(절대)>]
    py tools/char-forge/face_sdf_bake.py --check <face_sdf.png>          # 크기·회색·좌우(빛 오른쪽 기준: 오른뺨이 왼뺨보다 밝음) → FACE_SDF_CHECK_OK

셰이더 규격(cel_toon.gdshader 112~116): 빛 수평 방향과 머리 앞의 각 θ(정면 0°·오른쪽 90°·뒤 180°) → 문턱 thr = 0.5 − 0.5·cos θ, sdf ≥ thr 이면 밝음.
빛이 캐릭터 **오른쪽**일 때 기준(왼쪽 빛은 셰이더가 UV 좌우를 뒤집어 읽는다).
점의 수평 법선 각 φ(앞 0°, 오른쪽 +)에서 밝은 조건은 cos(θ − φ) > 0 → 밝은 마지막 각 θc = φ + 90° → 값 = 0.5 − 0.5·cos θc (0~1).
얼굴 법선 그대로면 코·입가가 얼룩지므로(원신은 얼굴 법선을 안 씀) 법선 = 다듬은 메시 법선과 머리 타원체 법선을 섞은 것(--mix = 타원체 몫).
"""
import json
import math
import os
import sys


def check(p):
    from PIL import Image
    import numpy as np
    im = Image.open(p)
    a = np.asarray(im.convert('L')).astype(float) / 255
    bad = []
    if im.size[0] != im.size[1] or im.size[0] < 512:
        bad.append(f'크기 {im.size}')
    if im.mode not in ('L', 'LA'):
        bad.append(f'회색 아님 {im.mode}')
    lit = a > 0.02
    if lit.mean() < 0.05:
        bad.append('값 있는 칸이 너무 적음')
    meta = json.load(open(os.path.splitext(p)[0] + '.json', encoding='utf-8')) if os.path.exists(os.path.splitext(p)[0] + '.json') else {}
    if meta:
        print('오른뺨 평균', meta.get('right_mean'), '왼뺨 평균', meta.get('left_mean'))
        if not meta.get('right_mean', 0) > meta.get('left_mean', 1):
            bad.append('빛 오른쪽 기준이 아님(오른뺨 ≤ 왼뺨)')
    print('FACE_SDF_CHECK_FAIL' if bad else 'FACE_SDF_CHECK_OK', *bad)
    return 1 if bad else 0


def bake():
    import bpy
    import numpy as np
    from mathutils import Vector
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, here)
    import build
    body, out = build.arg('--body'), build.arg('--out')
    mix = float(build.arg('--mix') or 0.55)
    S = int(build.arg('--size') or 1024)
    sheet = build.arg('--sheet')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objs = build.import_new(body)
    face = next(o for o in objs if o.type == 'MESH' and any(m and 'Face_00_SKIN' in m.name for m in o.data.materials))
    me = face.data
    W = face.matrix_world
    P = np.array([list(W @ v.co) for v in me.vertices])
    N = np.array([list((W.to_3x3() @ v.normal).normalized()) for v in me.vertices])
    # 다듬은 메시 법선 — 이웃 평균 40번(코·입·눈두덩 굴곡을 지운다)
    nb = [[] for _ in me.vertices]
    for e in me.edges:
        a, b = e.vertices
        nb[a].append(b)
        nb[b].append(a)
    Ns = N.copy()
    for _ in range(40):
        Ns = np.array([Ns[[i] + nb[i]].mean(axis=0) for i in range(len(nb))])
        Ns /= np.linalg.norm(Ns, axis=1, keepdims=True) + 1e-9
    # 머리 타원체 법선 — 가운데 = 얼굴 껍데기 뒤쪽(앞 −Y), 반지름 = 얼굴 상자
    lo, hi = P.min(axis=0), P.max(axis=0)
    r = np.maximum((hi - lo) / 2, 1e-3) * np.array([1.0, 1.6, 1.0])
    c = np.array([0.0 if abs((lo[0] + hi[0]) / 2) < 0.02 else (lo[0] + hi[0]) / 2, lo[1] + r[1], (lo[2] + hi[2]) / 2])
    Ne = (P - c) / (r ** 2)
    Ne /= np.linalg.norm(Ne, axis=1, keepdims=True) + 1e-9
    Nm = mix * Ne + (1 - mix) * Ns
    fwd, right = np.array([0, -1.0, 0]), np.array([-1.0, 0, 0])            # VRoid: 앞 −Y · 해부학 오른쪽 −X
    phi = np.degrees(np.arctan2(Nm @ right, Nm @ fwd))
    thc = np.clip(phi + 90, 0, 180)
    val = 0.5 - 0.5 * np.cos(np.radians(thc))
    # UV 공간에 그리기(삼각형 무게중심 보간)
    uv = me.uv_layers.active.data
    img = np.zeros((S, S), np.float32)
    cov = np.zeros((S, S), bool)
    for poly in me.polygons:
        li = list(poly.loop_indices)
        for t in range(1, len(li) - 1):
            tri = [li[0], li[t], li[t + 1]]
            q = np.array([[uv[k].uv[0] * S, (1 - uv[k].uv[1]) * S] for k in tri])
            vv = np.array([val[me.loops[k].vertex_index] for k in tri])
            x0, y0 = np.floor(q.min(axis=0)).astype(int)
            x1, y1 = np.ceil(q.max(axis=0)).astype(int)
            x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, S - 1), min(y1, S - 1)
            if x1 < x0 or y1 < y0:
                continue
            xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            (ax, ay), (bx, by), (cx, cy) = q
            d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(d) < 1e-9:
                continue
            w1 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / d
            w2 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / d
            w3 = 1 - w1 - w2
            m = (w1 >= -1e-4) & (w2 >= -1e-4) & (w3 >= -1e-4)
            img[y0:y1 + 1, x0:x1 + 1][m] = (w1 * vv[0] + w2 * vv[1] + w3 * vv[2])[m]
            cov[y0:y1 + 1, x0:x1 + 1] |= m
    # 바깥 칸 메우기(가까운 값 번짐 12번 — 밉맵·선형 거르기에서 경계가 검게 안 번지게)
    for _ in range(12):
        acc = np.zeros_like(img)
        cnt = np.zeros_like(img)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sh = np.roll(np.roll(img, dy, 0), dx, 1)
            sc = np.roll(np.roll(cov, dy, 0), dx, 1)
            acc += np.where(sc, sh, 0)
            cnt += sc
        grow = (~cov) & (cnt > 0)
        img[grow] = acc[grow] / cnt[grow]
        cov |= grow
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bimg = bpy.data.images.new('face_sdf', S, S, alpha=False, float_buffer=False)   # Blender 파이썬엔 PIL 이 없다 — Blender 이미지로 저장(회색 BW)
    bimg.colorspace_settings.name = 'Non-Color'
    g = np.clip(img[::-1], 0, 1).astype(np.float32)                                   # Blender 픽셀은 아래 줄부터
    bimg.pixels.foreach_set(np.stack([g, g, g, np.ones_like(g)], axis=-1).ravel())
    bimg.filepath_raw = out
    bimg.file_format = 'PNG'
    sc0 = bpy.context.scene
    sc0.render.image_settings.file_format, sc0.render.image_settings.color_mode, sc0.render.image_settings.color_depth = 'PNG', 'BW', '8'
    bimg.save_render(out, scene=sc0)
    # 오른뺨·왼뺨 평균(검사용) — 점 x<0 이 해부학 오른쪽
    rm, lm = float(val[P[:, 0] < -0.02].mean()), float(val[P[:, 0] > 0.02].mean())
    meta = {'body': os.path.basename(body), 'mix': mix, 'size': S, 'verts': len(P), 'right_mean': round(rm, 3), 'left_mean': round(lm, 3),
            'rule': 'value = 0.5 - 0.5*cos(clamp(phi+90,0,180)) · phi = 다듬은 법선 수평 각(앞 0, 오른쪽 +) · 빛 오른쪽 기준'}
    json.dump(meta, open(os.path.splitext(out)[0] + '.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('FACE_SDF_OK', S, len(P), 'right', round(rm, 3), 'left', round(lm, 3))
    if sheet:
        render_sheet(bpy, objs, face, out, sheet)


def render_sheet(bpy, objs, face, sdf_path, sheet):
    """얼굴에 SDF 를 입혀 빛 각도별로 찍는다 — 셰이더와 같은 식(오른쪽 빛 = UV 그대로, 왼쪽 빛 = UV 좌우 뒤집음)."""
    sc = bpy.context.scene
    for o in objs:
        if o.type == 'MESH' and o is not face:
            o.hide_render = True
    mat = bpy.data.materials.new('sdf_view')
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(sdf_path)
    tex.image.colorspace_settings.name = 'Non-Color'
    uvn = nt.nodes.new('ShaderNodeUVMap')
    flip = nt.nodes.new('ShaderNodeMapping')
    flip.inputs['Location'].default_value[0] = 1.0
    flip.inputs['Scale'].default_value[0] = -1.0
    thr = nt.nodes.new('ShaderNodeValue')
    side = nt.nodes.new('ShaderNodeValue')
    tex2 = nt.nodes.new('ShaderNodeTexImage')
    tex2.image = tex.image
    nt.links.new(uvn.outputs['UV'], tex.inputs['Vector'])
    nt.links.new(uvn.outputs['UV'], flip.inputs['Vector'])
    nt.links.new(flip.outputs['Vector'], tex2.inputs['Vector'])
    pick = nt.nodes.new('ShaderNodeMix')
    pick.data_type = 'FLOAT'
    nt.links.new(side.outputs[0], pick.inputs['Factor'])
    nt.links.new(tex.outputs['Color'], pick.inputs[2])
    nt.links.new(tex2.outputs['Color'], pick.inputs[3])
    cmp = nt.nodes.new('ShaderNodeMath')
    cmp.operation = 'GREATER_THAN'
    nt.links.new(pick.outputs[0], cmp.inputs[0])
    nt.links.new(thr.outputs[0], cmp.inputs[1])
    ramp = nt.nodes.new('ShaderNodeMix')
    ramp.data_type = 'RGBA'
    ramp.inputs[6].default_value = (0.55, 0.42, 0.45, 1)
    ramp.inputs[7].default_value = (1.0, 0.9, 0.84, 1)
    nt.links.new(cmp.outputs[0], ramp.inputs['Factor'])
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(ramp.outputs[2], em.inputs['Color'])
    outn = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs[0], outn.inputs['Surface'])
    face.data.materials.clear()
    face.data.materials.append(mat)
    P = [face.matrix_world @ v.co for v in face.data.vertices]
    zs = [p.z for p in P]
    cz = (min(zs) + max(zs)) / 2
    h = max(zs) - min(zs)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    cam.data.type, cam.data.ortho_scale = 'ORTHO', h * 1.5
    ang = math.radians(-25)                                    # 앞(−Y)에서 오른쪽(−X)으로 25° 돈 3/4
    cam.location = (-math.sin(-ang) * -2 if False else -2 * math.sin(math.radians(25)), -2 * math.cos(math.radians(25)), cz)
    cam.rotation_euler = (math.radians(90), 0, math.radians(-25))
    sc.camera = cam
    sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    sc.render.resolution_x = sc.render.resolution_y = 256
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Standard'
    tiles = []
    for deg in (-120, -60, -30, 0, 30, 60, 90, 120, 150):     # 음수 = 왼쪽 빛(셰이더처럼 UV 뒤집어 읽음)
        a = abs(deg)
        thr.outputs[0].default_value = 0.5 - 0.5 * math.cos(math.radians(a))
        side.outputs[0].default_value = 1.0 if deg < 0 else 0.0
        p = os.path.splitext(sheet)[0] + f'_{deg}.png'
        sc.render.filepath = p
        bpy.ops.render.render(write_still=True)
        tiles.append((deg, p))
    json.dump([[d, p] for d, p in tiles], open(os.path.splitext(sheet)[0] + '_tiles.json', 'w'))
    print('SHEET_TILES', len(tiles))



def compose(sheet):
    from PIL import Image, ImageDraw
    tiles = json.load(open(os.path.splitext(sheet)[0] + '_tiles.json'))
    W = Image.new('RGB', (256 * len(tiles), 276), (40, 40, 40))
    dr = ImageDraw.Draw(W)
    for i, (deg, p) in enumerate(tiles):
        im = Image.open(p).convert('RGBA')
        bg = Image.new('RGBA', im.size, (90, 90, 110, 255))
        bg.alpha_composite(im)
        W.paste(bg.convert('RGB'), (i * 256, 20))
        dr.text((i * 256 + 6, 4), f'light {"L" if deg < 0 else "R"} {abs(deg)}', fill=(255, 255, 0))
    W.save(sheet)
    print('SHEET', sheet)


if __name__ == '__main__':
    if '--compose' in sys.argv:
        compose(sys.argv[sys.argv.index('--compose') + 1])
        sys.exit(0)
    if '--check' in sys.argv:
        sys.exit(check(sys.argv[sys.argv.index('--check') + 1]))
    bake()
