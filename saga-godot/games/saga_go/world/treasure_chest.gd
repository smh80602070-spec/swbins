extends Node3D

## PLAN 106장 ⑥ — 보물 상자 하나. 원신의 "등급 넷 + 잠금 방식" 문법만 따른다.
##   grade: common(평범) · exquisite(정교) · precious(진귀) · luxurious(화려)
##   lock : none(그냥 열림) · camp(둘레 적 무리를 한꺼번에 다 쓰러뜨리면 봉인이 풀림)
##          · torch(석등마다 정해진 원소를 원소 스킬·폭발로 밝히고, 다 켜져 있는 동안 풀림)
##          · target(106장 ㊵ — 둘레 과녁을 TARGET_SEC 안에 다 맞히면 풀림, world/shoot_target.gd)
## 다가가면 저절로 열린다(모바일에 새 버튼이 필요 없게). 연 상자는 EventState 에
## "chest_<id>" 로 남아 저장·재실행 뒤에도 되살아나지 않는다(원신 상자처럼 한 번뿐).
## 보상은 이 판 유일한 재화인 경험치(party_state.gd 헤더) — 새 경제를 만들지 않는다.

signal opened(chest: Node3D)

const CreatureBuilder := preload("res://saga_core/world/creature_builder.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Growth := preload("res://games/saga_go/data/growth.gd")
const Weapons := preload("res://games/saga_go/data/weapons.gd")
const ShootTarget := preload("res://games/saga_go/world/shoot_target.gd")
const RenderBudget := preload("res://games/saga_go/world/render_budget.gd")

const GRADES := {
	"common": {"name": "평범한 상자", "exp": 5.0, "scale": 1.0,
		"wood": Color(0.55, 0.36, 0.2), "metal": Color(0.42, 0.42, 0.46)},
	"exquisite": {"name": "정교한 상자", "exp": 15.0, "scale": 1.05,
		"wood": Color(0.42, 0.28, 0.2), "metal": Color(0.84, 0.87, 0.92)},
	"precious": {"name": "진귀한 상자", "exp": 30.0, "scale": 1.15,
		"wood": Color(0.55, 0.17, 0.14), "metal": Color(0.96, 0.78, 0.3)},
	"luxurious": {"name": "화려한 상자", "exp": 60.0, "scale": 1.3,
		"wood": Color(0.96, 0.8, 0.36), "metal": Color(0.58, 0.36, 0.88)},
}

const OPEN_RADIUS := 1.9
const ARTIFACT_DROPS := {"exquisite": [4], "precious": [5], "luxurious": [5, 5]}
const HINT_RADIUS := 7.0
const HINT_RESET_RADIUS := 12.0
const CAMP_RADIUS := 12.0
const CAMP_CHECK_SEC := 0.5
## 석등 하나가 켜져 있는 시간 — 셋을 이 안에 다 밝혀야 한다.
const TORCH_SEC := 20.0
## 석등이 상자에서 떨어진 거리. 원소 스킬 반경(4m)보다 멀어 한 자리에서 다 켜지지 않는다.
const TORCH_RING := 6.0
## 스킬 반경에 얹는 여유(석등 몸 두께).
const TORCH_REACH_PAD := 0.8
## 106장 ㊵ 과녁 하나가 켜져 있는 시간 — 셋을 이 안에 다 맞혀야 한다.
const TARGET_SEC := 10.0
const VANISH_SEC := 2.5
const TOAST_SEC := 4.0

var chest_id := ""
var grade := "common"
var lock := "none"
var torch_elements: Array = []
var target_specs: Array = [] ## 106장 ㊵ [[각도°, 거리 m, 판 높이 m, 흔들림 m], …]
var region := "village"

var sealed := false
var is_open := false
var _camp_alive := -1
var _camp_t := 0.0
var _hinted := false
var _lid: Node3D
var _seal: Node3D
var _torches: Array = [] ## [{node, element, flame, lit_t}]
var _targets: Array = [] ## shoot_target.gd 노드


func setup(id: String, grade_id: String, lock_id: String, region_id: String, pos: Vector3, elements: Array = []) -> void:
	chest_id = id
	grade = grade_id
	lock = lock_id
	region = region_id
	if lock_id == "target":
		target_specs = elements
	else:
		torch_elements = elements
	position = pos


func _ready() -> void:
	add_to_group("treasure_chest")
	sealed = lock != "none"
	var g: Dictionary = GRADES[grade]
	var body := Node3D.new()
	body.name = "Visual"
	body.scale = Vector3.ONE * float(g.scale)
	add_child(body)
	_build_chest(body, g.wood, g.metal)
	RenderBudget.merge_children(body)   # G-0114 — 쇠 띠·자물쇠 조각을 한 메시로(그림 그대로, draw call 만 준다)
	RenderBudget.merge_children(_lid)
	if sealed:
		_build_seal()
	if lock == "torch":
		add_to_group("element_receiver")
		_build_torches()
	if lock == "target":
		_build_targets()


func _physics_process(delta: float) -> void:
	if is_open:
		return
	if lock == "camp" and sealed:
		_camp_t -= delta
		if _camp_t <= 0.0:
			_camp_t = CAMP_CHECK_SEC
			_check_camp()
	if lock == "torch":
		_tick_torches(delta)
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if player == null:
		return
	var d := player.global_position - global_position
	var flat := Vector2(d.x, d.z).length()
	if flat > HINT_RESET_RADIUS:
		_hinted = false
	if sealed:
		if flat < HINT_RADIUS and not _hinted:
			_hinted = true
			Toast.show(self, lock_hint(), TOAST_SEC)
		return
	if flat < OPEN_RADIUS and absf(d.y) < 2.0 and _can_open(player):
		open()


func _can_open(player: Node3D) -> bool:
	if player.get("frozen"):
		return false
	return get_tree().get_nodes_in_group("duel_active").is_empty()


func lock_hint() -> String:
	var title: String = GRADES[grade].name
	match lock:
		"camp":
			return "🔒 %s — 둘레의 적을 모두 물리치면 봉인이 풀린다 (남은 %d)" % [title, maxi(_camp_alive, 0)]
		"target":
			return "🔒 %s — 과녁 %d개를 %d초 안에 모두 맞혀라 (활 조준 R · 법구·활 기본 공격)" % [title, _targets.size(), int(TARGET_SEC)]
		"torch":
			var names: Array = []
			for el in torch_elements:
				names.append(Elements.name_of(el))
			return "🔒 %s — 석등 %d개에 [%s] 원소를 밝혀라 (원소 스킬 K · 폭발 Q, %d초 안에)" % [title, torch_elements.size(), "·".join(names), int(TORCH_SEC)]
	return title


## 상자를 연다(점검에서 직접 부르기도 한다). 받은 경험치(천후·특성 배율 전)를 돌려준다.
func open() -> float:
	if is_open or sealed:
		return 0.0
	is_open = true
	var g: Dictionary = GRADES[grade]
	EventState.mark_resolved("chest_" + chest_id)
	var reward: float = g.exp
	PartyState.add_exp(reward)
	## 신수 알(data/eggs.gd) — 상자 등급마다 알이 나올 수 있다.
	get_tree().call_group("go_eggs", "award", "chest:" + grade, chest_id)
	## 106장 ⑩ — 육성 재료(냥·견문록·원소 결정, growth.gd CHEST_LOOT).
	PartyState.add_items(Growth.CHEST_LOOT.get(grade, {}))
	## 106장 ⑰ — 성유물(정교 ★4 하나·진귀 ★5 하나·화려 ★5 둘).
	for r in ARTIFACT_DROPS.get(grade, []):
		PartyState.add_artifact(r)
	## 106장 ⑯ — 진귀 ★3·화려 ★4 무기(상자마다 정해진 종류). 이미 있으면 재련.
	var wid := Weapons.chest_weapon(chest_id, grade)
	if wid != "":
		var got := PartyState.add_weapon(wid)
		Toast.show(self, "무기 %s %s" % [Weapons.info(wid).name, "— 재련" if got == "refine" else ("(재련 끝)" if got == "max" else "획득")], TOAST_SEC)
	var tw := create_tween()
	tw.tween_property(_lid, "rotation_degrees:x", -110.0, 0.5).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_sparkle(g.metal)
	CombatFeel.pickup(self, "보물 +%d" % int(reward))
	opened.emit(self)
	var vanish := create_tween()
	vanish.tween_interval(VANISH_SEC)
	vanish.tween_property(self, "scale", Vector3.ONE * 0.01, 0.35)
	vanish.tween_callback(queue_free)
	return reward


func unseal() -> void:
	if not sealed:
		return
	sealed = false
	if _seal:
		var tw := create_tween()
		tw.tween_property(_seal, "scale", Vector3.ONE * 1.8, 0.4)
		tw.tween_callback(_seal.queue_free)
		_seal = null
	CombatFeel.ui()
	Toast.show(self, "🔓 %s의 봉인이 풀렸다" % GRADES[grade].name, TOAST_SEC)

# ---------------------------------------------------------------- 잠금: 적 무리

func _check_camp() -> void:
	var total := 0
	var alive := 0
	for e in get_tree().get_nodes_in_group("field_enemy"):
		var home: Vector3 = e.get("home")
		if Vector2(home.x - global_position.x, home.z - global_position.z).length() > CAMP_RADIUS:
			continue
		total += 1
		if not e.call("is_dead"):
			alive += 1
	_camp_alive = alive
	if total > 0 and alive == 0:
		unseal()

# ---------------------------------------------------------------- 잠금: 원소 석등

## field_combat.gd 가 원소 스킬·폭발 때 call_group("element_receiver", ...) 로 부른다.
func receive_element(pos: Vector3, radius: float, element: String) -> void:
	if not sealed or element == "":
		return
	for t in _torches:
		if t.element != element:
			continue
		var tp: Vector3 = (t.node as Node3D).global_position
		if Vector2(tp.x - pos.x, tp.z - pos.z).length() > radius + TORCH_REACH_PAD:
			continue
		t.lit_t = TORCH_SEC
		(t.flame as Node3D).visible = true
	if lit_count() == _torches.size():
		unseal()


## 원소 시야(106장 ⑬)가 짚는 아직 꺼진 석등 [{pos, element}] — 봉인이 남아 있을 때만.
func unlit_torches() -> Array:
	var out: Array = []
	if not sealed or is_open:
		return out
	for t in _torches:
		if t.lit_t <= 0.0:
			out.append({"pos": (t.node as Node3D).global_position, "element": t.element})
	return out


func lit_count() -> int:
	var n := 0
	for t in _torches:
		if t.lit_t > 0.0:
			n += 1
	return n


func _tick_torches(delta: float) -> void:
	for t in _torches:
		if t.lit_t <= 0.0:
			continue
		## 봉인이 풀리면 석등은 켜진 채로 남는다(다 밝혔다는 표시).
		if not sealed:
			continue
		t.lit_t -= delta
		if t.lit_t <= 0.0:
			(t.flame as Node3D).visible = false

# ---------------------------------------------------------------- 잠금: 과녁(106장 ㊵)

func _build_targets() -> void:
	for i in target_specs.size():
		var sp: Array = target_specs[i]
		var a := deg_to_rad(float(sp[0]))
		var world := global_position + Vector3(sin(a), 0, cos(a)) * float(sp[1])
		world.y = TerrainBuilder.height_at(region, world) - 0.05
		var t := ShootTarget.new()
		t.name = "Target_%d" % i
		t.hold_sec = TARGET_SEC
		t.setup(to_local(world), float(sp[2]), Vector3.ZERO, float(sp[3]), float(i) * 2.1)
		t.struck.connect(_on_target_struck)
		add_child(t)
		_targets.append(t)


func _on_target_struck(_t: Node3D) -> void:
	if not sealed:
		return
	var n := hit_count()
	CombatFeel.ui()
	if n == _targets.size():
		for t in _targets:
			t.call("lock_lit")
		unseal()
	else:
		Toast.show(self, "과녁 %d/%d" % [n, _targets.size()], 1.5)


func hit_count() -> int:
	var n := 0
	for t in _targets:
		if t.call("is_lit"):
			n += 1
	return n


func targets() -> Array:
	return _targets.duplicate()


## 원소 시야(106장 ⑬)가 짚는 아직 안 맞은 과녁 자리 — 봉인이 남아 있을 때만.
func unhit_targets() -> Array:
	var out: Array = []
	if not sealed or is_open:
		return out
	for t in _targets:
		if not t.call("is_lit"):
			out.append(t.call("center"))
	return out

# ---------------------------------------------------------------- 모양

func _build_chest(p: Node3D, wood: Color, metal: Color) -> void:
	## 몸통 0.9×0.5×0.6, 앞 = +Z. 뚜껑은 뒤쪽 경첩(-Z)을 축으로 연다.
	_box(p, Vector3(0.9, 0.5, 0.6), Vector3(0, 0.25, 0), wood)
	for x in [-0.3, 0.3]:
		_box(p, Vector3(0.08, 0.52, 0.62), Vector3(x, 0.25, 0), metal, false)
	_box(p, Vector3(0.92, 0.07, 0.62), Vector3(0, 0.035, 0), metal, false)
	_lid = Node3D.new()
	_lid.name = "Lid"
	_lid.position = Vector3(0, 0.5, -0.3)
	p.add_child(_lid)
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.3
	cyl.bottom_radius = 0.3
	cyl.height = 0.9
	cyl.radial_segments = 16
	CreatureBuilder._add(_lid, cyl, Vector3(0, 0, 0.3), Vector3(0, 0, 90), wood, true)
	for x in [-0.3, 0.3]:
		var band := CylinderMesh.new()
		band.top_radius = 0.315
		band.bottom_radius = 0.315
		band.height = 0.08
		band.radial_segments = 16
		CreatureBuilder._add(_lid, band, Vector3(x, 0, 0.3), Vector3(0, 0, 90), metal, false)
	_box(p, Vector3(0.16, 0.2, 0.05), Vector3(0, 0.42, 0.31), metal, false)


func _box(p: Node3D, size: Vector3, pos: Vector3, color: Color, outline: bool = true) -> MeshInstance3D:
	var m := BoxMesh.new()
	m.size = size
	return CreatureBuilder._add(p, m, pos, Vector3.ZERO, color, outline)


func _glow_mat(color: Color, alpha: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(color.r, color.g, color.b, alpha)
	if alpha < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m


func _build_seal() -> void:
	_seal = Node3D.new()
	_seal.name = "Seal"
	_seal.position = Vector3(0, 0.45, 0)
	add_child(_seal)
	var color := Color(0.62, 0.45, 1.0) if lock == "camp" else (Color(0.95, 0.95, 0.85) if lock == "target" else Color(1.0, 0.72, 0.35))
	for i in 2:
		var ring := MeshInstance3D.new()
		var tor := TorusMesh.new()
		tor.inner_radius = 0.72
		tor.outer_radius = 0.8
		tor.rings = 24
		tor.ring_segments = 6
		ring.mesh = tor
		ring.material_override = _glow_mat(color, 0.7)
		ring.rotation_degrees = Vector3(70.0 if i == 0 else -70.0, 0, 0)
		ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_seal.add_child(ring)
	## 봉인 노드에 묶는다 — 상자에 묶으면 봉인을 지운 뒤 빈 루프가 돌아 "Infinite loop" 오류.
	var tw := _seal.create_tween().set_loops()
	tw.tween_property(_seal, "rotation_degrees:y", 360.0, 6.0).from(0.0)


func _build_torches() -> void:
	var n := torch_elements.size()
	for i in n:
		var a := TAU * float(i) / float(n) + PI * 0.5
		var world := global_position + Vector3(cos(a), 0, sin(a)) * TORCH_RING
		world.y = TerrainBuilder.height_at(region, world) - 0.05
		var t := Node3D.new()
		t.name = "Torch_%d" % i
		add_child(t)
		t.global_position = world
		## 106장 ㊵ 화살이 석등 머리에 멎는다(충전 화살 원소로 멀리서 밝히기) — aimed_shot.gd first_hit.
		t.add_to_group("arrow_stop")
		t.set_meta("arrow_y", 1.2)
		t.set_meta("arrow_r", 0.45)
		var el: String = torch_elements[i]
		var col := Elements.color_of(el)
		var stone := Color(0.55, 0.54, 0.5)
		var post := CylinderMesh.new()
		post.top_radius = 0.18
		post.bottom_radius = 0.26
		post.height = 1.1
		CreatureBuilder._add(t, post, Vector3(0, 0.55, 0), Vector3.ZERO, stone, true)
		_box(t, Vector3(0.62, 0.12, 0.62), Vector3(0, 1.14, 0), stone)
		var band := CylinderMesh.new()
		band.top_radius = 0.21
		band.bottom_radius = 0.21
		band.height = 0.1
		CreatureBuilder._add(t, band, Vector3(0, 0.85, 0), Vector3.ZERO, col, false)
		RenderBudget.merge_children(t)   # G-0114 — 돌 기둥·머리(같은 돌색)를 한 메시로, 원소 띠·불꽃은 그대로
		var flame := MeshInstance3D.new()
		var sph := SphereMesh.new()
		sph.radius = 0.2
		sph.height = 0.46
		flame.mesh = sph
		flame.material_override = _glow_mat(col, 1.0)
		flame.position = Vector3(0, 1.42, 0)
		flame.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		flame.visible = false
		t.add_child(flame)
		var label := Label3D.new()
		label.text = Elements.name_of(el)
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.modulate = col
		label.outline_size = 8
		label.font_size = 48
		label.pixel_size = 0.01
		label.position = Vector3(0, 1.95, 0)
		t.add_child(label)
		_torches.append({"node": t, "element": el, "flame": flame, "lit_t": 0.0})


func _sparkle(color: Color) -> void:
	for i in 6:
		var s := MeshInstance3D.new()
		var sph := SphereMesh.new()
		sph.radius = 0.06
		sph.height = 0.12
		s.mesh = sph
		s.material_override = _glow_mat(color.lightened(0.4), 1.0)
		s.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		s.position = Vector3(0, 0.6, 0)
		add_child(s)
		var a := TAU * float(i) / 6.0
		var tw := create_tween()
		tw.tween_property(s, "position", Vector3(cos(a) * 0.7, 1.7 + 0.2 * float(i % 2), sin(a) * 0.7), 0.7).set_ease(Tween.EASE_OUT)
		tw.tween_property(s, "scale", Vector3.ONE * 0.01, 0.4)
		tw.tween_callback(s.queue_free)
