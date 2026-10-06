extends Control
## 즉위(계승) 순간 얼굴을 보여주는 자리 — toast.gd(공용 헬퍼)와 같은 결로,
## RealmHUD.tscn 안의 인스턴스를 "lord_portrait" 그룹으로 찾아 쓴다.
## G-0030 — 장면의 Visual 은 빈 자리이고, 즉위하는 군주마다 새 인물 몸(characters_dex, 이름 해시로 299 중 하나)을 끼운다.

@onready var name_label: Label = $NameLabel

## 2026-09-30 탈것 — 사가국지엔 조작하는 몸이 없어(전략 판) 이동식 탈것 대신 군주 초상에 탈것을 태워 보인다.
## 즉위하는 군주마다 이름 해시로 신수 탈것 하나(data/mounts.gd 여섯 중) — 카메라를 물려 말·호랑이·새·용 위의 전신이 보이게.
const Mounts := preload("res://saga_core/data/mounts.gd")
const CreatureBuilder := preload("res://saga_core/world/creature_builder.gd")
const VroidBody := preload("res://saga_core/world/vroid_body.gd")
var _mount_body: Node3D = null


## 2026-09-29 — 공방 몸 그림자 대역(ZZ_ShadowProxy)이 보이는 몸과 겹쳐 그려지지 않게(셀 셰이더는 안 입힌다).
func _ready() -> void:
	_set_body("realm_lord")
	## 독립 세계(LordPortrait.tscn own_world_3d)라 주변광이 없다 — 하늘빛 주변광을 깐다.
	var svp := get_node_or_null("Viewport/SubViewport")
	if svp != null and svp.get_node_or_null("PortraitEnv") == null:
		var env := Environment.new()
		env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		env.ambient_light_color = Color(0.82, 0.86, 0.95)
		env.ambient_light_energy = 0.9
		var we := WorldEnvironment.new()
		we.name = "PortraitEnv"
		we.environment = env
		svp.add_child(we)
	var cam := get_node_or_null("Viewport/SubViewport/Camera3D") as Camera3D
	if cam:
		cam.position = Vector3(0.0, 2.1, 6.0)
		cam.look_at(Vector3(0.0, 1.55, 0.0))

## G-0030 — 빈 Visual 자리(또는 지난 군주 몸)를 이 군주의 새 몸으로. VroidBody 가 셀 셰이더·idle 까지 걸어 준다.
func _set_body(lord_name: String) -> void:
	var v := get_node_or_null("Viewport/SubViewport/Visual") as Node3D
	if v != null:
		VroidBody.wear(v, lord_name, 5)

## 이 군주의 몸·탈것(이름 해시로 고정)을 초상에 앉힌다. 이전 탈것은 치운다.
func set_mount(lord_name: String) -> void:
	_set_body(lord_name)
	if _mount_body != null:
		_mount_body.queue_free()
		_mount_body = null
	var list: Array = Mounts.MOUNTS
	var def: Dictionary = list[absi(lord_name.hash()) % list.size()]
	var vp := get_node_or_null("Viewport/SubViewport")
	var v := get_node_or_null("Viewport/SubViewport/Visual") as Node3D
	if vp == null or v == null:
		return
	_mount_body = CreatureBuilder.build_pet(String(def.id), float(def.height))
	_mount_body.name = "MountBody"
	vp.add_child(_mount_body)
	v.position = Vector3(0.0, float(def.ride), 0.0)

static func show_lord(node: Node, lord_name: String, show_sec: float) -> void:
	var portraits := node.get_tree().get_nodes_in_group("lord_portrait")
	if portraits.is_empty():
		return
	var p: Control = portraits[0]
	p.name_label.text = lord_name
	p.call("set_mount", lord_name)
	p.show()
	node.get_tree().create_timer(show_sec).timeout.connect(func() -> void:
		if is_instance_valid(p) and p.name_label.text == lord_name:
			p.hide()
	)
