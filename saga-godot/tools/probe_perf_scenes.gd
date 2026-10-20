extends SceneTree

## G-0257 최적화 측정 다섯 판 — probe_perf(1만리 TestVillage 뼈대 전용)를 다섯 대표 씬 + 5천하 지도(REALM_MAP)로 넓힌 표.
##   헤드리스(셈 칸만): godot --headless --path saga-godot --script res://tools/probe_perf_scenes.gd
##   창 모드(그리기 숫자): godot --path saga-godot --rendering-method mobile --position -4000,0 --resolution 1280x720 --script res://tools/probe_perf_scenes.gd
## 씬마다 SETTLE 프레임 뒤 한 번: 노드·mesh/multimesh·인스턴스·삼각형(get_faces 씬당 한 번, 재질 next_pass 면 ×2)·빛·그림자·해 그림자 거리·입자(emitting)·카메라 far.
## 이어서 MEASURE 프레임 동안 RenderingServer draw/objects/primitives(평균·최대)·frame_ms(프레임 간격 가운데값 — TIME_PROCESS 는 1초 최댓값이라 안 씀) — 헤드리스(더미 렌더러)면 0 이라 n/a, 예산에 안 센다.
## 예산을 넘으면 "PERF5 over <판> <칸>=값/예산" — FAIL 아님(판정은 다음 티켓). FAIL = 씬 못 실음·결과 줄 없음.
## 끝줄 "PROBE perf_scenes OK|FAIL n" + tools/_out/perf_scenes.md 표(덮어씀). 씬·env·세이브는 안 바꾼다(측정만).

const Gfx := preload("res://saga_core/data/graphics_settings.gd")
const SETTLE := 20
const MEASURE := 10
const SCENES := [
	["GO", "res://games/saga_go/world/TestVillage.tscn"],   # check_refs:allow — gfx_baseline 과 같은 다섯 씬
	["DUNGEON", "res://games/saga_dungeon/world/TestRoom.tscn"],   # check_refs:allow
	["FOREST", "res://games/saga_forest/world/TestVillageForest.tscn"],   # check_refs:allow
	["STORY", "res://games/saga_story/world/SinyaField.tscn"],   # check_refs:allow
	["REALM", "res://games/saga_realm/world/TestCity.tscn"],   # check_refs:allow — 이어서 같은 씬에서 viewing_map 토글로 REALM_MAP
]
## 판별 예산 — 출발은 여섯 행 모두 1만리 값(probe_perf BUDGET_DRAW_AVG 260·TRI_AVG 350000·TRI_MAX 500000),
## 그림자 빛 ≤8(2나락 횃불 7, G-0249)·입자 ≤12. 판마다 따로 고칠 수 있게 dict 로 둔다.
const BASE_BUDGET := {"draw_avg": 260, "tris_avg": 350000, "tris_max": 500000, "shadow_lights": 8, "particles": 12}
const BUDGET := {
	"GO": BASE_BUDGET, "DUNGEON": BASE_BUDGET, "FOREST": BASE_BUDGET,
	"STORY": BASE_BUDGET, "REALM": BASE_BUDGET, "REALM_MAP": BASE_BUDGET,
}
const COLS := ["nodes", "mesh_nodes", "mm_nodes", "mm_instances", "tris", "lights", "shadow_lights", "sun_shadow_m", "particles", "cam_far", "draw_avg", "draw_max", "objects_avg", "prims_avg", "prims_max", "frame_ms"]

var fails := 0
var _rows: Array = []   # [label, dict]
var _overs: Array[String] = []
var _headless := false


