#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
팔레트 스냅 — SAGA-DESIGN.md §7.2 1번(palette.py), §6.0 "바이옴당 24색
(기본 8 + 명·암 2단), 모든 에셋은 임포트 시 팔레트에 스냅". tools/obj-split·
tools/glb-compress 처럼 다섯 판·두 트랙이 공유하는 빌드 도구라 tools/ 에 둔다
(게임 코드 공유 금지 원칙은 빌드 도구엔 안 걸린다, SAGA-DESIGN 105-Q 확인됨).

무엇을 하나:
1. `build` — PALETTES(아래, 판별 base8 하드코딩)에서 명(light)·암(dark) 2단을
   자동 계산해(흰/검과 섞기) 24색 JSON(assets/generated/palettes/<name>.json)을
   씨앗 없이 결정적으로 만든다.
2. `snap-glb` — GLB 하나를 읽어 텍스처(PBRMaterial.baseColorTexture)와
   정점색(ColorVisuals)을 팔레트 24색 중 최근접 색으로 전부 바꿔 새 GLB로
   내보낸다. 알파 채널은 그대로 둔다.
3. `preview` — 스냅 전/후 텍스처를 나란히 붙인 비교 PNG 하나(GUI를 띄우지
   않고 결과를 눈으로 확인하는 자리 — 3D 스크린샷 금지 규칙과 별개, 평면
   이미지 비교일 뿐).
4. `tint-glb`/`tint-preview`(2026-09-19) — `snap-glb`와 달리 **명도(V)는
   원본 그대로 두고 색상·채도만** 팔레트 한 색으로 바꾼다. 부드럽게 음영진
   천 텍스처(VRoid 옷 등)를 최근접 스냅하면 그라디언트가 얼룩덜룩 깨지는
   문제(§"VRoid 옷" 발견, HANDOFF 참고)를 피한다. `--only-suffix`로
   material.name 접미사(예: VRoid 의 `_CLOTH`)를 골라 얼굴·피부·머리는
   그대로 둘 수 있다.

무엇을 안 하나: 어떤 GLB를 스냅할지 고르는 것(자산마다 사람/세션이 판단),
스냅한 GLB를 실제 씬에 물리는 것(103-5 절차의 다음 단계, 여기선 안 한다).

