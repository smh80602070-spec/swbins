extends Node3D

## G-0382 4종횡 룬(메이플스토리 — 사냥터에 가끔 룬이 서고, 건드려 화살표를 맞히면 한동안 경험치가 오른다).
##   서기   사냥터(적 생성기가 붙임)에서 GAP_MIN~GAP_MAX 초마다 하나 — 주인공 앞 SPAWN_DX m · 발 높이. LIFE_SEC 지나면 사라짐
##   풀기   닿으면(TOUCH_R) 화살표 ARROWS 개(←→↑↓ — move_left·move_right·move_forward·move_back, 화면 단추도)를 INPUT_SEC 안에 차례로
##   덤     다 맞히면 BUFF_SEC 동안 경험치 ×BUFF_MUL(story_enemy 처치 경험치에 곱 — exp_mul) · 틀리거나 늦으면 룬만 사라짐
##   그림   빛나는 돌기둥(코드 도형 — 에셋 없음). 화살표 창은 공용 CanvasLayer 하나. SAGA_RUNE=0 이면 안 섬.

const Toast := preload("res://saga_core/ui/toast.gd")

const GAP_MIN := 90.0
const GAP_MAX := 180.0
const LIFE_SEC := 60.0
const SPAWN_DX := 7.0
const TOUCH_R := 1.4
const ARROWS := 4
const INPUT_SEC := 6.0
const BUFF_SEC := 600.0
const BUFF_MUL := 2.0
const KEYS := {"←": "move_left", "→": "move_right", "↑": "move_forward", "↓": "move_back"}

static var buff_until_ms := 0

var _t := 0.0
var _life := 0.0
var _rune: Node3D = null
var _seq: Array = []
var _pos := 0
var _input_left := 0.0
var _layer: CanvasLayer = null
var _label: Label = null
var _rng := RandomNumberGenerator.new()
var _player: Node3D = null


static func enabled() -> bool:
	return OS.get_environment("SAGA_RUNE") != "0"


static func exp_mul() -> float:
	return BUFF_MUL if Time.get_ticks_msec() < buff_until_ms else 1.0


static func attach(parent: Node) -> Node3D:
	if not enabled():
		return null
	var n := new()
	n.name = "StoryRune"
	parent.add_child(n)
	return n


## 화살표 차례 맞히기(순수) — 지금 자리 pos 에 arrow 를 눌렀을 때: "next" · "done" · "wrong"
static func judge(seq: Array, pos: int, arrow: String) -> String:
	if pos >= seq.size() or String(seq[pos]) != arrow:
		return "wrong"
	return "done" if pos + 1 >= seq.size() else "next"


func _ready() -> void:
	_rng.randomize()
	_t = _rng.randf_range(GAP_MIN, GAP_MAX) * 0.5


func _player_ref() -> Node3D:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
	return _player


func _process(delta: float) -> void:
	if get_tree().paused:
		return
	if not _seq.is_empty():
		_input_left -= delta
		for arrow: String in KEYS:
			if Input.is_action_just_pressed(String(KEYS[arrow])):
				press(arrow)
				break
		if not _seq.is_empty() and _input_left <= 0.0:
			_finish(false)
		return
	var p := _player_ref()
	if p == null:
		return
	if _rune != null:
		_life -= delta
		var d := Vector2(p.global_position.x - _rune.global_position.x, p.global_position.y - _rune.global_position.y).length()
		if d < TOUCH_R:
			start_input()
		elif _life <= 0.0:
			_rune.queue_free()
			_rune = null
		else:
			_rune.rotation.y += delta * 1.5
		return
	_t -= delta
	if _t <= 0.0:
		_t = _rng.randf_range(GAP_MIN, GAP_MAX)
		spawn_rune()


## 룬 하나를 세운다(점검도 부른다).
func spawn_rune() -> void:
	var p := _player_ref()
	if p == null or _rune != null:
		return
	var face := signf(float(p.get("_facing"))) if p.get("_facing") != null else 1.0
	_rune = Node3D.new()
	_rune.name = "Rune"
	add_child(_rune)
	_rune.global_position = p.global_position + Vector3(SPAWN_DX * (face if face != 0.0 else 1.0), 0.0, 0.0)
	var mi := MeshInstance3D.new()
	var m := PrismMesh.new()
	m.size = Vector3(0.7, 1.4, 0.7)
	mi.mesh = m
	mi.position = Vector3(0, 0.9, 0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.4, 0.8, 1.0)
	mat.emission_enabled = true
	mat.emission = Color(0.35, 0.75, 1.0)
	mat.emission_energy_multiplier = 2.0
	mi.material_override = mat
	_rune.add_child(mi)
	var lt := OmniLight3D.new()
	lt.light_color = Color(0.4, 0.8, 1.0)
	lt.omni_range = 3.5
	lt.position = Vector3(0, 1.2, 0)
	_rune.add_child(lt)
	_life = LIFE_SEC
	Toast.show(self, "🔷 룬이 나타났다 — 가서 건드려 보자", 2.5)


func start_input() -> void:
	_seq = []
	var keys := KEYS.keys()
	for i in ARROWS:
		_seq.append(keys[_rng.randi() % keys.size()])
	_pos = 0
	_input_left = INPUT_SEC
	if _rune != null:
		_rune.queue_free()
		_rune = null
	_show_ui()


func _show_ui() -> void:
	if _layer == null:
		_layer = CanvasLayer.new()
		_layer.layer = 6
		add_child(_layer)
		var box := VBoxContainer.new()
		box.anchor_left = 0.5
		box.anchor_right = 0.5
		box.anchor_top = 0.3
		box.offset_left = -170.0
		box.offset_right = 170.0
		_layer.add_child(box)
		_label = Label.new()
		_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_label.add_theme_font_size_override("font_size", 34)
		box.add_child(_label)
		var row := HBoxContainer.new()
		row.alignment = BoxContainer.ALIGNMENT_CENTER
		box.add_child(row)
		for arrow: String in KEYS:
			var b := Button.new()
			b.text = arrow
			b.custom_minimum_size = Vector2(64, 56)
			b.focus_mode = Control.FOCUS_NONE
			var a := arrow
			b.pressed.connect(func() -> void: press(a))
			row.add_child(b)
	_layer.visible = true
	_refresh()


func _refresh() -> void:
	if _label == null:
		return
	var parts: PackedStringArray = []
	for i in _seq.size():
		parts.append(("[%s]" % _seq[i]) if i == _pos else (("·" if i < _pos else String(_seq[i]))))
	_label.text = "🔷 " + " ".join(parts)


## 화살표 하나(키·단추·점검).
func press(arrow: String) -> void:
	if _seq.is_empty():
		return
	match judge(_seq, _pos, arrow):
		"next":
			_pos += 1
			_refresh()
		"done":
			_finish(true)
		_:
			_finish(false)


func _finish(ok: bool) -> void:
	_seq = []
	if _layer != null:
		_layer.visible = false
	if ok:
		buff_until_ms = Time.get_ticks_msec() + int(BUFF_SEC * 1000.0)
		Toast.show(self, "🔷 룬 해방! — %d분 동안 경험치 ×%d" % [int(BUFF_SEC / 60.0), int(BUFF_MUL)], 3.5)
	else:
		Toast.show(self, "🔷 룬이 흩어졌다…", 2.0)
