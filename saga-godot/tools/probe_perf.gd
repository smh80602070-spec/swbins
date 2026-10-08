extends Node
## GO 그리기 부담 측정 — 평소엔 안 붙는다. test_village.gd 가 SAGA_PERF_PROBE 가 있을 때만 단다.
## 헤드리스(더미 렌더러)에선 숫자가 0 이라 창 모드로 돌린다(화면 밖, 스크린샷 없음):
##
##   SAGA_PERF_PROBE=1 "$GODOT_CONSOLE" --path saga-godot --rendering-method mobile --position -4000,0 \
##       --resolution 540x960 res://games/saga_go/world/TestVillage.tscn
##
## SAGA_PERF_TOP=N — 삼각형 몫 표를 상위 N개까지(기본 14). SAGA_PERF_HIDE=노드이름접두어,… — 그 노드를 숨기고 잰다.
## 세 지역 신상 곁에서 카메라를 한 바퀴(8방향) 돌며 프레임마다 draw call·그린 물체·삼각형 수를 재고 최댓값·평균을 찍는다.
## 기기와 상관없는 수(해상도·GPU 를 안 탐)라 폰 부담의 기준으로 쓴다. 저장은 안 한다.

const SPOTS := [["village", "v_statue"], ["coast", "c_dock"], ["ruins", "r_statue"], ["village_again", "v_statue"], ["village_station", "v_station"]]
const DIRS := 8
const SETTLE := 40
const PER_DIR := 20

var _p: Node3D
var _wps: Node
var _rig: Node3D
var _frame := 0
var _spot := 0
var _dir := 0
var _acc: Array = []

func _ready() -> void:
	Weather.force("clear")

var _tl_f := 0

func _process(_delta: float) -> void:
	## SAGA_PERF_TIMELINE=N — 한 자리에 N 초 서서 1초마다 물리·처리 시간·노드 수를 찍는다(시간이 지나며 무거워지는 것 찾기).
	if OS.get_environment("SAGA_PERF_TIMELINE") != "":
		_tl_f += 1
		if _tl_f % 60 == 0:
			print("PERF t=%3ds physics=%.1f process=%.1f nodes=%d objects=%d active_bodies=%d pairs=%d fps=%.0f" % [_tl_f / 60,
				Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000.0, Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0,
				Performance.get_monitor(Performance.OBJECT_NODE_COUNT), Performance.get_monitor(Performance.OBJECT_COUNT),
				Performance.get_monitor(Performance.PHYSICS_3D_ACTIVE_OBJECTS), Performance.get_monitor(Performance.PHYSICS_3D_COLLISION_PAIRS),
				Performance.get_monitor(Performance.TIME_FPS)])
		## SAGA_PERF_TL_OFF=노드이름,... — 20초부터 그 노드들을 멈추고 40초에 되살린다(몫 재기).
		var off := OS.get_environment("SAGA_PERF_TL_OFF")
		if off != "" and (_tl_f == 60 * 20 or _tl_f == 60 * 40):
			for nm in off.split(","):
				var nd := get_tree().current_scene.find_child(nm, false, false)
				if nd:
					nd.process_mode = Node.PROCESS_MODE_DISABLED if _tl_f == 60 * 20 else Node.PROCESS_MODE_INHERIT
			print("PERF --- %s %s" % [off, "off" if _tl_f == 60 * 20 else "on"])
		if _tl_f >= 60 * int(OS.get_environment("SAGA_PERF_TIMELINE")):
			get_tree().quit()
		return
	_frame += 1
	if _wps == null:
		_p = get_tree().get_first_node_in_group("player")
		_wps = get_tree().get_first_node_in_group("go_waypoints")
		if _wps == null:
			_wps = get_tree().current_scene.find_child("Waypoints", true, false)
		_rig = get_tree().get_first_node_in_group("camera_rig")
		_frame = 0
		return
	if _spot >= SPOTS.size():
		if OS.get_environment("SAGA_PERF_BISECT") != "" and _bisect_step():
			return
		_summary()
		get_tree().quit()
		return
	if _spot == 1 and not _ds_done and OS.get_environment("SAGA_PERF_DRAWSHARE") != "":
		_drawshare_step()
		return
	if _frame == 1:
		if _spot == 0:
			_hide_for_share()
		var pos: Vector3 = _wps.call("world_pos_of", SPOTS[_spot][1])
		_p.global_position = pos + Vector3(4.0, 1.0, 4.0)
		_p.set("velocity", Vector3.ZERO)
	if _rig:
		_rig.rotation.y = TAU * float(_dir) / DIRS
	if _frame > SETTLE and _spot == 0:
		var dcn := RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME)
		if dcn > _ds_max:
			_ds_max = dcn
			_ds_dir = _dir
	if _frame > SETTLE:
		_acc.append([
			RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME),
			RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_OBJECTS_IN_FRAME),
			RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME),
			Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0,
			Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000.0,
		])
	if _frame >= SETTLE + PER_DIR:
		_dir += 1
		_frame = SETTLE # 같은 자리에선 다시 안 기다린다
		if _dir >= DIRS:
			_report(SPOTS[_spot][0])
			_acc.clear()
			_dir = 0
			_spot += 1
			_frame = 0

