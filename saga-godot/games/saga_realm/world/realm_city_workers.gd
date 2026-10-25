extends Node3D

## G-0392 5천하 눈에 보이는 일꾼(에이지 오브 엠파이어 — 구조만) — 유니티 U-0224 RealmWorkers.cs 짝. 보이기만, 수치 안 바꿈.
##   수     밭마다 둘(하나는 성문 ↔ 밭 곡식 짐, 하나는 밭 → 곡창 자루) · 시장마다 하나(성문 ↔ 시장 상자) · 상한 12 · 치안 30 밑이면 절반(적어도 하나).
##          곡창 길은 밭 둘째 일꾼 몫이라 따로 세지 않는다(밭 3·시장 2 → 8).
##   길     성문(앞 담 밖) · 둘레 길(반지름 RING — 밭·시장·곳간 바깥) · 소품 곁: 끝 → 둘레로 곧게 → 둘레를 따라 → 다른 끝. 성벽·망루를 안 뚫는다.
##   몸     코드 도형 대역 — 몸통·머리·삿갓을 정점색 메시 하나로 합치고(그리기 1) 다리 둘을 흔들어 걷는다 · 짐 = 코드 도형(자루·상자).
##          인물 몸(VroidBody.build_pool)은 하나에 메시 24·삼각형 6만이라 여덟이면 성 화면 그리기 288→571·삼각형 22만→47만(예산 350·27만 넘음, 10-25 잼) — 군중 묶음이 오면 다시 잰다.
##          · 갈 땐 빈손, 돌아올 땐 짐(곡창 길은 반대) · 끝에서 LOAD_SEC 쉼.
##   다시   realm_city.gd 가 디오라마를 다시 지을 때 rebuild() — 몸은 수만큼 다시 쓰고 남는 것만 지운다(새기 없음).
## SAGA_CITY_WORKERS=0 이면 아무도 안 선다.

const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")

const MAX := 12
const LOW_SEC := 30
const SPEED := 1.2
const HEIGHT := 0.5   # 디오라마 눈금(담 1.2m·망루 0.36배)에 맞춘 키
const LEG := 0.2      # 다리 길이(엉덩이 높이)
const SWING := 0.55   # 걸음 다리 흔들림(라디안)
const STRIDE := 9.0   # 걸음 빠르기(라디안/초)
const SKIN := Color(0.86, 0.68, 0.52)
const STRAW := Color(0.83, 0.72, 0.42)
const CLOTH := [Color(0.45, 0.52, 0.62), Color(0.58, 0.5, 0.38), Color(0.42, 0.5, 0.36), Color(0.62, 0.6, 0.55), Color(0.5, 0.4, 0.42)]
const LOAD_SEC := 2.5
const RING := 8.0
const GATE := Vector3(0, 0, 4.7)
const ARC_STEP := 0.25
const SACK := Color(0.8, 0.7, 0.45)
const CRATE := Color(0.55, 0.38, 0.22)

var turns := 0   # 끝에 닿아 돌아선 횟수(점검용)
var _men: Array = []   # [{node, legs, t, load, pts, i, dir, wait}]
var _mat: ShaderMaterial = null   # 모든 일꾼이 같이 쓰는 정점색 재질


static func on() -> bool:
	return OS.get_environment("SAGA_CITY_WORKERS") != "0"


## 일꾼 수 — 순수
static func count(farms: int, markets: int, sec: int) -> int:
	if not on():
		return 0
	var n := mini(MAX, farms * 2 + markets)
	if sec < LOW_SEC:
		n = maxi(1, int(n / 2.0))
	return n if farms + markets > 0 else 0


static func _ring_pt(p: Vector3) -> Vector3:
	var d := Vector2(p.x, p.z)
	if d.length() < 0.01:
		d = Vector2(0, 1)
	d = d.normalized() * RING
	return Vector3(d.x, 0, d.y)


## a → b 둘레 길 점들 — 순수
static func path(a: Vector3, b: Vector3) -> Array:
	var pts: Array = [a]
	var ra := _ring_pt(a)
	var rb := _ring_pt(b)
	pts.append(ra)
	var aa := atan2(ra.z, ra.x)
	var ab := atan2(rb.z, rb.x)
	var d := wrapf(ab - aa, -PI, PI)
	var steps := int(absf(d) / ARC_STEP)
	for k in range(1, steps + 1):
		var t := aa + d * float(k) / float(steps + 1)
		pts.append(Vector3(cos(t) * RING, 0, sin(t) * RING))
	pts.append(rb)
	pts.append(b)
	return pts


