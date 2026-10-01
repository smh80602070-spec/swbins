extends Node
## GO 봉수대(101-2 ⑤: world/beacon_tower.gd — 불을 올리면 그 지역의 안 본 명소(place)가 한 번에 도감에 찍히고 경험치) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_BEACON_PROBE 가 있을 때만 단다. 진짜 세이브는 안 건드린다(도감·경험치는 끝에 되돌림).
##
##   SAGA_BEACON_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 봉수대가 둘 넘게 서 있고 지역이 서로 다르다 ② 불을 올리면: 그 지역 place 만(점검이 따로 센 개수만큼) 새로 찍히고 다른 지역은 안 건드리며
## 경험치가 오르고 불이 켜진다 ③ 두 번째 올리기는 아무 일도 없다(보상 한 번) ④ 다른 지역 봉수대도 제 지역만. 끝에 BEACON_PROBE_DONE fails=N.

const TestMap := preload("res://games/saga_go/data/test_map.gd")

var _scene: Node
var _fails := 0


func _ready() -> void:
	Weather.force("clear")
	_scene = get_tree().current_scene
	_run.call_deferred()


func _frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("BEACON_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


## 그 지역 사각형 안에 있는 Discover_<id> 들의 id 집합(점검이 따로 센다 — 봉수대 코드와 같은 규칙을 독립으로).
func _ids_in(region_id: String) -> Dictionary:
	var origin: Vector3 = TestMap.origin_of(region_id)
	var s: Vector2i = TestMap.size(region_id)
	var tile: float = TestMap.tile_size_of(region_id)
	var out := {}
	for n in get_tree().get_nodes_in_group("codex_discoverable"):
		if not String(n.name).begins_with("Discover_"):
			continue
		var local: Vector3 = (n as Node3D).global_position - origin
		if absf(local.x) <= s.x * 0.5 * tile and absf(local.z) <= s.y * 0.5 * tile:
			out[String(n.name).substr("Discover_".length())] = true
	return out


func _run() -> void:
	await _frames(4)
	var saved_book: Dictionary = CodexState.book.duplicate()
	var saved_exp: float = PartyState.exp
	var towers := _scene.find_children("BeaconTower_*", "", true, false)
	var regions := {}
	for t in towers:
		regions[String(t.region_id)] = true
	_check("towers", towers.size() >= 2 and regions.size() == towers.size(), "%d개 · 지역 %s" % [towers.size(), str(regions.keys())])
	if towers.size() < 2:
		print("BEACON_PROBE_DONE fails=%d" % _fails)
		get_tree().quit()
		return

	CodexState.restore({})
	var first: Node = towers[0]
	var second: Node = towers[1]
	var ids1 := _ids_in(first.region_id)
	var ids2 := _ids_in(second.region_id)
	_check("regions_disjoint", ids1.size() > 0 and ids2.size() > 0 and not ids1.keys().any(func(k: String) -> bool: return ids2.has(k)), "명소 %d곳 / %d곳(겹침 없음)" % [ids1.size(), ids2.size()])

	var exp0: float = PartyState.exp
	first._light_beacon()
	var found_here := 0
	var found_other := 0
	for k in CodexState.book:
		var id := String(k).substr("place:".length())
		if ids1.has(id):
			found_here += 1
		elif ids2.has(id):
			found_other += 1
	_check("light_first", first._lit and found_here == ids1.size() and found_other == 0 and PartyState.exp >= exp0 + first.LIGHT_EXP - 0.01 and first._fire.material_override != null, "찍힌 명소 %d/%d · 다른 지역 %d · 경험 +%.1f" % [found_here, ids1.size(), found_other, PartyState.exp - exp0])

	var count1 := CodexState.count()
	var exp1: float = PartyState.exp
	first._light_beacon()
	_check("light_twice", CodexState.count() == count1 and is_equal_approx(PartyState.exp, exp1), "두 번째는 아무 일 없음")

	second._light_beacon()
	var now_other := 0
	for k in CodexState.book:
		if ids2.has(String(k).substr("place:".length())):
			now_other += 1
	_check("light_second", second._lit and now_other == ids2.size(), "다른 봉수대 %d/%d" % [now_other, ids2.size()])

	CodexState.restore(saved_book)
	PartyState.exp = saved_exp
	print("BEACON_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
