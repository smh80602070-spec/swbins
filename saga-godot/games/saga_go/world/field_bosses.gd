extends Node3D

## PLAN 106장 ㉓ — 원신식 들판 보스(세계에 서 있는 보스·보상 꽃·보스 막대). 규칙·표는 data/field_bosses.gd.
##   보스 셋을 제자리에 세운다(combat/field_boss.gd — 주간 보스와 같은 패턴, 세계 등급 적용). 쓰러뜨리면 그 집 자리에
##   보상 꽃이 피고, 3m 안에서 F(터치 "보상 (F)" 단추)로 원기 40 을 써서 받는다. 받으면 150초 뒤 보스가 다시 선다.
##   싸우는 동안(30m 안·보스가 쫓는 중) 화면 위 가운데에 보스 이름·Lv·체력 막대·방패 막대.
## 저장 없음 — 원기(PartyState.resin)만 비경과 같이 쓴다.

const FB := preload("res://games/saga_go/data/field_bosses.gd")
const Domains := preload("res://games/saga_go/data/domains.gd")
const Adventure := preload("res://games/saga_go/data/adventure.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const FieldBoss := preload("res://games/saga_go/combat/field_boss.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

signal claimed(id: String)
## G-0195 — 보스가 쓰러질 때(꽃이 피기 전) — 사냥 의뢰(world/trail.gd)가 듣는다. enemy 는 그 보스 노드(phase·shield 를 읽는다)
signal boss_died(id: String, enemy: Node)

const BAR_W := 480.0

var _player: Node3D = null
var _bosses: Dictionary = {} # id → FieldBoss
var _homes: Dictionary = {} # id → Vector3
var _blooms: Dictionary = {} # id → Node3D
var _claim_btn: Button = null
var _hud: Control = null
var _hud_label: Label = null
var _hp_fill: ColorRect = null
var _sh_fill: ColorRect = null
var _sh_bg: ColorRect = null

func _ready() -> void:
	add_to_group("go_field_bosses")
	_player = get_tree().get_first_node_in_group("player")
	if not InputMap.has_action("go_domain"):
		InputMap.add_action("go_domain")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_F
		InputMap.action_add_event("go_domain", ev)
	var wl := Adventure.world_level()
	for i in FB.ORDER.size():
		var id: String = FB.ORDER[i]
		var b: Dictionary = FB.BOSSES[id]
		var home := home_of(id)
		_homes[id] = home
		var e: CharacterBody3D = FieldBoss.new()
		e.name = "FieldBoss_" + id
		e.setup(b.kind, home + Vector3(0.0, 0.3, 0.0), 20260824 + 700 + i)
		e.drops = false # 보상은 꽃에서
		e.apply_world_level(wl)
		add_child(e)
		e.connect("died", _on_died.bind(id))
		_bosses[id] = e
	PartyState.world_changed.connect(_reapply_world_level)
	_build_hud()

static func home_of(id: String) -> Vector3:
	var b: Dictionary = FB.BOSSES[id]
	var c: Vector2 = b.cell
	var p := TestMap.world_pos(c.x, c.y, b.region)
	p.y = TerrainBuilder.height_at(b.region, p)
	return p

func boss(id: String) -> Node:
	return _bosses.get(id)

func has_bloom(id: String) -> bool:
	return _blooms.has(id)

func _reapply_world_level() -> void:
	var wl := Adventure.world_level()
	for id in _bosses:
		_bosses[id].call("apply_world_level", wl)

func _on_died(_e: Node, id: String) -> void:
	boss_died.emit(id, _e)
	## 꽃을 받을 때까지 되살아나지 않는다.
	_bosses[id].call("hold_respawn", 1.0e9)
	if not _blooms.has(id):
		_blooms[id] = _build_bloom(id)
	Toast.show(self, "%s 쓰러뜨림 — 보상 꽃이 피었다 (원기 %d)" % [FieldEnemy.KINDS[FB.BOSSES[id].kind].name, FB.RESIN_COST], 3.0)

## 3m 안 보상 꽃 id(없으면 "").
func near_bloom() -> String:
	if _player == null:
		return ""
	for id in _blooms:
		var d: Vector3 = _player.global_position - _homes[id]
		d.y = 0.0
		if d.length() <= FB.CLAIM_M:
			return id
	return ""

## 보상 꽃 — 원기 40 을 쓰고 받는다. 받았으면 true(모자라면 알리고 꽃은 남긴다).
func claim(id: String) -> bool:
	if not _blooms.has(id):
		return false
	if not Domains.spend_resin(FB.RESIN_COST):
		Toast.show(self, "원기가 모자라다 (%d/%d) — 꽃은 그대로 남는다" % [Domains.resin_now(), FB.RESIN_COST], 3.0)
		return false
	var wl := Adventure.world_level()
	var text := FB.reward_text(id, wl)
	PartyState.add_items(FB.reward_of(id, wl))
	PartyState.add_artifact(4)
	PartyState.add_exp(FB.REWARD_EXP)
	get_tree().call_group("go_eggs", "award", "bloom", "%s|%d" % [id, int(Time.get_unix_time_from_system() / 86400.0)])
	var bloom: Node3D = _blooms[id]
	CombatFeel.pickup(bloom, "보상")
	bloom.queue_free()
	_blooms.erase(id)
	_bosses[id].call("hold_respawn", FB.RESPAWN_SEC)
	Toast.show(self, "보상: %s · 원기 %d/%d" % [text, Domains.resin_now(), Domains.RESIN_MAX], 3.5)
	claimed.emit(id)
	return true

## 지금 싸우는 보스 id(없으면 "") — 30m 안, 쫓거나 치는 중.
func engaged_boss() -> String:
	if _player == null or get_tree().get_nodes_in_group("go_domain_active").size() > 0:
		return ""
	for id in _bosses:
		var e: Node3D = _bosses[id]
		var ai := int(e.get("ai"))
		if ai == FieldEnemy.AI.IDLE or ai == FieldEnemy.AI.RETURN or ai == FieldEnemy.AI.DEAD:
			continue
		if _player.global_position.distance_to(e.global_position) <= FB.ENGAGE_M:
			return id
	return ""

func hud_text() -> String:
	return _hud_label.text if _hud.visible else ""

func _physics_process(_delta: float) -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
		return
	_claim_btn.visible = near_bloom() != "" and not _modal_open()
	_refresh_hud()

## 보이는 창이 떠 있는가(숨겨 둔 선택지 창은 그룹에 남아 있다 — camera_rig._modal_open 과 같게). 자기 자신은 뺀다.
func _modal_open() -> bool:
	for n in get_tree().get_nodes_in_group("ui_modal"):
		if n != self and n.get("visible") != false:
			return true
	return false

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("go_domain"):
		var id := near_bloom()
		if id != "":
			claim(id)
			get_viewport().set_input_as_handled()

# ---------------------------------------------------------------- 보스 막대

func _build_hud() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 5
	add_child(layer)
	_claim_btn = Button.new()
	_claim_btn.text = "보상 (F) · 원기 %d" % FB.RESIN_COST
	_claim_btn.anchor_left = 0.5
	_claim_btn.anchor_right = 0.5
	_claim_btn.anchor_top = 1.0
	_claim_btn.anchor_bottom = 1.0
	_claim_btn.offset_left = -90
	_claim_btn.offset_right = 90
	_claim_btn.offset_top = -170
	_claim_btn.offset_bottom = -124
	_claim_btn.visible = false
	_claim_btn.pressed.connect(func() -> void:
		var id := near_bloom()
		if id != "":
			claim(id))
	layer.add_child(_claim_btn)
	_hud = Control.new()
	_hud.anchor_left = 0.5
	_hud.anchor_right = 0.5
	_hud.offset_left = -BAR_W * 0.5
	_hud.offset_right = BAR_W * 0.5
	_hud.offset_top = 64
	_hud.offset_bottom = 120
	_hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hud.visible = false
	layer.add_child(_hud)
	_hud_label = Label.new()
	_hud_label.size = Vector2(BAR_W, 26)
	_hud_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hud_label.add_theme_font_size_override("font_size", 18)
	_hud_label.add_theme_color_override("font_outline_color", Color(0, 0, 0))
	_hud_label.add_theme_constant_override("outline_size", 6)
	_hud.add_child(_hud_label)
	var bg := ColorRect.new()
	bg.color = Color(0.08, 0.06, 0.06, 0.8)
	bg.position = Vector2(0, 30)
	bg.size = Vector2(BAR_W, 12)
	_hud.add_child(bg)
	_hp_fill = ColorRect.new()
	_hp_fill.color = Color(0.9, 0.25, 0.2)
	_hp_fill.position = Vector2(2, 32)
	_hp_fill.size = Vector2(BAR_W - 4, 8)
	_hud.add_child(_hp_fill)
	_sh_bg = ColorRect.new()
	_sh_bg.color = Color(0.08, 0.06, 0.06, 0.8)
	_sh_bg.position = Vector2(0, 45)
	_sh_bg.size = Vector2(BAR_W, 8)
	_hud.add_child(_sh_bg)
	_sh_fill = ColorRect.new()
	_sh_fill.position = Vector2(2, 46)
	_sh_fill.size = Vector2(BAR_W - 4, 6)
	_hud.add_child(_sh_fill)
	for c in [bg, _hp_fill, _sh_bg, _sh_fill, _hud_label]:
		(c as Control).mouse_filter = Control.MOUSE_FILTER_IGNORE

## 106장 ㉜ 이야기 보스(go_story_boss 그룹 — story_quest duel 단계)가 싸우는 중이면 그것.
func _engaged_story_boss() -> Node:
	if _player == null:
		return null
	for e in get_tree().get_nodes_in_group("go_story_boss"):
		var ai := int(e.get("ai"))
		if ai == FieldEnemy.AI.IDLE or ai == FieldEnemy.AI.RETURN or ai == FieldEnemy.AI.DEAD:
			continue
		if _player.global_position.distance_to((e as Node3D).global_position) <= FB.ENGAGE_M:
			return e
	return null

func _refresh_hud() -> void:
	var id := engaged_boss()
	var e: Node = _bosses[id] if id != "" else _engaged_story_boss()
	_hud.visible = e != null
	if e == null:
		return
	var def: Dictionary = e.get("def")
	var hp_r := clampf(float(e.get("hp")) / float(e.get("max_hp")), 0.0, 1.0)
	var sh := float(e.get("shield"))
	var sh_max := float(e.get("max_shield"))
	var head := "Lv.%d %s" % [Adventure.enemy_level(maxi(int(e.get("world_lv")), 0)), def.name]
	var tail := ""
	if sh > 0.0:
		tail = " · %s 방패 %d" % [Elements.name_of(String(def.element)), int(sh)]
	_hud_label.text = "%s — 체력 %d%%%s" % [head, ceili(hp_r * 100.0), tail]
	_hp_fill.size.x = (BAR_W - 4.0) * hp_r
	var show_sh := sh > 0.0 and sh_max > 0.0
	_sh_bg.visible = show_sh
	_sh_fill.visible = show_sh
	if show_sh:
		_sh_fill.color = Elements.color_of(String(def.element))
		_sh_fill.size.x = (BAR_W - 4.0) * clampf(sh / sh_max, 0.0, 1.0)

# ---------------------------------------------------------------- 보상 꽃

func _glow(c: Color, alpha: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(c.r, c.g, c.b, alpha)
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m

func _mesh(parent: Node3D, mesh: Mesh, mat: Material, pos: Vector3) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	parent.add_child(mi)
	return mi

## 줄기 + 보스 원소 빛 꽃잎 다섯 + 빛무리 + 이름표. 천천히 돈다.
func _build_bloom(id: String) -> Node3D:
	var col := Elements.color_of(String(FieldEnemy.KINDS[FB.BOSSES[id].kind].element))
	var root := Node3D.new()
	root.name = "BossBloom_" + id
	add_child(root)
	root.global_position = _homes[id]
	var stem_m := StandardMaterial3D.new()
	stem_m.albedo_color = Color(0.3, 0.5, 0.25)
	var stem := CylinderMesh.new()
	stem.top_radius = 0.08
	stem.bottom_radius = 0.14
	stem.height = 1.4
	_mesh(root, stem, stem_m, Vector3(0.0, 0.7, 0.0))
	var head := Node3D.new()
	head.position = Vector3(0.0, 1.5, 0.0)
	root.add_child(head)
	var petal_m := StandardMaterial3D.new()
	petal_m.albedo_color = col.lightened(0.25)
	petal_m.emission_enabled = true
	petal_m.emission = col * 0.8
	for i in 5:
		var a := TAU * i / 5.0
		var pm := SphereMesh.new()
		pm.radius = 0.32
		pm.height = 0.64
		var p := _mesh(head, pm, petal_m, Vector3(cos(a), 0.0, sin(a)) * 0.38)
		p.scale = Vector3(1.0, 0.35, 0.6)
		p.rotation.y = -a
	var core := SphereMesh.new()
	core.radius = 0.2
	core.height = 0.4
	var core_m := StandardMaterial3D.new()
	core_m.albedo_color = Color(1.0, 0.95, 0.7)
	core_m.emission_enabled = true
	core_m.emission = Color(1.0, 0.9, 0.6)
	_mesh(head, core, core_m, Vector3(0.0, 0.08, 0.0))
	var halo := SphereMesh.new()
	halo.radius = 1.4
	halo.height = 2.8
	var h := _mesh(root, halo, _glow(col, 0.14), Vector3(0.0, 1.4, 0.0))
	h.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var tw := head.create_tween().set_loops()
	tw.tween_property(head, "rotation:y", TAU, 6.0).from(0.0)
	var label := Label3D.new()
	label.text = "보상 꽃 · 원기 %d (F)" % FB.RESIN_COST
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = true
	label.font_size = 40
	label.outline_size = 8
	label.pixel_size = 0.006
	label.position = Vector3(0.0, 2.6, 0.0)
	root.add_child(label)
	return root