## 소품 곁(바깥쪽으로 off m)
static func _beside(p: Vector3, off: float) -> Vector3:
	var d := Vector2(p.x, p.z)
	if d.length() < 0.01:
		return p
	d = d.normalized() * (d.length() + off)
	return Vector3(d.x, 0, d.y)


## 길 목록 — 순수. [{kind: farm·granary·market, load: sack·crate, pts}] 앞에서부터 n 개
static func routes(farms: Array, markets: Array, granary: Vector3, n: int) -> Array:
	var all: Array = []
	var g := _beside(granary, 0.9)
	for k in maxi(farms.size(), markets.size()):
		if k < farms.size():
			var f := _beside(farms[k] as Vector3, 0.7)
			all.append({"kind": "farm", "load": "sack", "pts": path(GATE, f)})
		if k < markets.size():
			all.append({"kind": "market", "load": "crate", "pts": path(GATE, _beside(markets[k] as Vector3, 0.8))})
	for k in farms.size():
		all.append({"kind": "granary", "load": "sack", "pts": path(_beside(farms[k] as Vector3, 0.7), g)})
	return all.slice(0, n)


## 다시 세운다 — 세운 일꾼 수
func rebuild(farms: Array, markets: Array, granary: Vector3, sec: int) -> int:
	var list := routes(farms, markets, granary, count(farms.size(), markets.size(), sec))
	while _men.size() > list.size():
		var m: Dictionary = _men.pop_back()
		(m.node as Node3D).queue_free()
	for k in list.size():
		var r: Dictionary = list[k]
		if k >= _men.size():
			_men.append(_make(k))
		var m: Dictionary = _men[k]
		m["pts"] = r.pts
		m["kind"] = r.kind
		m["i"] = k % 3   # 같은 길에서 겹치지 않게 조금 앞에서 시작
		m["dir"] = 1
		m["wait"] = 0.0
		(m.node as Node3D).position = (r.pts as Array)[m.i]
		_set_load(m, String(r["load"]))
	return _men.size()


func _make(k: int) -> Dictionary:
	if _mat == null:
		_mat = WorldCurveMaterial.vertex_color_material(0.0, 0.9)
	var root := Node3D.new()
	root.name = "Worker%d" % k
	add_child(root)
	var cloth: Color = CLOTH[k % CLOTH.size()]
	var torso := CapsuleMesh.new()
	torso.radius = 0.07
	torso.height = 0.24
	torso.radial_segments = 8   # 기본 64 — 0.5m 몸엔 넘친다(삼각형)
	torso.rings = 2
	var head := SphereMesh.new()
	head.radius = 0.055
	head.height = 0.11
	head.radial_segments = 8
	head.rings = 4
	var hat := CylinderMesh.new()
	hat.top_radius = 0.0
	hat.bottom_radius = 0.1
	hat.height = 0.05
	hat.radial_segments = 8
	hat.rings = 0
	var body := MeshInstance3D.new()
	body.name = "Body"
	body.mesh = _merge([[torso, Transform3D(Basis(), Vector3(0, LEG + 0.11, 0)), cloth], [head, Transform3D(Basis(), Vector3(0, LEG + 0.27, 0)), SKIN],
		[hat, Transform3D(Basis(), Vector3(0, LEG + 0.32, 0)), STRAW]])
	body.material_override = _mat
	root.add_child(body)
	var leg_mesh := BoxMesh.new()
	leg_mesh.size = Vector3(0.04, LEG, 0.045)
	var legs: Array = []
	for sx in [-0.035, 0.035]:
		var hip := Node3D.new()
		hip.position = Vector3(sx, LEG, 0)
		var leg := _part(leg_mesh, cloth.darkened(0.35))
		leg.position = Vector3(0, -LEG * 0.5, 0)
		hip.add_child(leg)
		root.add_child(hip)
		legs.append(hip)
	var sack := _part(SphereMesh.new(), SACK)
	(sack.mesh as SphereMesh).radius = 0.08
	(sack.mesh as SphereMesh).height = 0.14
	(sack.mesh as SphereMesh).radial_segments = 8
	(sack.mesh as SphereMesh).rings = 4
	sack.name = "Sack"
	sack.position = Vector3(0, LEG + 0.15, -0.1)
	root.add_child(sack)
	var crate := _part(BoxMesh.new(), CRATE)
	(crate.mesh as BoxMesh).size = Vector3(0.14, 0.11, 0.12)
	crate.name = "Crate"
	crate.position = Vector3(0, LEG + 0.14, -0.1)
	root.add_child(crate)
	return {"node": root, "legs": legs, "t": float(k) * 0.9, "load": "", "pts": [], "i": 0, "dir": 1, "wait": 0.0, "kind": ""}


