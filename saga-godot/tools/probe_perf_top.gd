extends SceneTree

## G-0260 삼각형 상위 목록 — 한 씬(기본 3마을 FOREST)을 싣고 SETTLE 뒤 한 번만 센다(매 틱 셈 금지).
##   godot --headless --path saga-godot --script res://tools/probe_perf_top.gd [-- <라벨 GO|DUNGEON|FOREST|STORY|REALM 또는 res:// 씬>]
## 셈 = probe_perf `_summary`·`_key_of` 와 같은 꼴: 씬 바로 밑 노드(+한 칸 아래, 끝 번호 묶음) 키 · MultiMesh 는 인스턴스 곱 · 재질 next_pass 면 ×2 · get_faces 는 메시마다 한 번.
## 출력: "PERFTOP <라벨> <키> = n" 상위 14 · "PERFTOP mesh <인스턴스 수> <삼각형> <노드 이름>" 메시(rid)별 상위 5 · 끝줄 "PROBE perf_top OK|FAIL n".
## 씬·env·세이브는 안 바꾼다(측정만). 헤드리스에서도 셈 칸은 같다(그리기 숫자는 probe_perf_scenes 창 모드).

const SETTLE := 20
const TOP_KEYS := 14
const TOP_MESHES := 5
const SCENES := {
	"GO": "res://games/saga_go/world/TestVillage.tscn",   # check_refs:allow — perf_scenes 와 같은 씬
	"DUNGEON": "res://games/saga_dungeon/world/TestRoom.tscn",   # check_refs:allow
	"FOREST": "res://games/saga_forest/world/TestVillageForest.tscn",   # check_refs:allow
	"STORY": "res://games/saga_story/world/SinyaField.tscn",   # check_refs:allow
	"REALM": "res://games/saga_realm/world/TestCity.tscn",   # check_refs:allow
}

var fails := 0


func _key_of(n: Node, top: Node) -> String:
	var chain: Array[String] = []
	var cur := n
	while cur and cur.get_parent() != top and cur != top:
		chain.push_front(String(cur.name))
		cur = cur.get_parent()
	if cur:
		chain.push_front(String(cur.name))
	var key := chain[0] if chain.size() > 0 else String(n.name)
	if chain.size() > 1:
		var rx := RegEx.create_from_string("[_@0-9]+$")
		key += "/" + rx.sub(chain[1], "")
	return key


func _top(label: String, scene: Node) -> void:
	var by := {}
	var face_cache := {}
	var per_mesh := {}   # rid → [인스턴스 수, 메시 하나 삼각형, 첫 노드 이름]
	var total := 0
	for g in scene.find_children("*", "GeometryInstance3D", true, false):
		var gi := g as GeometryInstance3D
		if not gi.is_visible_in_tree():
			continue
		var mesh: Mesh = null
		var count := 1
		if gi is MeshInstance3D:
			mesh = (gi as MeshInstance3D).mesh
		elif gi is MultiMeshInstance3D and (gi as MultiMeshInstance3D).multimesh:
			var mm := (gi as MultiMeshInstance3D).multimesh
			mesh = mm.mesh
			count = mm.visible_instance_count if mm.visible_instance_count >= 0 else mm.instance_count
		if mesh == null:
			continue
		var rid := mesh.get_rid()
		if not face_cache.has(rid):
			face_cache[rid] = mesh.get_faces().size() / 3
		var one: int = int(face_cache[rid])
		var t := one * count
		var mat := gi.material_override
		if mat == null and mesh.get_surface_count() > 0:
			mat = mesh.surface_get_material(0)
		if mat and mat.next_pass:
			t *= 2
		total += t
		var key := _key_of(gi, scene)
		by[key] = int(by.get(key, 0)) + t
		if per_mesh.has(rid):
			per_mesh[rid][0] = int(per_mesh[rid][0]) + count
		else:
			per_mesh[rid] = [count, one, String(gi.get_path()).trim_prefix(String(scene.get_path()) + "/")]
	var keys := by.keys()
	keys.sort_custom(func(x: Variant, y: Variant) -> bool: return int(by[x]) > int(by[y]))
	print("PERFTOP %s total = %d" % [label, total])
	for k in keys.slice(0, maxi(int(OS.get_environment("SAGA_PERF_TOP")), TOP_KEYS)):
		print("PERFTOP %s %s = %d" % [label, k, by[k]])
	var rids := per_mesh.keys()
	rids.sort_custom(func(x: Variant, y: Variant) -> bool: return int(per_mesh[x][0]) * int(per_mesh[x][1]) > int(per_mesh[y][0]) * int(per_mesh[y][1]))
	for r in rids.slice(0, TOP_MESHES):
		var e: Array = per_mesh[r]
		print("PERFTOP mesh %d %d %s" % [e[0], e[1], e[2]])
	if total <= 0:
		fails += 1
		print("PERFTOP %s FAIL 삼각형 0" % label)


func _initialize() -> void:
	create_timer(150.0).timeout.connect(func() -> void:
		print("PROBE perf_top FAIL 1 (시간 초과)")
		quit(3))
	var args := OS.get_cmdline_user_args()
	var label := "FOREST"
	var path: String = SCENES["FOREST"]
	if args.size() > 0:
		var a := String(args[0])
		if SCENES.has(a.to_upper()):
			label = a.to_upper()
			path = SCENES[label]
		else:
			label = a.get_file().get_basename()
			path = a
	var ps := load(path) as PackedScene
	if ps == null:
		print("PERFTOP %s FAIL 씬 못 읽음 %s" % [label, path])
		print("PROBE perf_top FAIL 1")
		quit(1)
		return
	var scene := ps.instantiate()
	root.add_child(scene)
	current_scene = scene
	for _i in SETTLE:
		await process_frame
	_top(label, scene)
	print("PROBE perf_top OK" if fails == 0 else "PROBE perf_top FAIL %d" % fails)
	quit(0 if fails == 0 else 1)
