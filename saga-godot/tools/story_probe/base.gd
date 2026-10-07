extends Node
## 사가만리 이야기 1부 점검(tools/probe_story.gd)의 공용 — 상수·상태·도우미(R-4 로 나눔).
## 사슬: story_probe/base.gd → story_probe/ch1_5.gd(1~5장, 단계 0~39) → probe_story.gd(6~9장·몸짓, 단계 40~88).

const Story := preload("res://games/saga_go/data/story.gd")
const FieldBosses := preload("res://games/saga_go/world/field_bosses.gd")
const Domains := preload("res://games/saga_go/data/domains.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const Cooking := preload("res://games/saga_go/data/cooking.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Gathering := preload("res://games/saga_go/world/gathering.gd")
const Veg := preload("res://games/saga_go/world/vegetation_builder.gd")
const SkyIsle := preload("res://games/saga_go/world/sky_isle.gd")

var _p: CharacterBody3D
var _sq: Node
var _fb: Node
var _dm: Node
var _frame := 0
var _step := 0
var _fails := 0
var _v: Variant = null
var _saved := {}
var _boss: Node = null # 6장 이야기 보스(㊸~㊹)

## 보이는 선택지 창(승급 3택 등) 수 — 이야기 노드 자신은 뺀다.
func _visible_prompts() -> int:
	return get_tree().get_nodes_in_group("ui_modal").filter(func(n: Node) -> bool: return n != _sq and n.get("visible") != false).size()

## 보이는 선택지 창마다 첫 단추를 한 번 누른다(사람이 고르는 것처럼). 창은 그 프레임 끝에 사라지므로 몇 프레임 뒤에 본다.
var _pressed: Array = []

func _dismiss_prompts() -> void:
	for n in get_tree().get_nodes_in_group("ui_modal"):
		if n == _sq or n.get("visible") == false or _pressed.has(n):
			continue
		_pressed.append(n)
		var btns := (n as Node).find_children("*", "Button", true, false)
		if not btns.is_empty():
			(btns[0] as Button).pressed.emit()

## 대화를 끝까지 넘긴다(고르는 줄은 첫 대답). 고른 줄 수를 돌려준다.
func _drain() -> int:
	var choices := 0
	var guard := 0
	while _sq.call("is_dialogue_open") and guard < 50:
		guard += 1
		if _sq.get("_dlg_waiting_choice"):
			_sq.call("choose", 0)
			choices += 1
		else:
			_sq.call("next_line")
	return choices

## 카메라가 그 사람 얼굴(발 자리 + 1.45m) 쪽을 보는 정도(1 = 정면).
func _looks_at(foot: Vector3) -> float:
	var cam: Camera3D = _p.get_node("CameraRig/SpringArm3D/Camera3D")
	var to: Vector3 = (foot + Vector3.UP * 1.45) - cam.global_position
	return (-cam.global_transform.basis.z).dot(to.normalized())

## 다음 줄로 — 글자가 흘러나오는 중이면 두 번(한 번은 줄 전체 보이기).
func _line_next() -> void:
	if _sq.call("is_revealing"):
		_sq.call("next_line")
	_sq.call("next_line")

## 오른손 뼈에 붙인 빈 노드(손짓 점검 — 뼈대 수정 뒤 자리를 따라간다).
func _hand_probe(body: Node3D) -> Node3D:
	var skel: Skeleton3D = body.find_children("*", "Skeleton3D", true, false)[0]
	var att := BoneAttachment3D.new()
	att.bone_idx = skel.find_bone("J_Bip_R_Hand") if skel.find_bone("J_Bip_R_Hand") >= 0 else skel.find_bone("hand_r")
	skel.add_child(att)
	return att

func _flat(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()

## 5장 새 자리가 신수 조우 원(pet_encounter.gd TRIGGER_RADIUS + 임무 적 퍼짐)과 얼마나 떨어졌나 [여유 m, 어디] — 겹치면 조우 창이 대화를 막는다.
func _pet_clear(spots: Dictionary = {}) -> Array:
	var best := 1e9
	var where := ""
	if spots.is_empty():
		spots = _ch5_spots()
	for n in get_tree().current_scene.get_children():
		var sc: Script = n.get_script()
		if sc == null or not sc.resource_path.ends_with("pet_encounter.gd"):
			continue
		for k in spots:
			var m := _flat((n as Node3D).global_position, spots[k]) - float(n.get("TRIGGER_RADIUS")) - 4.5
			if m < best:
				best = m
				where = "%s~%s" % [k, n.name]
	return [best, where]

## 6장 새 자리 — 봉우리·나그네·학자(봉우리)·제단.
func _ch6_spots() -> Dictionary:
	var spots := {}
	spots["peak"] = TestMap.world_pos(7.1, 1.55, "village")
	spots["wanderer"] = TestMap.world_pos(Story.NPCS.wanderer.appear[2].cell.x, Story.NPCS.wanderer.appear[2].cell.y, "village")
	spots["scholar"] = TestMap.world_pos(Story.STATIONS.scholar[2].cell.x, Story.STATIONS.scholar[2].cell.y, "village")
	var alt: Dictionary = Story.CHAPTERS[5].steps[5]
	spots["altar"] = TestMap.world_pos(alt.cell.x, alt.cell.y, "village")
	return spots

## 7장 곶 자리 — 제단·나그네·싸움터·물결이 나오는 둘레 자리 전부(포구).
func _ch7_spots() -> Dictionary:
	var spots := {}
	var d: Dictionary = Story.CHAPTERS[6].steps[4]
	var c := TestMap.world_pos(d.cell.x, d.cell.y, "coast")
	spots["altar"] = c
	spots["wanderer"] = TestMap.world_pos(Story.NPCS.wanderer.appear[3].cell.x, Story.NPCS.wanderer.appear[3].cell.y, "coast")
	var du: Dictionary = Story.CHAPTERS[6].steps[5]
	spots["duel"] = TestMap.world_pos(du.cell.x, du.cell.y, "coast")
	for w in (d.waves as Array).size():
		var n: int = (d.waves[w] as Array).size()
		for i in n:
			var a := TAU * float(i) / float(n) + 0.9 * w
			spots["wave%d_%d" % [w, i]] = c + Vector3(cos(a), 0.0, sin(a)) * Story.DEFEND_RING
	return spots

## 8장 바위섬 자리 — 제단·나그네·해솔·배 댄 자리·석등 셋·순간이동 신상.
func _ch8_spots() -> Dictionary:
	var spots := {}
	var c := TestMap.world_pos(6.0, 2.0, "coast")
	spots["altar"] = c
	spots["wanderer"] = TestMap.world_pos(Story.NPCS.wanderer.appear[4].cell.x, Story.NPCS.wanderer.appear[4].cell.y, "coast")
	spots["haesol"] = TestMap.world_pos(Story.NPCS.haesol.cell.x, Story.NPCS.haesol.cell.y, "coast")
	spots["landing"] = TestMap.world_pos(Story.STATIONS.ferryman[0].cell.x, Story.STATIONS.ferryman[0].cell.y, "coast")
	spots["statue"] = TestMap.world_pos(5.95, 2.27, "coast")
	for i in Story.SEAL_LAYOUT.size():
		var a := TAU * float(i) / float(Story.SEAL_LAYOUT.size())
		spots["lamp_" + String(Story.SEAL_LAYOUT[i])] = c + Vector3(sin(a), 0.0, -cos(a)) * Story.SEAL_RING
	return spots

## 8장 도둑 길 점(포구 사건 반경에 걸리면 쫓는 도중 선택 창이 뜬다).
func _ch8_path_spots() -> Dictionary:
	var spots := {}
	var c: Dictionary = Story.CHAPTERS[7].steps[2]
	for i in (c.path as Array).size():
		spots["path%d" % i] = TestMap.world_pos(c.path[i].x, c.path[i].y, "coast")
	return spots

## 포구 사건(region2_coast.gd — 어부 부탁·표류물·조각배, 반경 안에 들면 선택 창이 떠 대화를 막는다)과의 여유 [m, 어디].
func _coast_event_clear(spots: Dictionary) -> Array:
	const Coast := preload("res://games/saga_go/world/region2_coast.gd")
	var evs := {"fisher": [Coast.FISHER_GRID, Coast.FISHER_TALK_RADIUS], "driftwood": [Coast.DRIFTWOOD_GRID, Coast.DRIFTWOOD_TRIGGER_RADIUS],
		"boat": [Coast.BOAT_GRID, Coast.BOAT_TRIGGER_RADIUS]}
	var best := 1e9
	var where := ""
	for e in evs:
		var g: Vector2i = evs[e][0]
		var ep := TestMap.world_pos(g.x, g.y, "coast")
		for k in spots:
			var m := _flat(ep, spots[k]) - float(evs[e][1])
			if m < best:
				best = m
				where = "%s~%s" % [k, e]
	return [best, where]

## 산 바위(vegetation_builder _scatter_rocks 와 같은 해시)에서 가장 가까운 거리 [m, 어디] — 바위가 제단·인물을 덮지 않게.
func _rock_clear(spots: Dictionary) -> Array:
	var best := 1e9
	var where := ""
	var rows := TestMap.rows_of("village")
	for y in rows.size():
		for x in String(rows[y]).length():
			if String(rows[y])[x] != "^":
				continue
			for i in Veg.ROCKS_PER_MOUNTAIN_TILE:
				var jx := (Veg._hash(x, y, i * 3 + 500) - 0.5) * TestMap.TILE_SIZE * 0.6
				var jz := (Veg._hash(x, y, i * 3 + 501) - 0.5) * TestMap.TILE_SIZE * 0.6
				var rp := TestMap.world_pos(x, y, "village") + Vector3(jx, 0.0, jz)
				for k in spots:
					var d := _flat(rp, spots[k])
					if d < best:
						best = d
						where = k
	return [best, where]

func _ch5_spots() -> Dictionary:
	var spots := {}
	spots["road"] = TestMap.world_pos(Story.STATIONS.scholar[0].cell.x, Story.STATIONS.scholar[0].cell.y, "village")
	spots["altar_side"] = TestMap.world_pos(Story.STATIONS.scholar[1].cell.x, Story.STATIONS.scholar[1].cell.y, "village")
	spots["wanderer"] = TestMap.world_pos(Story.NPCS.wanderer.appear[1].cell.x, Story.NPCS.wanderer.appear[1].cell.y, "village")
	var seal: Dictionary = Story.CHAPTERS[4].steps[4]
	spots["altar"] = TestMap.world_pos(seal.cell.x, seal.cell.y, "village")
	return spots

## 5장 새 자리(학자 두 자리·나그네·제단·석등 셋)에서 가장 가까운 나무 줄기까지 [거리, 어디] — vegetation_builder 와 같은 해시.
func _trunk_clear() -> Array:
	var spots := _ch5_spots()
	var c: Vector3 = spots["altar"]
	for i in Story.SEAL_LAYOUT.size():
		var a := TAU * float(i) / float(Story.SEAL_LAYOUT.size())
		spots["lamp_" + String(Story.SEAL_LAYOUT[i])] = c + Vector3(sin(a), 0.0, -cos(a)) * Story.SEAL_RING
	var best := 1e9
	var where := ""
	var rows := TestMap.rows_of("village")
	for y in rows.size():
		for x in String(rows[y]).length():
			if String(rows[y])[x] != "T":
				continue
			for i in Veg.TREES_PER_FOREST_TILE:
				var jx := (Veg._hash(x, y, i * 2) - 0.5) * TestMap.TILE_SIZE * 0.8
				var jz := (Veg._hash(x, y, i * 2 + 1) - 0.5) * TestMap.TILE_SIZE * 0.8
				var tp := TestMap.world_pos(x, y, "village") + Vector3(jx, 0.0, jz)
				for k in spots:
					var d := _flat(tp, spots[k])
					if d < best:
						best = d
						where = k
	return [best, where]

func _near_npc(id: String) -> void:
	_dismiss_prompts()
	_put(_sq.call("npc_pos", id) + Vector3(0.0, 0.3, 1.5))

func _put(pos: Vector3) -> void:
	_p.global_position = pos + Vector3(0.0, 0.3, 0.0)
	_p.velocity = Vector3.ZERO

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("STORY_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
