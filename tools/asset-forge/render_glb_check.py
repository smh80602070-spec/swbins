"""GLB 눈 판정 렌더 — Blender 로 3/4 시점·3점 조명 한 장(Cycles CPU, GPU 는 SD 사슬에 양보).
  "/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python tools/asset-forge/render_glb_check.py -- <a.glb> <out.png> [크기=512] [동작이름 위상0~1]
  동작이름(Walk 등)과 위상을 주면 그 클립의 그 시점 자세로 찍는다(리깅 판정용).
메시옵트(EXT_meshopt_compression) GLB 는 Blender 가 못 읽는다 — 압축 전 GLB(tools/_out/creature_rig/k96/ 등)를 준다.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

src, out = sys.argv[sys.argv.index('--') + 1:][:2]
rest = sys.argv[sys.argv.index('--') + 3:]
TOON = '--toon' in rest                      # 웹 toon3d(3단 램프) 흉내 — Toon BSDF + 정점색 'Col' 곱(K-0136)
rest = [x for x in rest if x != '--toon']
size = int(rest[0]) if rest else 512
action, phase = (rest[1], float(rest[2])) if len(rest) >= 3 else (None, 0.0)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(src))
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
if action:
    act = next((a for a in bpy.data.actions if a.name == action or a.name.startswith(action)), None)
    if act is None:
        print('ACTION_NOT_FOUND', action, [a.name for a in bpy.data.actions])
    else:
        for o in bpy.data.objects:
            if o.type == 'ARMATURE':
                o.animation_data_create()
                for tr in o.animation_data.nla_tracks:
                    tr.mute = True
                o.animation_data.action = act
        f0, f1 = act.frame_range
        bpy.context.scene.frame_set(int(round(f0 + (f1 - f0) * phase)))
        bpy.context.view_layer.update()
lo = Vector((1e9, 1e9, 1e9))
hi = Vector((-1e9, -1e9, -1e9))
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        lo = Vector(min(a, b) for a, b in zip(lo, w))
        hi = Vector(max(a, b) for a, b in zip(hi, w))
center = (lo + hi) / 2
radius = max((hi - lo).length / 2, 0.01)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import saga_cycles; saga_cycles.use(scene)
scene.cycles.samples = 48
scene.cycles.use_denoising = False
scene.render.resolution_x = scene.render.resolution_y = size
scene.render.film_transparent = False
world = bpy.data.worlds.new('W')
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs[0].default_value = (0.62, 0.66, 0.72, 1)
bg.inputs[1].default_value = 0.25
scene.world = world


def light(name, kind, pos, energy, size_=None):
    d = bpy.data.lights.new(name, kind)
    d.energy = energy
    if size_ is not None:
        d.size = size_
    ob = bpy.data.objects.new(name, d)
    scene.collection.objects.link(ob)
    ob.location = center + Vector(pos) * radius
    direction = center - ob.location
    ob.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    return ob


light('key', 'AREA', (2.2, -2.6, 3.0), 120 * radius * radius, 2.0 * radius)
light('fill', 'AREA', (-3.0, -1.5, 1.5), 40 * radius * radius, 3.0 * radius)
light('rim', 'AREA', (-1.0, 3.0, 2.5), 80 * radius * radius, 1.5 * radius)

cam_d = bpy.data.cameras.new('C')
cam_d.lens = 50
cam = bpy.data.objects.new('C', cam_d)
scene.collection.objects.link(cam)
scene.camera = cam
cam.location = center + Vector((1.0, -1.6, 0.75)).normalized() * radius * 2.1
cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()

# 바닥(그림자 받이)
bpy.ops.mesh.primitive_plane_add(size=radius * 12, location=(center.x, center.y, lo.z))
plane = bpy.context.active_object
m = bpy.data.materials.new('floor')
m.use_nodes = True
m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.55, 0.56, 0.5, 1)
plane.data.materials.append(m)

# 기준구: 알베도 0.5 무광(노출 기준 — 이 공이 중간 회색으로 보여야 조명이 맞다)
bpy.ops.mesh.primitive_uv_sphere_add(radius=radius * 0.22, location=(center.x + radius * 0.95, center.y - radius * 0.6, lo.z + radius * 0.22))
sph = bpy.context.active_object
bpy.ops.object.shade_smooth()
ms = bpy.data.materials.new('ref')
ms.use_nodes = True
ms.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.5, 0.5, 0.5, 1)
ms.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.85
sph.data.materials.append(ms)

if TOON:
    for o in meshes:
        has_col = 'Col' in o.data.color_attributes
        for slot in o.material_slots:
            m = slot.material
            if not m or not m.use_nodes:
                continue
            t = m.node_tree
            bsdf = next((n for n in t.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            outn = next((n for n in t.nodes if n.type == 'OUTPUT_MATERIAL'), None)
            if bsdf is None or outn is None:
                continue
            toon = t.nodes.new('ShaderNodeBsdfToon')
            toon.component = 'DIFFUSE'
            toon.inputs['Size'].default_value = 0.55
            toon.inputs['Smooth'].default_value = 0.02
            src = bsdf.inputs['Base Color']
            if has_col and not any(n.type == 'VERTEX_COLOR' for n in t.nodes):
                vc = t.nodes.new('ShaderNodeVertexColor')
                vc.layer_name = 'Col'
                mix = t.nodes.new('ShaderNodeMix')
                mix.data_type = 'RGBA'
                mix.blend_type = 'MULTIPLY'
                mix.inputs['Factor'].default_value = 1.0
                if src.is_linked:
                    t.links.new(src.links[0].from_socket, mix.inputs[6])
                else:
                    mix.inputs[6].default_value = src.default_value
                t.links.new(vc.outputs['Color'], mix.inputs[7])
                t.links.new(mix.outputs[2], toon.inputs['Color'])
            elif src.is_linked:
                t.links.new(src.links[0].from_socket, toon.inputs['Color'])
            else:
                toon.inputs['Color'].default_value = src.default_value
            t.links.new(toon.outputs['BSDF'], outn.inputs['Surface'])

scene.render.filepath = os.path.abspath(out)
bpy.ops.render.render(write_still=True)
print('RENDER_OK', out)
