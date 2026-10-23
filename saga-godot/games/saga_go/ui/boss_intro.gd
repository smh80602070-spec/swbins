extends Node

## G-0338 1만리 보스 등장 컷(원신 주간 보스·엘든 링 보스 이름 — 구조만) — 보스 바(ui/boss_bar.gd)가 새 보스를 처음 고를 때:
##   카메라   camera_rig.talk_shot(보스, 나) 로 보스를 내 어깨 너머로 SHOT_SEC 잡고 end_talk 로 원래 시점(대화 구도 그대로 — 새 카메라 길 없음).
##            대화 중(in_talk)이면 카메라는 안 건드리고 띠만.
##   띠       공용 saga_core/ui/boss_banner.gd(G-0339 로 뺌) — 큰 이름 + 아랫줄 "원소 · Lv". 이 노드 아래에 달고 띠가 끝나면 같이 지운다.
##   틈       패턴 중이 아니면 보스 skill_cd 를 SHOT_SEC + GRACE_SEC 이상으로, 이미 예고 중이면 skill_t 를 SHOT_SEC 늘림 — 화면을 뺏긴 사이 맞지 않게.
##   한 번    보스 몸(인스턴스)마다 이 씬에서 한 번 — 멀어졌다 다시 와도 또 안 함(_seen). 비경 보스(Lv 없음)도 같다.
##   SAGA_BOSS_INTRO=0 이면 끔(보스 바만, 옛 길).

const Elements := preload("res://games/saga_go/combat/elements.gd")
const Adventure := preload("res://games/saga_go/data/adventure.gd")
const BossBanner := preload("res://saga_core/ui/boss_banner.gd")

const SHOT_SEC := 1.3
const GRACE_SEC := 0.8   # 컷이 끝나고 첫 패턴까지 더 두는 틈

static var _seen := {}   # 보스 인스턴스 id → true
static var played := 0   # 점검용 — 몇 번 틀었나


static func on() -> bool:
	return BossBanner.on()


## 보스 바가 새 보스를 고를 때 부른다 — 틀었으면 true
static func maybe_play(host: Node, boss: Node3D) -> bool:
	if not on() or boss == null or not is_instance_valid(boss):
		return false
	var key := boss.get_instance_id()
	if _seen.has(key):
		return false
	_seen[key] = true
	played += 1
	if boss.get("skill_cd") != null and String(boss.get("skill")) == "":   # 컷 동안 첫 패턴을 미룬다(화면을 뺏긴 사이 맞지 않게)
		boss.set("skill_cd", maxf(float(boss.get("skill_cd")), SHOT_SEC + GRACE_SEC))
	elif boss.get("skill_t") != null:   # 이미 예고 중(쿨은 멀리서도 줄어 다가가자마자 시작될 수 있다) — 예고를 컷만큼 늘려 카메라가 돌아온 뒤 친다
		boss.set("skill_t", float(boss.get("skill_t")) + SHOT_SEC)
	var n: Node = load("res://games/saga_go/ui/boss_intro.gd").new()
	n.name = "BossIntro"
	host.add_child(n)
	n.call("_play", boss)
	return true


static func sub_text(boss: Node3D) -> String:
	var def: Dictionary = boss.get("def") if boss.get("def") is Dictionary else {}
	var p: Array = []
	var el := String(def.get("element", ""))
	if Elements.INFO.has(el):
		p.append("%s 원소" % String(Elements.INFO[el].name))
	var wl := int(boss.get("world_lv")) if boss.get("world_lv") != null else -1
	if wl >= 0:
		p.append("Lv.%d" % Adventure.enemy_level(wl))
	return " · ".join(p)


func _play(boss: Node3D) -> void:
	var def: Dictionary = boss.get("def") if boss.get("def") is Dictionary else {}
	var el := String(def.get("element", ""))
	var tint: Color = Elements.INFO[el].color if Elements.INFO.has(el) else Color(1.0, 0.9, 0.7)
	BossBanner.pop(self, String(def.get("name", "")), sub_text(boss), tint)
	get_tree().create_timer(BossBanner.IN_SEC + BossBanner.HOLD_SEC + BossBanner.OUT_SEC + 0.1).timeout.connect(queue_free)
	var rig := get_tree().get_first_node_in_group("camera_rig")
	var pl := get_tree().get_first_node_in_group("player") as Node3D
	if rig != null and pl != null and rig.has_method("talk_shot") and not bool(rig.call("in_talk")):
		rig.call("talk_shot", boss.global_position, pl.global_position)
		var mine: Vector3 = (rig.call("talk_target") as Dictionary).eye
		get_tree().create_timer(SHOT_SEC).timeout.connect(func() -> void:
			## 그 사이 대화가 제 구도로 바꿨으면(눈 자리가 다르면) 대화 몫이라 안 끊는다
			if is_instance_valid(rig) and bool(rig.call("in_talk")) and ((rig.call("talk_target") as Dictionary).eye as Vector3).is_equal_approx(mine):
				rig.call("end_talk"))
