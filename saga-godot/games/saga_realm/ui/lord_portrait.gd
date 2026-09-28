extends Control
## 즉위(계승) 순간 얼굴을 보여주는 자리 — toast.gd(공용 헬퍼)와 같은 결로,
## RealmHUD.tscn 안의 인스턴스를 "lord_portrait" 그룹으로 찾아 쓴다.
## 지금은 GO·FOREST(103-4)와 같은 VRoid 자리표시자(AvatarSample_A)를 그대로
## 보여준다 — 인물별 실제 얼굴 구분은 나중에 VRoid Studio로 캐릭터를
## 새로 만들 때 이어간다(지금은 "누가 즉위했는지"를 얼굴로 보여주는 것만 목표).

@onready var name_label: Label = $NameLabel


## 2026-09-29 — 공방 몸 그림자 대역(ZZ_ShadowProxy)이 보이는 몸과 겹쳐 그려지지 않게(셀 셰이더는 안 입힌다).
func _ready() -> void:
	var v := get_node_or_null("Viewport/SubViewport/Visual")
	if v:
		preload("res://saga_core/shaders/cel_shader_apply.gd").setup_shadow_proxy(v)

static func show_lord(node: Node, lord_name: String, show_sec: float) -> void:
	var portraits := node.get_tree().get_nodes_in_group("lord_portrait")
	if portraits.is_empty():
		return
	var p: Control = portraits[0]
	p.name_label.text = lord_name
	p.show()
	node.get_tree().create_timer(show_sec).timeout.connect(func() -> void:
		if is_instance_valid(p) and p.name_label.text == lord_name:
			p.hide()
	)
