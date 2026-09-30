extends RefCounted

## PLAN 106장 ④ — 짐승·신수·들판 적 몸을 코드로 그린다(짐승 GLB 가 저장소에 없다 — CC0 짐승 팩 미확보).
## 원작 신수 디자인을 베끼지 않고 전설 동물의 일반 모양(세 발 까마귀·아홉 꼬리 여우·거북+뱀 등)만 쓴다.
##
## 2026-09-29 "그래픽 먼저" — 캡슐·공 서른 개를 이어 붙인 모양(보라 캡슐 살쾡이)을 버리고 다시 지었다:
##   · 몸통·목·머리·주둥이를 **한 줄기 관**(척추 곡선 Catmull-Rom + 마디마다 굵기)으로 — 이음매 없는 짐승 실루엣.
##   · 빛깔은 정점색(배 밝게·등 어둡게·주둥이·양말·줄무늬·꼬리 끝), 알파 0 은 **발광**(원소 눈·번개 줄무늬·얼음 가시).
##   · 다리·꼬리·날개·팔은 관절 축(Node3D)에 따로 달고 AnimationPlayer "idle"/"walk" 를 코드로 만든다
##     (field_enemy._play·story_quest._thief_anim 이 이름으로 부른다).
##   · 한 짐승의 부품은 재질 **하나**(cel_vertex_color + 외곽선)를 나눠 써 combat_feel 피격 번쩍임이 온몸에 걸린다.
##
##   build(kind, colors, opts) → Node3D "Creature"(앞 = +Z, 발밑 = y 0) / "Body"(첫 자식이 몸 메시) / "AnimationPlayer"
##   kind: beast · cat · wolf · fox9 · bear · horse · bird · crow3 · serpent · turtle · goblin
##   opts: element(원소 id — 눈·장식이 그 빛으로 빛남) · enemy(true 면 사나운 눈·송곳니) · mane · stripes · horn · snake
## 키 맞춤(_fit)은 지은 몸의 실제 높이(meta natural_h)로 한다.

const CEL_SHADER := preload("res://saga_core/shaders/cel_toon.gdshader")
const OUTLINE_SHADER := preload("res://saga_core/shaders/cel_outline.gdshader")
const VC_SHADER := preload("res://saga_core/shaders/cel_vertex_color.gdshader")

## 신수 id → [모양, 몸색, 둘째색, 셋째색, (선택) opts]
const PET_LOOKS := {
	"pt_samjogo": ["crow3", Color(0.12, 0.11, 0.14), Color(0.95, 0.75, 0.25), Color(0.9, 0.2, 0.15)],
	"pt_haetae": ["beast", Color(0.78, 0.84, 0.8), Color(0.25, 0.6, 0.55), Color(0.95, 0.8, 0.3), {"mane": true, "horn": true}],
	"pt_cheongryong": ["serpent", Color(0.2, 0.55, 0.6), Color(0.85, 0.9, 0.6), Color(0.95, 0.85, 0.4), {"dragon": true}],
	"pt_baekho": ["beast", Color(0.95, 0.95, 0.92), Color(0.15, 0.15, 0.18), Color(0.4, 0.75, 0.95), {"mane": false, "stripes": true}],
	"pt_jujak": ["bird", Color(0.9, 0.25, 0.15), Color(1.0, 0.7, 0.2), Color(1.0, 0.95, 0.6)],
	"pt_hyeonmu": ["turtle", Color(0.2, 0.25, 0.28), Color(0.3, 0.45, 0.35), Color(0.55, 0.7, 0.6), {"snake": true}],
	"pt_gumiho": ["fox9", Color(0.98, 0.9, 0.72), Color(1.0, 1.0, 1.0), Color(0.95, 0.45, 0.3)],
	"pt_dokkaebi": ["goblin", Color(0.85, 0.3, 0.25), Color(0.25, 0.35, 0.7), Color(0.95, 0.85, 0.5)],
	"pt_bulgasari": ["bear", Color(0.45, 0.48, 0.52), Color(0.25, 0.26, 0.3), Color(0.9, 0.55, 0.2), {"plates": true}],
	"pt_jeoktoma": ["horse", Color(0.7, 0.18, 0.12), Color(1.0, 0.55, 0.15), Color(0.2, 0.12, 0.1)],
	"pt_jeolyeong": ["horse", Color(0.85, 0.88, 0.95), Color(0.45, 0.7, 1.0), Color(0.3, 0.32, 0.4)],
}

## 네발짐승 치수(몸 단위 — _fit 이 목표 키로 늘린다).
const QUAD := {
	"beast": {"leg_h": 0.5, "L": 1.0, "rw": 0.27, "rh": 0.29, "neck_up": 0.36, "neck_fwd": 0.12, "head_r": 0.26,
		"snout": 0.1, "snout_r": 0.13, "ear": "round", "tail": "curl", "mane": true, "leg_r": 0.08, "paw": 0.1},
	"cat": {"leg_h": 0.46, "L": 1.1, "rw": 0.2, "rh": 0.23, "neck_up": 0.3, "neck_fwd": 0.1, "head_r": 0.2,
		"snout": 0.05, "snout_r": 0.1, "ear": "tuft", "tail": "thin", "leg_r": 0.055, "paw": 0.07, "stripes": true},
	"wolf": {"leg_h": 0.55, "L": 1.05, "rw": 0.22, "rh": 0.27, "neck_up": 0.28, "neck_fwd": 0.14, "head_r": 0.19,
		"snout": 0.2, "snout_r": 0.08, "ear": "point", "tail": "bush", "ruff": true, "leg_r": 0.06, "paw": 0.07},
	"fox9": {"leg_h": 0.4, "L": 0.92, "rw": 0.19, "rh": 0.21, "neck_up": 0.3, "neck_fwd": 0.1, "head_r": 0.18,
		"snout": 0.17, "snout_r": 0.07, "ear": "big", "tail": "nine", "ruff": true, "leg_r": 0.05, "paw": 0.06},
	"bear": {"leg_h": 0.42, "L": 1.15, "rw": 0.42, "rh": 0.42, "neck_up": 0.08, "neck_fwd": 0.14, "head_r": 0.28,
		"snout": 0.12, "snout_r": 0.13, "ear": "round", "tail": "stub", "leg_r": 0.12, "paw": 0.14, "hump": 0.12},
}

## 모양 이름 → 옛 기준 키(meta 가 없는 노드에 _fit 을 부를 때만).
const NATURAL := {"beast": 1.25, "cat": 1.1, "wolf": 1.2, "bear": 1.35, "fox9": 1.1, "horse": 1.9, "bird": 1.2,
	"crow3": 1.1, "serpent": 1.6, "turtle": 1.0, "goblin": 1.8}

const DARK := Color(0.07, 0.06, 0.08)
const WHITE := Color(0.97, 0.96, 0.93)


static func build_pet(pet_id: String, height_m: float) -> Node3D:
	var look: Array = PET_LOOKS.get(pet_id, ["beast", Color(0.8, 0.7, 0.5), Color(0.5, 0.4, 0.3), Color(0.9, 0.8, 0.4)])
	var opts: Dictionary = look[4] if look.size() > 4 else {}
	var root := build(look[0], [look[1], look[2], look[3]], opts)
	_fit(root, look[0], height_m)
	return root


static func build(kind: String, colors: Array, opts: Dictionary = {}) -> Node3D:
	var root := Node3D.new()
	root.name = "Creature"
	var body := Node3D.new()
	body.name = "Body"
	root.add_child(body)
	var el := String(opts.get("element", ""))
	var ctx := {
		"root": root, "body": body, "mat": _vc_mat(0.012), "top": 0.0, "opts": opts,
		"c0": colors[0], "c1": colors[1], "c2": colors[2], "el": el,
		"fierce": bool(opts.get("enemy", false)) or el != "",
		"rig": {"mode": "quad", "legs": [], "arms": [], "tails": [], "wings": []},
	}
	match kind:
		"beast", "cat", "wolf", "fox9", "bear":
			_quad(ctx, kind)
		"horse":
			_horse(ctx)
		"bird", "crow3":
			_bird(ctx, kind)
		"serpent":
			_serpent(ctx)
		"turtle":
			_turtle(ctx)
		"goblin":
			_goblin(ctx)
		_:
			_quad(ctx, "beast")
	root.set_meta("natural_h", float(ctx.top))
	_animate(root, ctx.rig)
	return root


## 목표 키에 맞춘 배율. 지은 몸의 실제 높이(natural_h)를 쓴다.
static func _fit(root: Node3D, kind: String, height_m: float) -> void:
	var nat := float(root.get_meta("natural_h", NATURAL.get(kind, 1.3)))
	root.scale = Vector3.ONE * (height_m / maxf(nat, 0.1))


## 움직임을 멈춘다(멈춘 시간 속 짐승 등 — region10_fork).
static func freeze(root: Node3D) -> void:
	var ap := root.get_node_or_null("AnimationPlayer") as AnimationPlayer
	if ap:
		ap.autoplay = ""
		ap.stop()

# ================================================================ 메시 그릇

