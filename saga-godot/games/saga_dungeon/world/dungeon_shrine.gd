extends Node3D

## G-0406 2나락 성소(디아블로 2 shrine — 건드리면 잠깐 센 몸). 한 판에 SHRINE_ROOMS 방마다 하나:
##   자리   상자(trove)·우물(well) 방 오른쪽 뒤(OFF) · 종류 빛깔 기둥 + 위에 뜬 글(코드 도형 — 에셋 없음)
##   종류   KINDS 넷 — 분노(공격 +%)·방벽(받는 피해 −%)·질풍(공격 속도 +%)·재물(금 +%) · 씨앗 + 방 번호로 고름(같은 판 두 성소는 서로 다름)
##   쓰기   다가가면(USE_R) 저절로 — DungeonRunState.add_temp_buff(eff, v, SEC) · 기둥이 꺼지고(한 번만) 알림
##   셈     효과는 은사·장비와 같은 _sum_eff 길로 든다(atk_mult·guard_mult·atk_speed_mult·gold_mult). SAGA_SHRINE=0 이면 없음.

const Toast := preload("res://saga_core/ui/toast.gd")

const SHRINE_ROOMS := [1, 3]
const OFF := Vector3(3.4, 0.0, -2.6)
const USE_R := 1.8
const SEC := 30.0
const KINDS := [
	{"key": "wrath", "name": "분노의 성소", "emoji": "🔥", "eff": "atkPct", "v": 40.0, "text": "공격 +40%", "color": Color(1.0, 0.35, 0.2)},
	{"key": "ward", "name": "방벽의 성소", "emoji": "🛡️", "eff": "guardPct", "v": 30.0, "text": "받는 피해 −30%", "color": Color(0.35, 0.6, 1.0)},
	{"key": "gale", "name": "질풍의 성소", "emoji": "🌀", "eff": "atkSpdPct", "v": 35.0, "text": "공격 속도 +35%", "color": Color(0.4, 1.0, 0.6)},
	{"key": "fortune", "name": "재물의 성소", "emoji": "💰", "eff": "goldPct", "v": 100.0, "text": "금 +100%", "color": Color(1.0, 0.85, 0.3)},
]

var kind: Dictionary = {}
var used := false
var _player: Node3D = null
var _pillar: MeshInstance3D = null
var _light: OmniLight3D = null
var _label: Label3D = null


static func enabled() -> bool:
	return OS.get_environment("SAGA_SHRINE") != "0"


## 방 i 성소 종류(순수) — 같은 씨앗의 두 성소는 이웃 종류라 겹치지 않는다.
static func kind_for(seed_value: int, nth: int) -> Dictionary:
	return KINDS[posmod(seed_value + nth, KINDS.size())]


static func attach(room: Node, origins: Array, seed_value: int) -> Array:
	var out: Array = []
	if not enabled():
		return out
	for n in SHRINE_ROOMS.size():
		var i: int = SHRINE_ROOMS[n]
		if i >= origins.size():
			continue
		var s := new()
		s.name = "Shrine%d" % i
		s.kind = kind_for(seed_value, n)
		room.add_child(s)
		s.position = Vector3(0.0, 0.0, float(origins[i])) + OFF
		out.append(s)
	return out


func _ready() -> void:
	var col: Color = kind.get("color", Color.WHITE)
	_pillar = MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.28
	cm.bottom_radius = 0.42
	cm.height = 1.8
	_pillar.mesh = cm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = col.darkened(0.5)
	mat.emission_enabled = true
	mat.emission = col
	mat.emission_energy_multiplier = 1.4
	_pillar.material_override = mat
	_pillar.position = Vector3(0, 0.9, 0)
	add_child(_pillar)
	_light = OmniLight3D.new()
	_light.light_color = col
	_light.light_energy = 1.8
	_light.omni_range = 4.5
	_light.position = Vector3(0, 2.0, 0)
	add_child(_light)
	_label = Label3D.new()
	_label.text = "%s %s" % [String(kind.get("emoji", "")), String(kind.get("name", ""))]
	_label.font_size = 40
	_label.position = Vector3(0, 2.4, 0)
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.modulate = col.lightened(0.3)
	add_child(_label)


func _physics_process(_delta: float) -> void:
	if used:
		return
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
	if _player == null:
		return
	var d := Vector2(_player.global_position.x - global_position.x, _player.global_position.z - global_position.z).length()
	if d < USE_R:
		use()


func use() -> void:
	if used:
		return
	used = true
	DungeonRunState.add_temp_buff(String(kind.eff), float(kind.v), SEC)
	Toast.show(self, "%s %s — %d초 동안 %s" % [String(kind.emoji), String(kind.name), int(SEC), String(kind.text)], 3.0)
	(_pillar.material_override as StandardMaterial3D).emission_energy_multiplier = 0.05
	_light.light_energy = 0.15
	_label.modulate = Color(0.5, 0.5, 0.5, 0.6)
