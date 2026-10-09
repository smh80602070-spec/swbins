extends RefCounted

## G-0130 — 떠 있는 바위섬(구름섬·갈림길 끝·하늘 항로 돌섬·먹구름 눈)의 밑동. 예전엔 14각 원뿔 하나·단색이라
## 밑에서 올려다보면 매끈한 역피라미드 판으로 읽혔다. 같은 윗반지름·높이로 울퉁불퉁한 바위 뿔(모난 면)을 짓고,
## 꼭짓점 색으로 윗띠 흙빛·바위 층 줄무늬·끝으로 갈수록 어둡게, 윗띠에서 늘어진 뿌리와 끝 밑에 뜬 돌 몇 개를 더한다.
## 전부 메시 한 벌·재질 하나라 그리기 수는 예전 원뿔과 같다(1). 충돌은 부르는 쪽이 원래 CylinderMesh 로 따로 만든다.
## 모양은 seed 로 결정적(섬마다 다르지만 매번 같다).

const RINGS := 7 # 윗링(원판과 맞물림) ~ 끝 바로 위 링
const SEG := 20
const SOIL := Color(0.4, 0.31, 0.21)
const ROOT := Color(0.27, 0.19, 0.12)
const ROCK_WARM := Color(0.56, 0.45, 0.35)


## cone = 예전 보이던 뿔(top_radius·bottom_radius·height 만 읽는다). pos = 예전 MeshInstance3D 자리(뿔 가운데).
static func add(parent: Node3D, cone: CylinderMesh, color: Color, pos: Vector3, seed: int) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = build(cone.top_radius, cone.bottom_radius, cone.height, color, seed)
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.roughness = 0.95
	mi.material_override = m
	mi.position = pos
	parent.add_child(mi)
	return mi


static func build(top_r: float, tip_r: float, h: float, color: Color, seed: int) -> ArrayMesh:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var rock := color.lerp(ROCK_WARM, 0.6) # 밑면은 하늘빛(파랑)만 받으니 바탕을 흙빛 쪽으로 — 얼음처럼 푸르게 뜨지 않게
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	## 링 꼭짓점 — 윗링은 원판 밑면(반지름 top_r)과 딱 맞게 흔들지 않는다.
	var rings: Array = []
	for i in RINGS:
		var t := float(i) / float(RINGS)
		var y := h * 0.5 - t * h
		var r := lerpf(top_r, tip_r, pow(t, 1.35))
		var ring: Array = []
		var twist := rng.randf_range(-0.12, 0.12)
		for j in SEG:
			var a := TAU * float(j) / float(SEG) + (twist if i > 0 else 0.0)
			var rr := r if i == 0 else r * rng.randf_range(0.82, 1.05)
			var yy := y if i == 0 else y + rng.randf_range(-0.07, 0.07) * h / float(RINGS) * 2.0
			ring.append(Vector3(cos(a) * rr, yy, sin(a) * rr))
		rings.append(ring)
	var tip := Vector3(rng.randf_range(-1.0, 1.0) * tip_r, -h * 0.5 - rng.randf_range(0.0, 0.8), rng.randf_range(-1.0, 1.0) * tip_r)
	## 면 — 링 사이 사각형을 세모 둘로, 마지막 링은 끝 한 점으로.
	for i in RINGS:
		for j in SEG:
			var a: Vector3 = rings[i][j]
			var b: Vector3 = rings[i][(j + 1) % SEG]
			if i == RINGS - 1:
				_tri(st, a, b, tip, _rock_col(rock, 1.0, i, rng))
			else:
				var c: Vector3 = rings[i + 1][j]
				var d: Vector3 = rings[i + 1][(j + 1) % SEG]
				var col := SOIL * rng.randf_range(0.9, 1.08) if i == 0 else _rock_col(rock, float(i) / float(RINGS), i, rng)
				col.a = 1.0
				_tri(st, a, b, d, col)
				_tri(st, a, d, c, col)
	## 늘어진 뿌리 — 윗띠 가장자리에서 아래로, 끝이 살짝 바깥으로 휜 가는 네모 기둥(세 마디).
	var roots := int(clampf(top_r * 0.55, 5.0, 10.0))
	for k in roots:
		var ang := TAU * (float(k) + rng.randf_range(-0.3, 0.3)) / float(roots)
		var out := Vector3(cos(ang), 0.0, sin(ang))
		var start := out * top_r * rng.randf_range(0.93, 0.99) + Vector3.UP * (h * 0.5 - 0.25)
		var length := rng.randf_range(2.6, 6.0)
		var w := rng.randf_range(0.24, 0.38)
		var prev := start
		for s in 3:
			var f := float(s + 1) / 3.0
			var nxt := start + Vector3.DOWN * length * f + out * (0.25 * f * f + rng.randf_range(-0.1, 0.1))
			_prism(st, prev, nxt, w * (1.0 - 0.3 * float(s)), w * (1.0 - 0.3 * float(s + 1)), ROOT * rng.randf_range(0.85, 1.15))
			prev = nxt
	## 끝 밑에 뜬 돌 — 떨어져 나온 조각 두셋(보기만).
	var chunks := 2 + rng.randi_range(0, 1)
	for k in chunks:
		var ang2 := rng.randf_range(0.0, TAU)
		var c := tip + Vector3(cos(ang2), 0.0, sin(ang2)) * rng.randf_range(1.0, 2.6) + Vector3.DOWN * rng.randf_range(1.6, 3.8)
		_chunk(st, c, rng.randf_range(0.45, 0.9), _rock_col(rock, 0.9, k, rng), rng)
	return st.commit()