## 부품 하나(메시 하나). tube/blob 을 쌓고 commit 으로 ArrayMesh.
class Part:
	var v := PackedVector3Array()
	var n := PackedVector3Array()
	var c := PackedColorArray()
	var ix := PackedInt32Array()
	var top := 0.0

	static func cr3(p: Array, s: int, t: float) -> Vector3:
		var m := p.size()
		var p0: Vector3 = p[maxi(s - 1, 0)]
		var p1: Vector3 = p[s]
		var p2: Vector3 = p[mini(s + 1, m - 1)]
		var p3: Vector3 = p[mini(s + 2, m - 1)]
		var t2 := t * t
		return 0.5 * ((2.0 * p1) + (p2 - p0) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 + (3.0 * p1 - p0 - 3.0 * p2 + p3) * t2 * t)

	static func cr2(p: Array, s: int, t: float) -> Vector2:
		var m := p.size()
		var p0: Vector2 = p[maxi(s - 1, 0)]
		var p1: Vector2 = p[s]
		var p2: Vector2 = p[mini(s + 1, m - 1)]
		var p3: Vector2 = p[mini(s + 2, m - 1)]
		var t2 := t * t
		var r := 0.5 * ((2.0 * p1) + (p2 - p0) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 + (3.0 * p1 - p0 - 3.0 * p2 + p3) * t2 * t)
		return Vector2(maxf(r.x, 0.002), maxf(r.y, 0.002))

	## 척추 ctrl(Vector3 여럿)을 따라 굵기 radii(float 또는 Vector2 = 옆·위 반지름)의 관. cap 은 끝 둥글기(0 = 뚫림).
	## hint 는 첫 마디의 "위" — Vector2 반지름의 y 가 이쪽을 향한다(귀·날개처럼 납작한 관의 방향).
	func tube(ctrl: Array, radii: Array, paint: Callable, segs := 12, per := 4, cap0 := 1.0, cap1 := 1.0, hint := Vector3.UP, flat := false) -> void:
		var R: Array = []
		for r in radii:
			R.append(r if r is Vector2 else Vector2(float(r), float(r)))
		var m := ctrl.size()
		var pts: Array = []
		var rr: Array = []
		for s in m - 1:
			for j in per:
				var t := float(j) / float(per)
				pts.append(cr3(ctrl, s, t))
				rr.append(cr2(R, s, t))
		pts.append(ctrl[m - 1])
		rr.append(R[m - 1])
		var cnt := pts.size()
		var tan: Array = []
		for k in cnt:
			var d: Vector3 = pts[mini(k + 1, cnt - 1)] - pts[maxi(k - 1, 0)]
			tan.append(d.normalized() if d.length_squared() > 1e-12 else Vector3.FORWARD)
		var sid: Array = []
		var upv: Array = []
		var up := hint
		for k in cnt:
			var t3: Vector3 = tan[k]
			var s3 := up.cross(t3)
			if s3.length_squared() < 1e-6:
				s3 = Vector3.RIGHT if absf(t3.x) < 0.9 else Vector3.BACK
				s3 = (s3 - t3 * s3.dot(t3))
			s3 = s3.normalized()
			up = t3.cross(s3).normalized()
			sid.append(s3)
			upv.append(up)
		var cen: Array = []
		var cs: Array = []
		var cu: Array = []
		var cr: Array = []
		var tip0 = null
		var tip1 = null
		if cap0 > 0.0:
			var r0: Vector2 = rr[0]
			var l0 := (r0.x + r0.y) * 0.5 * cap0
			tip0 = pts[0] - tan[0] * l0
			for j in [3, 2, 1]:
				var a := PI * 0.5 * float(j) / 4.0
				cen.append(pts[0] - tan[0] * l0 * sin(a))
				cs.append(sid[0])
				cu.append(upv[0])
				cr.append(r0 * cos(a))
		for k in cnt:
			cen.append(pts[k])
			cs.append(sid[k])
			cu.append(upv[k])
			cr.append(rr[k])
		if cap1 > 0.0:
			var r1: Vector2 = rr[cnt - 1]
			var l1 := (r1.x + r1.y) * 0.5 * cap1
			tip1 = pts[cnt - 1] + tan[cnt - 1] * l1
			for j in [1, 2, 3]:
				var a := PI * 0.5 * float(j) / 4.0
				cen.append(pts[cnt - 1] + tan[cnt - 1] * l1 * sin(a))
				cs.append(sid[cnt - 1])
				cu.append(upv[cnt - 1])
				cr.append(r1 * cos(a))
		skin(cen, cs, cu, cr, segs, tip0, tip1, paint, flat)

	## 타원체(반지름 r, 방향 basis — z 축이 긴 축 방향).
	func blob(center: Vector3, r: Vector3, basis: Basis, paint: Callable, segs := 12, rings := 8, flat := false) -> void:
		var cen: Array = []
		var cs: Array = []
		var cu: Array = []
		var cr: Array = []
		for k in range(1, rings):
			var phi := PI * float(k) / float(rings)
			cen.append(center + basis.z * (-cos(phi) * r.z))
			cs.append(basis.x)
			cu.append(basis.y)
			cr.append(Vector2(r.x, r.y) * sin(phi))
		skin(cen, cs, cu, cr, segs, center - basis.z * r.z, center + basis.z * r.z, paint, flat)

	## 가시·뿔 — base 에서 tip 으로 가늘어지는 원뿔(segs 적으면 각진 결정).
	func spike(base: Vector3, tip: Vector3, r: float, paint: Callable, segs := 6, flat := false) -> void:
		tube([base, tip], [r, 0.004], paint, segs, 2, 0.4, 0.0, Vector3.UP, flat)

	func skin(cen: Array, sid: Array, upv: Array, rad: Array, segs: int, tip0, tip1, paint: Callable, flat: bool) -> void:
		var rings := cen.size()
		var pos := PackedVector3Array()
		var out := PackedVector3Array()
		for r in rings:
			var s3: Vector3 = sid[r]
			var u3: Vector3 = upv[r]
			var rv: Vector2 = rad[r]
			for k in segs:
				var a := TAU * float(k) / float(segs)
				var d := s3 * (cos(a) * rv.x) + u3 * (sin(a) * rv.y)
				pos.append(cen[r] + d)
				out.append(s3 * cos(a) + u3 * sin(a))
		var tris := PackedInt32Array()
		for r in rings - 1:
			for k in segs:
				var a0 := r * segs + k
				var a1 := r * segs + (k + 1) % segs
				var b0 := (r + 1) * segs + k
				var b1 := (r + 1) * segs + (k + 1) % segs
				_tri(tris, a0, a1, b1)
				_tri(tris, a0, b1, b0)
		if tip0 != null:
			var t0 := pos.size()
			pos.append(tip0)
			out.append((tip0 - cen[0]).normalized())
			for k in segs:
				_tri(tris, t0, k, (k + 1) % segs)
		if tip1 != null:
			var t1 := pos.size()
			var last := (rings - 1) * segs
			pos.append(tip1)
			out.append((tip1 - cen[rings - 1]).normalized())
			for k in segs:
				_tri(tris, t1, last + k, last + (k + 1) % segs)
		_emit(pos, out, tris, paint, flat)

	static func _tri(t: PackedInt32Array, a: int, b: int, c2: int) -> void:
		t.append(a)
		t.append(b)
		t.append(c2)

	## 삼각형 감김을 바깥 기준으로 맞추고(Godot 앞면 = 시계 방향) 부드러운 법선을 모은다.
	func _emit(pos: PackedVector3Array, out: PackedVector3Array, tris: PackedInt32Array, paint: Callable, flat: bool) -> void:
		var acc := PackedVector3Array()
		acc.resize(pos.size())
		var ord := PackedInt32Array()
		var t := 0
		while t < tris.size():
			var a := tris[t]
			var b := tris[t + 1]
			var c3 := tris[t + 2]
			var fn := (pos[b] - pos[a]).cross(pos[c3] - pos[a])
			if fn.dot(out[a] + out[b] + out[c3]) > 0.0:
				ord.append(a)
				ord.append(c3)
				ord.append(b)
			else:
				ord.append(a)
				ord.append(b)
				ord.append(c3)
				fn = -fn
			acc[a] += fn
			acc[b] += fn
			acc[c3] += fn
			t += 3
		if flat:
			var q := 0
			while q < ord.size():
				var p0 := pos[ord[q]]
				var p1 := pos[ord[q + 1]]
				var p2 := pos[ord[q + 2]]
				var fnn := -((p1 - p0).cross(p2 - p0)).normalized()
				var col := _lin(paint.call((p0 + p1 + p2) / 3.0, fnn))
				for p3 in [p0, p1, p2]:
					ix.append(v.size())
					v.append(p3)
					n.append(fnn)
					c.append(col)
					top = maxf(top, p3.y)
				q += 3
			return
		var base := v.size()
		for k in pos.size():
			var nn := acc[k].normalized() if acc[k].length_squared() > 1e-14 else out[k].normalized()
			v.append(pos[k])
			n.append(nn)
			c.append(_lin(paint.call(pos[k], nn)))
			top = maxf(top, pos[k].y)
		for k in ord:
			ix.append(base + k)

	static func _lin(col: Color) -> Color:
		var l := col.srgb_to_linear()
		l.a = col.a
		return l

	func commit() -> ArrayMesh:
		var arr := []
		arr.resize(Mesh.ARRAY_MAX)
		arr[Mesh.ARRAY_VERTEX] = v
		arr[Mesh.ARRAY_NORMAL] = n
		arr[Mesh.ARRAY_COLOR] = c
		arr[Mesh.ARRAY_INDEX] = ix
		var mesh := ArrayMesh.new()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		return mesh

# ================================================================ 칠하기

static func _solid(col: Color) -> Callable:
	return func(_p: Vector3, _n: Vector3) -> Color: return col

