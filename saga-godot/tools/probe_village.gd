extends Node
## GO 마을 꾸미기(world/village_dressing.gd) 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_VILLAGE_PROBE 가 있을 때만 단다.
##   SAGA_VILLAGE_PROBE=1 "$GODOT_CONSOLE" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
## ① 마을 집 칸 둘레의 상호작용 자리(Area3D·인물 몸·이야기 인물 칸·이야기/세계 임무 단계 칸)를 모아
## ② 새 집·울타리·소품(VillageDressing 아래 충돌) 어느 것도 그 자리 반경 CLEAR_M 안에 없는지 본다.
## ③ 집 칸 한가운데 광장에서 마을 밖 네 방향 길로 걸어 나갈 수 있는지(직선 광선이 새 충돌에 안 막히는지).
## 저장은 안 한다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Story := preload("res://games/saga_go/data/story.gd")
const WorldQuests := preload("res://games/saga_go/data/world_quests.gd")

const CLEAR_M := 3.5
## 마을 집 칸 둘레(칸 좌표) — 이 안의 자리만 본다.
const AREA := Rect2(2.6, 3.6, 5.0, 3.8)

var _frame := 0
var _fails := 0


func _process(_delta: float) -> void:
	_frame += 1
	if _frame != 30:
		return
	var spots := _spots()
	print("VILLAGE_PROBE spots=%d" % spots.size())
	for s in spots:
		print("VILLAGE_PROBE spot %s %s" % [s[0], _fmt(s[1])])
	var dress := get_tree().current_scene.get_node_or_null("VillageDressing")
	_check("built", dress != null and dress.get_child_count() > 0, "children=%d" % (dress.get_child_count() if dress else -1))
	var boxes: Array = []
	if dress:
		for n in dress.find_children("*", "CollisionShape3D", true, false):
			var cs := n as CollisionShape3D
			if cs.shape is BoxShape3D:
				boxes.append([cs.global_transform, (cs.shape as BoxShape3D).size, cs.get_parent().get_parent().name])
	var bad: Array = []
	for s in spots:
		for b in boxes:
			var local: Vector3 = (b[0] as Transform3D).affine_inverse() * (s[1] as Vector3)
			var half: Vector3 = (b[1] as Vector3) * 0.5 + Vector3(CLEAR_M, 0, CLEAR_M)
			if absf(local.x) < half.x and absf(local.z) < half.z:
				bad.append("%s@%s in %s" % [s[0], _fmt(s[1]), b[2]])
	_check("spots_clear", bad.is_empty(), "boxes=%d %s" % [boxes.size(), str(bad.slice(0, 8))])
	## 남북 길(x = 0) 은 곧게 뚫려 있어야 하고, 광장에서 서·동으로는 빠져나갈 틈(z −20~20, 2m 간격)이 하나라도 있어야 한다.
	var space := (get_tree().current_scene as Node3D).get_world_3d().direct_space_state
	var blocked: Array = []
	for pair in [[Vector3(0, 1, -60), Vector3(0, 1, 60), "road_ns"]]:
		var hit: Dictionary = space.intersect_ray(PhysicsRayQueryParameters3D.create(pair[0], pair[1], 1))
		if not hit.is_empty() and dress and dress.is_ancestor_of(hit.collider):
			blocked.append("%s by %s" % [pair[2], (hit.collider as Node).get_parent().name])
	for end_x in [-110.0, 60.0]:
		var lane := false
		for z in range(-20, 21, 2):
			var hit: Dictionary = space.intersect_ray(PhysicsRayQueryParameters3D.create(Vector3(-24, 1, z), Vector3(end_x, 1, z), 1))
			if hit.is_empty() or not (dress and dress.is_ancestor_of(hit.collider)):
				lane = true
				break
		if not lane:
			blocked.append("no lane to x=%d" % end_x)
	_check("roads_open", blocked.is_empty(), str(blocked))
	print("VILLAGE_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()


## [이름, 자리] — 장면의 Area3D·인물 몸 + 이야기 인물 칸 + 이야기·세계 임무 단계 칸(마을, AREA 안).
func _spots() -> Array:
	var out: Array = []
	var root := get_tree().current_scene
	var dress := root.get_node_or_null("VillageDressing")
	for n in root.find_children("*", "Area3D", true, false) + root.find_children("*", "CharacterBody3D", true, false):
		var p := (n as Node3D).global_position
		if dress and dress.is_ancestor_of(n):
			continue
		if _in_area(p):
			out.append([String(n.name), p])
	for id in Story.NPCS:
		var d: Dictionary = Story.NPCS[id]
		if String(d.get("region", "")) == "village" and d.has("cell") and AREA.has_point(d.cell):
			out.append(["npc:" + id, _cell(d.cell)])
	for ch in Story.CHAPTERS:
		for s in ch.get("steps", []):
			_add_step(out, "story:" + String(ch.id), s)
		for key in ["appear", "stations"]:
			for a in ch.get(key, []):
				if a is Dictionary:
					_add_step(out, "%s:%s" % [key, ch.id], a)
	for q in WorldQuests.ORDER:
		for s in WorldQuests.QUESTS[q].get("steps", []):
			_add_step(out, "wq:" + q, s)
	return out


func _add_step(out: Array, tag: String, s: Dictionary) -> void:
	if String(s.get("region", "")) == "village" and s.has("cell") and AREA.has_point(s.cell):
		out.append([tag, _cell(s.cell)])


func _in_area(p: Vector3) -> bool:
	if TestMap.region_at(p) != "village":
		return false
	var g := (p - TestMap.origin_of("village")) / TestMap.tile_size_of("village")
	var c := Vector2(g.x + TestMap.size("village").x * 0.5, g.z + TestMap.size("village").y * 0.5)
	return AREA.has_point(c)


func _cell(c: Vector2) -> Vector3:
	var p := TestMap.world_pos(c.x, c.y, "village")
	p.y = TerrainBuilder.height_at("village", p)
	return p


func _fmt(v: Vector3) -> String:
	return "(%.0f,%.0f)" % [v.x, v.z]


func _check(name: String, ok: bool, info: String) -> void:
	if not ok:
		_fails += 1
	print("VILLAGE_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", info])
