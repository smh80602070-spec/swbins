extends RefCounted

## G-0150 — 한중 굴혈(CaveHuntGround)·미궁(StoryLabyrinth)이 잿빛 허공에 뜬 발판이었다(동굴엔 들판 나무 실루엣까지).
## 배경 사실 쪽(사용자 10-09 "배경 전부 사실·인물 툰")으로 동굴 안을 짓는다: 뒤 바위 벽 · 천장 · 종유석·석순 · 발판 아래 바위 바닥 · 벽 횃불.
## 카메라(story_camera)는 z +16 에서 회전 없이 x·y 만 따라간다 — 세로 시야 75° 라 벽(z −14, 30m)에서 위아래 ±23m·좌우 ±41m 가 보여 그만큼 덮는다.
## 충돌 없음(보이기만), 새 에셋 없음(tiles 돌 512 + 코드 메시). 겹마다 메시·재질 하나(횃불 불빛만 몇 개).

const STONE := preload("res://assets/generated/tiles/stone_512.png")
const STONE_N := preload("res://assets/generated/tiles/stone_512_n.png")

const SIDE_M := 60.0          # 지도 양옆으로 더(카메라가 끝에 서도 화면 끝까지)
const FLOOR_Y := -0.35        # 발판 윗면(0) 바로 아래
const NEAR_Z := 14.0          # 카메라(z +16) 바로 앞까지
const WALL_Z := -14.0
const CEIL_Y := 16.0
const TORCH_EVERY := 12.0

const CAVE := {"rock": Color(0.5, 0.46, 0.5), "floor": Color(0.36, 0.33, 0.36), "torch": Color(1.0, 0.62, 0.32)}
const LABYRINTH := {"rock": Color(0.62, 0.54, 0.74), "floor": Color(0.5, 0.44, 0.58), "torch": Color(0.78, 0.6, 1.0)}


static func _h(i: int, salt: int) -> float:
	return fposmod(sin(float(i) * 12.9898 + float(salt) * 78.233) * 43758.5453, 1.0)


