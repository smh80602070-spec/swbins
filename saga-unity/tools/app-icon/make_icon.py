# PLAN.md 110 ⑥b 임시 앱 아이콘 — Blender 로 굽는다(그림을 받으면 같은 세 파일을 바꿔 넣으면 된다).
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P tools/app-icon/make_icon.py
# 먹빛 둥근 그러데이션 바탕 + 금빛 테 + 금빛 "史"(역사 — Noto Sans KR Bold, OFL: 글꼴로 만든 그림은 글꼴 소프트웨어가 아니다).
# 결과(1024²) → Assets/Art/Icon/:
#   icon_full.png        바탕+테+글자 (PC·안드로이드 옛 아이콘·스토어 그림)
#   icon_adaptive_bg.png 바탕만 (안드로이드 적응형 뒤판, 가장자리까지 꽉)
#   icon_adaptive_fg.png 테+글자만, 투명 바탕 (적응형 앞판 — 기기가 잘라 내도 안전한 가운데 66/108 안에 들어가게 작게)
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
FONT = os.path.join(ROOT, "Assets", "Art", "Fonts", "NotoSansKR", "NotoSansKR-Bold.otf")
OUT = os.path.join(ROOT, "Assets", "Art", "Icon")
SIZE = 1024
GLYPH = "史"

INK_CENTER = (0.030, 0.034, 0.060)
INK_EDGE = (0.004, 0.004, 0.007)
GOLD = (0.83, 0.56, 0.20)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 96
    sc.cycles.use_denoising = True
    sc.render.resolution_x = SIZE
    sc.render.resolution_y = SIZE
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("W")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.20, 0.17, 0.13, 1.0)  # 금속이 비칠 따뜻한 주변빛
    bg.inputs[1].default_value = 0.6
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 2.0
    cam = bpy.data.objects.new("Cam", cam_data)
    cam.location = (0, 0, 10)
    sc.collection.objects.link(cam)
    sc.camera = cam
    return sc


def gold_material():
    m = bpy.data.materials.new("Gold")
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*GOLD, 1.0)
    p.inputs["Metallic"].default_value = 0.85
    p.inputs["Roughness"].default_value = 0.32
    return m


def background(sc):
    bpy.ops.mesh.primitive_plane_add(size=2.0, location=(0, 0, -1))
    plane = bpy.context.active_object
    plane.name = "Background"
    m = bpy.data.materials.new("Ink")
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    grad = nt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (0.85, 0.85, 0.85)
    nt.links.new(coord.outputs["Object"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], grad.inputs["Vector"])
    nt.links.new(grad.outputs["Fac"], ramp.inputs["Fac"])
    ramp.color_ramp.elements[0].color = (*INK_EDGE, 1.0)
    ramp.color_ramp.elements[1].color = (*INK_CENTER, 1.0)
    nt.links.new(ramp.outputs["Color"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    plane.data.materials.append(m)
    return plane


def foreground(sc, gold):
    objs = []
    # 금빛 테
    bpy.ops.mesh.primitive_torus_add(major_radius=0.86, minor_radius=0.045, major_segments=160, minor_segments=24, location=(0, 0, 0))
    ring = bpy.context.active_object
    ring.data.materials.append(gold)
    bpy.ops.object.shade_smooth()
    objs.append(ring)
    # 글자
    font = bpy.data.fonts.load(FONT)
    cu = bpy.data.curves.new("Glyph", "FONT")
    cu.body = GLYPH
    cu.font = font
    cu.size = 2.75
    cu.extrude = 0.10
    cu.bevel_depth = 0.03
    cu.bevel_resolution = 3
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    glyph = bpy.data.objects.new("Glyph", cu)
    sc.collection.objects.link(glyph)
    glyph.data.materials.append(gold)
    # 실제 잉크 상자로 가운데 맞춤(글꼴 상자는 글자 위아래 여백이 달라 한쪽으로 쏠린다)
    bpy.context.view_layer.update()
    xs = [v[0] for v in glyph.bound_box]
    ys = [v[1] for v in glyph.bound_box]
    glyph.location = (-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, 0.0)
    objs.append(glyph)
    # 빛: 왼쪽 위 주광 · 오른쪽 아래 약한 보조
    for name, loc, power, size in (("Key", (-3, 4, 6), 1400, 3.0), ("Fill", (4, -3, 5), 350, 4.0), ("Top", (0, 0, 8), 250, 6.0)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = power
        ld.size = size
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        sc.collection.objects.link(lo)
        tr = lo.constraints.new("TRACK_TO")
        tr.target = glyph
        tr.track_axis = "TRACK_NEGATIVE_Z"
        tr.up_axis = "UP_Y"
    return objs


def render(sc, path, transparent):
    sc.render.film_transparent = transparent
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("[make_icon] " + path)


def main():
    os.makedirs(OUT, exist_ok=True)
    sc = reset()
    gold = gold_material()
    bg = background(sc)
    fg = foreground(sc, gold)

    # 전체 아이콘: 테 지름 = 화면 86%
    render(sc, os.path.join(OUT, "icon_full.png"), False)

    # 뒤판: 글자·테 숨김
    for o in fg:
        o.hide_render = True
    render(sc, os.path.join(OUT, "icon_adaptive_bg.png"), False)

    # 앞판: 바탕 숨김, 테 지름을 66/108 안(= 화면 61%)의 58% 로 줄인다
    for o in fg:
        o.hide_render = False
    bg.hide_render = True
    s = 0.58 / 0.86 / 1.035
    for o in fg:
        o.scale = (s, s, s)
        o.location = (o.location[0] * s, o.location[1] * s, 0.0)
    render(sc, os.path.join(OUT, "icon_adaptive_fg.png"), True)


main()