색 거리는 단순 RGB 유클리드다(Lab 변환 없음) — "가장 싸고 즉시 가능"이
목표라 트리·바위 몇 종 팔레트 스왑엔 이 정도로 충분하다(SAGA-DESIGN §7.2).
"""

import argparse
import colorsys
import json
import os
import sys

import numpy as np
from PIL import Image

FORGE_DIR = os.path.dirname(os.path.abspath(__file__))

## 판별 base 8색 — 이미 실기 승인난 세계의 실제 지형색에서 그대로 뽑았다
## (새로 지어내지 않는다 — 팔레트가 지금 화면과 어긋나면 "통일"이 아니라
## "또 다른 스타일"이 된다). GO는 saga-godot/games/saga_go/world/
## terrain_builder.gd LEGEND 색 8종(2026-09-19 확인).
PALETTES = {
	"go_village": {
		"grass": (0.38, 0.55, 0.24),
		"forest": (0.16, 0.32, 0.14),
		"path": (0.62, 0.50, 0.32),
		"village_wall": (0.78, 0.68, 0.42),
		"mountain_stone": (0.55, 0.53, 0.50),
		"water": (0.25, 0.45, 0.62),
		"sand": (0.76, 0.68, 0.50),
		"shrine_wood": (0.50, 0.42, 0.30),
	},
	## saga-godot PLAN.md 103-3 "폐허" 갈래 base8 — go_village과 같은 원칙
	## (새로 안 지어냄). terrain_builder.gd LEGEND["R"]·landmarks_builder.gd
	## 바위 재질(mossstone 포함)·region3_ruins.gd DEBRIS_COLOR에서 그대로
	## 뽑았다(2026-09-19). "시대 퓨전"(녹슨 금속·홀로그램) 갈래는 아직 이
	## 판에 실제 색이 없어(전장 잔해 4종은 방패·투구·화살통·깃발, 미래 소품
	## 아님) 보류 — 실제로 그 소품이 생기면 그때 base8을 뽑는다.
	"go_ruins": {
		"ruins_ground": (0.45, 0.42, 0.40),
		"debris": (0.40, 0.36, 0.30),
		"weathered_stone": (0.48, 0.44, 0.36),
		"moss_stone": (0.30, 0.36, 0.24),
		"mountain_stone": (0.55, 0.53, 0.50),
		"path": (0.62, 0.50, 0.32),
		"cave_dark": (0.20, 0.20, 0.22),
		"plains": (0.38, 0.55, 0.24),
	},
	## saga-godot PLAN.md 103-3 "포구" 갈래 base8 — go_village과 같은 원칙.
	## terrain_builder.gd LEGEND["D"](모래)·water 앵커(go_village과 같은
	## 값)·region2_coast.gd의 실제 소품 색(선착장·표류물 나무·갈매기·
	## 고래뼈·해변 잡동사니·조각배·게)에서 그대로 뽑았다(2026-09-19).
	"go_coast": {
		"sand": (0.76, 0.68, 0.50),
		"water": (0.25, 0.45, 0.62),
		"mountain_stone": (0.55, 0.53, 0.50),
		"driftwood": (0.42, 0.30, 0.18),
		"bone_white": (0.88, 0.86, 0.80),
		"beach_debris": (0.62, 0.56, 0.42),
		"boat_gray": (0.55, 0.50, 0.42),
		"crab_red": (0.75, 0.22, 0.14),
	},
	## saga-forest PLAN.md §6.3 "green"(기본) 바이옴 판별 팔레트 base8.
	## TILES(grass/path 등)·FOG_COLOR 앵커에서 그대로 옮겼다(2026-09-19,
	## Kenney Fantasy Town Kit 킷배싱 건물의 diffuse 를 이 팔레트로 스냅).
	"forest_green": {
		"ground": (0.388, 0.690, 0.290),   # 땅 #63b04a
		"path": (0.796, 0.671, 0.455),     # 길 #cbab74
		"leaf": (0.247, 0.561, 0.227),     # 잎 #3f8f3a
		"stem": (0.420, 0.290, 0.180),     # 줄기 #6b4a2e
		"water": (0.310, 0.737, 0.855),    # 물 #4fbcda
		"stone": (0.663, 0.655, 0.635),    # 돌 #a9a7a2
		"accent": (0.910, 0.353, 0.416),   # 강조 #e85a6a
		"sky": (0.561, 0.780, 0.910),      # 하늘/안개 #8fc7e8
	},
	## saga-godot PLAN.md 103-3 "Modular Cave 굴혈 mood 3" — DUNGEON엔 GO의
	## terrain_builder LEGEND 같은 "이미 화면에 승인된" 기준색이 없어(2026-09-19
	## 리타겟 보고 때 확인), 이 세 팔레트는 새로 지어낸 첫 시안이다 — 103-5
	## 절차대로 스냅만 해 두고 씬엔 안 물린다, 사람이 톤을 보고 확정해야 한다.
	## 셋 다 "shadow" 롤은 go_ruins의 cave_dark(0.20,0.20,0.22)를 그대로 재사용해
	## 새로 지어내는 색을 최소화했다.
	"dungeon_dirt": {
		"wall": (0.40, 0.32, 0.24),
		"floor": (0.28, 0.22, 0.16),
		"rock": (0.42, 0.40, 0.36),
		"root": (0.30, 0.22, 0.12),
		"moss": (0.26, 0.36, 0.20),
		"vein": (0.58, 0.48, 0.28),
		"water": (0.18, 0.30, 0.36),
		"shadow": (0.20, 0.20, 0.22),
	},
	"dungeon_limestone": {
		"wall": (0.62, 0.60, 0.54),
		"floor": (0.48, 0.46, 0.40),
		"rock": (0.70, 0.68, 0.62),
		"stalactite": (0.75, 0.73, 0.66),
		"moss": (0.30, 0.40, 0.26),
		"vein": (0.55, 0.52, 0.42),
		"water": (0.30, 0.50, 0.56),
		"shadow": (0.20, 0.20, 0.22),
	},
	"dungeon_lava": {
		"wall": (0.24, 0.16, 0.14),
		"floor": (0.18, 0.12, 0.10),
		"rock": (0.30, 0.22, 0.18),
		"ember": (0.85, 0.35, 0.10),
		"lava_glow": (0.95, 0.55, 0.12),
		"ash": (0.34, 0.30, 0.28),
		"vein": (0.60, 0.30, 0.14),
		"shadow": (0.12, 0.08, 0.08),
	},
	## saga-godot PLAN.md 101-3 G "성장 가시화"(무기 메시 스왑) — 새로 지어낸
	## 색이 아니라 `games/saga_dungeon/data/dungeon_items.gd` GRADES(key 0~4)
	## 의 기존 hex를 그대로 옮겼다. g0=상품(常品)·g1=양품(良品)·g2=명품(名品)·
	## g3=보물(寶物)·g4=전설(傳說), 원본 hex는 각각
	## #d0c8b8·#6f6fff·#ffff64·#00c000·#c7a76c.
	"dungeon_grade": {
		"g0": (0.816, 0.784, 0.722),
		"g1": (0.435, 0.435, 1.000),
		"g2": (1.000, 1.000, 0.392),
		"g3": (0.000, 0.753, 0.000),
		"g4": (0.780, 0.655, 0.424),
	},
	## saga-realm §6 "탑 킷배싱" 2·3등급 동양풍(2026-09-23) — 원본 부품(Polygonal
	## Mind "tomb-chaser-2", 네온웨이브 콘셉트 팩)의 텍스처가 보라·분홍·시안 같은
	## 네온색이라 그대로 못 쓴다(오프라인 실루엣 확인 뒤 색만 따로 확인해 발견).
	## 1등급 BellStructure.glb 채택 당시 "붉은 기둥 종틀"이라 적어 둔 결(나무·
	## 기와 톤)에 맞춰 새로 골랐다 — 사가만리 팔레트의 "기와 #4A4E57"·"목재
	## #A9744F"(SAGA-DESIGN §6.0 예시색)와도 같은 계열.
	"realm_asian_tower": {
		"wood": (0.55, 0.36, 0.20),
		"wood_dark": (0.34, 0.21, 0.12),
		"roof_red": (0.55, 0.15, 0.12),
		"roof_dark": (0.16, 0.12, 0.11),
		"stone": (0.55, 0.53, 0.50),
		"gold": (0.72, 0.58, 0.26),
		"plaster": (0.82, 0.76, 0.64),
		"ink": (0.10, 0.09, 0.09),
	},
}

LIGHT_MIX = 0.35  # 흰색 쪽으로 섞는 비율
DARK_MIX = 0.35   # 검은색 쪽으로 섞는 비율


def _mix(rgb, target, t):
	return tuple(c * (1.0 - t) + target * t for c in rgb)


def _to_hex(rgb01):
	return "#%02x%02x%02x" % tuple(round(max(0.0, min(1.0, c)) * 255) for c in rgb01)


def build_palette(name):
	if name not in PALETTES:
		sys.exit("모르는 팔레트 이름 '%s' — palette.py 의 PALETTES 에 base8 을 먼저 추가하세요." % name)
	base = PALETTES[name]
	swatches = []
	for role, rgb in base.items():
		swatches.append({"role": role, "band": "base", "hex": _to_hex(rgb)})
		swatches.append({"role": role, "band": "light", "hex": _to_hex(_mix(rgb, 1.0, LIGHT_MIX))})
		swatches.append({"role": role, "band": "dark", "hex": _to_hex(_mix(rgb, 0.0, DARK_MIX))})
	data = {"name": name, "roles": len(base), "colors": swatches}
	assert len(swatches) == len(base) * 3
	return data


def save_palette(name, out_dir):
	data = build_palette(name)
	os.makedirs(out_dir, exist_ok=True)
	out_path = os.path.join(out_dir, "%s.json" % name)
	with open(out_path, "w", encoding="utf-8") as f:
		json.dump(data, f, ensure_ascii=False, indent=2)
	print("팔레트 %d색 -> %s" % (len(data["colors"]), out_path))
	return out_path


def load_role_rgb01(path, role, band="base"):
	"""2026-09-19 — VRoid 옷감 물들이기(tint) 용. `snap_rgb_array`의 최근접
	스냅은 부드럽게 음영진 천 텍스처(하이라이트~그림자 그라디언트)를 8색
	중 하나로 픽셀마다 따로 반올림해 버려, 원단이 아니라 얼룩덜룩한
	패치워크로 뭉갠다(2026-09-19, avatar_sample_a Tops 텍스처로 확인 —
	`_material_matches`+CLOTH 필터로 얼굴/피부/머리는 지켰는데도 옷 자체가
	깨졌다). 그래서 옷은 스냅이 아니라 **색조(H)·채도(S)만 팔레트 색으로
	갈아 끼우고 명도(V, 원본 음영)는 그대로 두는** `tint_image()`를 쓴다."""
	with open(path, "r", encoding="utf-8") as f:
		data = json.load(f)
	for c in data["colors"]:
		if c["role"] == role and c["band"] == band:
			h = c["hex"].lstrip("#")
			return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
	sys.exit("팔레트 %s 에 role=%s band=%s 가 없습니다." % (path, role, band))


def tint_image(img: Image.Image, target_rgb01, sat_scale=1.0) -> Image.Image:
	"""원본의 명도(V, 음영·하이라이트)는 그대로 두고 색상(H)·채도(S)만
	target 색으로 맞춘다 — `snap_image()`(최근접 스냅)와 달리 그라디언트가
	안 깨진다. `sat_scale` < 1 이면 target 채도를 눌러 더 차분하게(팔레트
	원색 그대로 쓰면 애니메 특유의 쨍한 채도가 남을 수 있어서)."""
	img = img.convert("RGBA")
	r, g, b, a = img.split()
	hsv = Image.merge("RGB", (r, g, b)).convert("HSV")
	_h, s_ch, v_ch = hsv.split()
	th, ts, _tv = colorsys.rgb_to_hsv(*target_rgb01)
	ts = max(0.0, min(1.0, ts * sat_scale))
	h_new = Image.new("L", img.size, int(round(th * 255)) % 256)
	s_new = Image.new("L", img.size, int(round(ts * 255)))
	rgb_new = Image.merge("HSV", (h_new, s_new, v_ch)).convert("RGB")
	nr, ng, nb = rgb_new.split()
	return Image.merge("RGBA", (nr, ng, nb, a))


def tint_glb(in_path, palette_path, role, out_path, only_suffix=None, band="base", sat_scale=1.0):
	import trimesh

	target = load_role_rgb01(palette_path, role, band)
	scene = trimesh.load(in_path, force="scene")
	touched, skipped = [], []
	for name, geom in scene.geometry.items():
		visual = geom.visual
		mat = getattr(visual, "material", None)
		if not _material_matches(mat, only_suffix):
			skipped.append(name)
			continue
		tex = getattr(mat, "baseColorTexture", None) if mat is not None else None
		if tex is not None:
			visual.material.baseColorTexture = tint_image(tex, target, sat_scale)
			touched.append("%s(texture)" % name)
	if not touched:
		print("경고 — 대상 재질에서 텍스처를 못 찾았습니다(%s). 그대로 내보냅니다." % in_path)
	os.makedirs(os.path.dirname(out_path), exist_ok=True)
	scene.export(out_path)
	print("물들임(%s) %s -> %s (%s)%s" % (
		role, in_path, out_path, ", ".join(touched) or "변경 없음",
		" [건너뜀: %s]" % ", ".join(skipped) if skipped else ""))
	return touched


def tint_preview(in_path, palette_path, role, out_path, only_suffix=None, band="base", sat_scale=1.0):
	import trimesh

	target = load_role_rgb01(palette_path, role, band)
	scene = trimesh.load(in_path, force="scene")
	tex = None
	for geom in scene.geometry.values():
		mat = getattr(geom.visual, "material", None)
		if not _material_matches(mat, only_suffix):
			continue
		tex = getattr(mat, "baseColorTexture", None) if mat is not None else None
		if tex is not None:
			break
	if tex is None:
		sys.exit("대상 재질에 텍스처가 없어 preview 를 못 만듭니다: %s" % in_path)
	before = tex.convert("RGBA")
	after = tint_image(before, target, sat_scale)
	combo = Image.new("RGBA", (before.width * 2 + 8, before.height), (0, 0, 0, 0))
	combo.paste(before, (0, 0))
	combo.paste(after, (before.width + 8, 0))
	os.makedirs(os.path.dirname(out_path), exist_ok=True)
	combo.save(out_path)
	print("물들임 비교 PNG(좌 원본/우 %s) -> %s" % (role, out_path))


def load_palette_rgb(path):
	with open(path, "r", encoding="utf-8") as f:
		data = json.load(f)
	out = []
	for c in data["colors"]:
		h = c["hex"].lstrip("#")
		out.append(tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)))
	return np.array(out, dtype=np.float32)  # (24, 3) 0~255


def snap_rgb_array(rgb_u8, palette_rgb):
	"""rgb_u8: (...,3) uint8 배열. 각 픽셀/정점을 palette_rgb(24,3) 중
	유클리드 최근접 색으로 바꾼다. 24색뿐이라 KD-tree 없이 브로드캐스트로
	충분히 빠르다."""
	shape = rgb_u8.shape
	flat = rgb_u8.reshape(-1, 3).astype(np.float32)
	# (N,1,3) - (1,24,3) -> (N,24) 거리
	dist = np.sum((flat[:, None, :] - palette_rgb[None, :, :]) ** 2, axis=2)
	nearest = palette_rgb[np.argmin(dist, axis=1)]
	return nearest.reshape(shape).astype(np.uint8)


def snap_image(img: Image.Image, palette_rgb) -> Image.Image:
	img = img.convert("RGBA")
	arr = np.array(img)
	rgb = arr[:, :, :3]
	alpha = arr[:, :, 3:4]
	snapped_rgb = snap_rgb_array(rgb, palette_rgb)
	out = np.concatenate([snapped_rgb, alpha], axis=2)
	return Image.fromarray(out, mode="RGBA")


def _material_matches(mat, only_suffix):
	"""only_suffix 가 없으면 전부 통과. 있으면 material.name 에 `_<suffix>`
	토큰이 있을 때만 통과 — VRoid는 `F00_..._Tops_01_CLOTH`처럼 이름 끝에
	FACE/EYE/SKIN/CLOTH/HAIR 범주를 붙여 내보낸다(2026-09-19 확인,
	avatar_sample_a.glb material 17개 실제 이름 대조). **끝이 아니라 토큰
	검사인 이유** — GUI 자동화로 뽑은 `avatar_custom_01.glb`는 같은 이름
	끝에 `(Instance)`가 덧붙어(`..._CLOTH (Instance)`) 단순 endswith 로는
	하나도 안 걸렸다(실제로 tint-glb 첫 실행에서 "변경 없음"으로 드러남).
	얼굴·눈·피부·머리는 그대로 두고 옷(`CLOTH`)만 바이옴 팔레트로 물들일 때
	쓴다 — 전체를 8색으로 스냅하면 얼굴이 뭉개진다(§tint_image 주석 참고)."""
	if not only_suffix:
		return True
	name = (getattr(mat, "name", "") or "").upper()
	return ("_" + only_suffix.upper()) in name


def _node_excluded(scene, geom_name, exclude_node_prefix):
	"""snap-glb 전용 — material.name 만으로는 못 가리는 조립물(kitbash.py
	가 여러 부품을 하나로 합치면 부품마다 원래 material 이 달라도 텍스처
	내용이 우연히 같으면 glTF 내보내기 단계에서 재질이 하나로 합쳐진다.
	그래서 material 기준(`_material_matches`)이 아니라 **씬 그래프 노드
	이름**(kitbash.py `assemble()`이 `"<원본 파일명>_<idx>"`로 붙인다,
	예: "roof-gable_5")으로 가린다. 2026-09-19 — 집 지붕만 색을 다르게
	해 §6.4 "주민 집 외형 3종"을 만들 때, 조립 뒤 전체 스냅이 미리 물들여
	둔 지붕 텍스처까지 다시 8색으로 덮어써 버리는 걸 막는 용도."""
	if not exclude_node_prefix:
		return False
	prefix = exclude_node_prefix.lower()
	for node in scene.graph.nodes_geometry:
		_, gname = scene.graph[node]
		if gname == geom_name and node.lower().startswith(prefix):
			return True
	return False


def snap_glb(in_path, palette_path, out_path, only_suffix=None, exclude_node_prefix=None):
	import trimesh

	palette_rgb = load_palette_rgb(palette_path)
	scene = trimesh.load(in_path, force="scene")
	touched = []
	skipped = []
	for name, geom in scene.geometry.items():
		visual = geom.visual
		mat = getattr(visual, "material", None)
		if not _material_matches(mat, only_suffix) or _node_excluded(scene, name, exclude_node_prefix):
			skipped.append(name)
			continue
		touched_this = False
		tex = getattr(mat, "baseColorTexture", None) if mat is not None else None
		if tex is not None:
			visual.material.baseColorTexture = snap_image(tex, palette_rgb)
			touched.append("%s(texture)" % name)
			touched_this = True
		vc = getattr(visual, "vertex_colors", None)
		if vc is not None and len(vc) > 0:
			vc_arr = np.asarray(vc)
			rgb = vc_arr[:, :3]
			alpha = vc_arr[:, 3:4] if vc_arr.shape[1] > 3 else None
			snapped = snap_rgb_array(rgb.astype(np.uint8), palette_rgb)
			new_vc = snapped if alpha is None else np.concatenate([snapped, alpha.astype(np.uint8)], axis=1)
			geom.visual.vertex_colors = new_vc
			touched.append("%s(vertex_colors)" % name)
			touched_this = True
		if not touched_this:
			## 2026-09-19 — Kenney Nature Kit(tree_oak·rock_largeA/smallA)은
			## 텍스처도 정점색도 없이 재질마다 단색 baseColorFactor 하나뿐
			## (예: 나무 몸통 재질 하나, 수관 재질 하나). 이 경우 그 단색
			## 하나를 24색 중 최근접으로 바꾼다 — 배열이 아니라 상수 색이라
			## 위 두 갈래(snap_image·snap_rgb_array)로는 못 건드렸었다.
			factor = getattr(mat, "baseColorFactor", None) if mat is not None else None
			if factor is not None:
				rgb = np.array([factor[:3]], dtype=np.float32)
				snapped = snap_rgb_array(rgb.astype(np.uint8), palette_rgb)[0]
				alpha = int(factor[3]) if len(factor) > 3 else 255
				mat.baseColorFactor = np.array(
					[snapped[0], snapped[1], snapped[2], alpha], dtype=np.uint8)
				touched.append("%s(solid_color)" % name)
	if not touched:
		print("경고 — 텍스처도 정점색도 단색도 못 찾았습니다(%s). 그대로 내보냅니다." % in_path)
	os.makedirs(os.path.dirname(out_path), exist_ok=True)
	scene.export(out_path)
	print("스냅 %s -> %s (%s)%s" % (
		in_path, out_path, ", ".join(touched) or "변경 없음",
		" [건너뜀: %s]" % ", ".join(skipped) if skipped else ""))
	return touched


def preview_texture(in_path, palette_path, out_path, only_suffix=None):
	import trimesh

	palette_rgb = load_palette_rgb(palette_path)
	scene = trimesh.load(in_path, force="scene")
	tex = None
	for geom in scene.geometry.values():
		mat = getattr(geom.visual, "material", None)
		if not _material_matches(mat, only_suffix):
			continue
		tex = getattr(mat, "baseColorTexture", None) if mat is not None else None
		if tex is not None:
			break
	if tex is None:
		sys.exit("텍스처가 없는 GLB라 preview 를 못 만듭니다: %s" % in_path)
	snapped = snap_image(tex, palette_rgb)
	before = tex.convert("RGBA")
	after = snapped.resize(before.size) if snapped.size != before.size else snapped
	combo = Image.new("RGBA", (before.width * 2 + 8, before.height), (0, 0, 0, 0))
	combo.paste(before, (0, 0))
	combo.paste(after, (before.width + 8, 0))
	os.makedirs(os.path.dirname(out_path), exist_ok=True)
	combo.save(out_path)
	print("비교 PNG(좌 원본/우 스냅) -> %s" % out_path)


def main():
	ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	sub = ap.add_subparsers(dest="cmd", required=True)

	p_build = sub.add_parser("build", help="PALETTES 의 base8 로 24색 JSON 생성")
	p_build.add_argument("name", choices=sorted(PALETTES.keys()))
	p_build.add_argument("--out-dir", required=True)

	p_snap = sub.add_parser("snap-glb", help="GLB 텍스처/정점색을 팔레트로 스냅")
	p_snap.add_argument("glb_path")
	p_snap.add_argument("palette_path")
	p_snap.add_argument("out_path")
	p_snap.add_argument("--only-suffix", default=None,
		help="material.name 이 이 접미사로 끝나는 것만 스냅(예: CLOTH). VRoid 처럼 "
			"한 GLB에 얼굴/피부/머리/옷 재질이 섞여 있을 때 옷만 물들이는 용도")
	p_snap.add_argument("--exclude-node-prefix", default=None,
		help="씬 그래프 노드 이름이 이 접두사로 시작하는 부품은 건너뛴다(kitbash.py "
			"조립물 전용, 예: roof — tint-glb로 미리 물들여 둔 지붕을 전체 스냅이 "
			"다시 덮어쓰지 않게)")

	p_prev = sub.add_parser("preview", help="스냅 전/후 텍스처 비교 PNG")
	p_prev.add_argument("glb_path")
	p_prev.add_argument("palette_path")
	p_prev.add_argument("out_path")
	p_prev.add_argument("--only-suffix", default=None)

	p_tint = sub.add_parser("tint-glb", help="GLB 텍스처를 팔레트 한 색으로 물들인다(명도는 원본 유지)")
	p_tint.add_argument("glb_path")
	p_tint.add_argument("palette_path")
	p_tint.add_argument("role", help="팔레트 JSON 의 role 이름(예: leaf, stem, accent)")
	p_tint.add_argument("out_path")
	p_tint.add_argument("--only-suffix", default=None)
	p_tint.add_argument("--band", default="base", choices=["base", "light", "dark"])
	p_tint.add_argument("--sat-scale", type=float, default=1.0)

	p_tprev = sub.add_parser("tint-preview", help="물들이기 전/후 텍스처 비교 PNG")
	p_tprev.add_argument("glb_path")
	p_tprev.add_argument("palette_path")
	p_tprev.add_argument("role")
	p_tprev.add_argument("out_path")
	p_tprev.add_argument("--only-suffix", default=None)
	p_tprev.add_argument("--band", default="base", choices=["base", "light", "dark"])
	p_tprev.add_argument("--sat-scale", type=float, default=1.0)

	args = ap.parse_args()
	if args.cmd == "build":
		save_palette(args.name, args.out_dir)
	elif args.cmd == "snap-glb":
		snap_glb(args.glb_path, args.palette_path, args.out_path, only_suffix=args.only_suffix,
			exclude_node_prefix=args.exclude_node_prefix)
	elif args.cmd == "preview":
		preview_texture(args.glb_path, args.palette_path, args.out_path, only_suffix=args.only_suffix)
	elif args.cmd == "tint-glb":
		tint_glb(args.glb_path, args.palette_path, args.role, args.out_path,
			only_suffix=args.only_suffix, band=args.band, sat_scale=args.sat_scale)
	elif args.cmd == "tint-preview":
		tint_preview(args.glb_path, args.palette_path, args.role, args.out_path,
			only_suffix=args.only_suffix, band=args.band, sat_scale=args.sat_scale)


if __name__ == "__main__":
	main()