## 발광색(알파 0 = 셰이더가 EMISSION 으로 빛낸다). amount 1 = 다 빛남.
static func _glow(col: Color, amount := 1.0) -> Color:
	return Color(col.r, col.g, col.b, 1.0 - amount)

## 털: 배·턱 밑 밝게, 등 약간 어둡게, 주둥이 밝게, 붓 자국 같은 얼룩, (선택) 줄무늬.
static func _fur(fur: Color, belly: Color, muzzle_z := 99.0, stripe_on := false, stripe := Color.BLACK, z0 := -9.0, z1 := 9.0) -> Callable:
	return func(p: Vector3, nn: Vector3) -> Color:
		var col := fur
		col = col.lerp(belly, clampf((-nn.y - 0.1) * 1.8, 0.0, 1.0) * 0.85)
		if p.z > muzzle_z:
			col = col.lerp(belly, clampf((p.z - muzzle_z) * 5.0, 0.0, 0.7))
		col = col.darkened(clampf(nn.y, 0.0, 1.0) * 0.1)
		var w := sin(p.x * 11.0 + sin(p.z * 7.0) * 1.7) * sin(p.z * 6.0 + p.y * 8.0)
		col = col.lightened(w * 0.05) if w > 0.0 else col.darkened(-w * 0.06)
		if stripe_on and nn.y > -0.4 and p.z > z0 and p.z < z1:
			var st := sin(p.z * 20.0 + sin(p.y * 16.0) * 1.1 + absf(p.x) * 3.0)
			col = col.lerp(stripe, clampf((st - 0.5) * 4.0, 0.0, 1.0))
		return col

## 아래로 갈수록 other 로(다리 양말·발굽 위).
static func _socks(fur: Color, sock: Color, y0: float, y1: float) -> Callable:
	return func(p: Vector3, nn: Vector3) -> Color:
		var col := fur.darkened(clampf(nn.y, 0.0, 1.0) * 0.08)
		return col.lerp(sock, clampf((y0 - p.y) / maxf(y0 - y1, 0.01), 0.0, 1.0))

## 뿌리(원점)에서 멀어질수록 tip 색으로(꼬리 끝·깃 끝).
static func _toward(base: Color, tip: Color, d0: float, d1: float, origin := Vector3.ZERO) -> Callable:
	return func(p: Vector3, nn: Vector3) -> Color:
		var col := base.darkened(clampf(nn.y, 0.0, 1.0) * 0.06)
		return col.lerp(tip, clampf(((p - origin).length() - d0) / maxf(d1 - d0, 0.01), 0.0, 1.0))

# ================================================================ 조립

static func _vc_mat(outline: float) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = VC_SHADER
	var o := ShaderMaterial.new()
	o.shader = OUTLINE_SHADER
	o.set_shader_parameter("thickness", outline)
	m.next_pass = o
	return m

## 부품을 노드로. name 이 비면 Body 에 바로(몸 메시 — 가장 먼저 붙여야 combat_feel 이 첫 메시로 잡는다).
static func _attach(ctx: Dictionary, part: Part, name: String, at := Vector3.ZERO, rot := Vector3.ZERO, host: Node3D = null) -> Node3D:
	var parent: Node3D = host if host != null else ctx.body
	var pivot := parent
	if name != "":
		pivot = Node3D.new()
		pivot.name = name
		pivot.position = at
		pivot.rotation = rot
		parent.add_child(pivot)
	var mi := MeshInstance3D.new()
	mi.name = "Mesh"
	mi.mesh = part.commit()
	mi.set_surface_override_material(0, ctx.mat)
	pivot.add_child(mi)
	var base_y := at.y + (parent.position.y if host != null else 0.0)
	ctx.top = maxf(float(ctx.top), base_y + part.top)
	return pivot

## dir 을 z 축으로 하는 기저(roll 만큼 비튼다).
static func _look(dir: Vector3, roll := 0.0) -> Basis:
	var z := dir.normalized()
	var up := Vector3.UP if absf(z.y) < 0.95 else Vector3.BACK
	var x := up.cross(z).normalized()
	var y := z.cross(x)
	var b := Basis(x, y, z)
	if roll != 0.0:
		b = Basis(z, roll) * b
	return b

## 눈 한 쌍 — 사나우면(적) 빛나는 눈에 세로 동공·눈초리를 치켜 올림, 순하면 까만 눈에 흰 반짝임.
static func _eyes(ctx: Dictionary, part: Part, head: Vector3, hr: float, spread := 0.52, lift := 0.3, size := 1.0) -> void:
	var eye: Color = ctx.c2
	for sx in [-1.0, 1.0]:
		var s: float = sx
		var d := Vector3(s * spread, lift, 0.8).normalized()
		var ec := head + d * hr * 0.88
		if ctx.fierce:
			var b := _look(d, -s * 0.4)
			var g := 1.0 if ctx.el != "" else 0.55
			part.blob(ec, Vector3(0.24, 0.15, 0.1) * hr * size, b, _solid(_glow(eye, g)), 10, 6)
			part.blob(ec + d * hr * 0.075 * size, Vector3(0.045, 0.13, 0.04) * hr * size, b, _solid(DARK), 6, 4)
		else:
			var b2 := _look(d)
			part.blob(ec, Vector3(0.19, 0.22, 0.1) * hr * size, b2, _solid(DARK), 10, 6)
			part.blob(ec + d * hr * 0.08 * size + b2.y * hr * 0.07 * size - b2.x * s * hr * 0.05 * size,
				Vector3.ONE * hr * 0.05 * size, b2, _solid(_glow(WHITE, 0.4)), 6, 4)

## 원소 장식 — 등줄기(pts 위 점들, 위쪽 방향 up)에 원소마다 다른 것을 단다.
static func _crest(ctx: Dictionary, part: Part, pts: Array, up: Vector3, size: float) -> void:
	var el: String = ctx.el
	var c1: Color = ctx.c1
	var c2: Color = ctx.c2
	var k := 0
	for p in pts:
		var at: Vector3 = p
		var tilt := Vector3(0.0, 0.0, -0.35)
		match el:
			"ice":
				var h := size * (0.9 + 0.5 * float(k % 2))
				part.spike(at, at + (up + tilt).normalized() * h, size * 0.28, _solid(_glow(c1.lerp(WHITE, 0.3), 0.55)), 4, true)
				part.spike(at + Vector3(size * 0.25, 0, 0), at + Vector3(size * 0.55, 0, 0) + (up + tilt).normalized() * h * 0.6, size * 0.16, _solid(_glow(c2, 0.7)), 4, true)
			"rock":
				var b := _look(up + Vector3(0.3 * float(k % 2) - 0.15, 0, -0.4), float(k) * 1.3)
				part.blob(at + up * size * 0.15, Vector3(0.75, 0.5, 0.95) * size, b, _solid(c1.darkened(0.35).lerp(Color(0.45, 0.4, 0.36), 0.5)), 5, 3, true)
				part.spike(at + up * size * 0.4, at + (up + tilt).normalized() * size * 1.1, size * 0.18, _solid(_glow(c2, 0.85)), 4, true)
			"fire":
				part.tube([at, at + (up + tilt * 0.5) * size * 0.6, at + (up + tilt) * size * 1.2], [size * 0.3, size * 0.2, 0.004],
					_toward(_glow(c1.lerp(Color(1.0, 0.4, 0.1), 0.5), 0.6), _glow(c2, 1.0), 0.0, size * 1.1, at), 7, 3, 0.4, 0.0)
			"grass":
				part.tube([at, at + (up * 0.6 + tilt + Vector3(0.2 * (1.0 if k % 2 == 0 else -1.0), 0, 0)) * size, at + (up * 0.4 + tilt * 2.2) * size],
					[Vector2(size * 0.1, size * 0.03), Vector2(size * 0.32, size * 0.05), Vector2(0.004, 0.004)],
					_toward((ctx.c0 as Color).darkened(0.4), c1.lightened(0.15), 0.0, size, at), 6, 3, 0.4, 0.0, Vector3.BACK)
			"wind":
				part.tube([at, at + (up * 0.5 + tilt * 1.6) * size, at + (up * 0.2 + tilt * 3.0) * size],
					[Vector2(size * 0.14, size * 0.04), Vector2(size * 0.18, size * 0.04), Vector2(0.004, 0.004)],
					_toward(c1, _glow(c2, 0.6), size * 0.3, size * 1.4, at), 6, 3, 0.4, 0.0)
			"water":
				var wv := Color(0.45, 0.85, 1.0).lerp(c2, 0.3)
				part.tube([at, at + (up * 0.7 + tilt * 0.3) * size, at + (up * 1.05 + tilt * 1.2) * size, at + (up * 0.75 + tilt * 1.8) * size],
					[size * 0.3, size * 0.22, size * 0.13, 0.004], _toward(c1.lerp(wv, 0.4), _glow(wv, 0.9), size * 0.3, size * 1.6, at), 7, 3, 0.4, 0.0)
			"thunder":
				var zz := at + up * size * 0.1
				part.tube([zz, zz + (up * 0.6 + Vector3(0.25, 0, -0.1)) * size, zz + (up * 0.9 + Vector3(-0.2, 0, -0.3)) * size, zz + (up * 1.4 + Vector3(0.1, 0, -0.4)) * size],
					[size * 0.14, size * 0.1, size * 0.08, 0.004], _solid(_glow(c2, 0.9)), 5, 2, 0.4, 0.0)
		k += 1

