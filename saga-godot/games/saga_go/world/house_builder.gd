extends RefCounted

## saga-godot 2026-09-28 "그래픽 먼저" — 코드로 짓는 오두막. 예전 GO 집은 1m 벽 블록(창 무늬 텍스처) 격자 + 지붕 하나라
## 멀리서 푸른 유리 상자로 보였다(창 모드 촬영). 원신 들판 마을 집의 문법만 따른다:
## 돌 받침 · 흰 회벽 · 짙은 나무 뼈대(기둥·띠·샛기둥) · 창(틀·창턱·꽃 상자) · 문(틀·차양) · 깊은 처마의 박공지붕 · 용마루 · 굴뚝.
## 부품을 전부 **메시 하나**(정점색)로 합쳐 draw call 한 번(+외곽선 한 번)이다 — landmarks_builder.gd 가 부른다.
## 앞(문) = +Z, 용마루는 X 축. 크기는 footprint(가로·벽 높이·세로, m). 충돌은 부르는 쪽(_solid) 그대로.

const SHADER := preload("res://saga_core/shaders/cel_vertex_color.gdshader")
const OUTLINE := preload("res://saga_core/shaders/cel_outline.gdshader")
const GLOW_SHADER := preload("res://saga_core/shaders/night_glow.gdshader")

const STONE := Color(0.62, 0.6, 0.56)
const PLASTER := Color(0.95, 0.91, 0.82)
const WOOD := Color(0.4, 0.27, 0.18)
const DOOR := Color(0.55, 0.36, 0.22)
const GLASS := Color(0.22, 0.32, 0.42)
const ROOFS := [Color(0.64, 0.36, 0.28), Color(0.38, 0.46, 0.58), Color(0.36, 0.54, 0.5)]
const FLOWERS := [Color(0.92, 0.32, 0.36), Color(0.98, 0.78, 0.3), Color(0.72, 0.45, 0.9)]

var _v := PackedVector3Array()
var _n := PackedVector3Array()
var _c := PackedColorArray()
var _i := PackedInt32Array()
## 밤에 켜지는 유리(창·등롱) — 따로 모아 공유 재질(glow_material) 하나로 그린다.
var _glow = null
static var _glow_mat: ShaderMaterial = null


static func glow_material() -> ShaderMaterial:
	if _glow_mat == null:
		_glow_mat = ShaderMaterial.new()
		_glow_mat.shader = GLOW_SHADER
	return _glow_mat


## 밤(1)·낮(0) — village_dressing.gd 가 밤낮이 바뀔 때 부른다.
static func set_night(amount: float) -> void:
	glow_material().set_shader_parameter("night", amount)


static func build(footprint: Vector3, variant: int) -> MeshInstance3D:
	var b = new()
	b._house(footprint, variant)
	return b.to_instance("HouseBody", 0.04)


## 다른 코드 모형(신상 — waypoints.gd)도 부품을 여기 모아 메시 하나로 합친다.
func add_mesh(m: Mesh, xf: Transform3D, color: Color) -> void:
	_append(m, xf, color)


func to_instance(node_name: String, outline_thickness: float) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.name = node_name
	mi.mesh = _commit()
	if _glow != null:
		var g := MeshInstance3D.new()
		g.name = "Glow"
		g.mesh = _glow._commit()
		g.material_override = glow_material()
		g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.add_child(g)
	var mat := ShaderMaterial.new()
	mat.shader = SHADER
	var o := ShaderMaterial.new()
	o.shader = OUTLINE
	o.set_shader_parameter("thickness", outline_thickness)
	mat.next_pass = o
	mi.material_override = mat
	return mi