## 씬당 한 번 — 매 틱 셈 금지(get_faces 는 여기서만, 같은 메시는 한 번만 센다).
func _count(scene: Node) -> Dictionary:
	var d := {}
	d["nodes"] = int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT))
	var mesh_nodes := 0
	var mm_nodes := 0
	var mm_inst := 0
	var tris := 0
	var face_cache := {}
	for g in scene.find_children("*", "GeometryInstance3D", true, false):
		var gi := g as GeometryInstance3D
		if not gi.is_visible_in_tree():
			continue
		var mesh: Mesh = null
		var count := 1
		if gi is MeshInstance3D:
			mesh = (gi as MeshInstance3D).mesh
			if mesh:
				mesh_nodes += 1
		elif gi is MultiMeshInstance3D and (gi as MultiMeshInstance3D).multimesh:
			var mm := (gi as MultiMeshInstance3D).multimesh
			mesh = mm.mesh
			count = mm.visible_instance_count if mm.visible_instance_count >= 0 else mm.instance_count
			mm_nodes += 1
			mm_inst += count
		if mesh == null:
			continue
		var rid := mesh.get_rid()
		if not face_cache.has(rid):
			face_cache[rid] = mesh.get_faces().size() / 3
		var t: int = int(face_cache[rid]) * count
		var mat := gi.material_override
		if mat == null and mesh.get_surface_count() > 0:
			mat = mesh.surface_get_material(0)
		if mat and mat.next_pass:
			t *= 2
		tris += t
	d["mesh_nodes"] = mesh_nodes
	d["mm_nodes"] = mm_nodes
	d["mm_instances"] = mm_inst
	d["tris"] = tris
	var lights := 0
	var shadow := 0
	var sun_m := 0.0
	for l in scene.find_children("*", "Light3D", true, false):
		var lt := l as Light3D
		if not lt.is_visible_in_tree():
			continue
		lights += 1
		if lt.shadow_enabled:
			shadow += 1
			if lt is DirectionalLight3D:
				sun_m = maxf(sun_m, (lt as DirectionalLight3D).directional_shadow_max_distance)
	d["lights"] = lights
	d["shadow_lights"] = shadow
	d["sun_shadow_m"] = int(sun_m)
	var parts := 0
	for p in scene.find_children("*", "GPUParticles3D", true, false):
		if (p as GPUParticles3D).emitting and (p as GPUParticles3D).is_visible_in_tree():
			parts += 1
	for p in scene.find_children("*", "CPUParticles3D", true, false):
		if (p as CPUParticles3D).emitting and (p as CPUParticles3D).is_visible_in_tree():
			parts += 1
	d["particles"] = parts
	var cam := root.get_viewport().get_camera_3d()
	d["cam_far"] = int(cam.far) if cam else -1
	return d


## MEASURE 프레임 — RenderingServer 숫자·process 시간만 모은다.
func _measure(d: Dictionary) -> void:
	var dr: Array = []
	var ob: Array = []
	var pr: Array = []
	var ms: Array = []
	var t0 := Time.get_ticks_usec()
	for _i in MEASURE:
		await process_frame
		var t1 := Time.get_ticks_usec()
		ms.append((t1 - t0) / 1000.0)   # 프레임 간격 — Performance.TIME_PROCESS 는 지난 1초의 최댓값이라 씬 싣기 걸음이 남는다
		t0 = t1
		dr.append(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME))
		ob.append(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_OBJECTS_IN_FRAME))
		pr.append(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME))
	var avg := func(a: Array) -> int:
		var s := 0.0
		for v in a:
			s += float(v)
		return int(s / maxf(a.size(), 1))
	if int(dr.max()) <= 0:
		_headless = true
		for k in ["draw_avg", "draw_max", "objects_avg", "prims_avg", "prims_max"]:
			d[k] = "n/a"
	else:
		d["draw_avg"] = avg.call(dr)
		d["draw_max"] = int(dr.max())
		d["objects_avg"] = avg.call(ob)
		d["prims_avg"] = avg.call(pr)
		d["prims_max"] = int(pr.max())
	ms.sort()
	d["frame_ms"] = "%.2f" % float(ms[ms.size() / 2])


func _budget(label: String, d: Dictionary) -> void:
	var b: Dictionary = BUDGET.get(label, BASE_BUDGET)
	var checks := [["draw_avg", "draw_avg"], ["prims_avg", "tris_avg"], ["prims_max", "tris_max"], ["shadow_lights", "shadow_lights"], ["particles", "particles"]]
	for c in checks:
		var v: Variant = d.get(c[0])
		if typeof(v) != TYPE_INT:
			continue   # n/a(헤드리스) 는 안 센다
		if int(v) > int(b[c[1]]):
			var line := "PERF5 over %s %s=%d/%d" % [label, c[0], v, b[c[1]]]
			print(line)
			_overs.append(line)