# ================================================================ 네발짐승

static func _quad(ctx: Dictionary, kind: String) -> void:
	var q: Dictionary = (QUAD.get(kind, QUAD.beast) as Dictionary).duplicate()
	q.merge(ctx.opts, true)
	var fur: Color = ctx.c0
	var acc: Color = ctx.c1
	var eye: Color = ctx.c2
	var el: String = ctx.el
	var leg_h: float = q.leg_h
	var L: float = q.L
	var rw: float = q.rw
	var rh: float = q.rh
	var hr: float = q.head_r
	var hump := float(q.get("hump", 0.0))
	var yb := leg_h + rh * 0.5
	var belly := fur.lerp(Color(0.98, 0.95, 0.88), 0.5)
	if kind == "cat":
		belly = fur.lerp(acc, 0.6)
	var head := Vector3(0, yb + float(q.neck_up), L * 0.5 + float(q.neck_fwd))
	var snout: float = q.snout
	var sr: float = q.snout_r
	var nose := head + Vector3(0, -hr * 0.28, hr * 0.72 + snout)
	var stripes := bool(q.get("stripes", false))
	var stripe_c := _glow(eye, 1.0) if el == "thunder" else (acc if kind == "beast" else fur.darkened(0.55))
	var paint := _fur(fur, belly, head.z + hr * 0.35, stripes, stripe_c, -L * 0.55, L * 0.42)

	var b := Part.new()
	## 한 줄기: 엉덩이 → 허리 → 가슴(곰은 어깨 혹) → 목 → 머리 → 주둥이 → 코끝.
	b.tube([Vector3(0, yb + 0.03, -L * 0.5), Vector3(0, yb - 0.015 + hump * 0.3, -L * 0.12), Vector3(0, yb + 0.03 + hump, L * 0.28),
			Vector3(0, lerpf(yb, head.y, 0.5), L * 0.5 + float(q.neck_fwd) * 0.15), head,
			head + Vector3(0, -hr * 0.22, hr * 0.62 + snout * 0.45), nose],
		[Vector2(rw * 0.9, rh * 0.86), Vector2(rw, rh * 0.96), Vector2(rw * 1.05 + hump * 0.35, rh * 1.05 + hump * 0.55),
			Vector2(rw * 0.62, rh * 0.64), Vector2(hr, hr * 0.92), Vector2(sr, sr * 0.82), Vector2(sr * 0.55, sr * 0.5)],
		paint, 16, 7, 0.9, 0.7)
	## 볼 털(고양이·여우·늑대) — 머리 양옆으로 삐친 털.
	if kind != "bear":
		for sx in [-1.0, 1.0]:
			var s: float = sx
			var c0 := head + Vector3(s * hr * 0.62, -hr * 0.3, -hr * 0.05)
			b.tube([c0, c0 + Vector3(s * hr * 0.3, -hr * 0.18, -hr * 0.3)], [hr * 0.24, 0.004], _solid(belly.lerp(fur, 0.3)), 8, 2, 0.5, 0.0)
	b.blob(nose + Vector3(0, sr * 0.2, sr * 0.2), Vector3(sr * 0.5, sr * 0.35, sr * 0.35), Basis(), _solid(DARK), 8, 5)
	_eyes(ctx, b, head, hr)
	## 이마 찡그림(적) — 눈 위 어두운 눈썹 덩이.
	if ctx.fierce:
		for sx in [-1.0, 1.0]:
			var s: float = sx
			var d := Vector3(s * 0.42, 0.62, 0.66).normalized()
			b.blob(head + d * hr * 0.9, Vector3(0.26, 0.07, 0.1) * hr, _look(d, s * 0.45), _solid(fur.darkened(0.4)), 8, 4)
		for sx in [-1.0, 1.0]:
			var s: float = sx
			var f0 := nose + Vector3(s * sr * 0.5, -sr * 0.35, -snout * 0.3 - sr * 0.45)
			b.spike(f0, f0 + Vector3(0, -sr * 0.5 - 0.012, 0.01), sr * 0.13, _solid(WHITE), 5)
	## 귀
	var ear: String = q.ear
	for sx in [-1.0, 1.0]:
		var s: float = sx
		if ear == "round":
			var d := Vector3(s * 0.62, 0.72, -0.1).normalized()
			var eb := head + d * hr * 0.85
			b.blob(eb, Vector3(0.3, 0.3, 0.13) * hr, _look(Vector3(s * 0.25, 0.1, 1.0)), _fur(fur.darkened(0.08), acc.lerp(fur, 0.4)), 10, 5)
		else:
			var ear_len := hr * (1.35 if ear == "big" else (1.1 if ear == "tuft" else 1.0))
			var ew := hr * (0.5 if ear == "big" else 0.4)
			var base := head + Vector3(s * hr * 0.5, hr * 0.62, -hr * 0.18)
			var tip := base + Vector3(s * ear_len * 0.22, ear_len, -ear_len * 0.1)
			var inner := acc.lerp(Color(0.95, 0.72, 0.72), 0.4) if kind != "cat" else acc
			var ep := func(p: Vector3, nn: Vector3) -> Color:
				var col := fur.darkened(0.05) if nn.z < 0.25 else inner
				return col.lerp(fur.darkened(0.45) if el == "" else _glow(eye, 0.7), clampf((p.y - tip.y + ear_len * 0.3) / (ear_len * 0.3), 0.0, 1.0))
			b.tube([base, base.lerp(tip, 0.5) + Vector3(0, 0, 0.015), tip], [Vector2(ew, ew * 0.4), Vector2(ew * 0.72, ew * 0.3), Vector2(0.004, 0.004)],
				ep, 8, 3, 0.4, 0.0, Vector3.BACK)
			if ear == "tuft":
				b.tube([tip - (tip - base) * 0.12, tip + Vector3(s * 0.02, hr * 0.5, -0.02)], [hr * 0.08, 0.003],
					_solid(_glow(eye, 1.0) if el != "" else fur.darkened(0.6)), 5, 2, 0.3, 0.0)
	## 뿔(해태)
	if bool(q.get("horn", false)):
		var h0 := head + Vector3(0, hr * 0.85, hr * 0.25)
		b.tube([h0, h0 + Vector3(0, hr * 0.5, hr * 0.15), h0 + Vector3(0, hr * 0.85, -hr * 0.1)], [hr * 0.15, hr * 0.1, 0.004], _solid(eye), 8, 3, 0.4, 0.0)
	## 갈기(해태·사자개) / 목 털(늑대·여우)
	if bool(q.get("mane", false)) or bool(q.get("ruff", false)):
		var big := bool(q.get("mane", false))
		var neck := Vector3(0, lerpf(yb, head.y, 0.55), L * 0.5 + float(q.neck_fwd) * 0.3)
		var nm := 16 if big else 9
		var mcol := acc if big else belly
		for i in nm:
			var a := TAU * float(i) / float(nm) + 0.2
			if not big and sin(a) > -0.2:
				continue # 목 털은 턱 밑·가슴 쪽만
			var dir := Vector3(cos(a) * (1.0 if big else 0.5), sin(a) * 0.9 + 0.15, 0.0)
			var m0 := neck + dir * rw * 0.5 + Vector3(0, 0, 0.06)
			var ln := (0.3 if big else 0.14) * (0.85 + 0.3 * float(i % 3) / 2.0)
			b.tube([m0, m0 + dir * ln * 0.5 + Vector3(0, 0, -ln * 0.3), m0 + dir * ln + Vector3(0, -0.02, -ln * 0.75)],
				[0.085 if big else 0.06, 0.07 if big else 0.045, 0.004], _toward(mcol, mcol.darkened(0.25), 0.0, ln, m0), 7, 3, 0.5, 0.0)
		if big:
			for i in 3: # 앞머리 털
				var f0 := head + Vector3((float(i) - 1.0) * hr * 0.35, hr * 0.8, -hr * 0.1)
				b.tube([f0, f0 + Vector3((float(i) - 1.0) * 0.05, 0.1, -0.12)], [0.07, 0.004], _solid(acc), 7, 2, 0.4, 0.0)
	## 곰 등판(불가사리 쇠판)
	if bool(q.get("plates", false)):
		for i in 5:
			var pz := -L * 0.35 + float(i) * L * 0.17
			b.spike(Vector3(0, yb + rh * 0.8 + hump * 0.5, pz), Vector3(0, yb + rh * 0.8 + hump * 0.5 + 0.28, pz - 0.08), 0.1, _solid(acc.lerp(eye, 0.2)), 5, true)
	## 원소 장식 — 등줄기 따라.
	if el != "" and el != "thunder":
		var pts: Array = []
		var nc := 4 if kind != "bear" else 5
		for i in nc:
			var t := float(i) / float(nc - 1)
			var z := lerpf(-L * 0.36, L * 0.3, t)
			pts.append(Vector3(0, yb + rh * 0.85 + hump * (0.2 + 0.8 * t) * 0.8, z))
		_crest(ctx, b, pts, Vector3.UP, rw * (0.7 if kind == "bear" else 0.9))
	_attach(ctx, b, "")

	## 다리 — 엉덩이·어깨 관절 축에 매달아 걸을 때 앞뒤로 흔든다(대각선 짝).
	var lr: float = q.leg_r
	var pw: float = q.paw
	var sock := fur.darkened(0.25) if kind != "cat" else acc
	if kind == "fox9":
		sock = fur.darkened(0.55)
	for front in [true, false]:
		for sx in [-1.0, 1.0]:
			var s: float = sx
			var hip := Vector3(s * rw * 0.6, yb - rh * 0.3, L * 0.34 if front else -L * 0.34)
			var h := hip.y
			var lp := Part.new()
			var lpaint := _socks(fur, sock, -h * 0.55, -h * 0.9)
			if front:
				lp.tube([Vector3(0, 0.06, 0.0), Vector3(0, -h * 0.42, 0.03), Vector3(0, -h * 0.78, -0.01), Vector3(0, -h + pw * 0.5, 0.03)],
					[lr * 1.9, lr * 1.15, lr * 0.9, lr * 0.95], lpaint, 10, 3, 0.8, 0.3)
			else:
				lp.tube([Vector3(0, 0.08, 0.02), Vector3(0, -h * 0.34, 0.1), Vector3(0, -h * 0.68, -0.07), Vector3(0, -h + pw * 0.5, 0.0)],
					[lr * 2.3, lr * 1.35, lr * 0.85, lr * 0.95], lpaint, 10, 3, 0.8, 0.3)
			lp.blob(Vector3(0, -h + pw * 0.5, 0.06), Vector3(pw, pw * 0.5, pw * 1.25), Basis(), _solid(sock.darkened(0.1)), 10, 5)
			if ctx.fierce: # 발톱
				for tx in [-1.0, 0.0, 1.0]:
					var c0 := Vector3(float(tx) * pw * 0.45, -h + pw * 0.3, 0.06 + pw * 1.05)
					lp.spike(c0, c0 + Vector3(0, -pw * 0.28, pw * 0.28), pw * 0.12, _solid(WHITE.darkened(0.15)), 4)
			var nm := "Leg%s%s" % ["F" if front else "R", "L" if s > 0 else "R"]
			_attach(ctx, lp, nm, hip)
			var ph := 0.0 if (front == (s > 0)) else PI
			ctx.rig.legs.append(["Body/" + nm, ph])

	## 꼬리
	var tail: String = q.tail
	var tp := Part.new()
	var tb := Vector3(0, yb + rh * 0.35, -L * 0.5 - rw * 0.15)
	var tipc := fur.darkened(0.5)
	if el != "":
		tipc = _glow(eye, 1.0)
	elif kind == "fox9" or kind == "wolf":
		tipc = WHITE
	match tail:
		"thin":
			tp.tube([Vector3.ZERO, Vector3(0, 0.12, -0.3), Vector3(0.04, 0.42, -0.48), Vector3(-0.02, 0.72, -0.4), Vector3(0.02, 0.86, -0.28)],
				[0.05, 0.045, 0.042, 0.038, 0.03], _toward(fur, tipc, 0.6, 0.95), 8, 4, 0.5, 1.0)
		"bush":
			tp.tube([Vector3.ZERO, Vector3(0, -0.06, -0.22), Vector3(0, -0.22, -0.42), Vector3(0, -0.42, -0.5)],
				[0.06, 0.12, 0.13, 0.06], _toward(fur, tipc, 0.4, 0.6), 10, 4, 0.5, 1.0)
		"curl":
			tp.tube([Vector3.ZERO, Vector3(0, 0.2, -0.22), Vector3(0, 0.46, -0.2), Vector3(0, 0.56, 0.0), Vector3(0, 0.46, 0.08)],
				[0.07, 0.12, 0.14, 0.12, 0.05], _toward(fur, acc, 0.3, 0.6), 10, 4, 0.5, 1.0)
		"nine":
			for i in 9:
				var a := deg_to_rad(-64.0 + 16.0 * float(i))
				var sw := sin(a)
				var hgt := 0.62 + 0.14 * cos(a * 2.0)
				tp.tube([Vector3(sw * 0.04, 0, 0), Vector3(sw * 0.3, 0.2, -0.3), Vector3(sw * 0.58, hgt * 0.75, -0.48), Vector3(sw * 0.7, hgt, -0.34)],
					[0.05, 0.11, 0.1, 0.02], _toward(fur, tipc, 0.4, 0.85), 8, 4, 0.5, 1.0)
		"stub":
			tp.blob(Vector3(0, 0, -0.04), Vector3(0.1, 0.1, 0.1), Basis(), _solid(fur), 8, 5)
	_attach(ctx, tp, "Tail", tb)
	ctx.rig.tails.append("Body/Tail")

