extends RefCounted

## G-0312 한 판 결과 등급 공용(웹 shared/js/runrank-core.js W-0378 짝) — 점수식·덤 표·셈.
##   점수   급 t(1~5) · 피격 0→3·≤3+(t-1)→2·≤8+2(t-1)→1 · 연속 ≥20→3·≥10→2·≥5→1 · 시간 ≤180·≤360초×(1+0.25(t-1))→2·1 · 처치 ≥15 +1
##          (합 9) → S 7+·A 5+·B 3+·C 1+·D 0. 4종횡 G-0245 rank_of 를 그대로 옮김(4종횡은 이 함수를 부른다 — 결과 같음).
##   덤     살아 나온 판만 — 판에서 늘어난 금 × BONUS(S 0.5·A 0.2·B 0.1).
##   셈     Counter — begin·hit(2.5초 안 다음 타격이면 연속)·hurt(연속 끊김)·kill·finish(금, 쓰러짐) → {rank, sec, hits, combo, kills, tier, bonus_gold, dead}
##          · 처치 MIN_KILLS 미만이면 {}(등급 없음). 최고 기록은 판마다 제 세이브에(best_up).

const ORDER := ["D", "C", "B", "A", "S"]
const BONUS := {"S": 0.5, "A": 0.2, "B": 0.1}
const MIN_KILLS := 3
const COMBO_GAP_MS := 2500


static func rank_of(sec: float, hits: int, combo: int, kills: int = 0, tier: int = 1) -> String:
	var t := clampi(tier, 1, 5)
	var tm := 1.0 + 0.25 * float(t - 1)
	var p := 0
	p += 3 if hits == 0 else (2 if hits <= 3 + (t - 1) else (1 if hits <= 8 + 2 * (t - 1) else 0))
	p += 3 if combo >= 20 else (2 if combo >= 10 else (1 if combo >= 5 else 0))
	p += 2 if sec <= 180.0 * tm else (1 if sec <= 360.0 * tm else 0)
	p += 1 if kills >= 15 else 0
	return "S" if p >= 7 else ("A" if p >= 5 else ("B" if p >= 3 else ("C" if p >= 1 else "D")))


## 최고 기록 갱신 — best[key] 보다 높으면 바꾸고 {best: bool, prev_best}
static func best_up(best: Dictionary, key: String, rk: String) -> Dictionary:
	var old := String(best.get(key, ""))
	if old.is_empty() or ORDER.find(rk) > ORDER.find(old):
		best[key] = rk
		return {"best": true, "prev_best": old}
	return {"best": false, "prev_best": old}


## 둘째 줄 공용 조각 — 덤·최고 기록·쓰러짐(판마다 덧붙일 것은 extra)
static func line2(r: Dictionary, extra: Array = []) -> String:
	if r.is_empty():
		return ""
	var p: Array = []
	if int(r.get("bonus_gold", 0)) > 0:
		p.append("🪙 등급 덤 +%d" % int(r.bonus_gold))
	p.append_array(extra)
	if bool(r.get("best", false)):
		var pb := String(r.get("prev_best", ""))
		p.append("🏆 최고 기록 %s → %s" % [pb, String(r.rank)] if not pb.is_empty() else "🏆 첫 기록 %s" % String(r.rank))
	return " · ".join(p)


class Counter:
	extends RefCounted
	var t0_ms := 0
	var hits := 0
	var combo := 0
	var combo_max := 0
	var kills := 0
	var gold0 := 0
	var tier := 1
	var _last_hit_ms := 0

	func begin(gold_now: int, tier_now: int = 1) -> void:
		t0_ms = maxi(1, Time.get_ticks_msec())
		hits = 0
		combo = 0
		combo_max = 0
		kills = 0
		gold0 = gold_now
		tier = clampi(tier_now, 1, 5)
		_last_hit_ms = 0

	func active() -> bool:
		return t0_ms > 0

	func hit() -> void:
		if t0_ms <= 0:
			return
		var now := Time.get_ticks_msec()
		combo = combo + 1 if now - _last_hit_ms <= COMBO_GAP_MS else 1
		_last_hit_ms = now
		combo_max = maxi(combo_max, combo)

	func hurt() -> void:
		if t0_ms <= 0:
			return
		hits += 1
		combo = 0

	func kill() -> void:
		if t0_ms > 0:
			kills += 1

	## 판을 닫는다 — 덤 금은 돌려주기만(더하는 건 부르는 쪽). 처치 MIN_KILLS 미만이면 {}.
	func finish(gold_now: int, dead: bool = false) -> Dictionary:
		if t0_ms <= 0:
			return {}
		var sec := float(Time.get_ticks_msec() - t0_ms) / 1000.0
		t0_ms = 0
		if kills < MIN_KILLS:
			return {}
		var rk: String = (load("res://saga_core/data/runrank.gd") as GDScript).call("rank_of", sec, hits, combo_max, kills, tier)
		var bonus := 0 if dead else int(round(float(maxi(0, gold_now - gold0)) * float(BONUS.get(rk, 0.0))))
		return {"rank": rk, "sec": sec, "hits": hits, "combo": combo_max, "kills": kills, "tier": tier, "bonus_gold": bonus, "dead": dead}
