extends SceneTree

## GO 지역 레지스트리(data/test_map.gd REGIONS — 마을·포구·폐허·고원·… 글자 지도와 좌표 변환) 자동 점검 — 화면 없는 순수 규칙.
##   godot --headless --path saga-godot --script res://tools/probe_regions.gd
## ① 표: 지역 열이 EXPECTED 와 같고 각 지도가 직사각형·칸 크기 양수·모든 글자가 terrain_builder LEGEND 에 있음
## ② 좌표 왕복: 모든 칸에서 world_pos → grid_at 이 제 칸으로 · region_at 이 제 지역으로(지역끼리 칸 겹침 0) · 먼 곳은 ""
## ③ 경계: 지도 밖 칸은 산(^) · 지역 사각형끼리 겹치지 않음. 끝에 "PROBE regions OK" 또는 "PROBE regions FAIL n".

const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")

## 지금 있는 지역 열 — 새 지역을 붙이면 여기도 늘린다(그래야 "붙였는데 점검에서 빠진" 일이 없다).
const EXPECTED := ["village", "coast", "ruins", "frost", "skyport", "crossing", "sunken", "amber", "vault", "fork"]

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	# ① 표
	var keys: Array = TestMap.REGIONS.keys()
	var a := keys.duplicate()
	var b := EXPECTED.duplicate()
	a.sort()
	b.sort()
	check(a == b, "지역 %d개 = 기대 열 (%s)" % [keys.size(), ", ".join(PackedStringArray(keys))])
	var shape_ok := true
	var legend_bad := ""
	for id in keys:
		var rows: Array = TestMap.rows_of(id)
		var w := String(rows[0]).length()
		shape_ok = shape_ok and rows.size() > 0 and w > 0 and TestMap.tile_size_of(id) > 0.0
		for r in rows:
			shape_ok = shape_ok and String(r).length() == w
			for ch in String(r):
				if not TerrainBuilder.LEGEND.has(ch):
					legend_bad += "%s:%s " % [id, ch]
	check(shape_ok, "모든 지도가 직사각형·칸 크기 양수")
	check(legend_bad == "", "모든 글자가 LEGEND 에 있다 " + legend_bad)

	# ② 좌표 왕복·겹침
	var round_bad := 0
	var region_bad := 0
	var cells := 0
	for id in keys:
		var s: Vector2i = TestMap.size(id)
		for y in s.y:
			for x in s.x:
				cells += 1
				var wp: Vector3 = TestMap.world_pos(x, y, id)
				if TestMap.grid_at(id, wp) != Vector2i(x, y):
					round_bad += 1
				if TestMap.region_at(wp) != id:
					region_bad += 1
	check(round_bad == 0, "world_pos → grid_at 왕복 (%d칸)" % cells)
	check(region_bad == 0, "region_at 이 제 지역을 돌려줌 — 지역끼리 칸 겹침 0")
	check(TestMap.region_at(Vector3(99999.0, 0.0, 99999.0)) == "", "먼 곳은 지역 없음")

	# ③ 경계
	var edge_ok := true
	for id in keys:
		var s: Vector2i = TestMap.size(id)
		edge_ok = edge_ok and TestMap.tile_at(-1, 0, id) == "^" and TestMap.tile_at(0, -1, id) == "^" and TestMap.tile_at(s.x, 0, id) == "^" and TestMap.tile_at(0, s.y, id) == "^"
	check(edge_ok, "지도 밖 칸은 산(^)")
	var overlap := 0
	for i in keys.size():
		for j in range(i + 1, keys.size()):
			var ra := _rect(keys[i])
			var rb := _rect(keys[j])
			var inter := ra.intersection(rb)
			if inter.size.x > 0.01 and inter.size.y > 0.01:
				overlap += 1
	check(overlap == 0, "지역 사각형끼리 겹침 %d쌍" % overlap)

	print("PROBE regions ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)


func _rect(id: String) -> Rect2:
	var s: Vector2i = TestMap.size(id)
	var ts: float = TestMap.tile_size_of(id)
	var o: Vector3 = TestMap.origin_of(id)
	var w := s.x * ts
	var h := s.y * ts
	return Rect2(o.x - w * 0.5, o.z - h * 0.5, w, h)