# ================================================================ 말

static func _horse(ctx: Dictionary) -> void:
	var fur: Color = ctx.c0
	var hair: Color = ctx.c1
	var hoof: Color = ctx.c2
	var leg_h := 0.95
	var L := 1.3
	var yb := leg_h + 0.18
	var belly := fur.lerp(Color(0.98, 0.95, 0.88), 0.3)
	var poll := Vector3(0, yb + 0.86, L * 0.64)
	var b := Part.new()
	b.tube([Vector3(0, yb + 0.03, -L * 0.5), Vector3(0, yb - 0.03, -L * 0.1), Vector3(0, yb + 0.04, L * 0.34),
			Vector3(0, yb + 0.32, L * 0.52), Vector3(0, yb + 0.66, L * 0.6), poll,
			poll + Vector3(0, -0.14, 0.22), poll + Vector3(0, -0.28, 0.4)],
		[Vector2(0.28, 0.3), Vector2(0.29, 0.33), Vector2(0.29, 0.35), Vector2(0.17, 0.24), Vector2(0.12, 0.16),
			Vector2(0.12, 0.14), Vector2(0.105, 0.12), Vector2(0.09, 0.1)],
		_fur(fur, belly, poll.z + 0.25), 16, 6, 0.9, 0.7)
	b.blob(poll + Vector3(0, -0.3, 0.46), Vector3(0.1, 0.06, 0.05), Basis(), _solid(fur.darkened(0.45)), 8, 4) # 코
	_eyes(ctx, b, poll + Vector3(0, -0.04, 0.02), 0.13, 0.85, 0.2)
	for sx in [-1.0, 1.0]:
		var s: float = sx
		var e0 := poll + Vector3(s * 0.06, 0.1, -0.04)
		b.tube([e0, e0 + Vector3(s * 0.03, 0.17, -0.04)], [Vector2(0.045, 0.02), Vector2(0.004, 0.004)], _solid(fur.darkened(0.1)), 6, 2, 0.4, 0.0, Vector3.BACK)
	## 갈기 — 정수리에서 어깨까지 목 등줄기를 따라 납작한 털 다발.
	for i in 9:
		var t := float(i) / 8.0
		var m0 := poll.lerp(Vector3(0, yb + 0.3, L * 0.36), t) + Vector3(0, 0.1 - t * 0.02, -0.06)
		b.tube([m0, m0 + Vector3(0.03, -0.1, -0.16), m0 + Vector3(0.06, -0.26, -0.18)], [Vector2(0.05, 0.035), Vector2(0.06, 0.03), Vector2(0.004, 0.004)],
			_toward(hair, hair.darkened(0.3), 0.0, 0.3, m0), 6, 3, 0.4, 0.0, Vector3.RIGHT)
	b.tube([poll + Vector3(0, 0.1, 0.04), poll + Vector3(0.02, 0.02, 0.2)], [0.06, 0.004], _solid(hair), 6, 2, 0.4, 0.0) # 앞머리
	_attach(ctx, b, "")
	for front in [true, false]:
		for sx in [-1.0, 1.0]:
			var s: float = sx
			var hip := Vector3(s * 0.17, yb - 0.1, L * 0.36 if front else -L * 0.36)
			var h := hip.y
			var lp := Part.new()
			if front:
				lp.tube([Vector3(0, 0.08, 0), Vector3(0, -h * 0.4, 0.02), Vector3(0, -h * 0.62, 0.0), Vector3(0, -h + 0.12, 0.03)],
					[0.13, 0.075, 0.06, 0.055], _socks(fur, fur.darkened(0.2), -h * 0.6, -h * 0.9), 10, 3, 0.8, 0.0)
			else:
				lp.tube([Vector3(0, 0.1, 0.02), Vector3(0, -h * 0.3, 0.1), Vector3(0, -h * 0.58, -0.08), Vector3(0, -h + 0.12, 0.0)],
					[0.16, 0.09, 0.06, 0.055], _socks(fur, fur.darkened(0.2), -h * 0.6, -h * 0.9), 10, 3, 0.8, 0.0)
			var hz := 0.03 if front else 0.0
			lp.tube([Vector3(0, -h + 0.14, hz), Vector3(0, -h, hz + 0.01)], [0.06, 0.075], _solid(hoof), 10, 1, 0.0, 0.3)
			var nm := "Leg%s%s" % ["F" if front else "R", "L" if s > 0 else "R"]
			_attach(ctx, lp, nm, hip)
			ctx.rig.legs.append(["Body/" + nm, 0.0 if (front == (s > 0)) else PI])
	var tp := Part.new()
	tp.tube([Vector3.ZERO, Vector3(0, -0.12, -0.2), Vector3(0, -0.45, -0.3), Vector3(0, -0.78, -0.26)],
		[Vector2(0.07, 0.05), Vector2(0.11, 0.06), Vector2(0.12, 0.06), Vector2(0.05, 0.03)],
		_toward(hair, hair.darkened(0.3), 0.3, 0.8), 8, 4, 0.5, 0.8, Vector3.BACK)
	_attach(ctx, tp, "Tail", Vector3(0, yb + 0.2, -L * 0.52))
	ctx.rig.tails.append("Body/Tail")

