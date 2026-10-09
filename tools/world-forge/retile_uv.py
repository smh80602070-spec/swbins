"""K-0089 — 아틀라스 전용 UV 모델에 돌·나무 타일용 UV 를 새로 편다(상자 투영). 모양·치수·원점·재질 이름은 그대로.

  blender -b --factory-startup -P tools/world-forge/retile_uv.py -- <in.glb> <out.glb> [--unit 4.4]

UV = 모델 좌표(미터) ÷ unit, 면 법선의 큰 축으로 고른다 — ±Z 면 (x, y) · ±X 면 (z, y) · ±Y 면 (x, z).
unit 은 엔진이 MakeTiled(재질, unit, unit)로 반복을 잡는 길이(유니티 사가나락 문 아치 = GateModelWidth 4.4m)라
UV 0~1 이 unit 미터가 되고, 결과 반복이 벽과 같은 미터당 결이 된다. 옛 UV(색 아틀라스)는 버린다 — 원본 파일은 안 건드린다.
"""
import sys

import bmesh
import bpy

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst = argv[0], argv[1]
unit = float(argv[argv.index('--unit') + 1]) if '--unit' in argv else 4.4

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
n_face = 0
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    mw = o.matrix_world
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uv = bm.loops.layers.uv.active or bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        n = (mw.to_3x3() @ f.normal)
        ax = max(range(3), key=lambda i: abs(n[i]))
        for lp in f.loops:
            p = mw @ lp.vert.co          # 블렌더 좌표: Z 위 — glTF y 위로 돌아가 내보내진다
            if ax == 2:                  # 위·아래 면 (블렌더 Z = glTF Y)
                u, v = p.x, p.y
            elif ax == 0:                # 옆 ±X
                u, v = p.y, p.z
            else:                        # 앞뒤 ±Y (블렌더 Y = glTF −Z)
                u, v = p.x, p.z
            lp[uv].uv = (u / unit, v / unit)
        n_face += 1
    bm.to_mesh(o.data)
    bm.free()
    # 다른 UV 층이 있으면 지운다(엔진이 첫 층만 씀 — 남기면 헷갈림)
    while len(o.data.uv_layers) > 1:
        o.data.uv_layers.remove(o.data.uv_layers[1])
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_yup=True, export_apply=False)
print('RETILE_UV_OK', n_face, 'faces', 'unit', unit, '->', dst)
