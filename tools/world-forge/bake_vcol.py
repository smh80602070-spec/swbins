"""K-0136 1단계 — 툰 GLB 에 "칠한 명암" 을 정점색(COLOR_0)으로 굽는다. 모양·재질·삼각형은 그대로, 정점색만 더한다.
  "/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P tools/world-forge/bake_vcol.py -- <in.glb> <out.glb> [samples=32]

한 패스(Cycles CPU, EMIT 베이크 → 정점색): 밝기 = AO(거리 0.7m, 안쪽만, √ 뒤 0.62~1.0) × 위쪽 밝힘(법선 z: 아래 0.86 → 위 1.0) × 모서리(pointiness 0.88~1.05). 첫 시도(거리 1.6·0~1 그대로)는 벽이 통째로 검게 눌렸다(10-17).
웹 toon3d 가 vertexColors 를 곱하면 3단 램프 위에 그려진 명암이 얹힌다(런타임 0). 사실 트랙엔 안 쓴다(툰 export 전용).
정점 수가 적은 저폴리라 정점색 = 면 단위 명암 — 그래서 모서리·골만 잡아도 "손으로 칠한" 느낌이 난다.
"""
import os
import sys

import bpy

a = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = os.path.abspath(a[0]), os.path.abspath(a[1])
SAMPLES = int(a[2]) if len(a) > 2 else 32

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import saga_cycles; saga_cycles.use(sc)
sc.cycles.samples = SAMPLES
sc.render.bake.target = 'VERTEX_COLORS'
sc.render.bake.use_clear = True

# 베이크용 재질(발광 = 명암 값) 하나
bm = bpy.data.materials.new('_vcol_bake')
bm.use_nodes = True
nt = bm.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
out = nt.nodes.new('ShaderNodeOutputMaterial')
emit = nt.nodes.new('ShaderNodeEmission')
ao = nt.nodes.new('ShaderNodeAmbientOcclusion')
ao.inputs['Distance'].default_value = 0.7
ao.only_local = True
ao.samples = 8
geo = nt.nodes.new('ShaderNodeNewGeometry')
# 위쪽 밝힘: 0.78 + 0.22 * clamp(nz*0.5+0.5)
sep = nt.nodes.new('ShaderNodeSeparateXYZ')
nt.links.new(geo.outputs['Normal'], sep.inputs['Vector'])
mr = nt.nodes.new('ShaderNodeMapRange')
mr.inputs['From Min'].default_value = -1.0
mr.inputs['From Max'].default_value = 1.0
mr.inputs['To Min'].default_value = 0.86
mr.inputs['To Max'].default_value = 1.0
nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
# 모서리: pointiness 0.5 = 평평, >0.5 튀어나옴(밝게 ×1.08), <0.5 골(어둡게 ×0.8)
pm = nt.nodes.new('ShaderNodeMapRange')
pm.inputs['From Min'].default_value = 0.35
pm.inputs['From Max'].default_value = 0.65
pm.inputs['To Min'].default_value = 0.88
pm.inputs['To Max'].default_value = 1.05
nt.links.new(geo.outputs['Pointiness'], pm.inputs['Value'])
# AO 0~1 → 0.62~1.0(제곱근으로 부드럽게) — 그을림이 아니라 칠한 명암
aop = nt.nodes.new('ShaderNodeMath')
aop.operation = 'POWER'
aop.inputs[1].default_value = 0.5
nt.links.new(ao.outputs['AO'], aop.inputs[0])
aom = nt.nodes.new('ShaderNodeMapRange')
aom.inputs['From Min'].default_value = 0.0
aom.inputs['From Max'].default_value = 1.0
aom.inputs['To Min'].default_value = 0.62
aom.inputs['To Max'].default_value = 1.0
nt.links.new(aop.outputs['Value'], aom.inputs['Value'])
m1 = nt.nodes.new('ShaderNodeMath')
m1.operation = 'MULTIPLY'
nt.links.new(aom.outputs['Result'], m1.inputs[0])
nt.links.new(mr.outputs['Result'], m1.inputs[1])
m2 = nt.nodes.new('ShaderNodeMath')
m2.operation = 'MULTIPLY'
nt.links.new(m1.outputs['Value'], m2.inputs[0])
nt.links.new(pm.outputs['Result'], m2.inputs[1])
nt.links.new(m2.outputs['Value'], emit.inputs['Color'])
nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for o in meshes:
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    me = o.data
    if 'Col' in me.color_attributes:
        me.color_attributes.remove(me.color_attributes['Col'])
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    me.color_attributes.active_color = ca
    saved = [s.material for s in o.material_slots]
    if not saved:
        me.materials.append(bm)
    for s in o.material_slots:
        s.material = bm
    bpy.ops.object.bake(type='EMIT')
    for s, m in zip(o.material_slots, saved):
        s.material = m
    if not saved:
        me.materials.clear()
    # 재질에 정점색 곱 — 웹이 vertexColors 를 안 켜도 Blender 렌더·Godot 에서 보이게 Base Color 앞에 곱한다
    for m in {s.material for s in o.material_slots if s.material}:
        t = m.node_tree
        bsdf = next((n for n in t.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf is None or any(n.type == 'VERTEX_COLOR' for n in t.nodes):
            continue
        vc = t.nodes.new('ShaderNodeVertexColor')
        vc.layer_name = 'Col'
        mix = t.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        src = bsdf.inputs['Base Color']
        if src.is_linked:
            t.links.new(src.links[0].from_socket, mix.inputs[6])
        else:
            mix.inputs[6].default_value = src.default_value
        t.links.new(vc.outputs['Color'], mix.inputs[7])
        t.links.new(mix.outputs[2], src)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True, export_image_format='AUTO',
                          export_vertex_color='ACTIVE' if 'export_vertex_color' in bpy.ops.export_scene.gltf.get_rna_type().properties else 'MATERIAL')
print('BAKE_VCOL', os.path.basename(SRC), 'meshes', len(meshes), 'kb', os.path.getsize(OUT) // 1024)
