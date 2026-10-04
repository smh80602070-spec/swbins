extends SceneTree
## G-0019 사가의숲 자연 소품 교체 점검 — godot --headless --path saga-godot --script res://tools/probe_forest_assets.gd → "PROBE forest_assets OK" / "FAIL n"
## ① 숲 나무·바위·버섯·꽃·풀 GLB 가 열리고 높이×배율이 옛 목표(5.52·0.115·0.32·0.28·0.4m) ±10% ② textured_surfaces 가 모든 표면을 곡률 텍스처 재질로 바꾸고
## 원본 메시는 안 건드린다 ③ 곡률 텍스처 셰이더의 tint 기본이 흰색(기존 사용처 불변)

const FVB := preload("res://games/saga_forest/world/forest_vegetation_builder.gd")
const FBS := preload("res://games/saga_forest/world/forest_biome_scatter.gd")
const WCM := preload("res://saga_core/world/world_curve_material.gd")
const GLBUtils := preload("res://saga_core/world/glb_utils.gd")

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


func _check(label: String, path: String, scale: float, target: float) -> void:
	var h := _height(path)
	if h < 0.0:
		fails += 1
		print("  FAIL 열리지 않음 ", label, " ", path)
		return
	var shown := h * scale
	if absf(shown - target) > target * 0.10:
		fails += 1
		print("  FAIL 높이 ", label, " ", snappedf(shown, 0.001), "m (목표 ", target, ")")


func _init() -> void:
	_check("나무", FVB.TREE_GLB, FVB.TREE_SCALE, 5.52)
	_check("바위", FBS.ROCK_GLB, FBS.ROCK_SCALE, 0.115)
	_check("버섯", FBS.MUSHROOM_GLB, FBS.MUSHROOM_SCALE, 0.32)
	_check("꽃", FBS.FLOWER_GLB, FBS.FLOWER_SCALE, 0.28)
	_check("풀", FBS.FERN_GLB, FBS.FERN_SCALE, 0.4)
	var src := GLBUtils.extract_mesh(FVB.TREE_GLB)
	if src == null:
		fails += 1
		print("  FAIL 나무 메시 추출")
	else:
		var before := src.surface_get_material(0)
		var out := WCM.textured_surfaces(src, 0.004, 0.9, Color(0.5, 0.6, 0.7))
		for i in out.get_surface_count():
			var m := out.surface_get_material(i) as ShaderMaterial
			if m == null or m.get_shader_parameter("albedo_texture") == null:
				fails += 1
				print("  FAIL 표면 ", i, " 곡률 텍스처 재질 아님")
		if src.surface_get_material(0) != before or not (before is BaseMaterial3D):
			fails += 1
			print("  FAIL 원본 메시가 바뀜")
	var sh := load("res://saga_core/shaders/curved_textured.gdshader") as Shader
	## 헤드리스(더미 렌더러)에선 유니폼 기본값을 못 읽어 셰이더 코드 줄로 본다.
	if not sh.code.contains("uniform vec4 tint_color : source_color = vec4(1.0);"):
		fails += 1
		print("  FAIL tint 기본이 흰색이 아님")
	print("PROBE forest_assets ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
