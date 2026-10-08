extends Node
## G-0061 사가만리 집 안(world/house_interiors.gd) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_GO_HOUSE_PROBE 가 있을 때만 단다.
##
##   SAGA_GO_HOUSE_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 문 — 마을집 둘·역참·사당·폐허·조선소 창고 + 선 꾸밈 집 수만큼 ② 껍데기 int_* 12 를 다 지음·집마다 천장 쪽 표면을 뺌
## ③ 집마다 들어온 자리 바닥(광선)·앞 보이지 않는 벽 ④ 기와집 문 곁 → 들어감 → 1.5초 뒤 바닥 위·첫 집 모라 +300(두 번째는 없음)
## ⑤ 한숨 돌리기 한 번만 ⑥ 빛 원판에서 나감 → 문 앞·해 되돌림 ⑦ 비경·굴 안이면 안 열림. 저장은 안 한다.

var _p: CharacterBody3D
var _hi: Node
var _frame := 0
var _step := 0
var _fails := 0
var _sun0 := 0.0
var _mora0 := 0


func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")


func _sun() -> DirectionalLight3D:
	return get_tree().current_scene.get_node_or_null("Sun") as DirectionalLight3D


func _physics_process(_delta: float) -> void:
	_frame += 1
	if _hi == null:
		_hi = get_tree().get_first_node_in_group("go_house_interiors")
		_frame = 0
		return
	match _step:
		0: # ① 문(꾸밈 집은 call_deferred 로 서니 조금 기다렸다가)
			if _frame == 90:
				_hi.call("scan_doors")
				var ids: Array = _hi.call("door_ids")
				var vh := 0
				for i in 6:   # 6번 꾸밈 집은 늘 막혀 문을 뺐다
					if get_tree().current_scene.find_child("VHouse_%d" % i, true, false) != null:
						vh += 1
				var must := ["house_4", "house_5", "waystation", "shrine", "ruins", "shipyard_shed"].filter(func(x: String) -> bool: return not ids.has(x))
				_check("doors", ids.size() == 6 + vh and must.is_empty(), "n=%d vhouse=%d missing=%s" % [ids.size(), vh, must])
				## 문 곁(F 거리 + 0.5m)에 다른 F 물건(인물·게시판·솥·채집·상자·이야기 자리 — village_dressing 의 비워 둘 자리와 같은 이름)이 없다.
				var spots: Array = []
				for n in get_tree().current_scene.find_children("*", "Node3D", true, false):
					for pre in ["Waypoint_", "Villager_", "StoryNpc_", "Chest", "Pot", "Kitchen", "Board", "Gather", "Shard"]:
						if String(n.name).begins_with(pre):
							spots.append([String(n.name), (n as Node3D).global_position])
							break
				var clash: Array = []
				for id in ids:
					var dp: Vector3 = _hi.call("door_pos", id)
					for sp in spots:
						if Vector2((sp[1] as Vector3).x - dp.x, (sp[1] as Vector3).z - dp.z).length() < 3.3:
							clash.append("%s~%s" % [id, sp[0]])
				_check("door_clear", clash.is_empty(), "clash=%s" % [clash])
				_next()
		1: # ② 껍데기
			if _frame == 1:
				_hi.call("build_all")
			if _frame == 3:
				var want: Array = []
				for f in DirAccess.get_files_at("res://assets/world"):
					if f.begins_with("int_") and f.ends_with(".glb"):
						want.append(f.get_basename())
				var used: Dictionary = _hi.get("used_files")
				var missing := want.filter(func(f: String) -> bool: return not used.has(f))
				var no_cut: Array = []
				for d: Dictionary in _hi.get("DOORS"):
					var room: Dictionary = _hi.call("room_info", String(d.id))
					var mi := (room.root as Node3D).get_node_or_null(String(d.shell)) as MeshInstance3D
					var src: Mesh = load("res://saga_core/world/glb_utils.gd").extract_mesh("res://assets/world/%s.glb" % d.shell)
					if mi == null or mi.mesh.get_surface_count() >= src.get_surface_count():
						no_cut.append(String(d.id))
				_check("shells", want.size() == 12 and missing.is_empty() and no_cut.is_empty(), "want=%d missing=%s no_ceiling_cut=%s" % [want.size(), missing, no_cut])
				_next()
		2: # ③ 바닥·앞 벽
			var space := _p.get_world_3d().direct_space_state
			var bad: Array = []
			for d: Dictionary in _hi.get("DOORS"):
				var room: Dictionary = _hi.call("room_info", String(d.id))
				var e: Vector3 = room.entry
				var r := space.intersect_ray(PhysicsRayQueryParameters3D.create(e + Vector3(0, 1.0, 0), e + Vector3(0, -2.0, 0)))
				var w := space.intersect_ray(PhysicsRayQueryParameters3D.create(e + Vector3(0, 1.0, 0), e + Vector3(0, 1.0, 4.0)))
				if r.is_empty() or absf((r.position as Vector3).y - e.y) > 0.3 or w.is_empty():
					bad.append("%s floor=%s wall=%s" % [d.id, "none" if r.is_empty() else "%.2f" % ((r.position as Vector3).y - e.y), not w.is_empty()])
			_check("floors", bad.is_empty(), "bad=%s" % [bad])
			_next()
		3: # ④ 들어감
			if _frame == 1:
				_stand(_hi.call("door_pos", "house_4"))
				_sun0 = _sun().light_energy if _sun() else 0.0
				_mora0 = PartyState.count("mora")
			if _frame == 3:
				var near: String = _hi.call("near_door")
				var ok: bool = _hi.call("enter", "house_4")
				_check("enter", near == "house_4" and ok and String(_hi.get("inside")) == "house_4" and PartyState.count("mora") - _mora0 == 300,
					"near=%s ok=%s mora+%d" % [near, ok, PartyState.count("mora") - _mora0])
			if _frame == 95:
				var e: Vector3 = (_hi.call("room_info", "house_4") as Dictionary).entry
				var d := _p.global_position - e
				_check("stand", absf(d.y) < 0.6 and Vector2(d.x, d.z).length() < 1.2 and _p.is_on_floor() and (_sun() == null or _sun().light_energy < _sun0),
					"d=%s floor=%s" % [d, _p.is_on_floor()])
				_next()
		4: # ⑤ 쉬기
			if _frame == 1:
				_stand((_hi.call("room_info", "house_4") as Dictionary).rest)
			if _frame == 4:
				var near: bool = _hi.call("near_rest")
				var a: bool = _hi.call("rest")
				var b: bool = _hi.call("rest")
				_check("rest", near and a and not b, "near=%s first=%s second=%s" % [near, a, b])
				_next()
		5: # ⑥ 나감
			if _frame == 1:
				_stand((_hi.call("room_info", "house_4") as Dictionary).exit)
			if _frame == 4:
				var near: bool = _hi.call("near_exit")
				_hi.call("leave")   # F 길(_use)은 시작 화면 창(ui_modal)이 떠 있으면 막히므로 곧장
				var back := _p.global_position.distance_to(_hi.call("door_pos", "house_4")) < 2.0
				var root: Node3D = (_hi.call("room_info", "house_4") as Dictionary).root
				_check("leave", near and back and String(_hi.get("inside")) == "" and not root.visible and (_sun() == null or is_equal_approx(_sun().light_energy, _sun0)),
					"near=%s back=%s" % [near, back])
				## 두 번째 들어감엔 선물이 없다.
				var m := PartyState.count("mora")
				_hi.call("enter", "house_4")
				_check("gift_once", PartyState.count("mora") == m, "mora+%d" % (PartyState.count("mora") - m))
				_hi.call("leave")
				_next()
		6: # ⑦ 막힘
			var dm := get_tree().get_first_node_in_group("go_domains")
			dm.add_to_group("go_domain_active")
			var blocked := not bool(_hi.call("enter", "waystation"))
			dm.remove_from_group("go_domain_active")
			_check("domain_block", blocked and String(_hi.get("inside")) == "", "blocked=%s" % blocked)
			_next()
		7:
			print("GO_HOUSE_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()


func _stand(at: Vector3) -> void:
	_p.global_position = at + Vector3.UP * 0.4
	_p.velocity = Vector3.ZERO


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("GO_HOUSE_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])


func _next() -> void:
	_step += 1
	_frame = 0