# ================================================================ 새

static func _bird(ctx: Dictionary, kind: String) -> void:
	var feather: Color = ctx.c0
	var acc: Color = ctx.c1
	var third: Color = ctx.c2
	var crow := kind == "crow3"
	var beak_c := acc if crow else third
	var y := 0.62
	var head := Vector3(0, y + 0.44, 0.36)
	var hr := 0.16
	var belly := feather.lerp(acc, 0.45)
	var b := Part.new()
	b.tube([Vector3(0, y + 0.03, -0.42), Vector3(0, y - 0.03, -0.1), Vector3(0, y + 0.05, 0.17), Vector3(0, y + 0.3, 0.3), head],
		[Vector2(0.11, 0.09), Vector2(0.26, 0.27), Vector2(0.24, 0.27), Vector2(0.13, 0.14), Vector2(hr, hr)],
		_fur(feather, belly), 14, 5, 0.5, 1.0)
	## 부리 — 매부리처럼 끝이 아래로 굽음.
	var bk := head + Vector3(0, -0.02, hr * 0.72)
	b.tube([bk, bk + Vector3(0, 0.0, 0.11), bk + Vector3(0, -0.05, 0.2)], [Vector2(0.06, 0.055), Vector2(0.04, 0.035), Vector2(0.004, 0.004)],
		_solid(beak_c), 8, 3, 0.3, 0.0)
	_eyes(ctx, b, head, hr, 0.72, 0.22)
	## 머리 깃
	for i in 3:
		var f0 := head + Vector3((float(i) - 1.0) * 0.03, hr * 0.8, -hr * 0.2)
		var f1 := f0 + Vector3((float(i) - 1.0) * 0.06, 0.12 + 0.05 * float(1 - absi(i - 1)), -0.22)
		b.tube([f0, f1], [Vector2(0.035, 0.012), Vector2(0.004, 0.004)], _toward(feather, acc, 0.05, 0.25, f0), 6, 3, 0.3, 0.0)
	## 꽁지깃 부채
	var tails := 3 if crow else 5
	var tl := 0.55 if crow else 1.0
	for i in tails:
		var a := deg_to_rad(-26.0 + 52.0 * float(i) / float(tails - 1))
		var t0 := Vector3(sin(a) * 0.05, y, -0.4)
		var t1 := t0 + Vector3(sin(a) * tl * 0.35, -0.08, -tl * 0.5)
		var t2 := t0 + Vector3(sin(a) * tl * 0.55, -0.1 - tl * 0.1, -tl)
		b.tube([t0, t1, t2], [Vector2(0.05, 0.015), Vector2(0.07, 0.014), Vector2(0.02, 0.006)],
			_toward(feather, _glow(third, 0.8) if ctx.el != "" else acc, tl * 0.4, tl, t0), 6, 3, 0.3, 0.6)
	## 다리·발가락
	var legs := 3 if crow else 2
	for i in legs:
		var lx := (float(i) - float(legs - 1) * 0.5) * 0.13
		b.tube([Vector3(lx, y - 0.12, 0.02), Vector3(lx, 0.22, 0.06), Vector3(lx, 0.03, 0.08)], [0.05, 0.028, 0.025], _solid(beak_c.darkened(0.15)), 6, 3, 0.3, 0.3)
		for ta in [-0.5, 0.0, 0.5]:
			var t0 := Vector3(lx, 0.03, 0.08)
			b.tube([t0, t0 + Vector3(sin(float(ta)) * 0.09, -0.02, cos(float(ta)) * 0.09)], [0.018, 0.006], _solid(beak_c.darkened(0.3)), 5, 1, 0.3, 0.5)
	if ctx.el != "":
		_crest(ctx, b, [head + Vector3(0, hr * 0.7, -0.08), Vector3(0, y + 0.25, -0.05)], Vector3.UP, 0.1)
	_attach(ctx, b, "")
	## 날개 — 어깨 축에서 반쯤 펴고(떠 있는 모양) 날갯짓은 z 축 회전.
	for sx in [-1.0, 1.0]:
		var s: float = sx
		var wp := Part.new()
		var arm := [Vector3.ZERO, Vector3(s * 0.32, 0.08, -0.04), Vector3(s * 0.66, 0.1, -0.16), Vector3(s * 0.96, 0.04, -0.34)]
		wp.tube(arm, [Vector2(0.13, 0.05), Vector2(0.16, 0.035), Vector2(0.12, 0.025), Vector2(0.04, 0.015)],
			_toward(feather, feather.darkened(0.15), 0.2, 0.9), 10, 3, 0.4, 0.6)
		for f in 6:
			var t := 0.3 + 0.13 * float(f)
			var r0: Vector3 = Part.cr3(arm, mini(int(t * 3.0), 2), fmod(t * 3.0, 1.0))
			var ln := 0.32 + 0.07 * float(f)
			var f1 := r0 + Vector3(s * (0.05 + 0.04 * float(f)), -0.03, -ln)
			wp.tube([r0, r0.lerp(f1, 0.5) + Vector3(0, 0.01, 0), f1], [Vector2(0.06, 0.012), Vector2(0.065, 0.01), Vector2(0.015, 0.005)],
				_toward(feather, _glow(third, 0.8) if ctx.el != "" else acc, ln * 0.5, ln, r0), 6, 3, 0.3, 0.6)
		var nm := "Wing" + ("L" if s > 0 else "R")
		_attach(ctx, wp, nm, Vector3(s * 0.2, y + 0.14, 0.08), Vector3(0, 0, s * 0.3))
		ctx.rig.wings.append(["Body/" + nm, s])
	ctx.rig.mode = "bird"

# ================================================================ 이무기·용

static func _serpent(ctx: Dictionary) -> void:
	var sc: Color = ctx.c0
	var belly: Color = ctx.c1
	var horn: Color = ctx.c2
	var el: String = ctx.el
	var dragon := bool(ctx.opts.get("dragon", false))
	var ctrl := [Vector3(-0.15, 0.07, -1.35), Vector3(0.35, 0.1, -1.05), Vector3(0.48, 0.14, -0.5), Vector3(0.05, 0.18, -0.12),
		Vector3(-0.32, 0.3, 0.2), Vector3(-0.18, 0.62, 0.46), Vector3(0.02, 0.96, 0.56), Vector3(0.0, 1.14, 0.66)]
	var rad := [0.03, 0.09, 0.15, 0.2, 0.21, 0.19, 0.17, 0.16]
	var paint := func(p: Vector3, nn: Vector3) -> Color:
		var col := sc.darkened(clampf(nn.y, 0.0, 1.0) * 0.12)
		var dia := absf(sin(p.x * 17.0 + p.z * 13.0)) * absf(sin(p.x * 13.0 - p.z * 17.0 + p.y * 9.0))
		col = col.lightened(0.08) if dia > 0.55 else col
		var und := clampf((-nn.y + 0.05) * 2.2, 0.0, 1.0)
		var band := 0.85 + 0.15 * sin(p.y * 40.0 + p.z * 40.0)
		return col.lerp(belly * band, und)
	var b := Part.new()
	b.tube(ctrl, rad, paint, 12, 6, 1.0, 0.6)
	## 머리 — 목 끝에서 앞으로, 아래턱은 살짝 벌림.
	var hc := Vector3(0.0, 1.16, 0.84)
	b.tube([Vector3(0, 1.14, 0.64), hc, hc + Vector3(0, -0.03, 0.2), hc + Vector3(0, -0.05, 0.33)],
		[Vector2(0.16, 0.15), Vector2(0.19, 0.15), Vector2(0.13, 0.09), Vector2(0.08, 0.055)], paint, 12, 4, 0.0, 0.6)
	b.tube([hc + Vector3(0, -0.1, -0.02), hc + Vector3(0, -0.14, 0.18), hc + Vector3(0, -0.13, 0.28)],
		[Vector2(0.13, 0.05), Vector2(0.09, 0.04), Vector2(0.05, 0.03)], _solid(belly), 10, 3, 0.4, 0.6)
	b.blob(hc + Vector3(0, -0.08, 0.14), Vector3(0.09, 0.03, 0.12), Basis(), _solid(Color(0.55, 0.12, 0.16)), 8, 4) # 입 안
	for sx in [-1.0, 1.0]:
		var s: float = sx
		var f0 := hc + Vector3(s * 0.07, -0.1, 0.24)
		b.spike(f0 + Vector3(0, 0.02, 0), f0 + Vector3(0, -0.07, 0.01), 0.018, _solid(WHITE), 4)
	_eyes(ctx, b, hc + Vector3(0, 0.02, -0.02), 0.17, 0.75, 0.35)
	for sx in [-1.0, 1.0]:
		var s: float = sx
		var h0 := hc + Vector3(s * 0.09, 0.1, -0.08)
		var hs := 0.55 if el == "grass" else 1.0
		b.tube([h0, h0 + Vector3(s * 0.08, 0.14, -0.14) * hs, h0 + Vector3(s * 0.12, 0.2, -0.34) * hs], [0.04 * hs, 0.03 * hs, 0.004],
			_solid(sc.darkened(0.35) if el == "grass" else horn), 7, 3, 0.4, 0.0)
		if dragon or el == "thunder" or el == "water":
			var w0 := hc + Vector3(s * 0.07, -0.04, 0.3)
			b.tube([w0, w0 + Vector3(s * 0.18, -0.02, 0.05), w0 + Vector3(s * 0.34, -0.12, -0.12), w0 + Vector3(s * 0.4, -0.3, -0.24)],
				[0.014, 0.012, 0.01, 0.004], _solid(horn if el == "" else _glow(horn, 0.6)), 5, 3, 0.3, 0.0) # 수염
	## 등지느러미 — 목덜미부터 꼬리까지(초 원소는 잎, 그 밖은 가시).
	var pts: Array = []
	for s in ctrl.size() - 1:
		if s == 0:
			continue
		var pt: Vector3 = Part.cr3(ctrl, s, 0.5)
		var r: float = lerpf(float(rad[s]), float(rad[s + 1]), 0.5)
		pts.append(pt + Vector3(0, r * 0.9, 0))
	if el == "grass" or el == "" and dragon:
		if el == "grass":
			_crest(ctx, b, pts, Vector3.UP, 0.26)
			var fl := hc + Vector3(0.08, 0.16, -0.06) # 머리 꽃
			for i in 5:
				var a := TAU * float(i) / 5.0
				b.blob(fl + Vector3(cos(a) * 0.05, 0.02, sin(a) * 0.05), Vector3(0.05, 0.018, 0.035), _look(Vector3(cos(a), 0.2, sin(a))), _solid(horn), 6, 4)
			b.blob(fl + Vector3(0, 0.03, 0), Vector3.ONE * 0.025, Basis(), _solid(Color(1.0, 0.9, 0.35)), 6, 4)
		else:
			for p in pts: # 청룡 갈기털
				var p0: Vector3 = p
				b.tube([p0, p0 + Vector3(0.04, 0.1, -0.1)], [0.05, 0.004], _solid(belly.lerp(horn, 0.4)), 6, 2, 0.4, 0.0)
	elif el != "":
		_crest(ctx, b, pts, Vector3.UP, 0.14)
	else:
		for p in pts:
			var p0: Vector3 = p
			b.spike(p0, p0 + Vector3(0, 0.12, -0.05), 0.05, _solid(horn.darkened(0.2)), 5)
	_attach(ctx, b, "")
	ctx.rig.mode = "serpent"

