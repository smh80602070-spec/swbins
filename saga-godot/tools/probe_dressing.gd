extends SceneTree

## G-0038 휑한 지역 셋 꾸밈(games/saga_go/world/region_dressing.gd — 굳은 거리·갈무리 벌·세갈래 고을) 자동 점검. 화면 없이 놓인 자리만 다시 잰다. 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_dressing.gd
## 지역마다: ① 표 자리 모으기 — 상자·NPC·순간이동·명소가 들어 있음 ② 놓인 수 하한·표의 종류가 다 놓임·GLB 다 열림
## ③ 모든 인스턴스가 규칙 통과(산·길 칸 밖·큰 것은 네 모서리도·표 자리 둘레 밖·서로 안 겹침) ④ 땅 높이(작은 것 = 땅, 큰 것 = 네 모서리 중 낮은 쪽 아래로 조금)
## ⑤ 충돌 상자 수 = 큰 것 수 · MultiMesh 는 종류당 하나·보이는 거리 220m ⑥ 두 번 지어도 같은 자리 ⑦ 세 지역 스크립트가 붙임.
## 끝에 "PROBE dressing OK" 또는 "PROBE dressing FAIL n".

const Dress := preload("res://games/saga_go/world/region_dressing.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const SCRIPTS := {"amber": "res://games/saga_go/world/region8_amber.gd", "vault": "res://games/saga_go/world/region9_vault.gd", "fork": "res://games/saga_go/world/region10_fork.gd"}
const MIN_COUNT := {"amber": 200, "vault": 200, "fork": 180}
## 꼭 비어 있어야 할 자리(칸) — 상자·NPC·순간이동 하나씩
const MUST_KEEP := {"amber": [Vector2(5.4, 6.2), Vector2(6.25, 5.3), Vector2(2.5, 5.2)], "vault": [Vector2(7.0, 5.3), Vector2(6.2, 5.2), Vector2(2.6, 4.2)],
	"fork": [Vector2(6.9, 5.4), Vector2(4.0, 5.95), Vector2(2.8, 4.2)]}

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _make(region: String) -> Node3D:
	var d := Node3D.new()
	d.set_script(Dress)
	d.set("region_id", region)
	d.set("keep_cells", Dress.collect_keep_cells(region, load(String(SCRIPTS[region]))))
	root.add_child(d)
	return d


func _initialize() -> void:
	await process_frame
	seed(20260824)
	for region: String in SCRIPTS:
		var d := _make(region)
		await process_frame
		var keep: Array = d.get("keep_cells")
		var has_all := true
		for c in MUST_KEEP[region]:
			if not keep.has(c):
				has_all = false
		check(keep.size() >= 20 and has_all, "%s: 표 자리 %d개 — 상자·NPC·순간이동 들어 있음" % [region, keep.size()])
		var recs: Array = d.get("records")
		var kinds := {}
		var solid_n := 0
		for r: Dictionary in recs:
			kinds[r.kind] = int(kinds.get(r.kind, 0)) + 1
			if r.solid:
				solid_n += 1
		var plan_kinds := {}
		var all_open := true
		for e: Array in Dress.PLAN[region]:
			plan_kinds[String(e[1])] = true
			if Dress.mesh_of(String(e[1])) == null:
				all_open = false
		var missing := []
		for k in plan_kinds:
			if not kinds.has(k):
				missing.append(k)
		print("  .. %s %s" % [region, kinds])
		check(recs.size() >= int(MIN_COUNT[region]) and missing.is_empty() and all_open, "%s: %d개 놓임(하한 %d) · 표의 %d종 다 놓임%s · GLB 다 열림" % [region, recs.size(), MIN_COUNT[region], plan_kinds.size(), "" if missing.is_empty() else " — 빠짐 %s" % [missing]])
		var keep_world: Array = d.call("keep_world_points")
		var bad := []
		var bad_y := []
		for i in recs.size():
			var r: Dictionary = recs[i]
			var others := recs.duplicate()
			others.remove_at(i)
			var why: String = d.call("violation", r.kind, r.pos, r.yaw, keep_world, others)
			if why != "":
				bad.append("%s@%s %s" % [r.kind, r.pos, why])
			var h := TerrainBuilder.height_at(region, r.pos)
			var y := float((r.pos as Vector3).y)
			if (not r.solid and absf(y - h) > 0.01) or (r.solid and (y > h + 0.01 or y < h - 3.0)):
				bad_y.append("%s y=%.2f 땅=%.2f" % [r.kind, y, h])
		check(bad.is_empty(), "%s: 모두 규칙 통과(산·길 칸 밖·표 자리 둘레 밖·안 겹침)%s" % [region, "" if bad.is_empty() else " — %s" % [bad.slice(0, 4)]])
		check(bad_y.is_empty(), "%s: 땅 높이에 앉음%s" % [region, "" if bad_y.is_empty() else " — %s" % [bad_y.slice(0, 4)]])
		var mmis := 0
		var vis_ok := true
		for ch in d.get_children():
			if ch is MultiMeshInstance3D:
				mmis += 1
				vis_ok = vis_ok and (ch as MultiMeshInstance3D).visibility_range_end == 220.0
		check(int(d.get("shapes")) == solid_n and mmis == kinds.size() and vis_ok, "%s: 충돌 상자 %d = 큰 것 %d · MultiMesh %d = 종류 %d · 보이는 거리 220m" % [region, d.get("shapes"), solid_n, mmis, kinds.size()])
		var again := _make(region)
		await process_frame
		var same: bool = (again.get("records") as Array).size() == recs.size()
		if same:
			for i in recs.size():
				if (again.get("records")[i].pos as Vector3).distance_to(recs[i].pos) > 0.001:
					same = false
					break
		check(same, "%s: 두 번 지어도 같은 자리" % region)
		again.free()
		d.free()
	for region: String in SCRIPTS:
		check(FileAccess.get_file_as_string(String(SCRIPTS[region])).contains("region_dressing.gd"), "%s 지역 스크립트가 꾸밈을 붙임" % region)
	print("PROBE dressing ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