## 도형 여럿을 정점색 메시 하나로 — [[PrimitiveMesh, Transform3D, Color]]
static func _merge(parts: Array) -> ArrayMesh:
	var verts := PackedVector3Array()
	var norms := PackedVector3Array()
	var cols := PackedColorArray()
	var idx := PackedInt32Array()
	for p: Array in parts:
		var arr: Array = (p[0] as PrimitiveMesh).get_mesh_arrays()
		var xf: Transform3D = p[1]
		var base := verts.size()
		var pv: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var pn: PackedVector3Array = arr[Mesh.ARRAY_NORMAL]
		for i in pv.size():
			verts.append(xf * pv[i])
			norms.append((xf.basis * pn[i]).normalized())
			cols.append(p[2])
		for i: int in (arr[Mesh.ARRAY_INDEX] as PackedInt32Array):
			idx.append(base + i)
	var out: Array = []
	out.resize(Mesh.ARRAY_MAX)
	out[Mesh.ARRAY_VERTEX] = verts
	out[Mesh.ARRAY_NORMAL] = norms
	out[Mesh.ARRAY_COLOR] = cols
	out[Mesh.ARRAY_INDEX] = idx
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, out)
	return m


func _part(m: Mesh, col: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF   # 그림자는 몸통만(그리기 수)
	mi.material_override = WorldCurveMaterial.vertex_color_material(0.0, 0.9, col)
	return mi


func _set_load(m: Dictionary, load_kind: String) -> void:
	m["load"] = load_kind
	_show_load(m)


## 짐은 돌아올 때(dir −1)만 — 곡창 길은 갈 때(밭에서 곡창으로)
func _show_load(m: Dictionary) -> void:
	var n := m.node as Node3D
	var carry := (int(m.dir) < 0) != (String(m.kind) == "granary")
	(n.get_node("Sack") as Node3D).visible = carry and String(m["load"]) == "sack"
	(n.get_node("Crate") as Node3D).visible = carry and String(m["load"]) == "crate"


func _process(delta: float) -> void:
	for m: Dictionary in _men:
		var pts: Array = m.pts
		if pts.size() < 2:
			continue
		var n := m.node as Node3D
		if float(m.wait) > 0.0:
			m["wait"] = float(m.wait) - delta
			_legs(m, 0.0)
			continue
		var goal: Vector3 = pts[int(m.i)]
		var d := goal - n.position
		var step := SPEED * delta
		if d.length() <= step:
			n.position = goal
			var ni := int(m.i) + int(m.dir)
			if ni < 0 or ni >= pts.size():
				m["dir"] = -int(m.dir)
				turns += 1
				m["wait"] = LOAD_SEC
				_show_load(m)
				ni = int(m.i) + int(m.dir)
			m["i"] = ni
			continue
		n.position += d.normalized() * step
		n.rotation.y = lerp_angle(n.rotation.y, atan2(d.x, d.z), minf(1.0, delta * 10.0))
		m["t"] = float(m.t) + delta * STRIDE
		_legs(m, sin(float(m.t)) * SWING)


## 다리 — a 만큼 앞뒤로(서 있으면 0)
func _legs(m: Dictionary, a: float) -> void:
	var legs: Array = m.legs
	(legs[0] as Node3D).rotation.x = a
	(legs[1] as Node3D).rotation.x = -a


## 점검용 — 짐 진 일꾼 수
func carrying() -> int:
	var c := 0
	for m: Dictionary in _men:
		var n := m.node as Node3D
		c += 1 if ((n.get_node("Sack") as Node3D).visible or (n.get_node("Crate") as Node3D).visible) else 0
	return c


func men() -> int:
	return _men.size()
