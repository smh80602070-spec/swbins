extends RefCounted
## G-0195 촬영 도우미 — shot_scene.gd 의 static 단계가 부른다. 오늘 마을 흔적 셋을 읽은 것으로 두고(메모리에서만, 저장 안 함)
## 플레이어를 아직 안 읽은 흔적 2m 곁에 세운다 — 흔적 표식·"🐾 흔적 읽기" 단추·미니맵 큰 짐승 표식·목표 줄이 찍힌다.

const Trail := preload("res://games/saga_go/data/trail.gd")
const Commissions := preload("res://games/saga_go/data/commissions.gd")

static func stage(tree: SceneTree) -> void:
	var tn := tree.get_first_node_in_group("go_trail")
	var p := tree.get_first_node_in_group("player") as Node3D
	if tn == null or p == null:
		return
	var vc: Array = []
	for c: Dictionary in tn.cells:
		if String(c.region) == "village":
			vc.append(c)
	PartyState.trail = {}
	for k in 3:
		Trail.read(PartyState.trail, Commissions.today(), String(vc[k].key), "village")
	tn.call("_refresh_hidden")
	var target: Dictionary = vc[5]
	p.global_position = (target.pos as Vector3) + Vector3(0, 0.4, 2.0)
	tn.call("tick")
	tn.emit_signal("changed")