static func rock_material(tint: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_texture = STONE
	m.albedo_color = tint
	m.normal_enabled = true
	m.normal_texture = STONE_N
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3(0.22, 0.22, 0.22)
	m.roughness = 0.95
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m


## 격자 하나를 노이즈로 휜다 — pos(u, v) 가 꼭짓점 자리를 돌려준다(u·v 는 0~1).
static func _grid(nu: int, nv: int, pos: Callable) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for j in nv + 1:
		for i in nu + 1:
			st.add_vertex(pos.call(float(i) / nu, float(j) / nv))
	for j in nv:
		for i in nu:
			var a := j * (nu + 1) + i
			var b := a + 1
			var c := a + nu + 1
			var d := c + 1
			st.add_index(a); st.add_index(c); st.add_index(b)
			st.add_index(b); st.add_index(c); st.add_index(d)
	st.generate_normals()
	return st.commit()


static func _mesh_node(parent: Node3D, node_name: String, mesh: Mesh, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.name = node_name
	mi.mesh = mesh
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi


static func _cones(parent: Node3D, node_name: String, xs: Array, down: bool, mat: Material) -> void:
	if xs.is_empty():
		return
	var cone := CylinderMesh.new()
	cone.top_radius = 1.0 if down else 0.03
	cone.bottom_radius = 0.03 if down else 1.0
	cone.height = 1.0
	cone.radial_segments = 7
	cone.rings = 1
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = cone
	mm.instance_count = xs.size()
	for i in xs.size():
		mm.set_instance_transform(i, xs[i])
	var mmi := MultiMeshInstance3D.new()
	mmi.name = node_name
	mmi.multimesh = mm
	mmi.material_override = mat
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mmi)


## parent 아래에 동굴 겹을 짓는다. width = 지도 폭(m), pal = CAVE·LABYRINTH.
static func build(parent: Node3D, width: float, pal: Dictionary) -> void:
	var x0 := -SIDE_M
	var x1 := width + SIDE_M
	var noise := FastNoiseLite.new()
	noise.seed = 20260824
	noise.frequency = 0.08
	var rock := rock_material(pal["rock"])
	var floor_mat := rock_material(pal["floor"])
	var nu := int((x1 - x0) / 1.5)

	## ① 뒤 바위 벽 — 아래는 바닥 밑에서, 위로 갈수록 앞으로 기울어 천장에 붙는다.
	var wall := _grid(nu, 16, func(u: float, v: float) -> Vector3:
		var x := lerpf(x0, x1, u)
		var y := lerpf(-3.0, CEIL_Y + 1.0, v)
		var z := WALL_Z + noise.get_noise_2d(x, y) * 3.2 + pow(v, 3.0) * 6.0
		return Vector3(x, y, z))
	_mesh_node(parent, "CaveWall", wall, rock)

	## ② 천장 — 벽 꼭대기에서 카메라 앞까지, 아래로 울퉁불퉁 처진다.
	var ceil := _grid(nu, 12, func(u: float, v: float) -> Vector3:
		var x := lerpf(x0, x1, u)
		var z := lerpf(WALL_Z + 6.0, NEAR_Z, v)
		var y := CEIL_Y - absf(noise.get_noise_2d(x * 1.3, z * 1.3 + 50.0)) * 3.0
		return Vector3(x, y, z))
	_mesh_node(parent, "CaveCeiling", ceil, rock)

	## ③ 바위 바닥 — 발판 아래·앞(카메라 앞까지)과 벽 밑까지. 발판 윗면(0)을 넘지 않게 아래로만 휜다.
	var flo := _grid(nu, 10, func(u: float, v: float) -> Vector3:
		var x := lerpf(x0, x1, u)
		var z := lerpf(NEAR_Z, WALL_Z + 1.0, v)
		var y := FLOOR_Y - absf(noise.get_noise_2d(x * 0.7 + 90.0, z * 0.7)) * 0.6 + pow(v, 2.0) * 0.9
		return Vector3(x, y, z))
	_mesh_node(parent, "CaveFloor", flo, floor_mat)

	## ④ 종유석(천장에서 아래로)·석순(벽 밑에서 위로) — 발판 뒤(z −5 아래)만, 앞을 가리지 않게.
	var hang := []
	var rise := []
	var n := int((x1 - x0) / 3.4)
	for i in n:
		var x := x0 + (float(i) + _h(i, 1)) * 3.4
		var z := -5.0 - _h(i, 2) * 6.0
		var r := 0.25 + _h(i, 3) * 0.4
		var h := 0.8 + pow(_h(i, 4), 2.0) * 4.0
		if _h(i, 9) < 0.7:
			hang.append(Transform3D(Basis.from_scale(Vector3(r, h, r)), Vector3(x, CEIL_Y - 2.2 - h * 0.5, z)))
		if _h(i, 5) < 0.45:
			var h2 := 0.8 + _h(i, 6) * 3.0
			var r2 := 0.4 + _h(i, 7) * 0.6
			rise.append(Transform3D(Basis.from_scale(Vector3(r2, h2, r2)), Vector3(x + 0.9, FLOOR_Y + h2 * 0.5 - 0.1, -8.0 - _h(i, 8) * 4.0)))
	_cones(parent, "CaveStalactites", hang, true, rock)
	_cones(parent, "CaveStalagmites", rise, false, floor_mat)

	## ⑤ 벽 횃불 — 지도 안에서만 12m 마다 따뜻한 불빛 하나(그림자 없음) + 작은 불꽃.
	var flame_mat := StandardMaterial3D.new()
	flame_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	flame_mat.albedo_color = pal["torch"]
	flame_mat.emission_enabled = true
	flame_mat.emission = pal["torch"]
	flame_mat.emission_energy_multiplier = 2.5
	var flame := SphereMesh.new()
	flame.radius = 0.16
	flame.height = 0.42
	flame.radial_segments = 8
	flame.rings = 4
	var tx := TORCH_EVERY * 0.5
	while tx < width:
		var p := Vector3(tx, 4.2, WALL_Z + 3.4)
		var lamp := OmniLight3D.new()
		lamp.name = "CaveTorch"
		lamp.light_color = pal["torch"]
		lamp.light_energy = 3.0
		lamp.omni_range = 13.0
		lamp.shadow_enabled = false
		lamp.position = p + Vector3(0, 0, 0.6)
		parent.add_child(lamp)
		_mesh_node(parent, "CaveTorchFlame", flame, flame_mat).position = p
		tx += TORCH_EVERY
