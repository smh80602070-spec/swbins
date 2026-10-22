extends RefCounted

## G-0309 4종횡 지도 조각·지름길(웹 saga-story/js/stagemap.js W-0305 짝) — 순수 규칙.
## 사냥터 넷마다 발판 위 조각 셋(발판 순서 1·⌊n/2⌋·n−1). 셋 다 = 완성 → 그 사냥터로 가는 문에서
## 입구·가운데(둘째 조각 x)·끝(셋째 조각 x) 고르기. 진행은 StorySaveState.stage_maps {stage_key: [번호…]}.
## SAGA_STAGEMAP=0 이면 조각도 고르기도 없음.

const PIECES := 3
const PIECE_LIFT := 0.6   # 발판 윗면에서 조각 가운데까지(m)

## 문 목적지 씬 → 그 사냥터 지도(사냥터만 — 들판·마을은 없음)
const SCENES := {
	"res://games/saga_story/world/TestField.tscn": "res://games/saga_story/data/field_map.gd",
	"res://games/saga_story/world/ForestHuntGround.tscn": "res://games/saga_story/data/forest_map.gd",
	"res://games/saga_story/world/CaveHuntGround.tscn": "res://games/saga_story/data/cave_map.gd",
	"res://games/saga_story/world/GorgeHuntGround.tscn": "res://games/saga_story/data/gorge_map.gd",
}


static func on() -> bool:
	return OS.get_environment("SAGA_STAGEMAP") != "0"


static func map_of_scene(scene_path: String) -> GDScript:
	var p := String(SCENES.get(scene_path, ""))
	return load(p) as GDScript if p != "" else null


## 조각 자리 셋 — Vector3(x, 발판 윗면 + PIECE_LIFT, 0), x 순서
static func pieces(map: GDScript) -> Array:
	var plats: Array = map.plats_m()
	plats.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return float(a.x) < float(b.x))
	var n := plats.size()
	var out: Array = []
	for i in [1, n / 2, n - 1]:
		var p: Dictionary = plats[clampi(i, 0, n - 1)]
		out.append(Vector3(float(p.x), float(p.height) + PIECE_LIFT, 0.0))
	return out


static func got(maps: Dictionary, key: String) -> Array:
	var v: Variant = maps.get(key, [])
	return v if v is Array else []


static func done(maps: Dictionary, key: String) -> bool:
	return got(maps, key).size() >= PIECES


## 조각 줍기 — 새로 주웠으면 true(이미 있거나 번호 밖이면 false)
static func add(maps: Dictionary, key: String, idx: int) -> bool:
	if idx < 0 or idx >= PIECES:
		return false
	var g := got(maps, key).duplicate()
	if g.has(idx):
		return false
	g.append(idx)
	g.sort()
	maps[key] = g
	return true


## 지름길 시작 x(m) — "mid" 둘째·"end" 셋째 조각, 그 밖(또는 미완성)은 -1(= 문 기본 도착 그대로)
static func start_x(maps: Dictionary, map: GDScript, at: String) -> float:
	if not on() or map == null or not done(maps, String(map.stage_key())):
		return -1.0
	var ps := pieces(map)
	match at:
		"mid":
			return (ps[1] as Vector3).x
		"end":
			return (ps[2] as Vector3).x
	return -1.0
