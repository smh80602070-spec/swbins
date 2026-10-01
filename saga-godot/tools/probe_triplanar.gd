extends Node
## GO 지형 트라이플레이너(102-5: world/terrain_builder.gd 가 지역마다 짓는 "Ground" — saga_core/shaders/terrain_triplanar.gdshader + 잔디·흙·돌 질감 9장) 자동 점검.
## 평소엔 안 붙는다. test_village.gd 가 SAGA_TRIPLANAR_PROBE 가 있을 때만 단다. 화면을 안 그리고 재질·메시 구조만 본다(그림이 맞는지는 사람 눈 몫).
##
##   SAGA_TRIPLANAR_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 지형 노드가 지역 수만큼 서 있고 각자 "Ground" 를 가짐 ② 재질이 ShaderMaterial(terrain_triplanar.gdshader)이고 셰이더가 실제로 컴파일돼
## 안 쓰이는 이름(오타)으로 값을 주지 않았다 — 코드가 주는 파라미터가 전부 셰이더 uniform 에 있다 ③ 질감 아홉 장이 비어 있지 않고 512×512 ·
## 같은 종류끼리만 같다(잔디≠흙≠돌) ④ hue_desat 가 지역 표(REGION_TEX_DESAT)와 같다 ⑤ 메시에 정점색·CUSTOM0(지형 판정)·삼각형이 있다.
## 끝에 TRIPLANAR_PROBE_DONE fails=N.

const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TEX_PARAMS := ["grass_albedo", "grass_normal", "grass_rough", "dirt_albedo", "dirt_normal", "dirt_rough", "stone_albedo", "stone_normal", "stone_rough"]

var _scene: Node
var _fails := 0


func _ready() -> void:
	Weather.force("clear")
	_scene = get_tree().current_scene
	_run.call_deferred()


func _frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("TRIPLANAR_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


func _terrains(root: Node, out: Array) -> void:
	var s: Script = root.get_script()
	if s != null and s.resource_path.ends_with("/terrain_builder.gd"):
		out.append(root)
	for c in root.get_children():
		_terrains(c, out)


func _run() -> void:
	await _frames(4)
	var terrains := []
	_terrains(_scene, terrains)
	var regions := {}
	var grounds := []
	for t in terrains:
		regions[String(t.region_id)] = true
		var g := t.get_node_or_null("Ground") as MeshInstance3D
		if g != null:
			grounds.append(g)
	_check("terrains", terrains.size() >= 3 and grounds.size() == terrains.size() and regions.size() == terrains.size(), "지형 %d개 · Ground %d개 · 지역 %s" % [terrains.size(), grounds.size(), str(regions.keys())])

	var shader_ok := true
	var uniforms_ok := true
	var tex_ok := true
	var desat_ok := true
	var mesh_ok := true
	var shared_ok := true
	var bad := ""
	var first_tex := {}
	for t in terrains:
		var g := t.get_node("Ground") as MeshInstance3D
		var mat := g.material_override as ShaderMaterial
		if mat == null or mat.shader == null or not mat.shader.resource_path.ends_with("/terrain_triplanar.gdshader"):
			shader_ok = false
			bad += " %s:재질" % t.region_id
			continue
		var uniform_names := {}
		for u in mat.shader.get_shader_uniform_list():
			uniform_names[String(u.name)] = true
		for p in TEX_PARAMS + ["hue_desat"]:
			if not uniform_names.has(p):
				uniforms_ok = false
				bad += " %s:uniform %s 없음" % [t.region_id, p]
		var seen := {}
		for p in TEX_PARAMS:
			var tx := mat.get_shader_parameter(p) as Texture2D
			if tx == null or tx.get_width() != 512 or tx.get_height() != 512:
				tex_ok = false
				bad += " %s:질감 %s" % [t.region_id, p]
				continue
			if seen.has(tx):
				tex_ok = false
				bad += " %s:%s 가 다른 종류와 같은 그림" % [t.region_id, p]
			seen[tx] = true
			if first_tex.has(p) and first_tex[p] != tx:
				shared_ok = false
			first_tex[p] = tx
		var want: float = float(TerrainBuilder.REGION_TEX_DESAT.get(String(t.region_id), 0.0))
		if not is_equal_approx(float(mat.get_shader_parameter("hue_desat")), want):
			desat_ok = false
			bad += " %s:desat" % t.region_id
		var mesh := g.mesh as ArrayMesh
		var fmt := mesh.surface_get_format(0) if mesh != null and mesh.get_surface_count() > 0 else 0
		var tris := 0
		if mesh != null and mesh.get_surface_count() > 0:
			var arr := mesh.surface_get_arrays(0)
			tris = (arr[Mesh.ARRAY_INDEX] as PackedInt32Array).size() / 3 if arr[Mesh.ARRAY_INDEX] != null else (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array).size() / 3
		if mesh == null or (fmt & Mesh.ARRAY_FORMAT_COLOR) == 0 or (fmt & Mesh.ARRAY_FORMAT_CUSTOM0) == 0 or tris <= 0:
			mesh_ok = false
			bad += " %s:메시" % t.region_id
	_check("shader_material", shader_ok, "모든 Ground 가 terrain_triplanar.gdshader" + bad)
	_check("uniforms_exist", uniforms_ok, "코드가 주는 파라미터 10개가 전부 셰이더 uniform 에 있다")
	_check("textures", tex_ok and shared_ok, "질감 9장 512×512 · 종류끼리 다른 그림 · 지역끼리 같은 질감 공유")
	_check("hue_desat", desat_ok, str(TerrainBuilder.REGION_TEX_DESAT))
	_check("mesh_format", mesh_ok, "정점색·CUSTOM0·삼각형 있음")

	print("TRIPLANAR_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
