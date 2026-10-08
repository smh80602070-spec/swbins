extends Node
## G-0098 사가만리 굴 안(world/cave_interior.gd) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_GO_CAVE_PROBE 가 있을 때만 단다.
##
##   SAGA_GO_CAVE_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 굴 조각 cave_* 16 파일(안 쓰던 15 + 입구 아치 dirt)을 다 지음 ② 이음마다 바닥이 이어짐(광선, 틈 0.35m 아래 — 끝 그릇 둘레 1m)
## ③ 입구 곁 → 들어감 → 1.5초 뒤에도 들어온 자리 바닥 위 ④ 적 2·2·3 ⑤ 다 쓰러뜨림 ⑥ 끝 그릇 바닥에 섬·보물 한 번만(모라 +2500 이상)
## ⑦ 끝 빛에서 F → 들어갔던 자리·굴 숨김·해 세기 되돌림 ⑧ 비경 안이면 안 열림 ⑨ 굴 밑으로 떨어지면 들어온 자리로. 저장은 안 한다.

var _p: CharacterBody3D
var _cv: Node
var _frame := 0
var _step := 0
var _fails := 0
var _v: Variant = null
var _sun0 := 0.0


func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")


func _physics_process(_delta: float) -> void:
	_frame += 1
	if _cv == null:
		_cv = get_tree().get_first_node_in_group("go_cave")
		_frame = 0
		return
	match _step:
		0: # ① 조각
			if _frame == 1:
				_cv.call("ensure_built")
			if _frame == 4:
				var want: Array = []
				for f in DirAccess.get_files_at("res://assets/world"):
					if f.begins_with("cave_") and f.ends_with(".glb"):
						want.append(f.get_basename())
				var used: Dictionary = _cv.get("used_files")
				var missing := want.filter(func(f: String) -> bool: return not used.has(f))
				_check("kit", want.size() == 16 and missing.is_empty() and used.has("cave_floor_01"), "want=%d missing=%s" % [want.size(), missing])
				## 입구 F 둘레에 다른 F 물건(인물·게시판·솥·채집·상자·이야기 자리)이 없다.
				var g: Vector3 = _cv.call("gate_pos")
				var clash: Array = []
				for n in get_tree().current_scene.find_children("*", "Node3D", true, false):
					for pre in ["Waypoint_", "Villager_", "StoryNpc_", "Chest", "Pot", "Kitchen", "Board", "Gather", "Shard"]:
						if String(n.name).begins_with(pre) and Vector2((n as Node3D).global_position.x - g.x, (n as Node3D).global_position.z - g.z).length() < _cv.GATE_M + 3.75 + 0.5:
							clash.append(String(n.name))
							break
				_check("gate_clear", clash.is_empty(), "clash=%s" % [clash])
				_next()
		1: # ② 이음
			var joints: Array = _cv.get("joints")
			var space := _p.get_world_3d().direct_space_state
			var bad: Array = []
			for i in joints.size():
				var j: Vector3 = joints[i]
				var tol := 1.0 if i == joints.size() - 1 else 0.35
				var r := space.intersect_ray(PhysicsRayQueryParameters3D.create(j + Vector3(0, 2.0, 0), j + Vector3(0, -3.0, 0)))
				if r.is_empty() or absf((r.position as Vector3).y - j.y) > tol:
					bad.append("%d:%s" % [i, "none" if r.is_empty() else "%.2f" % ((r.position as Vector3).y - j.y)])
			_check("joints", joints.size() == 15 and bad.is_empty(), "n=%d bad=%s" % [joints.size(), bad])
			_next()
		2: # ③ 들어감
			if _frame == 1:
				_stand(_cv.call("gate_pos") + Vector3(0, 0, 2.5))
				var sun := get_tree().current_scene.get_node_or_null("Sun") as DirectionalLight3D
				_sun0 = sun.light_energy if sun else 0.0
			if _frame == 3:
				_v = _p.global_position
				var near: bool = _cv.call("near_gate")
				var ok: bool = _cv.call("enter")
				_check("enter", near and ok and bool(_cv.get("inside")), "near=%s ok=%s" % [near, ok])
			if _frame == 95:
				var e: Vector3 = _cv.call("entry_pos")
				var d := _p.global_position - e
				_check("stand_entry", absf(d.y) < 1.0 and Vector2(d.x, d.z).length() < 1.5 and _p.is_on_floor(), "d=%s floor=%s" % [d, _p.is_on_floor()])
				var sun := get_tree().current_scene.get_node_or_null("Sun") as DirectionalLight3D
				_check("dark", sun == null or sun.light_energy < _sun0 * 0.5, "sun %.2f → %.2f" % [_sun0, sun.light_energy if sun else 0.0])
				_next()
		3: # ④ 적 ⑤ 쓰러뜨림
			if _frame == 1:
				var foes: Array = _cv.call("alive_enemies")
				var kinds: Array = foes.map(func(e: Node) -> String: return String(e.get("kind_id")) if e.get("kind_id") != null else "")
				_check("foes", foes.size() == 7, "n=%d %s" % [foes.size(), kinds])
				for e in foes:
					e.call("_die")   # 비경 점검과 같은 길(방패가 있으면 피해로는 한 번에 안 쓰러진다)
			if _frame == 20:
				_check("killed", (_cv.call("alive_enemies") as Array).is_empty(), "left=%d" % (_cv.call("alive_enemies") as Array).size())
				_next()
		4: # ⑥ 보물
			if _frame == 1:
				_stand(_cv.call("chest_pos") + Vector3(1.2, 0.4, 0))
			if _frame == 70:
				var c: Vector3 = _cv.call("chest_pos")
				var mora0 := PartyState.count("mora")
				var near: bool = _cv.call("near_chest")
				var got: bool = _cv.call("claim")
				var again: bool = _cv.call("claim")
				_check("chest", _p.global_position.y > c.y - 2.0 and near and got and not again and PartyState.count("mora") - mora0 >= 2500,   # 경험치가 업적·등급 보상을 끌어오면 더 붙는다
					"y=%.2f chest=%.2f near=%s got=%s again=%s mora+%d" % [_p.global_position.y, c.y, near, got, again, PartyState.count("mora") - mora0])
				_next()
		5: # ⑦ 나감
			if _frame == 1:
				_stand(_cv.call("exit_light_pos"))
			if _frame == 4:
				var near: bool = _cv.call("near_exit")
				_cv.call("leave")   # F 길(_use)은 시작 화면 창(ui_modal)이 떠 있으면 막히므로 곧장
				var root: Node3D = _cv.get_node_or_null("CaveInterior")
				var sun := get_tree().current_scene.get_node_or_null("Sun") as DirectionalLight3D
				var back := _p.global_position.distance_to(_v) < 2.0
				_check("leave", near and back and not bool(_cv.get("inside")) and root != null and not root.visible and (sun == null or is_equal_approx(sun.light_energy, _sun0)),
					"near=%s back=%s sun=%.2f/%.2f" % [near, back, sun.light_energy if sun else 0.0, _sun0])
				_next()
		6: # ⑧ 비경 안
			var dm := get_tree().get_first_node_in_group("go_domains")
			dm.add_to_group("go_domain_active")
			_stand(_cv.call("gate_pos") + Vector3(0, 0, 2.5))
			var blocked := not bool(_cv.call("enter"))
			dm.remove_from_group("go_domain_active")
			_check("domain_block", blocked and not bool(_cv.get("inside")), "blocked=%s" % blocked)
			_next()
		7: # ⑨ 떨어짐
			if _frame == 1:
				_stand(_cv.call("gate_pos") + Vector3(0, 0, 2.5))
				_cv.call("enter")
			if _frame == 5:
				_stand(_cv.call("chest_pos") + Vector3(30, -12, 0))
			if _frame == 12:
				var e: Vector3 = _cv.call("entry_pos")
				_check("fall", _p.global_position.distance_to(e) < 2.0, "d=%.2f" % _p.global_position.distance_to(e))
				_cv.call("leave")
				_next()
		8:
			print("GO_CAVE_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()


func _stand(at: Vector3) -> void:
	_p.global_position = at + Vector3.UP * 0.4
	_p.velocity = Vector3.ZERO


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("GO_CAVE_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])


func _next() -> void:
	_step += 1
	_frame = 0