# ================================================================ 거북

static func _turtle(ctx: Dictionary) -> void:
	var shell: Color = ctx.c0
	var skin: Color = ctx.c1
	var third: Color = ctx.c2
	var el: String = ctx.el
	var sp := func(p: Vector3, nn: Vector3) -> Color:
		## 등딱지 판 — 각진 면(flat) 하나하나가 판. 면 자리 해시로 판마다 밝기를 조금씩 달리한다.
		var h := fposmod(sin(floor(p.x * 9.0) * 12.9898 + floor(p.z * 9.0) * 78.233 + floor(p.y * 9.0) * 37.719) * 43758.5453, 1.0)
		var col := shell.lightened(clampf(nn.y - 0.5, 0.0, 0.5) * 0.35)
		return col.lightened(0.1) if h > 0.6 else (col.darkened(0.12) if h < 0.25 else col)
	var b := Part.new()
	b.blob(Vector3(0, 0.4, 0), Vector3(0.62, 0.36, 0.72), Basis(), sp, 9, 6, true)
	b.blob(Vector3(0, 0.34, 0), Vector3(0.68, 0.12, 0.78), Basis(), _solid(skin.darkened(0.3).lerp(shell, 0.4)), 18, 6) # 테두리
	b.blob(Vector3(0, 0.22, 0), Vector3(0.52, 0.12, 0.62), Basis(), _solid(skin.lerp(WHITE, 0.25)), 14, 6) # 배딱지
	## 목·머리
	var hc := Vector3(0, 0.56, 1.0)
	b.tube([Vector3(0, 0.34, 0.5), Vector3(0, 0.44, 0.8), hc, hc + Vector3(0, -0.03, 0.17)], [0.12, 0.11, Vector2(0.18, 0.16), Vector2(0.11, 0.085)],
		_fur(skin, skin.lerp(WHITE, 0.35)), 12, 4, 0.0, 0.8)
	_eyes(ctx, b, hc, 0.17, 0.72, 0.3, 1.25)
	b.tube([Vector3(0, 0.3, -0.62), Vector3(0, 0.24, -0.86)], [0.07, 0.004], _solid(skin), 8, 2, 0.4, 0.0) # 꼬리
	## 등 장식 — 원소 적은 빛나는 혹, 현무는 감아 오른 뱀.
	if el != "":
		var pts: Array = []
		for i in 5:
			var a := TAU * float(i) / 5.0
			pts.append(Vector3(cos(a) * 0.26, 0.68, sin(a) * 0.3))
		pts.append(Vector3(0, 0.77, 0))
		_crest(ctx, b, pts, Vector3.UP, 0.18)
	if bool(ctx.opts.get("snake", false)):
		var coil: Array = []
		for i in 12:
			var a := TAU * float(i) / 10.0
			coil.append(Vector3(cos(a) * 0.5, 0.5 + float(i) * 0.03, sin(a) * 0.6))
		coil.append(Vector3(0.1, 1.05, -0.05))
		coil.append(Vector3(0.12, 1.15, 0.12))
		b.tube(coil, [0.05, 0.08, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.1, 0.08],
			_fur(third, third.lerp(WHITE, 0.4)), 10, 3, 1.0, 0.8)
		var sctx := ctx.duplicate()
		sctx.c2 = Color(0.95, 0.85, 0.3)
		_eyes(sctx, b, Vector3(0.12, 1.15, 0.12), 0.09, 0.8, 0.3)
	_attach(ctx, b, "")
	for front in [true, false]:
		for sx in [-1.0, 1.0]:
			var s: float = sx
			var lp := Part.new()
			lp.tube([Vector3.ZERO, Vector3(s * 0.16, -0.12, 0.06 if front else -0.04), Vector3(s * 0.2, -0.24, 0.1 if front else -0.06)],
				[0.13, 0.12, Vector2(0.13, 0.07)], _fur(skin, skin.lerp(WHITE, 0.3)), 10, 3, 0.5, 0.8)
			for tx in [-1.0, 0.0, 1.0]:
				var c0 := Vector3(s * 0.2 + float(tx) * 0.06, -0.28, (0.2 if front else -0.16))
				lp.spike(c0, c0 + Vector3(0, -0.03, 0.06 if front else -0.06), 0.02, _solid(WHITE.darkened(0.2)), 4)
			var nm := "Leg%s%s" % ["F" if front else "R", "L" if s > 0 else "R"]
			_attach(ctx, lp, nm, Vector3(s * 0.4, 0.28, 0.42 if front else -0.44))
			ctx.rig.legs.append(["Body/" + nm, 0.0 if (front == (s > 0)) else PI])
	ctx.rig.mode = "turtle"

# ================================================================ 도깨비(두 발)