func _row(label: String, scene: Node) -> void:
	## 그리기·시간을 먼저 잰다 — get_faces 셈이 긴 프레임을 만들어 frame_ms 를 끌지 않게.
	var m := {}
	await _measure(m)
	var d := _count(scene)
	d.merge(m)
	var parts: Array[String] = []
	for k in COLS:
		parts.append("%s=%s" % [k, str(d.get(k, "-"))])
	print("PERF5 %s %s" % [label, " ".join(parts)])
	_rows.append([label, d])
	_budget(label, d)


func _scene(label: String, path: String) -> void:
	var ps := load(path) as PackedScene
	if ps == null:
		fails += 1
		print("PERF5 %s FAIL 씬 못 읽음 %s" % [label, path])
		return
	var scene := ps.instantiate()
	root.add_child(scene)
	current_scene = scene
	for _i in SETTLE:
		await process_frame
	await _row(label, scene)
	if label == "REALM":
		## 같은 씬에서 지도 토글(두 번 안 싣기) — 지도 단추와 같은 손잡이.
		var rs := root.get_node_or_null("/root/RealmSaveState")
		if rs == null:
			fails += 1
			print("PERF5 REALM_MAP FAIL RealmSaveState 없음")
		else:
			rs.set("viewing_map", true)
			for _i in SETTLE:
				await process_frame
			await _row("REALM_MAP", scene)
			rs.set("viewing_map", false)
			for _i in 3:
				await process_frame
	scene.queue_free()
	await process_frame
	await process_frame


func _write_md() -> void:
	var out := "# perf_scenes (G-0257) — %s · renderer=%s%s\n\n" % [Time.get_datetime_string_from_system(), RenderingServer.get_current_rendering_method(), " · 헤드리스(그리기 n/a)" if _headless else ""]
	out += "| 판 | " + " | ".join(PackedStringArray(COLS)) + " |\n"
	out += "|---|" + "---|".repeat(COLS.size()) + "\n"
	for r in _rows:
		var cells: Array[String] = []
		for k in COLS:
			cells.append(str((r[1] as Dictionary).get(k, "-")))
		out += "| %s | %s |\n" % [r[0], " | ".join(cells)]
	out += "\n예산(판별 BUDGET): draw_avg ≤260 · prims_avg ≤350000 · prims_max ≤500000 · shadow_lights ≤8 · particles ≤12\n\n"
	if _overs.is_empty():
		out += "넘은 곳 없음\n"
	else:
		for o in _overs:
			out += "- %s\n" % o
	var path := ProjectSettings.globalize_path("res://tools/_out")
	DirAccess.make_dir_recursive_absolute(path)
	var f := FileAccess.open(path.path_join("perf_scenes.md"), FileAccess.WRITE)
	if f:
		f.store_string(out)
		f.close()


func _initialize() -> void:
	create_timer(170.0).timeout.connect(func() -> void:
		print("PROBE perf_scenes FAIL 1 (시간 초과)")
		quit(3))
	## 성능 모드 설정 파일이 남아 있으면 숫자가 흔들린다 — gfx_baseline 처럼 없는 임시 경로(파일은 안 만든다).
	var tmp := OS.get_temp_dir().path_join("saga_probe_perf_scenes_%d.cfg" % OS.get_process_id())
	DirAccess.remove_absolute(tmp)
	Gfx.cfg_path = tmp
	Gfx.forget()
	for s in SCENES:
		await _scene(String(s[0]), String(s[1]))
	if fails == 0 and _rows.size() < SCENES.size() + 1:   # 결과 줄 없음(여섯 행 = 다섯 씬 + REALM_MAP)
		fails += SCENES.size() + 1 - _rows.size()
	_write_md()
	print("PROBE perf_scenes OK" if fails == 0 else "PROBE perf_scenes FAIL %d" % fails)
	quit(0 if fails == 0 else 1)