var _rows: Array = []

func _report(region: String) -> void:
	var mx := [0, 0, 0, 0.0, 0.0]
	var sm := [0.0, 0.0, 0.0, 0.0, 0.0]
	for a in _acc:
		for i in 5:
			mx[i] = maxf(mx[i], a[i])
			sm[i] += a[i]
	var n := float(maxi(_acc.size(), 1))
	## 시간은 가끔 튀는 프레임(다른 프로그램)에 끌리지 않게 가운데값·90% 값으로.
	var ph: Array = _acc.map(func(a: Array) -> float: return a[4])
	var pr: Array = _acc.map(func(a: Array) -> float: return a[3])
	ph.sort()
	pr.sort()
	var med := func(arr: Array, q: float) -> float: return float(arr[clampi(int(arr.size() * q), 0, arr.size() - 1)]) if not arr.is_empty() else 0.0
	var line := "PERF %s draw_calls max=%d avg=%d · objects max=%d avg=%d · triangles max=%d avg=%d · process_ms med=%.2f p90=%.2f · physics_ms med=%.2f p90=%.2f" % [
		region, mx[0], sm[0] / n, mx[1], sm[1] / n, mx[2], sm[2] / n, med.call(pr, 0.5), med.call(pr, 0.9), med.call(ph, 0.5), med.call(ph, 0.9)]
	print(line)
	_rows.append(line)

func _summary() -> void:
	var lights := 0
	var shadow_lights := 0
	for l in get_tree().current_scene.find_children("*", "Light3D", true, false):
		lights += 1
		if (l as Light3D).shadow_enabled:
			shadow_lights += 1
	var mm_instances := 0
	var mm_nodes := 0
	for m in get_tree().current_scene.find_children("*", "MultiMeshInstance3D", true, false):
		var mmi := m as MultiMeshInstance3D
		if mmi.multimesh:
			mm_nodes += 1
			mm_instances += mmi.multimesh.instance_count
	var meshes := get_tree().current_scene.find_children("*", "MeshInstance3D", true, false).size()
	## 삼각형이 어디서 오는가 — 마을 신상 180m 안, 씬 바로 밑 노드(또는 그 아래 한 칸)별로. 아웃라인(next_pass)이 있으면 두 번 센다.
	var center: Vector3 = _wps.call("world_pos_of", "v_statue")
	var by: Dictionary = {}
	var root := get_tree().current_scene
	for g in root.find_children("*", "GeometryInstance3D", true, false):
		var gi := g as GeometryInstance3D
		if not gi.is_visible_in_tree():
			continue
		var tris := 0
		var mesh: Mesh = null
		var count := 1
		if gi is MeshInstance3D:
			mesh = (gi as MeshInstance3D).mesh
		elif gi is MultiMeshInstance3D and (gi as MultiMeshInstance3D).multimesh:
			mesh = (gi as MultiMeshInstance3D).multimesh.mesh
			count = (gi as MultiMeshInstance3D).multimesh.instance_count
		if mesh == null:
			continue
		if gi is MeshInstance3D and gi.global_position.distance_to(center) > 180.0:
			continue
		tris = mesh.get_faces().size() / 3 * count
		var mat := gi.material_override
		if mat == null and mesh.get_surface_count() > 0:
			mat = mesh.surface_get_material(0)
		if mat and mat.next_pass:
			tris *= 2
		var key := _key_of(gi, root)
		by[key] = int(by.get(key, 0)) + tris
	var keys := by.keys()
	keys.sort_custom(func(x: Variant, y: Variant) -> bool: return int(by[x]) > int(by[y]))
	for k in keys.slice(0, maxi(int(OS.get_environment("SAGA_PERF_TOP")), 14)):
		print("PERF tris %s = %d" % [k, by[k]])
	var cam := get_viewport().get_camera_3d()
	print("PERF scene lights=%d shadow_lights=%d multimesh_nodes=%d multimesh_instances=%d mesh_nodes=%d camera_far=%.0f renderer=%s" % [
		lights, shadow_lights, mm_nodes, mm_instances, meshes, cam.far if cam else -1.0, RenderingServer.get_current_rendering_method()])

