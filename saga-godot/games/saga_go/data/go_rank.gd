extends RefCounted

## G-0313 1만리 무리 토벌 한 판 등급(웹 js/go-rank.js W-0379 짝) — 공용 saga_core/data/runrank.gd 어댑터.
##   한 판   들판 무리(combat/field_spawner.gd CAMPS — 적마다 meta "go_camp") 하나를 첫 타격부터 무리 전원이 쓰러질 때(토벌)까지.
##           무리마다 셈이 따로(두 무리와 동시에 싸워도 섞이지 않음 — 웹 한계 메모를 고돗에선 풂). 피격은 켜진 판 전부에.
##   셈      내 타격(field_enemy.apply_damage — 지속 피해 틱 FeelTuning.kind "dot" 은 안 셈) hit · 내가 맞음(field_combat take_damage) hurt ·
##           무리 적이 쓰러짐 kill · 최소 처치 = 무리 크기(둘짜리 무리도 등급).
##   급      세계 등급 wl → 1 + wl/2(최대 5) — 웹 거리 등급 자리.
##   덤      토벌 동안 늘어난 냥(mora) × S 0.5·A 0.2·B 0.1. 웹 S 단사 덤은 고돗 1만리에 단사가 없어 뺀다.
##   최고    무리별 best[go_camp] — SaveState "go_rank_best"(순수 추가, 버전 그대로). SAGA_RUNRANK=0 이면 끔.

const RunRank := preload("res://saga_core/data/runrank.gd")
const Adventure := preload("res://games/saga_go/data/adventure.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

static var runs: Dictionary = {}      # go_camp → Counter
static var members: Dictionary = {}   # go_camp → [적 노드…] (field_spawner 가 등록)
static var best: Dictionary = {}
static var last: Dictionary = {}


static func on() -> bool:
	return OS.get_environment("SAGA_RUNRANK") != "0"


static func register(camp: String, enemies: Array) -> void:
	members[camp] = enemies


static func tier_now() -> int:
	return clampi(1 + Adventure.world_level() / 2, 1, 5)


static func _mora() -> int:
	return int(PartyState.count("mora"))


static func _camp(enemy: Object) -> String:
	return String(enemy.get_meta("go_camp", "")) if enemy != null and enemy.has_meta("go_camp") else ""


static func hit(enemy: Object) -> void:
	var c := _camp(enemy)
	if c == "" or not on():
		return
	if not runs.has(c):
		var k: RefCounted = RunRank.Counter.new()
		k.call("begin", _mora(), tier_now())
		runs[c] = k
	(runs[c] as RefCounted).call("hit")


static func hurt() -> void:
	for c in runs:
		(runs[c] as RefCounted).call("hurt")


## 무리 적이 쓰러짐 — 무리 전원이 쓰러졌으면 토벌: 등급·덤·알림. 결과(아니면 {})
static func kill(enemy: Object) -> Dictionary:
	var c := _camp(enemy)
	if c == "" or not runs.has(c):
		return {}
	var k: RefCounted = runs[c]
	k.call("kill")
	var ms: Array = members.get(c, [])
	for e in ms:
		if is_instance_valid(e) and not bool((e as Object).call("is_dead")):
			return {}
	runs.erase(c)
	var r: Dictionary = k.call("finish", _mora(), false, maxi(1, ms.size()))
	if r.is_empty():
		return {}
	if int(r.bonus_gold) > 0:
		PartyState.add_items({"mora": int(r.bonus_gold)})
	r.merge(RunRank.best_up(best, c, String(r.rank)), true)
	last = r
	if enemy is Node and (enemy as Node).is_inside_tree():
		Toast.show(enemy as Node, text(r), 4.0)
	return r


static func text(r: Dictionary) -> String:
	if r.is_empty():
		return ""
	var s := int(r.sec)
	var l1 := "★ 토벌 등급 %s — 피격 %d · 연속 %d · %d:%02d" % [String(r.rank), int(r.hits), int(r.combo), s / 60, s % 60]
	var l2 := RunRank.line2(r).replace("💰 등급 덤", "💰 등급 덤 냥")
	return l1 + ("\n" + l2 if l2 != "" else "")


static func restore(saved: Variant) -> void:
	best = {}
	if typeof(saved) == TYPE_DICTIONARY:
		for k in (saved as Dictionary):
			var g := String((saved as Dictionary)[k])
			if RunRank.ORDER.has(g):
				best[String(k)] = g
