extends Node3D

## VERTICAL_SLICE_STORY.md 2절 — Background 레이어(Z 매우 음수, 큰 실루엣,
## 충돌 없음). 지금까지 story_terrain_builder.gd는 Midground(바닥·발판,
## Z=0)만 지어 뒀다 — 2절이 설계해 둔 세 겹(Background/Midground/
## Foreground) 중 Midground만 있던 상태를 이걸로 채운다(Foreground는
## 여전히 생략 — 2절 "있으면 좋고 없어도 완료 조건에 안 걸린다").
##
## 새 GLB를 안 받는다(PLAN.md 44장) — 이미 받아 둔 GO/FOREST 에셋
## (tree_oak.glb·rock_largeA.glb) 재활용. 실루엣이라 원래 텍스처 대신
## 짙은 단색(UNSHADED — 태양 방향·시간에 안 흔들리는 "늘 같은 먼 산" 톤)
## 으로 덮어 쓴다. 충돌은 안 만든다(MultiMeshInstance3D 자체가 충돌이
## 없다 — vegetation_builder.gd처럼 따로 StaticBody를 안 붙인다).

## **2026-09-13 추가(같은 날 더, 23절) — 사냥터 공용화.** field 전용으로
## FieldMap.width_m()을 상수 preload해 쓰던 것을 `map_path` export로
## 바꿨다(story_enemy_spawner.gd 등과 같은 이유) — 안 바꾸면 오림 숲·
## 한중 굴혈처럼 field보다 넓은 사냥터에서 배경 나무·언덕이 field 너비
## (44m)만큼만 깔려 뒷부분이 빈 채로 남는다.
@export var map_path: String = "res://games/saga_story/data/field_map.gd"

const GLBUtils := preload("res://saga_core/world/glb_utils.gd")
const CaveBackdrop := preload("res://games/saga_story/world/story_cave_backdrop.gd")

const TREE_GLB := "res://assets/world/tree_broadleaf_01.glb"
const HILL_GLB := "res://assets/world/hill_01.glb"

const TREE_Z := -30.0
const HILL_Z := -45.0  # 나무보다 더 뒤 — 대기 원근(더 멀수록 흐리고 파르스름)
const TREE_COUNT := 14
const HILL_COUNT := 5
const TREE_SCALE := 1.64   # G-0017: 옛 oak 1.2m×9 = 10.8m 와 같게(broadleaf_01 실측 6.594m)
const HILL_SCALE := 2.5    # hill_01 은 12m 폭·3.2m 높이 → 단색 실루엣 언덕 약 30m×8m
const TREE_COLOR := Color(0.36, 0.44, 0.4)
const HILL_COLOR := Color(0.3, 0.36, 0.42)


var _map: RefCounted


## G-0149 — 사실 쪽 여러 겹 배경(사용자 10-09 "사가종횡은 배경이 화면이 있어야 겠네"). 동굴·미궁 씬은 안 짓는다.
const GRASS_TEX := preload("res://assets/generated/tiles/grass_512.png")
const SIDE_M := 160.0            # 지도 양옆으로 더 까는 너비(카메라가 끝에 서도 화면 끝까지)
const GROUND_Y := -0.35          # 발판 윗면(0) 바로 아래 — 발판이 들판 위에 놓인 꼴
const GROUND_NEAR := 14.0        # 카메라(z +16) 바로 앞까지
const GROUND_FAR := -300.0
const TREELINE_GLBS := ["res://assets/world/tree_broadleaf_01.glb", "res://assets/world/tree_broadleaf_02.glb", "res://assets/world/tree_pine_02.glb"]
const RIDGES := [[-230.0, 60.0, Color(0.44, 0.5, 0.58)], [-330.0, 85.0, Color(0.56, 0.62, 0.7)]]   # [z, 최고 m, 색]


func _ready() -> void:
	_map = (load(map_path) as GDScript).new()
	var scene_path := owner.scene_file_path if owner != null else ""
	if scene_path.contains("Cave") or scene_path.contains("Labyrinth"):
		## G-0150 — 동굴 안에 들판 나무·언덕 실루엣 대신 바위 벽·천장·종유석·횃불.
		CaveBackdrop.build(self, _map.width_m(), CaveBackdrop.LABYRINTH if scene_path.contains("Labyrinth") else CaveBackdrop.CAVE)
		return
	_build_layer(TREE_GLB, TREE_COUNT, TREE_SCALE, TREE_Z, TREE_COLOR, "BackgroundTrees")
	_build_layer(HILL_GLB, HILL_COUNT, HILL_SCALE, HILL_Z, HILL_COLOR, "BackgroundHills")
	_build_scenery()


static func _h(i: int, salt: int) -> float:
	return fposmod(sin(float(i) * 12.9898 + float(salt) * 78.233) * 43758.5453, 1.0)