func _key_of(n: Node, root: Node) -> String:
	var chain: Array[String] = []
	var cur := n
	while cur and cur.get_parent() != root and cur != root:
		chain.push_front(String(cur.name))
		cur = cur.get_parent()
	if cur:
		chain.push_front(String(cur.name))
	var key := chain[0] if chain.size() > 0 else String(n.name)
	if chain.size() > 1:
		var sub := chain[1]
		## 이름 끝 번호는 하나로 모은다(StoryNpc_elder·FieldEnemy_village_3 등).
		var rx := RegEx.create_from_string("[_@0-9]+$")
		key += "/" + rx.sub(sub, "")
	return key

## 09-29 SAGA_PERF_HIDE=종류,…(noshadow·shadowsplit2 는 G-0023) — 재기 전에 그 종류를 숨겨 삼각형·draw call 몫을 잰다(숨긴 판 − 안 숨긴 판).
## people(사람 몸 — 플레이어 빼고) · player(플레이어 몸) · 그 밖은 노드 이름(모든 깊이, 이름이 그걸로 시작하면).
func _hide_for_share() -> void:
	var what := OS.get_environment("SAGA_PERF_HIDE")
	if what == "":
		return
	var root := get_tree().current_scene
	var n := 0
	## noshadow — 해(방향광) 그림자 끄기, shadowsplit2 — 그림자 분할을 2단으로(그림자 패스가 삼각형을 몇 번 더 그리는지 재기).
	for l in root.find_children("*", "DirectionalLight3D", true, false):
		if what.contains("noshadow"):
			(l as DirectionalLight3D).shadow_enabled = false
			n += 1
		## shadowdist:N — 그림자 최대 거리(m). 한 번 현재 값도 찍는다.
		var dl := l as DirectionalLight3D
		print("PERF light mode=%d max_dist=%.0f split1=%.2f split2=%.2f split3=%.2f fade_start=%.2f blur=%.2f bias=%.3f" % [dl.directional_shadow_mode, dl.directional_shadow_max_distance, dl.directional_shadow_split_1, dl.directional_shadow_split_2, dl.directional_shadow_split_3, dl.directional_shadow_fade_start, dl.shadow_blur, dl.shadow_bias])
		for tok in what.split(","):
			if tok.begins_with("shadowdist:"):
				dl.directional_shadow_max_distance = float(tok.substr(11))
				n += 1
		if what.contains("shadowsplit2"):
			(l as DirectionalLight3D).directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
			n += 1
	## nocast:노드이름접두어 — 그 노드(와 아래 전부)가 그림자를 드리우지 않게(그 몫만 재기, 눈에 보이는 건 그대로).
	for k in what.split(","):
		if k.begins_with("nocast:"):
			var pre := k.substr(7)
			for c in root.find_children("*", "Node3D", true, false):
				if String(c.name).begins_with(pre):
					if c is GeometryInstance3D:
						(c as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
						n += 1
					for g in c.find_children("*", "GeometryInstance3D", true, false):
						(g as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
						n += 1
	for k in what.split(","):
		if k.begins_with("nocast:"):
			continue
		for c in root.find_children("*", "Node3D", true, false):
			var node := c as Node3D
			var hit := false
			match k:
				"people":
					var p := String(node.scene_file_path)
					hit = p.contains("characters_dex") and not _p.is_ancestor_of(node)   # G-0030 — 사람 몸은 새 인물 몸뿐
				"player":
					hit = node.get_parent() == _p and node.name == "Visual"
				"playershadow", "playeroutline":
					## 플레이어 몸 메시의 그림자만 끄기 / 외곽선(next_pass)만 떼기 — 숨기지 않고 그 몫만 잰다.
					if node is MeshInstance3D and _p.is_ancestor_of(node):
						var mi := node as MeshInstance3D
						if k == "playershadow":
							mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
						else:
							for si in mi.mesh.get_surface_count():
								var m := mi.get_active_material(si)
								if m and m.next_pass:
									var c2 := m.duplicate() as Material
									c2.next_pass = null
									mi.set_surface_override_material(si, c2)
						n += 1
					continue
				_:
					hit = String(node.name).begins_with(k)
			if hit and node.visible:
				node.visible = false
				n += 1
	print("PERF hide %s nodes=%d" % [what, n])

## SAGA_PERF_DRAWSHARE=1 — 첫 자리(마을)를 다 잰 뒤, draw call 이 가장 많던 방향으로 돌아가 씬 바로 밑 노드(그 밑 한 단계까지)를
## 하나씩 숨겨 draw call 이 얼마나 주는지 찍는다(G-0114 — 예산 넘는 몫 찾기). "PERF share <경로> -N" 을 큰 순서로.
var _ds_dir := 0
var _ds_max := 0
var _ds_nodes: Array = []
var _ds_i := -1
var _ds_f := 0
var _ds_base := 0
var _ds_acc := 0
var _ds_rows: Array = []
var _ds_done := false
var _ds_hidden := false
var _ds_hid_dc := 0

func _drawshare_step() -> void:
	if _ds_nodes.is_empty() and _ds_i == -1:
		var pos: Vector3 = _wps.call("world_pos_of", SPOTS[0][1])
		_p.global_position = pos + Vector3(4.0, 1.0, 4.0)
		_p.set("velocity", Vector3.ZERO)
		if _rig:
			_rig.rotation.y = TAU * float(_ds_dir) / DIRS
		for c in get_tree().current_scene.get_children():
			if c == self or c == _p or c.is_ancestor_of(_p) or not (c is Node3D) or not (c as Node3D).visible:   # 처음부터 숨은 것은 재지 않는다(되살릴 때 켜지지 않게, R-5)
				continue
			_ds_nodes.append(c)
			if c.get_child_count() > 1:
				for g in c.get_children():
					if g is Node3D and not g.is_ancestor_of(_p) and (g as Node3D).visible:
						_ds_nodes.append(g)
	_ds_f += 1
	var wait := 60 if _ds_i == -1 and not _ds_hidden else 10
	if _ds_f > wait - 4:
		_ds_acc += RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME)
	if _ds_f < wait:
		return
	var dc := int(_ds_acc / 4)
	_ds_f = 0
	_ds_acc = 0
	## 숨긴 판 → 되살린 판(기준) 을 번갈아 재서, 숨긴 값은 바로 뒤 기준과 뺀다(순간 튐에 안 끌리게).
	if _ds_hidden:
		_ds_hid_dc = dc
		if is_instance_valid(_ds_nodes[_ds_i]):
			(_ds_nodes[_ds_i] as Node3D).visible = true
		_ds_hidden = false
		return
	if _ds_i == -1:
		print("PERF share base dir=%d draw_calls=%d (마을 최대 %d)" % [_ds_dir, dc, _ds_max])
	elif _ds_i < _ds_nodes.size() and is_instance_valid(_ds_nodes[_ds_i]):   # 재는 사이 사라진 노드(적·효과)는 버림
		if OS.get_environment("SAGA_PERF_DRAWSHARE") == "raw":
			print("PERF share raw %s hidden=%d base=%d" % [_ds_nodes[_ds_i].name, _ds_hid_dc, dc])
		_ds_rows.append([dc - _ds_hid_dc, str(get_tree().current_scene.get_path_to(_ds_nodes[_ds_i]))])
	_ds_i += 1
	if _ds_i >= _ds_nodes.size():
		_ds_rows.sort_custom(func(a: Array, b: Array) -> bool: return a[0] > b[0])
		for r in _ds_rows:
			if int(r[0]) != 0:
				print("PERF share %s %+d" % [r[1], -int(r[0])])
		_ds_done = true
		_frame = 0   # 다음 자리(포구)가 처음부터 — 자리 옮기기·기다리기를 건너뛰지 않게(R-5)
		return
	while _ds_i < _ds_nodes.size() and not is_instance_valid(_ds_nodes[_ds_i]):
		_ds_i += 1
	if _ds_i >= _ds_nodes.size():
		return   # 다음 틱에 끝 처리
	(_ds_nodes[_ds_i] as Node3D).visible = false
	_ds_hidden = true

## SAGA_PERF_BISECT=1 — 마지막 자리에서 씬 바로 밑 노드를 하나씩 멈추고(process_mode 끔) 물리·처리 시간이 얼마나 주는지 잰다.
var _b_nodes: Array = []
var _b_i := -1
var _b_f := 0
var _b_t := [0.0, 0.0]
var _b_base := [0.0, 0.0]
const B_FRAMES := 90

func _bisect_step() -> bool:
	if _b_i == -1 and _b_nodes.is_empty():
		for c in get_tree().current_scene.get_children():
			if c != self and c != _p and not c.is_ancestor_of(_p) and c is Node and c.get_class() != "WorldEnvironment":
				_b_nodes.append(c)
	_b_f += 1
	if _b_f > 10:
		_b_t[0] += Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000.0
		_b_t[1] += Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0
	if _b_f < B_FRAMES:
		return true
	var ph: float = _b_t[0] / (B_FRAMES - 10)
	var pr: float = _b_t[1] / (B_FRAMES - 10)
	if _b_i == -1:
		_b_base = [ph, pr]
		print("PERF bisect base physics=%.1f process=%.1f" % [ph, pr])
	else:
		var n: Node = _b_nodes[_b_i]
		print("PERF bisect off=%s physics=%.1f (%+.1f) process=%.1f (%+.1f)" % [n.name, ph, ph - _b_base[0], pr, pr - _b_base[1]])
		n.process_mode = Node.PROCESS_MODE_INHERIT
	_b_i += 1
	_b_f = 0
	_b_t = [0.0, 0.0]
	if _b_i >= _b_nodes.size():
		return false
	(_b_nodes[_b_i] as Node).process_mode = Node.PROCESS_MODE_DISABLED
	return true
