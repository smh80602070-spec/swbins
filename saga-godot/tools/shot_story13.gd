extends RefCounted
## G-0074 촬영 도우미 — shot_scene.gd 의 static 단계가 부른다. 메모리에서만(저장 안 함) 회차 1·레벨 86 으로 13부 43장 넷째 단계
## (그날의 검은 가면)로 옮기고, 보스 남쪽 3.5m(카메라가 보는 -z 쪽에 보스 — 더 멀면 봉우리 비탈이라 안전 자리로 되돌려진다)에 플레이어를 세운다.

static func duel(tree: SceneTree) -> void:
	var p := tree.get_first_node_in_group("player") as Node3D
	var sq := tree.get_first_node_in_group("go_story")
	if p == null or sq == null:
		return
	PartyState.cycle = maxi(PartyState.cycle, 1)
	PartyState.exp = maxf(PartyState.exp, 86.0 * PartyState.EXP_PER_LEVEL)
	PartyState.level = maxi(PartyState.level, 86)
	PartyState.ar_paid = maxi(PartyState.ar_paid, PartyState.level + 1)
	PartyState.story = {"ch": 42, "step": 3}
	sq.call("set_track", "")
	sq.call("_enter_step")
	var t: Vector3 = sq.call("target_pos")
	p.global_position = t + Vector3(0.0, 0.3, 3.5)
	p.set("velocity", Vector3.ZERO)
