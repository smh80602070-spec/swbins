extends SceneTree

## G-0406 2나락 성소 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_shrine.gd   → "PROBE dungeon_shrine OK" / "FAIL n"
## ① kind_for: 같은 씨앗 두 성소 종류 다름 · 넷 다 돈다
## ② TestRoom: 상자·우물 방(1·3)에 Shrine 둘 · 둘 다 아직 안 씀
## ③ 주인공을 성소 곁에 세우면 저절로 씀 → 그 효과 배율이 오른다(분노 atk_mult · 방벽 guard_mult 내림 · 질풍 atk_speed_mult · 재물 gold_mult) · 두 번 안 씀
## 저장은 안 한다(성소는 세이브 밖, 시간제 효과도 메모리만).

const SHRINE := "res://games/saga_dungeon/world/dungeon_shrine.gd"   # 자동 로드(DungeonRunState)를 쓰므로 load() 로
const ROOM := "res://games/saga_dungeon/world/TestRoom.tscn"

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _mult(rs: Node, eff: String) -> float:
	match eff:
		"atkPct": return float(rs.call("atk_mult"))
		"guardPct": return 2.0 - float(rs.call("guard_mult"))   # 받는 피해 배율은 내려가므로 뒤집어 "오름"으로
		"atkSpdPct": return float(rs.call("atk_speed_mult"))
		"goldPct": return float(rs.call("gold_mult"))
	return 0.0


func _init() -> void:
	await process_frame
	var S: GDScript = load(SHRINE)
	var seen := {}
	for sd in 8:
		var a: Dictionary = S.kind_for(sd, 0)
		var b: Dictionary = S.kind_for(sd, 1)
		seen[a.key] = true
		if a.key == b.key:
			_fail("① 씨앗 %d 두 성소 같음 %s" % [sd, a.key])
	if seen.size() != S.KINDS.size():
		_fail("① 종류 %d/%d" % [seen.size(), S.KINDS.size()])

	var sc := (load(ROOM) as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 60:
		await physics_frame
	var shrines: Array = []
	for i in S.SHRINE_ROOMS:
		var s := sc.find_child("Shrine%d" % i, true, false)
		if s == null or bool(s.get("used")):
			_fail("② Shrine%d %s" % [i, "없음" if s == null else "이미 씀"])
		else:
			shrines.append(s)
	var rs := root.get_node("DungeonRunState")
	var p := get_first_node_in_group("player") as Node3D
	for s: Node3D in shrines:
		var k: Dictionary = s.get("kind")
		var before := _mult(rs, String(k.eff))
		p.global_position = s.global_position + Vector3(0.6, 0.5, 0.0)
		for _i in 4:
			await physics_frame
		var after := _mult(rs, String(k.eff))
		print("SHRINE %s %s used=%s %.2f → %.2f" % [s.name, k.key, s.get("used"), before, after])
		if not bool(s.get("used")) or after <= before + 0.05:
			_fail("③ %s %s 안 듦 %.2f → %.2f" % [s.name, k.key, before, after])
		s.call("use")
		if absf(_mult(rs, String(k.eff)) - after) > 0.001:
			_fail("③ %s 두 번 씀" % s.name)
	sc.queue_free()
	for _k in 3:
		await process_frame
	print("PROBE dungeon_shrine ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
