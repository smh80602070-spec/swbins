extends RefCounted
## G-0284 촬영 도우미 — shot_scene 의 static 단계가 부른다. 촬영(120프레임째) 8프레임 전에 동작 하나를 틀어 휘두름·시전 한가운데를 찍는다.
##   kind: "go_cast"(1만리 무예 시전 = 모캡 cast) · "go_strong"(강공격 = 모캡 내리찍기) · "dg_attack"(2나락 기본 공격) · "dg_cast"(2나락 쏘기 무예 몸짓)
## 손잡이 SAGA_ACTION_MOCAP=0 이면 옛 동작(1만리 skill·attack, 2나락은 서 있음) — 전후 비교용.

const AT := 82   # 단계(30프레임째) 뒤 82 = 112프레임째


static func at(tree: SceneTree, kind: String) -> void:
	## 창은 안 지운다 — 1만리 첫 안내를 지우면 붙잡은 봉화대 안내가 깨진다(G-0278 함정). 2나락 컷은 free_modal 단계가 먼저.
	var p := tree.get_first_node_in_group("player") as Node3D
	if p == null:
		return
	var n := [0]
	var cb := [Callable()]
	cb[0] = func() -> void:
		n[0] += 1
		if not is_instance_valid(p):
			tree.process_frame.disconnect(cb[0])
			return
		if n[0] == AT:
			match kind:
				"go_cast": p.call("play_action", "skill", 0.4, 0.0)
				"go_strong": p.call("play_action", "strong", 0.5, 0.0)
				"dg_attack":
					var mel := p.get_node_or_null("MeleeAttack")
					if mel != null:
						mel.set("_cooldown_left", 0.0)
						mel.call("try_attack")
				"dg_cast": p.call("play_once", "cast", 0.4)
			tree.process_frame.disconnect(cb[0])
	tree.process_frame.connect(cb[0])