## 바위 층 — 링마다 밝기 줄무늬, 아래로 갈수록 어둡게, 면마다 조금씩 다르게.
static func _rock_col(rock: Color, t: float, ring: int, rng: RandomNumberGenerator) -> Color:
	var band: float = [1.0, 0.84, 1.07, 0.9, 1.0, 0.82, 0.95][ring % 7]
	var c := rock * band * lerpf(1.05, 0.68, t) * rng.randf_range(0.93, 1.07)
	c.a = 1.0
	return c


## 세모 하나 — 뿔 바깥(축에서 멀어지는 쪽·아래)을 앞면으로, 모난 면(면 법선). Godot 앞면 = 시계 방향.
static func _tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, col: Color, center := Vector3.INF) -> void:
	var n := (b - a).cross(c - a)
	if n.length_squared() < 1e-10:
		return
	n = n.normalized()
	var mid := (a + b + c) / 3.0
	var hint := mid - center if center != Vector3.INF else Vector3(mid.x, 0.0, mid.z)
	if n.dot(hint) < 0.0:
		n = -n
		var tmp := b
		b = c
		c = tmp
	col.a = 1.0
	st.set_color(col)
	st.set_normal(n)
	st.add_vertex(a)
	st.add_vertex(c)
	st.add_vertex(b)


## 뿌리 한 마디 — p0 에서 p1 까지 네모 기둥(굵기 w0 → w1).
static func _prism(st: SurfaceTool, p0: Vector3, p1: Vector3, w0: float, w1: float, col: Color) -> void:
	col.a = 1.0
	var axis := (p1 - p0).normalized()
	var u := axis.cross(Vector3.FORWARD if absf(axis.z) < 0.9 else Vector3.RIGHT).normalized()
	var v := axis.cross(u).normalized()
	var off := [u + v, u - v, -u - v, -u + v]
	for i in 4:
		var o0: Vector3 = off[i] * 0.5
		var o1: Vector3 = off[(i + 1) % 4] * 0.5
		var a := p0 + o0 * w0
		var b := p0 + o1 * w0
		var c := p1 + o0 * w1
		var d := p1 + o1 * w1
		var mid := (p0 + p1) * 0.5
		_tri(st, a, b, d, col, mid)
		_tri(st, a, d, c, col, mid)


## 뜬 돌 하나 — 꼭짓점을 흔든 팔면체.
static func _chunk(st: SurfaceTool, c: Vector3, s: float, col: Color, rng: RandomNumberGenerator) -> void:
	var p: Array = []
	for d in [Vector3.UP, Vector3.DOWN, Vector3.RIGHT, Vector3.LEFT, Vector3.FORWARD, Vector3.BACK]:
		var k := s * rng.randf_range(0.7, 1.2) * (0.7 if d.y > 0.0 else 1.0)
		p.append(c + (d as Vector3) * k)
	var ring := [2, 4, 3, 5]
	for i in 4:
		var a: Vector3 = p[ring[i]]
		var b: Vector3 = p[ring[(i + 1) % 4]]
		_tri(st, p[0], a, b, col, c)
		_tri(st, p[1], a, b, col * 0.8, c)
