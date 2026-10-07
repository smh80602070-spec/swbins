extends Node
## G-0062 사가마을 가구 GLB 고르기(forest_house.gd KEY_GLB → FURNITURE_GLB) — scene_probe_host 로 돈다(오토로드 필요).
## ① 키 덮어쓰기 넷(서안·문갑·도자기·등잔)이 새 GLB ② 가구 14종 중 GLB 가 있는 것은 메시가 열리고 목표 높이 > 0 ③ 덮어쓰기 없는 키는 모양 공용 GLB 그대로.

const ForestHouse := preload("res://games/saga_forest/world/forest_house.gd")
const ForestHome := preload("res://games/saga_forest/data/forest_home.gd")
const GLBUtils := preload("res://saga_core/world/glb_utils.gd")

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _pick(f: Dictionary) -> Array:
	return ForestHouse.KEY_GLB.get(String(f.key), ForestHouse.FURNITURE_GLB.get(String(f.form), []))


func run() -> int:
	var want := {"seoan": "desk_01", "mungab": "cabinet_low_01", "dokja": "vase_tall_01", "deungjan": "oil_lamp_01"}
	for k in want:
		var g := _pick(ForestHome.furn(k))
		if g.is_empty() or String(g[0]) != want[k]:
			_fail("%s → %s (기대 %s)" % [k, g, want[k]])
	var opened := 0
	for f: Dictionary in ForestHome.FURNITURE:
		var g := _pick(f)
		if g.is_empty():
			continue
		var m: Mesh = GLBUtils.extract_mesh("res://assets/world/%s.glb" % g[0])
		if m == null or float(g[1]) <= 0.0:
			_fail("%s(%s) 메시 못 엶" % [f.key, g[0]])
		else:
			opened += 1
	if opened < 12:
		_fail("GLB 로 그리는 가구 %d (12 이상이어야)" % opened)
	var bangseok := _pick(ForestHome.furn("bangseok"))
	if bangseok.is_empty() or String(bangseok[0]) != "cushion_01":
		_fail("덮어쓰기 없는 방석이 바뀜 %s" % [bangseok])
	return fails