func _house(fp: Vector3, variant: int) -> void:
	var w := fp.x
	var h := fp.y
	var d := fp.z
	var roof: Color = ROOFS[variant % ROOFS.size()]
	var flower: Color = FLOWERS[variant % FLOWERS.size()]
	## 받침·벽.
	_box(Vector3(0, 0.3, 0), Vector3(w + 0.5, 0.6, d + 0.5), STONE)
	_box(Vector3(0, h * 0.5, 0), Vector3(w, h, d), PLASTER)
	## 뼈대 — 모서리 기둥, 가로 띠 셋, 앞뒤 샛기둥.
	for sx in [-1.0, 1.0]:
		for sz in [-1.0, 1.0]:
			_box(Vector3(sx * w * 0.5, h * 0.5, sz * d * 0.5), Vector3(0.42, h, 0.42), WOOD)
	for y in [0.75, h * 0.55, h - 0.12]:
		for sz in [-1.0, 1.0]:
			_box(Vector3(0, y, sz * (d * 0.5 + 0.03)), Vector3(w + 0.1, 0.22, 0.14), WOOD)
		for sx in [-1.0, 1.0]:
			_box(Vector3(sx * (w * 0.5 + 0.03), y, 0), Vector3(0.14, 0.22, d + 0.1), WOOD)
	for sz in [-1.0, 1.0]:
		for fx in [-0.2, 0.2]:
			_box(Vector3(fx * w, h * 0.5, sz * (d * 0.5 + 0.03)), Vector3(0.16, h, 0.12), WOOD)
	## 문(앞 가운데) + 틀 + 차양.
	var dh := minf(2.5, h - 1.1)
	_box(Vector3(0, 0.6 + dh * 0.5, d * 0.5 + 0.05), Vector3(1.9, dh + 0.3, 0.08), WOOD)
	_box(Vector3(0, 0.6 + dh * 0.5 - 0.1, d * 0.5 + 0.09), Vector3(1.4, dh - 0.1, 0.08), DOOR)
	_box(Vector3(0, 0.6 + dh + 0.35, d * 0.5 + 0.55), Vector3(2.6, 0.14, 1.1), roof, Basis(Vector3.RIGHT, deg_to_rad(18)))
	## 창 — 앞 둘(문 양옆), 뒤 둘, 옆 하나씩. 앞 창엔 꽃 상자.
	var wy := clampf(h * 0.55 + 0.75, 1.6, h - 0.8)
	for fx in [-0.33, 0.33]:
		_window(Vector3(fx * w, wy, d * 0.5), Vector3.BACK, flower)
		_window(Vector3(fx * w, wy, -d * 0.5), Vector3.FORWARD, Color(0, 0, 0, 0))
	for sx in [-1.0, 1.0]:
		_window(Vector3(sx * w * 0.5, wy, 0), Vector3(sx, 0, 0), Color(0, 0, 0, 0))
	## 박공지붕 — 용마루 X 축, 처마 o 만큼 내밀기. 다락 삼각(회벽) + 두 지붕판 + 용마루.
	var o := 0.75
	var rh := d * 0.42
	var a := atan2(rh, d * 0.5)
	var slab_len := (d * 0.5 + o) / cos(a)
	var eave_y := h - o * tan(a)
	_prism(Vector3(0, h + rh * 0.5, 0), Vector3(d, rh, w), PLASTER)
	for sz in [-1.0, 1.0]:
		var mid := Vector3(0, (eave_y + h + rh) * 0.5 + 0.12, sz * (d * 0.5 + o) * 0.5)
		_box(mid, Vector3(w + 2.0 * o, 0.28, slab_len + 0.1), roof, Basis(Vector3.RIGHT, a * sz))
	_box(Vector3(0, h + rh + 0.2, 0), Vector3(w + 2.0 * o + 0.2, 0.3, 0.42), roof.darkened(0.3))
	## 굴뚝.
	_box(Vector3(w * 0.28, h + rh * 0.55 + 0.6, -d * 0.2), Vector3(0.9, rh + 1.4, 0.9), STONE)
	_box(Vector3(w * 0.28, h + rh * 1.05 + 1.35, -d * 0.2), Vector3(1.15, 0.22, 1.15), STONE.darkened(0.15))


## 벽면 자리 p(벽 겉면 위), 바깥 방향 out. 꽃 색 알파 0 이면 꽃 상자 없음.
func _window(p: Vector3, out: Vector3, flower: Color) -> void:
	var side := absf(out.x) > 0.5
	var sz := func(across: float, up: float, thick: float) -> Vector3:
		return Vector3(thick, up, across) if side else Vector3(across, up, thick)
	_box(p + out * 0.04, sz.call(1.45, 1.45, 0.08), WOOD)
	_box(p + out * 0.08, sz.call(1.1, 1.1, 0.06), GLASS, Basis(), true)
	_box(p + out * 0.1, sz.call(0.1, 1.1, 0.06), WOOD)
	_box(p + out * 0.1, sz.call(1.1, 0.1, 0.06), WOOD)
	_box(p + out * 0.18 + Vector3(0, -0.78, 0), sz.call(1.6, 0.12, 0.3), WOOD)
	if flower.a > 0.0:
		_box(p + out * 0.26 + Vector3(0, -1.0, 0), sz.call(1.35, 0.32, 0.36), WOOD.lightened(0.15))
		for k in 4:
			var t := (float(k) - 1.5) * 0.3
			var q := p + out * 0.26 + Vector3(0, -0.74, 0) + (Vector3(0, 0, t) if side else Vector3(t, 0, 0))
			_box(q, Vector3(0.22, 0.22, 0.22), flower if k % 2 == 0 else Color(0.35, 0.62, 0.3))


func _box(center: Vector3, size: Vector3, color: Color, basis := Basis(), glow := false) -> void:
	var m := BoxMesh.new()
	m.size = size
	if glow:
		if _glow == null:
			_glow = get_script().new()
		_glow._append(m, Transform3D(basis, center), color)
		return
	_append(m, Transform3D(basis, center), color)


## 다락 삼각 — PrismMesh(XY 삼각·Z 깊이)를 Y 로 90° 돌려 용마루가 X 축이 되게.
func _prism(center: Vector3, size: Vector3, color: Color) -> void:
	var m := PrismMesh.new()
	m.size = size
	_append(m, Transform3D(Basis(Vector3.UP, PI * 0.5), center), color)


func _append(m: Mesh, xf: Transform3D, color: Color) -> void:
	var arr := m.surface_get_arrays(0)
	var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var norms: PackedVector3Array = arr[Mesh.ARRAY_NORMAL]
	var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	var base := _v.size()
	var lin := color.srgb_to_linear()
	for k in verts.size():
		_v.append(xf * verts[k])
		_n.append((xf.basis * norms[k]).normalized())
		_c.append(lin)
	for k in idx:
		_i.append(base + k)


func _commit() -> ArrayMesh:
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = _v
	arr[Mesh.ARRAY_NORMAL] = _n
	arr[Mesh.ARRAY_COLOR] = _c
	arr[Mesh.ARRAY_INDEX] = _i
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return mesh