static func _goblin(ctx: Dictionary) -> void:
	var skin: Color = ctx.c0
	var cloth: Color = ctx.c1
	var horn: Color = ctx.c2
	var el: String = ctx.el
	var head := Vector3(0, 1.42, 0.06)
	var hr := 0.36
	var b := Part.new()
	var bp := _fur(skin, skin.lerp(Color(1.0, 0.9, 0.75), 0.25))
	b.tube([Vector3(0, 0.6, -0.02), Vector3(0, 0.8, 0.06), Vector3(0, 1.02, 0.0), Vector3(0, 1.18, 0.02)],
		[Vector2(0.28, 0.24), Vector2(0.36, 0.33), Vector2(0.33, 0.27), Vector2(0.17, 0.16)], bp, 14, 4, 0.8, 0.0)
	b.blob(head, Vector3(hr, hr * 0.92, hr * 0.94), Basis(), bp, 16, 10)
	## 허리 가리개·띠
	var skirt := func(p: Vector3, _n: Vector3) -> Color:
		return cloth.darkened(0.3) if int(floor((atan2(p.x, p.z) + PI) * 3.0)) % 2 == 0 else cloth
	b.tube([Vector3(0, 0.74, 0.02), Vector3(0, 0.46, 0.04)], [Vector2(0.37, 0.33), Vector2(0.44, 0.38)], skirt, 16, 2, 0.0, 0.0)
	b.tube([Vector3(0, 0.78, 0.03), Vector3(0, 0.7, 0.03)], [Vector2(0.38, 0.34), Vector2(0.39, 0.35)], _solid(horn.darkened(0.3)), 16, 1, 0.0, 0.0)
	## 얼굴 — 큰 입(어두운 틈)과 위로 솟은 엄니, 주먹코, 뾰족 귀.
	b.blob(head + Vector3(0, -hr * 0.4, hr * 0.8), Vector3(0.55, 0.14, 0.2) * hr, Basis(), _solid(Color(0.25, 0.06, 0.08)), 12, 5)
	for sx in [-1.0, 1.0]:
		var s: float = sx
		var t0 := head + Vector3(s * hr * 0.36, -hr * 0.48, hr * 0.84)
		b.spike(t0, t0 + Vector3(s * 0.02, hr * 0.32, 0.03), hr * 0.08, _solid(WHITE), 6)
		var e0 := head + Vector3(s * hr * 0.9, hr * 0.05, -hr * 0.05)
		b.tube([e0, e0 + Vector3(s * hr * 0.5, hr * 0.2, -hr * 0.2)], [Vector2(hr * 0.2, hr * 0.08), Vector2(0.004, 0.004)], bp, 8, 2, 0.4, 0.0, Vector3.BACK)
	b.blob(head + Vector3(0, -hr * 0.05, hr * 0.95), Vector3.ONE * hr * 0.17, Basis(), _solid(skin.darkened(0.15)), 8, 5)
	_eyes(ctx, b, head + Vector3(0, hr * 0.08, 0), hr, 0.42, 0.18, 1.15)
	for sx in [-1.0, 1.0]:
		var s: float = sx
		var d := Vector3(s * 0.38, 0.45, 0.8).normalized()
		b.blob(head + d * hr * 0.92, Vector3(0.3, 0.08, 0.1) * hr, _look(d, s * 0.5), _solid(skin.darkened(0.45)), 8, 4)
	## 뿔 — 하나(큰 뿔)는 도깨비, 원소 적은 둘.
	var horns := [0.0] if el == "" else [-1.0, 1.0]
	for hx in horns:
		var x: float = hx
		var h0 := head + Vector3(x * hr * 0.45, hr * 0.8, -hr * 0.05)
		b.tube([h0, h0 + Vector3(x * 0.08, hr * 0.5, 0.02), h0 + Vector3(x * 0.16, hr * 0.8, -hr * 0.2)], [hr * 0.2, hr * 0.12, 0.004],
			_toward(horn, horn.lightened(0.3), 0.0, hr, h0), 8, 3, 0.4, 0.0)
	## 불 원소 — 머리 위 불꽃 머리칼.
	if el == "fire":
		var pts: Array = []
		for i in 5:
			var a := PI * (0.15 + 0.7 * float(i) / 4.0)
			pts.append(head + Vector3(cos(a) * hr * 0.6, hr * 0.7 + sin(a) * hr * 0.1, -hr * 0.3))
		_crest(ctx, b, pts, Vector3(0, 1, -0.2).normalized(), hr * 0.7)
	elif el != "":
		_crest(ctx, b, [Vector3(-0.2, 1.12, -0.26), Vector3(0.2, 1.12, -0.26), Vector3(0, 0.95, -0.3)], Vector3(0, 0.6, -0.8).normalized(), 0.16)
	_attach(ctx, b, "")
	## 다리(굽은 짧은 다리 + 큰 발)
	for sx in [-1.0, 1.0]:
		var s: float = sx
		var lp := Part.new()
		lp.tube([Vector3(0, 0.05, 0), Vector3(s * 0.03, -0.24, 0.07), Vector3(0, -0.44, 0.0)], [0.14, 0.1, 0.09], bp, 10, 3, 0.5, 0.3)
		lp.blob(Vector3(0, -0.47, 0.08), Vector3(0.13, 0.08, 0.2), Basis(), _solid(skin.darkened(0.2)), 10, 5)
		var nm := "Leg" + ("L" if s > 0 else "R")
		_attach(ctx, lp, nm, Vector3(s * 0.17, 0.55, 0))
		ctx.rig.legs.append(["Body/" + nm, 0.0 if s > 0 else PI])
	## 팔 — 오른팔(-X)은 방망이.
	for sx in [-1.0, 1.0]:
		var s: float = sx
		var ap := Part.new()
		ap.tube([Vector3.ZERO, Vector3(s * 0.12, -0.24, 0.04), Vector3(s * 0.14, -0.5, 0.1)], [0.11, 0.085, 0.08], bp, 10, 3, 0.6, 0.3)
		ap.blob(Vector3(s * 0.14, -0.58, 0.12), Vector3(0.12, 0.12, 0.12), Basis(), bp, 10, 6)
		if s < 0:
			var c0 := Vector3(s * 0.14, -0.6, 0.14)
			var c1 := c0 + Vector3(0, 0.3, 0.55)
			ap.tube([c0 + Vector3(0, -0.08, -0.15), c0, c0.lerp(c1, 0.6), c1], [0.05, 0.05, 0.1, 0.12], _solid(Color(0.46, 0.3, 0.18).lerp(horn, 0.15)), 10, 3, 0.4, 0.8)
			for i in 6:
				var a := TAU * float(i) / 6.0
				var st := c0.lerp(c1, 0.75 + 0.1 * float(i % 2))
				var dir := Vector3(cos(a), sin(a) * 0.5, sin(a) * 0.5).normalized()
				ap.spike(st + dir * 0.08, st + dir * 0.18, 0.035, _solid(horn.lightened(0.2)), 5)
		var nm := "Arm" + ("L" if s > 0 else "R")
		_attach(ctx, ap, nm, Vector3(s * 0.33, 1.1, 0.0))
		ctx.rig.arms.append(["Body/" + nm, PI if s > 0 else 0.0])
	ctx.rig.mode = "biped"

# ================================================================ 움직임

## idle(숨쉬기·꼬리 흔들기·느린 날갯짓) / walk(대각선 걸음·몸 들썩·빠른 날갯짓). 이름은 VRoid 몸과 같다.
static func _animate(root: Node3D, rig: Dictionary) -> void:
	var ap := AnimationPlayer.new()
	ap.name = "AnimationPlayer"
	var lib := AnimationLibrary.new()
	lib.add_animation("idle", _clip(root, rig, false))
	lib.add_animation("walk", _clip(root, rig, true))
	ap.add_animation_library("", lib)
	ap.autoplay = "idle"
	root.add_child(ap)

static func _clip(root: Node3D, rig: Dictionary, walk: bool) -> Animation:
	var a := Animation.new()
	var mode: String = rig.mode
	var dur := 0.72 if walk else 2.4
	if mode == "bird" and walk:
		dur = 0.5
	a.length = dur
	a.loop_mode = Animation.LOOP_LINEAR
	match mode:
		"bird":
			_wave(a, "Body:position", Vector3.ZERO, Vector3(0, 0.16 if walk else 0.1, 0), dur, 1.0, 0.5)
		"serpent":
			_wave(a, "Body:rotation", Vector3.ZERO, Vector3(0, 0.22 if walk else 0.08, 0.03), dur, 1.0, 0.0)
			_wave(a, "Body:position", Vector3.ZERO, Vector3(0, 0.05 if walk else 0.03, 0), dur, 2.0, 0.0)
		_:
			if walk:
				_wave(a, "Body:position", Vector3.ZERO, Vector3(0, 0.03, 0), dur, 2.0, 0.0)
			else:
				_wave(a, "Body:scale", Vector3.ONE, Vector3(0, 0.025, 0.01), dur, 1.0, 0.0)
	var amp := 0.5 if mode != "turtle" else 0.32
	for l in rig.legs:
		_wave(a, String(l[0]) + ":rotation", Vector3.ZERO, Vector3(amp if walk else 0.0, 0, 0), dur, 1.0, float(l[1]))
	for arm in rig.arms:
		_wave(a, String(arm[0]) + ":rotation", Vector3.ZERO, Vector3(0.45 if walk else 0.06, 0, 0), dur, 1.0, float(arm[1]))
	for t in rig.tails:
		_wave(a, String(t) + ":rotation", Vector3.ZERO, Vector3(0.05, 0.35 if walk else 0.2, 0), dur, 1.0, 0.7)
	for w in rig.wings:
		var s: float = w[1]
		_wave(a, String(w[0]) + ":rotation", Vector3(0, 0, s * 0.3), Vector3(0, 0, s * (0.75 if walk else 0.18)), dur, 1.0 if walk else 2.0, 0.0)
	return a

## base + delta·sin(주기 cycles, 위상 phase) 를 12 마디로. 마지막 마디 = 첫 마디(이음매 없이 되풀이).
static func _wave(a: Animation, path: String, base: Vector3, delta: Vector3, dur: float, cycles: float, phase: float) -> void:
	var t := a.add_track(Animation.TYPE_VALUE)
	a.track_set_path(t, NodePath(path))
	a.value_track_set_update_mode(t, Animation.UPDATE_CONTINUOUS)
	a.track_set_interpolation_type(t, Animation.INTERPOLATION_CUBIC)
	var keys := 12
	for i in keys + 1:
		var u := float(i) / float(keys)
		a.track_insert_key(t, u * dur, base + delta * sin(TAU * u * cycles + phase))

# ================================================================ 다른 코드 모형이 쓰는 부품(낚시·과녁·보물 상자·신상)

static func _mat(color: Color, outline: bool) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = CEL_SHADER
	m.set_shader_parameter("albedo_tint", color)
	m.set_shader_parameter("albedo_texture", _white())
	if outline:
		var o := ShaderMaterial.new()
		o.shader = OUTLINE_SHADER
		m.next_pass = o
	return m

static var _white_tex: ImageTexture = null
static func _white() -> ImageTexture:
	if _white_tex == null:
		var img := Image.create(2, 2, false, Image.FORMAT_RGBA8)
		img.fill(Color.WHITE)
		_white_tex = ImageTexture.create_from_image(img)
	return _white_tex

static func _add(p: Node3D, mesh: Mesh, pos: Vector3, rot_deg: Vector3, color: Color, outline: bool, scl: Vector3 = Vector3.ONE) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.position = pos
	mi.rotation_degrees = rot_deg
	mi.scale = scl
	mi.material_override = _mat(color, outline)
	p.add_child(mi)
	return mi

static func _sphere(p: Node3D, r: float, pos: Vector3, color: Color, outline: bool = true, scl: Vector3 = Vector3.ONE) -> MeshInstance3D:
	var m := SphereMesh.new()
	m.radius = r
	m.height = r * 2.0
	m.radial_segments = 16
	m.rings = 8
	return _add(p, m, pos, Vector3.ZERO, color, outline, scl)
