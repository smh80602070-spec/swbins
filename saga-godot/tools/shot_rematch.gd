extends RefCounted
## G-0112 촬영 도우미 — shot_scene.gd 의 static 단계가 부른다. 메모리에서만(저장 안 함) 13부 끝(44장) 뒤로 옮겨
## 재대결 비경 「그날 노래의 메아리」(rematch_dawn) 입구 앞에 세우거나(gate) 안으로 들인다(inside). probe_aftermath [9] 와 같은 길.

const ID := "rematch_dawn"


static func _prep(tree: SceneTree) -> Node:
	PartyState.cycle = maxi(PartyState.cycle, 1)
	PartyState.level = maxi(PartyState.level, 86)
	PartyState.story = {"ch": 44, "step": 0}
	return tree.get_first_node_in_group("go_domains")


## 입구 남쪽 4m — 카메라가 보는 -z 쪽에 입구.
static func gate(tree: SceneTree) -> void:
	var p := tree.get_first_node_in_group("player") as CharacterBody3D
	var dm := _prep(tree)
	if p == null or dm == null:
		return
	p.global_position = (dm.call("gate_pos", ID) as Vector3) + Vector3(0.0, 0.3, 4.0)
	p.velocity = Vector3.ZERO


## 입구 1m 앞에서 들어간다 — 비경 안 보스(그날의 검은 가면).
static func inside(tree: SceneTree) -> void:
	var p := tree.get_first_node_in_group("player") as CharacterBody3D
	var dm := _prep(tree)
	if p == null or dm == null:
		return
	p.global_position = (dm.call("gate_pos", ID) as Vector3) + Vector3(0.0, 0.3, 1.0)
	p.velocity = Vector3.ZERO
	dm.call("enter", ID, 0)
