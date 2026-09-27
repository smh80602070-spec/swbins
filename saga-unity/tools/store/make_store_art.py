# PLAN.md 110 ⑥f 스토어 등록 그림(임시) — 앱 아이콘과 같은 장면(tools/app-icon/make_icon.py)을 불러 굽는다.
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P tools/store/make_store_art.py
# 결과 → docs/store/:
#   icon_512.png        Google Play 앱 아이콘(512×512, 네모 꽉 — 둥근 모서리·그림자는 Play 가 입힌다)
#   feature_ko.png      기능 그래픽 1024×500 — 왼쪽 아이콘 무늬, 오른쪽 "SAGA" + 한 줄(한국어)
#   feature_en.png      같은 그림, 영어 한 줄
# 진짜 그림을 받으면 같은 이름으로 바꿔 넣으면 된다. 글꼴은 Noto Sans KR(OFL — 글꼴로 만든 그림은 글꼴 소프트웨어가 아니다).
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "app-icon"))
import make_icon as mi  # noqa: E402

OUT = os.path.normpath(os.path.join(HERE, "..", "..", "docs", "store"))
FONT_BOLD = mi.FONT
IVORY = (0.93, 0.89, 0.80)
LINES = {
    "ko": "역사 인물로 노는 다섯 판",
    "en": "Five games with figures from history",
}


def text(sc, body, font_path, size, loc, material, extrude=0.0):
    cu = bpy.data.curves.new("T_" + body[:6], "FONT")
    cu.body = body
    cu.font = bpy.data.fonts.load(font_path, check_existing=True)
    cu.size = size
    cu.extrude = extrude
    cu.bevel_depth = extrude * 0.3
    cu.align_x = "LEFT"
    cu.align_y = "CENTER"
    ob = bpy.data.objects.new("T_" + body[:6], cu)
    sc.collection.objects.link(ob)
    ob.data.materials.append(material)
    ob.location = loc
    return ob


def ivory_material():
    m = bpy.data.materials.new("Ivory")
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (*IVORY, 1.0)
    emit.inputs["Strength"].default_value = 1.0
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return m


def icon_512():
    sc = mi.reset()
    gold = mi.gold_material()
    mi.background(sc)
    mi.foreground(sc, gold)
    sc.render.resolution_x = 512
    sc.render.resolution_y = 512
    mi.render(sc, os.path.join(OUT, "icon_512.png"), False)


def feature(lang):
    sc = mi.reset()
    w, h = 1024, 500
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    aspect = w / h
    sc.camera.data.ortho_scale = 2.0 * aspect          # 높이가 2 단위(아이콘과 같은 비율)
    gold = mi.gold_material()
    bg = mi.background(sc)
    bg.scale = (aspect * 1.02, 1.02, 1.0)               # 바탕을 가로로 늘림(그러데이션은 가운데가 밝은 원이라 늘려도 자연스럽다)
    fg = mi.foreground(sc, gold)
    s = 0.70
    for o in fg:
        o.scale = (s, s, s)
        o.location = (o.location[0] * s - aspect + 1.15, o.location[1] * s, 0.0)
    ivory = ivory_material()
    x = -aspect + 2.20
    text(sc, "SAGA", FONT_BOLD, 1.00, (x, 0.20, 0.0), gold, extrude=0.05)
    text(sc, LINES[lang], FONT_BOLD, 0.21 if lang == "en" else 0.25, (x + 0.03, -0.36, 0.0), ivory)
    sc.render.image_settings.color_mode = "RGB"      # Play 기능 그래픽은 투명 채널 없는 PNG·JPEG
    mi.render(sc, os.path.join(OUT, f"feature_{lang}.png"), False)


os.makedirs(OUT, exist_ok=True)
icon_512()
for lang in ("ko", "en"):
    feature(lang)
