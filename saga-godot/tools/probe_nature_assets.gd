extends SceneTree
## G-0017 자연 소품 교체 점검 — godot --headless --path saga-godot --script res://tools/probe_nature_assets.gd → "PROBE nature_assets OK" / "FAIL n"
## ① vegetation_builder 의 나무 표(마을·고원·폐허)가 전부 열리고 높이×배율 4.9~5.65m(옛 목표 5.52m, 활엽02 는 수관이 넓어 일부러 5.0m) ② 바위 둘이 열리고 높이×배율 ≈ 0.67m
## ③ clutter·하층·들꽃·관목 표 전부 열리고 높이×배율이 0.2~1.7m 안 ④ 마을 나무 표에 옛 variants 경로가 없다

const VB := preload("res://games/saga_go/world/vegetation_builder.gd")

var fails := 0


func _height(path: String) -> float:
	var ps := load(path) as PackedScene
	if ps == null:
		return -1.0
	var inst := ps.instantiate()
	var box := [AABB(), false]
	_walk(inst, Transform3D.IDENTITY, box)
	inst.free()
	return (box[0] as AABB).size.y if box[1] else -1.0


func _walk(n: Node, xf: Transform3D, box: Array) -> void:
	var t := xf
	if n is Node3D:
		t = xf * (n as Node3D).transform
	if n is MeshInstance3D and (n as MeshInstance3D).mesh != null:
		var a := t * (n as MeshInstance3D).mesh.get_aabb()
		box[0] = a if not box[1] else (box[0] as AABB).merge(a)
		box[1] = true
	for c in n.get_children():
		_walk(c, t, box)


func _check(label: String, path: String, scale: float, lo: float, hi: float) -> void:
	var h := _height(path)
	if h < 0.0:
		fails += 1
		print("  FAIL 열리지 않음 ", label, " ", path)
		return
	var shown := h * scale
	if shown < lo or shown > hi:
		fails += 1
		print("  FAIL 높이 ", label, " ", path.get_file(), " ", snappedf(shown, 0.01), "m (허용 ", lo, "~", hi, ")")


func _init() -> void:
	for region: String in VB.REGION_TREE_VARIANTS:
		for v: Dictionary in VB.REGION_TREE_VARIANTS[region]:
			_check("나무 " + region, v.glb, v.scale, 4.9, 5.65)
			if String(v.glb).contains("generated/variants"):
				fails += 1
				print("  FAIL 옛 variants 경로 ", v.glb)
	for region: String in VB.REGION_ROCK_LARGE_GLB:
		_check("큰 바위 " + region, VB.REGION_ROCK_LARGE_GLB[region], VB.ROCK_LARGE_SCALE, 0.6, 0.75)
		_check("작은 바위 " + region, VB.REGION_ROCK_SMALL_GLB[region], VB.ROCK_SMALL_SCALE, 0.6, 0.75)
	for region: String in VB.REGION_CLUTTER_GLB:
		_check("clutter " + region, VB.REGION_CLUTTER_GLB[region], VB.REGION_CLUTTER_SCALE[region], 0.2, 0.4)
	for v: String in VB.COAST_PEBBLE_GLB:
		_check("조약돌", v, 1.0, 0.05, 0.3)
	for tbl: Array in [VB.UNDERSTORY, VB.WILDFLOWERS, VB.SHRUBS]:
		for v: Dictionary in tbl:
			_check("하층·들꽃·관목", v.glb, v.scale, 0.2, 1.7)
	print("PROBE nature_assets ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
