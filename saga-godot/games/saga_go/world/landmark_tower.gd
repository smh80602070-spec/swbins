extends RefCounted

## saga-godot 2026-09-29 "그래픽 먼저" — 이야기 지역 명소가 들판에서 멀고 작아 보였다(옛 산성 담 2.6m·궁궐 지붕 7m).
## 멀리서도 보이는 높은 실루엣 두 가지를 명소 곁에 세운다: 성루(keep, 돌 탑 + 성가퀴 + 깃발) · 다층탑(pagoda, 층마다 처마).
## 둘 다 parent 원점(땅 높이 0)에서 위로 짓고, 아래 한 토막만 충돌(올라설 수 있는 건 아니다 — 보이기만). 재질은 prop_material.

const PropMaterial := preload("res://games/saga_go/world/prop_material.gd")


static func _box(parent: Node3D, size: Vector3, pos: Vector3, color: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	PropMaterial.apply_box(mi, size, color)
	mi.position = pos
	parent.add_child(mi)
	return mi


static func _flat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	return m


static func _glow(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = 2.2
	return m


static func _solid(parent: Node3D, size: Vector3, pos: Vector3) -> void:
	var body := StaticBody3D.new()
	body.position = pos
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	body.add_child(cs)
	parent.add_child(body)


## 네모 뿔 지붕(꼭대기 뾰족) — 밑 반지름 r·높이 h, 위아래 폭이 45° 돌아 네모 뿔이 된다.
static func _pyramid(parent: Node3D, r: float, h: float, pos: Vector3, color: Color) -> void:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.0
	cm.bottom_radius = r
	cm.height = h
	cm.radial_segments = 4
	cm.rings = 1
	mi.mesh = cm
	mi.material_override = _flat(color)
	mi.rotation.y = PI * 0.25
	mi.position = pos
	parent.add_child(mi)


## 성루 — 아래가 넓고 위가 좁은 돌 탑 셋 + 성가퀴 띠 + 뾰족 지붕 + 깃발. 높이 h(≥12).
static func keep(parent: Node3D, h: float, stone: Color, stone_dark: Color, roof: Color, banner: Color) -> void:
	var w := 7.0
	var base_h := h * 0.5
	_box(parent, Vector3(w + 1.4, 1.6, w + 1.4), Vector3(0, -0.2, 0), stone_dark) # 땅에 묻은 기단(굴곡을 덮는다)
	_box(parent, Vector3(w, base_h, w), Vector3(0, base_h * 0.5 + 0.6, 0), stone)
	_solid(parent, Vector3(w, base_h, w), Vector3(0, base_h * 0.5 + 0.6, 0))
	var mid_h := h * 0.32
	_box(parent, Vector3(w - 1.4, mid_h, w - 1.4), Vector3(0, base_h + 0.6 + mid_h * 0.5, 0), stone)
	## 위쪽 살짝 넓어지는 망루 방(성가퀴가 앞으로 내민다).
	var top_y := base_h + mid_h + 0.6
	_box(parent, Vector3(w + 0.8, 1.2, w + 0.8), Vector3(0, top_y + 0.6, 0), stone_dark)
	var room_h := 3.2
	_box(parent, Vector3(w - 0.6, room_h, w - 0.6), Vector3(0, top_y + 1.2 + room_h * 0.5, 0), stone)
	for k in 4:
		var a := k * PI * 0.5
		var n := Vector3(cos(a), 0, sin(a))
		for j in [-2.0, 0.0, 2.0]:
			var along: Vector3 = Vector3(-n.z, 0, n.x) * float(j)
			_box(parent, Vector3(1.0, 0.9, 1.0), n * (w * 0.5 + 0.2) + along + Vector3(0, top_y + 1.2 + room_h + 0.45, 0), stone_dark)
	## 창(어두운 구멍) 넷 — 실루엣에 결을 준다.
	for k in 4:
		var a2 := k * PI * 0.5
		var n2 := Vector3(cos(a2), 0, sin(a2))
		var win := _box(parent, Vector3(0.3, 1.4, 0.8) if absf(n2.x) > 0.5 else Vector3(0.8, 1.4, 0.3), n2 * (w * 0.5 - 0.25) + Vector3(0, base_h * 0.6, 0), Color(0.1, 0.09, 0.11))
		win.name = "Window%d" % k
	_pyramid(parent, w * 0.72, 5.0, Vector3(0, top_y + 1.2 + room_h + 2.5, 0), roof)
	## 깃발 — 꼭대기 장대와 나부끼는 천(세로로 긴 띠).
	var pole_y := top_y + 1.2 + room_h + 5.0
	_box(parent, Vector3(0.12, 4.0, 0.12), Vector3(0, pole_y + 2.0, 0), stone_dark)
	_box(parent, Vector3(0.06, 1.4, 2.4), Vector3(0, pole_y + 3.1, 1.25), banner)


## 다층탑 — 층마다 몸통 + 처마 지붕, 위로 갈수록 좁아지고 꼭대기에 빛 구슬. tiers 층(≥3), 층 높이 tier_h, 아래 폭 base_w.
static func pagoda(parent: Node3D, tiers: int, base_w: float, tier_h: float, wall: Color, roof: Color, glow: Color) -> void:
	var y := 0.0
	_box(parent, Vector3(base_w + 2.2, 1.2, base_w + 2.2), Vector3(0, 0.6, 0), wall.darkened(0.25)) # 기단
	_solid(parent, Vector3(base_w, tier_h, base_w), Vector3(0, 1.2 + tier_h * 0.5, 0))
	y = 1.2
	for t in tiers:
		var w := base_w * (1.0 - 0.13 * t)
		_box(parent, Vector3(w, tier_h, w), Vector3(0, y + tier_h * 0.5, 0), wall)
		## 층 앞뒤 문살 — 어두운 띠 둘.
		_box(parent, Vector3(w * 0.36, tier_h * 0.55, w + 0.1), Vector3(0, y + tier_h * 0.5, 0), wall.darkened(0.55))
		_box(parent, Vector3(w + 0.1, tier_h * 0.55, w * 0.36), Vector3(0, y + tier_h * 0.5, 0), wall.darkened(0.55))
		y += tier_h
		## 처마 — 넓고 납작한 네모 뿔.
		_pyramid(parent, w * 0.98, tier_h * 0.42, Vector3(0, y + tier_h * 0.21, 0), roof)
		y += tier_h * 0.3
	## 꼭대기 — 찰주(장대)와 빛 구슬.
	_box(parent, Vector3(0.2, tier_h * 1.6, 0.2), Vector3(0, y + tier_h * 0.8, 0), roof.darkened(0.3))
	var orb := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.7
	sm.height = 1.4
	orb.mesh = sm
	orb.material_override = _glow(glow)
	orb.position = Vector3(0, y + tier_h * 1.6 + 0.6, 0)
	parent.add_child(orb)
