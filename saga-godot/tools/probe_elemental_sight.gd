extends Node
## GO 원소 시야(106장 ⑬) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_SIGHT_PROBE 가 있을 때만 단다.
##
##   SAGA_SIGHT_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 입력(V·휠 누르기) + 숨은 선택지 창이 마우스 시점을 안 막음 ② 켜면 막이 짙어지고 반경 안 상자가 짚힘 ③ 상자·지점·적 수가 직접 센 것과 같음
## ④ 흔적 = 가장 가까운 상자·별조각, 점들이 땅 위 ⑤ 상자를 열면 빛이 빠짐 ⑥ 석등 상자 곁 — 꺼진 석등 수
## ⑦ 창(인물 화면)이 열리면 저절로 꺼짐 ⑧ 떼면 막이 걷힘.
## 저장 파일은 안 건드린다(연 상자는 이 판에서만).

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Waypoints := preload("res://games/saga_go/world/waypoints.gd")

var _p: Node3D
var _s: Node
var _frame := 0
var _step := 0
var _fails := 0
var _chest: Node3D = null
var _n0 := 0

func _ready() -> void:
	Weather.force("clear")

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _s == null:
		_p = get_tree().get_first_node_in_group("player")
		_s = get_tree().get_first_node_in_group("go_elemental_sight")
		return
	match _step:
		0: # ① 입력
			var keys := false
			var mid := false
			for ev in InputMap.action_get_events("go_sight"):
				if ev is InputEventKey and (ev as InputEventKey).physical_keycode == KEY_V:
					keys = true
				if ev is InputEventMouseButton and (ev as InputEventMouseButton).button_index == MOUSE_BUTTON_MIDDLE:
					mid = true
			## 숨겨 둔 선택지 창이 ui_modal 에 남아 있어도 마우스 시점이 풀렸다고 보지 않는다(camera_rig 버그 고침).
			var rig := get_tree().get_first_node_in_group("camera_rig")
			var free_look: bool = rig != null and not rig.call("_modal_open")
			_check("input", keys and mid and not _s.get("active") and free_look,
				"free_look=%s hidden_modals=%d" % [free_look, get_tree().get_nodes_in_group("ui_modal").size()])
			_next()
		1: # ② 잠금 없는 안 연 상자 8m 옆에서 켠다
			if _frame == 1:
				_chest = _pick_chest("none")
				if _chest:
					_p.global_position = _chest.global_position + Vector3(8.0, 1.0, 0.0)
			if _frame == 4:
				_s.call("set_active", true)
			if _frame == 20:
				_s.call("rescan")
				var veil: ColorRect = _s.get("_veil")
				_check("on", _chest != null and _s.get("active") and float(_s.get("strength")) >= 0.99 and veil.visible \
					and int(_s.call("count_of", "chest")) >= 1,
					"chest=%s active=%s strength=%.2f chests=%d modal=%d duel=%d frozen=%s" % [_chest != null, _s.get("active"), float(_s.get("strength")), int(_s.call("count_of", "chest")), get_tree().get_nodes_in_group("ui_modal").size(), get_tree().get_nodes_in_group("duel_active").size(), _p.get("frozen")])
				_next()
		2: # ③ 직접 센 것과 같음
			_s.call("rescan")
			var p := _p.global_position
			var chests := 0
			for c in get_tree().get_nodes_in_group("treasure_chest"):
				if not c.get("is_open") and p.distance_to((c as Node3D).global_position + Vector3.UP * 0.5) <= 45.0:
					chests += 1
			var wps := get_tree().get_first_node_in_group("go_waypoints")
			var wp := 0
			for id in Waypoints.point_ids():
				if not Waypoints.is_active(id) and p.distance_to(wps.call("world_pos_of", id) + Vector3.UP * 1.6) <= 45.0:
					wp += 1
			var en := 0
			for e in get_tree().get_nodes_in_group("field_enemy"):
				if not e.call("is_dead") and p.distance_to((e as Node3D).global_position + Vector3.UP) <= 45.0:
					en += 1
			var ok: bool = chests == int(_s.call("count_of", "chest")) and wp == int(_s.call("count_of", "waypoint")) and en == int(_s.call("count_of", "enemy"))
			_check("counts", ok, "chest %d/%d wp %d/%d enemy %d/%d" % [chests, int(_s.call("count_of", "chest")), wp, int(_s.call("count_of", "waypoint")), en, int(_s.call("count_of", "enemy"))])
			_next()
		3: # ④ 흔적 — 가장 가까운 상자·별조각, 땅 위
			_s.call("rescan")
			var p := _p.global_position
			var best := 80.0
			var want: Variant = null
			var cands: Array = []
			for c in get_tree().get_nodes_in_group("treasure_chest"):
				if not c.get("is_open"):
					cands.append((c as Node3D).global_position)
			var shards := get_tree().get_first_node_in_group("go_star_shards")
			for sp in shards.call("remaining_positions"):
				cands.append(sp)
			for q in cands:
				var d := Vector2(q.x - p.x, q.z - p.z).length()
				if d < best:
					best = d
					want = q
			var got: Variant = _s.get("trail_target")
			var pts: Array = _s.get("trail_points")
			var on_ground := true
			for q in pts:
				var region := TestMap.region_at(q)
				if region != "" and absf(q.y - TerrainBuilder.height_at(region, q) - 0.15) > 0.01:
					on_ground = false
			_check("trail", want != null and got != null and (got as Vector3).is_equal_approx(want) and pts.size() >= 2 and on_ground,
				"dist=%.1f pts=%d ground=%s" % [best, pts.size(), on_ground])
			_next()
		4: # ⑤ 상자를 열면 빛이 빠진다
			_n0 = int(_s.call("count_of", "chest"))
			_chest.call("open")
			_s.call("rescan")
			_check("opened", int(_s.call("count_of", "chest")) == _n0 - 1, "chest %d→%d" % [_n0, int(_s.call("count_of", "chest"))])
			_next()
		5: # ⑥ 석등 상자 곁 — 꺼진 석등 수
			if _frame == 1:
				_chest = _pick_chest("torch")
				if _chest:
					_p.global_position = _chest.global_position + Vector3(3.0, 1.0, 3.0)
			if _frame == 4:
				_s.call("rescan")
				var want := 0
				var p := _p.global_position
				for c in get_tree().get_nodes_in_group("treasure_chest"):
					for t in c.call("unlit_torches"):
						if p.distance_to(t.pos + Vector3.UP * 1.3) <= 45.0:
							want += 1
				var torches := (_chest.call("unlit_torches") as Array).size() if _chest else 0
				_check("torches", _chest != null and torches >= 2 and int(_s.call("count_of", "torch")) == want,
					"torches=%d seen=%d want=%d" % [torches, int(_s.call("count_of", "torch")), want])
				_next()
		6: # ⑦ 창이 열리면 꺼진다
			var cs := get_tree().get_first_node_in_group("go_character_screen")
			if _frame == 1:
				cs.call("open_screen")
			if _frame == 10: # 시야는 _process(그리는 프레임)에서 창을 본다 — 부하가 크면 물리 2프레임 사이에 그리는 프레임이 없을 수 있다
				var off: bool = not _s.get("active")
				var reopen: bool = _s.call("set_active", true) == null and not _s.get("active")
				cs.call("close_screen")
				_check("modal_off", off and reopen, "off=%s reopen_blocked=%s" % [off, reopen])
				_next()
		7: # ⑧ 켰다 떼면 막이 걷힌다
			if _frame == 1:
				_s.call("set_active", true)
			if _frame == 3:
				_s.call("set_active", false)
			if _frame == 30:
				var veil: ColorRect = _s.get("_veil")
				_check("off", not _s.get("active") and float(_s.get("strength")) == 0.0 and not veil.visible, "strength=%.2f" % float(_s.get("strength")))
				_next()
		8:
			print("SIGHT_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _pick_chest(lock: String) -> Node3D:
	for c in get_tree().get_nodes_in_group("treasure_chest"):
		if not c.get("is_open") and c.get("lock") == lock:
			return c
	return null

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("SIGHT_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