func _build_scenery() -> void:
	var width: float = _map.width_m()
	var x0 := -SIDE_M
	var x1 := width + SIDE_M
	## ① 들판 — 발판 아래·뒤로 이어지는 땅(풀 텍스처 월드 투영, 멀수록 안개가 흐린다).
	var plane := PlaneMesh.new()
	plane.size = Vector2(x1 - x0, GROUND_NEAR - GROUND_FAR)
	var g := MeshInstance3D.new()
	g.name = "BackgroundGround"
	g.mesh = plane
	g.position = Vector3((x0 + x1) * 0.5, GROUND_Y, (GROUND_NEAR + GROUND_FAR) * 0.5)
	var gm := StandardMaterial3D.new()
	gm.albedo_texture = GRASS_TEX
	gm.albedo_color = Color(0.5, 0.62, 0.4)   # 0.62,0.78,0.5 는 화면 아래 절반이 쨍한 연두 판이었다
	gm.uv1_triplanar = true
	gm.uv1_world_triplanar = true
	gm.uv1_scale = Vector3(0.25, 0.25, 0.25)
	gm.roughness = 0.95
	g.material_override = gm
	g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(g)
	## ② 숲 띠 — 지도 양옆까지 두 줄(나무 종류마다 MultiMesh 하나, GLB 제 재질 그대로 — 조명 받는다).
	var per := []
	for k in TREELINE_GLBS.size():
		per.append([])
	var n := int((x1 - x0) / 4.2)
	for row in 2:
		for i in n:
			var id := i + row * 1000
			var x := x0 + (float(i) + _h(id, 1)) * 4.2
			var z := -22.0 - float(row) * 13.0 - _h(id, 2) * 6.0
			var s := 1.3 + _h(id, 3) * 0.9 + float(row) * 0.35
			var basis := Basis(Vector3.UP, _h(id, 4) * TAU).scaled(Vector3.ONE * s)
			(per[int(_h(id, 5) * TREELINE_GLBS.size()) % TREELINE_GLBS.size()] as Array).append(Transform3D(basis, Vector3(x, GROUND_Y, z)))
	for k in TREELINE_GLBS.size():
		var mesh := GLBUtils.extract_mesh(TREELINE_GLBS[k])
		if mesh == null or (per[k] as Array).is_empty():
			continue
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = mesh
		mm.instance_count = (per[k] as Array).size()
		for i in mm.instance_count:
			mm.set_instance_transform(i, per[k][i])
		var mmi := MultiMeshInstance3D.new()
		mmi.name = "BackgroundTreeLine%d" % k
		mmi.multimesh = mm
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mmi)
	## ③ 먼 산맥 — 노이즈 능선 띠 두 겹(가까운 쪽 짙게·먼 쪽 옅게), 아래는 들판 밑으로 묻힌다.
	for r in RIDGES:
		add_child(_ridge(float(r[0]), float(r[1]), r[2] as Color, x0 - 200.0, x1 + 200.0))


func _ridge(z: float, top: float, col: Color, xa: float, xb: float) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var step := 8.0
	var n := int((xb - xa) / step)
	var prev := Vector3.ZERO
	for i in n + 1:
		var x := xa + float(i) * step
		var u := x * 0.006 + z
		var hgt := top * (0.35 + 0.4 * (sin(u * 1.7) * 0.5 + 0.5) + 0.25 * _h(int(x / step) + int(z), 9))
		var p := Vector3(x, hgt, z)
		if i > 0:
			var b0 := Vector3(prev.x, -20.0, z)
			var b1 := Vector3(x, -20.0, z)
			for v in [[b0, 0.0], [prev, 1.0], [p, 1.0], [b0, 0.0], [p, 1.0], [b1, 0.0]]:
				st.set_color(col.lerp(col.darkened(0.25), 1.0 - float(v[1])))
				st.set_normal(Vector3.BACK)
				st.add_vertex(v[0])
		prev = p
	var mi := MeshInstance3D.new()
	mi.name = "BackgroundRidge%d" % int(-z)
	mi.mesh = st.commit()
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED   # 먼 산은 해에 안 흔들리는 대기 원근 빛(안개가 더 흐린다)
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	mi.material_override = m
	mi.set_meta("flat_silhouette", true)   # 재질 감사 flat-tint 예외(먼 산 단색)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi


## 사냥터 너비에 고르게 퍼뜨리되, 인덱스 홀짝으로 크기를 살짝 변주한다
## (randf()는 안 쓴다 — 배경도 매번 켤 때마다 같은 자리·같은 크기여야
## vegetation_builder.gd의 해시 원칙과 같은 정신을 지킨다, 다만 여긴
## 격자가 없어 인덱스만으로 충분하다).
func _build_layer(glb_path: String, count: int, base_scale: float, z: float, color: Color, node_name: String) -> void:
	var mesh := GLBUtils.extract_mesh(glb_path)
	if mesh == null:
		return

	var width: float = _map.width_m()
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = count

	for i in count:
		var t: float = (float(i) + 0.5) / float(count)
		var x: float = t * width
		var s: float = base_scale * (0.85 + 0.3 * float(i % 3) / 2.0)
		var basis := Basis().scaled(Vector3.ONE * s)
		mm.set_instance_transform(i, Transform3D(basis, Vector3(x, 0, z)))

	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.name = node_name
	mmi.set_meta("flat_silhouette", true)   # 대기 원근 단색 실루엣 — 재질 감사 flat-tint 예외(material_audit.gd)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mmi.material_override = mat
	add_child(mmi)
