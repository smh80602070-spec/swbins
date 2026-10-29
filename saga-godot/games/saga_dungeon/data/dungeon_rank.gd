extends RefCounted

## G-0312 2나락 던전 한 판 결과 등급(웹 js/dg-rank.js W-0378 짝) — 공용 saga_core/data/runrank.gd 어댑터.
##   한 판   던전에 들어서면(test_room _ready, 난도 굳힌 뒤) 시작 → 마지막 방을 나가면(_finish_exit is_final) 등급 · 쓰러지면(player_health
##           _die_and_respawn) 쓰러진 등급(덤 없음) 매기고 은총 자리에서 새 판.
##   셈      평타(melee_attack)·무예(skill_caster)가 적을 칠 때 hit · 내가 맞을 때 hurt · 적이 쓰러질 때 kill · 금 = DungeonGoldState.
##   급      난도 평 1·험 2·절 3 + 켠 부적 티어 / 3(최대 5) — 웹은 시작 층(f1·f6…), 고돗 던전은 층이 하나라 난도·부적으로.
##   덤      S 금 +50%·A +20%·B +10%(살아 나온 판만). 웹 S 덤 보석은 고돗 2나락에 보석 가방이 없어 뺀다(금 덤만).
##   최고    난도별 best[mode] — DungeonSaveState "rank_best" 칸(순수 추가, 버전 그대로). SAGA_RUNRANK=0 이면 끔.

const RunRank := preload("res://saga_core/data/runrank.gd")
const DungeonMode := preload("res://games/saga_dungeon/data/dungeon_mode.gd")
const Season := preload("res://games/saga_dungeon/data/dungeon_season.gd")   # G-0334 로컬 시즌·래더
const Bounty := preload("res://games/saga_dungeon/data/dungeon_bounty.gd")   # G-0372 현상금 — 같은 판 고리

static var counter: RefCounted = RunRank.Counter.new()
static var best: Dictionary = {}
static var last: Dictionary = {}


static func on() -> bool:
	return OS.get_environment("SAGA_RUNRANK") != "0"


static func tier_now() -> int:
	var mk: String = DungeonMode.run_mode if DungeonMode.run_mode != "" else DungeonMode.chosen
	var t: int = {"normal": 1, "hard": 2, "hell": 3}.get(mk, 1)
	if DungeonSigilState.is_active():
		t += int(DungeonSigilState.active_sigil().get("tier", 0)) / 3
	return clampi(t, 1, 5)


static func begin() -> void:
	if on():
		counter.call("begin", DungeonGoldState.gold, tier_now())
	Bounty.begin(tier_now())


static func hit() -> void:
	counter.call("hit")


static func hurt() -> void:
	counter.call("hurt")


## elite — 정예면 현상금 정예 셈도. 이번에 채운 현상금 이름들(토스트용).
static func kill(elite: bool = false) -> Array[String]:
	counter.call("kill")
	return Bounty.kill(elite)


## 판을 닫고 덤 금을 더한다 — 결과(등급 없으면 {})
static func finish(dead: bool = false) -> Dictionary:
	var r: Dictionary = counter.call("finish", DungeonGoldState.gold, dead)
	var br := Bounty.finish(r, dead)   # G-0372 끝 판정 현상금·덤 금(쓰러지면 0)
	if int(br.get("gold", 0)) > 0:
		DungeonSaveState.bounty_pending_gold += int(br.gold)   # G-0414 오늘 창에서 직접 받기
	if r.is_empty():
		last = {}
		return {}
	if int(r.bonus_gold) > 0:
		DungeonGoldState.add(int(r.bonus_gold))
	var mk: String = DungeonMode.run_mode if DungeonMode.run_mode != "" else DungeonMode.chosen
	r.merge(RunRank.best_up(best, mk, String(r.rank)), true)
	r["bounty"] = br
	r["season"] = Season.record(r)   # G-0334 살아 나온 판만 래더에(쓰러지면 {})
	last = r
	return r


static func line(r: Dictionary) -> String:
	if r.is_empty():
		return ""
	var s := int(r.sec)
	return "⭐ 이번 판 등급 %s — 피격 %d · 연속 %d · 처치 %d · %d:%02d" % [String(r.rank), int(r.hits), int(r.combo), int(r.kills), s / 60, s % 60]


static func text(r: Dictionary) -> String:
	if r.is_empty():
		return ""
	var l2 := RunRank.line2(r, ["💀 쓰러져 덤 없음"] if bool(r.get("dead", false)) else [])
	var sl := Season.line(r.get("season", {}))
	var bl := Bounty.text(r.get("bounty", {}))
	return line(r) + ("\n" + l2 if l2 != "" else "") + ("\n" + bl if bl != "" else "") + ("\n" + sl if sl != "" else "")


static func restore(saved: Variant) -> void:
	best = {}
	if typeof(saved) == TYPE_DICTIONARY:
		for k in (saved as Dictionary):
			var g := String((saved as Dictionary)[k])
			if RunRank.ORDER.has(g):
				best[String(k)] = g
