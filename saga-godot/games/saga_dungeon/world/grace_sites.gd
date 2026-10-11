extends Node3D

## G-0193 — 2나락 은총 자리(엘든링, 웹 W-0102 의 고돗 짝). 죽음이 "그 자리에서 곧바로"가 아니라 루프가 되게 —
## 쓰러지면 마지막으로 밝힌 은총 자리에서 다시 선다(유품은 쓰러진 자리에 그대로 — 되찾으러 걸어간다).
##   은총 자리 = 첫 방(입구) + 샘 방(ROOM_KINDS "well"). 처음엔 첫 방이 밝혀져 있고, 샘 방에 들어서면 그곳이 은총이 된다(토스트 한 번).
##   방마다 바닥에 금빛 기둥 표식(코드 도형, 비조명 — 밝힌 것은 진하게, 아직은 옅게) + "은총" 이름표.
## 0.25초마다 플레이어가 선 방을 본다(매 틱 셈 금지). 저장은 안 한다 — 다시 켜면 첫 방부터(웹도 판마다 처음부터).
## test_room.gd 가 방을 다 지은 뒤 setup(방 z 원점, 방 종류)로 붙인다. player_health.gd 가 "dungeon_grace" 그룹으로 찾아 grace_pos()·room_label_at() 을 쓴다.

const Toast := preload("res://saga_core/ui/toast.gd")

const TICK_SEC := 0.25
const ROOM_HALF_Z := 6.0
const KIND_NAMES := {"elite": "정예 방", "trove": "보물 방", "fight": "싸움 방", "well": "샘 방", "miniboss": "우두머리 방", "cave": "굴 방"}
const LIT := Color(1.0, 0.82, 0.38, 0.9)
const DIM := Color(1.0, 0.82, 0.38, 0.28)
const GRACE_OFFSET := Vector3(0.0, 0.1, 2.5)   # 방 가운데에서 남쪽(입구 쪽)으로 조금 — 문 앞이 아니라 방 안

var origins: Array = []   # 방 z 원점
var kinds: Array = []
var grace_room := 0
var _markers := {}       # room index -> MeshInstance3D
var _acc := 0.0


func setup(p_origins: Array, p_kinds: Array) -> void:
	origins = p_origins
	kinds = p_kinds


func _ready() -> void:
	name = "GraceSites"
	add_to_group("dungeon_grace")
	for i in origins.size():
		if i == 0 or String(kinds[i]) == "well":
			_add_marker(i)
	_refresh_markers()


func _process(delta: float) -> void:
	_acc += delta
	if _acc < TICK_SEC:
		return
	_acc = 0.0
	tick()


## 한 번 셈 — 샘 방에 들어섰으면 은총을 옮긴다(점검도 부른다)
func tick() -> void:
	var p := get_tree().get_first_node_in_group("player") as Node3D
	if p == null:
		return
	var i := room_index_at(p.global_position.z)
	if i >= 0 and _markers.has(i) and i != grace_room:
		grace_room = i
		_refresh_markers()
		Toast.show(self, "✨ 은총 자리를 밝혔다 — 쓰러지면 여기서 다시 선다", 2.5)


## 방 번호(통로면 −1) — 방 i 는 z = origins[i] ± ROOM_HALF_Z
func room_index_at(z: float) -> int:
	for i in origins.size():
		if absf(z - float(origins[i])) <= ROOM_HALF_Z:
			return i
	return -1


func room_label_at(pos: Vector3) -> String:
	var i := room_index_at(pos.z)
	if i < 0:
		return "방 사이 통로"
	return "%d번째 방 · %s" % [i + 1, String(KIND_NAMES.get(String(kinds[i]), String(kinds[i])))]


func grace_pos() -> Vector3:
	return Vector3(0.0, 0.0, float(origins[grace_room])) + GRACE_OFFSET


func _add_marker(i: int) -> void:
	var mi := MeshInstance3D.new()
	mi.name = "Grace_%d" % i
	var cm := CylinderMesh.new()
	cm.top_radius = 0.05
	cm.bottom_radius = 0.35
	cm.height = 2.6
	mi.mesh = cm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position = Vector3(0.0, 1.3, float(origins[i])) + GRACE_OFFSET
	add_child(mi)
	var l := Label3D.new()
	l.text = "은총"
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.fixed_size = true
	l.pixel_size = 0.0012
	l.font_size = 24
	l.outline_size = 7
	l.modulate = Color(1.0, 0.9, 0.6)
	l.position = Vector3(0, 1.7, 0)
	mi.add_child(l)
	_markers[i] = mi


func _refresh_markers() -> void:
	for i: int in _markers:
		var m := StandardMaterial3D.new()
		var c: Color = LIT if i == grace_room else DIM
		m.albedo_color = c
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.emission_enabled = true
		m.emission = Color(c.r, c.g, c.b)
		(_markers[i] as MeshInstance3D).material_override = m
