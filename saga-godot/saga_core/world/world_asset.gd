class_name WorldAsset
extends RefCounted

## G-0014 — K-0017 통일 툰 GLB(`assets/world/<id>.glb`, 세 트랙 공용)로 옛 소품·건물 GLB 를 바꾸는 조회 한 곳.
## 호출부는 옛 경로를 그대로 넘기고 `path()` 로 새 경로를, `k()` 로 "같은 크기로 보이게 하는 배율"을 받는다.
## 표에 없는 경로(나무·풀·바위·시장 좌판 등 world 세트에 짝이 없는 것)는 그대로 돌려준다.
## 새 GLB 가 안 열리면 옛 경로로 물러서고 경고 한 줄을 남긴다(진단에서 0 이어야 한다).

const WORLD_DIR := "res://assets/world/"
const PROPS_DIR := "res://assets/generated/props/"

## 옛 파일 이름(폴더 뺌) → [새 id, 배율]. 배율 = 옛 높이 / 새 높이(집은 바닥 면적 쪽으로 절충). 키는 `assets/generated/props` 기준.
const MAP := {
	"well_s1_01.glb": ["well_01", 1.03],
	"lamp_s1_01.glb": ["stone_lantern_01", 1.48],
	"lamp_s2_02.glb": ["street_lamp_01", 0.77],
	"stele_s1_01.glb": ["stele_01", 0.566],
	"stele_s2_02.glb": ["stele_01", 0.664],
	"house_s2_02.glb": ["eu_house_01", 0.6],
	"tower_s1_01.glb": ["stone_tower_01", 1.12],
	## G-0021 — K-0053·K-0057 통일 툰 GLB 로 나머지 procgen 소품(실측 AABB 높이 비로 맞춤).
	"fence_s1_01.glb": ["wood_fence_01", 0.82],
	"fence_s2_02.glb": ["iron_fence_01", 0.43],
	"reed_s1_01.glb": ["reed_clump_01", 0.88],
	"scare_s1_01.glb": ["scarecrow_01", 1.06],
	"rock_s1_01.glb": ["rock_small_01", 1.4],
	"rock_s2_02.glb": ["rock_moss_01", 0.6],
	"rock_s3_03.glb": ["rock_large_01", 0.4],
	"rock_s4_04.glb": ["rock_small_01", 1.3],
	"market_s1_01.glb": ["market_stall_01", 1.04],
	"wall_s1_01.glb": ["rubble_wall_01", 0.7],
	"wall_s2_02.glb": ["low_stone_wall_01", 1.15],
}


static func _entry(old_path: String) -> Array:
	if not old_path.begins_with(PROPS_DIR):
		return []
	return MAP.get(old_path.get_file(), []) as Array


## 새 GLB 경로(짝이 있고 열리면), 아니면 `old_path` 그대로.
static func path(old_path: String) -> String:
	var e := _entry(old_path)
	if e.is_empty():
		return old_path
	var p := "%s%s.glb" % [WORLD_DIR, String(e[0])]
	if not ResourceLoader.exists(p):
		push_warning("WorldAsset: 새 GLB 없음 — %s (옛 경로로 물러섬)" % p)
		return old_path
	return p


## `path()` 가 새 경로를 골랐을 때의 크기 배율, 아니면 1.0.
static func k(old_path: String) -> float:
	var e := _entry(old_path)
	if e.is_empty() or path(old_path) == old_path:
		return 1.0
	return float(e[1])


static func load_scene(old_path: String) -> PackedScene:
	return load(path(old_path)) as PackedScene
