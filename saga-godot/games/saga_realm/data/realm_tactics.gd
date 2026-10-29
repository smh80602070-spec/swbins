extends RefCounted

const CampaignSkills := preload("res://games/saga_realm/data/realm_hero_skills.gd")
const CampaignGear := preload("res://games/saga_realm/data/realm_campaign_gear.gd")
const CampaignCommand := preload("res://games/saga_realm/data/realm_commander.gd")
const CampaignUltimate := preload("res://games/saga_realm/data/realm_ultimate.gd")
const CampaignClass := preload("res://games/saga_realm/data/realm_class.gd")
const BattleEvent := preload("res://games/saga_realm/data/realm_battle_event.gd")
const SideGoal := preload("res://games/saga_realm/data/realm_side_goal.gd")

## G-0182 — 사가천하 격자 전술 규칙 층. 웹 `saga-web/saga-realm/js/tactics.js`(W-0107) 를 화면 없이 그대로 옮겼다(함수 이름은 snake_case).
## "전투가 구경이다"를 깨는 소수 장수 격자 전술 — 화면은 G-0183(realm_tactics_view.gd), 결과 적용은 realm_rules_war.gd attack() 셋째 인자.
##
##   판      8열 × 6행, 내 편은 둘째·셋째 열·적은 여섯째·일곱째 열. 칸 = 평지·숲·강·성벽. 땅 꼴(plain·hill·river·mount)이 섞는 비율을 정하고,
##           공성이면 수비 쪽 끝에서 둘째 열에 성벽 줄(짝수 행). 강 칸은 못 선다(건널목 둘은 늘 남긴다).
##   엄폐    숲 = 절반 엄폐(피격 명중 −30%p) · 성벽 = 완전 엄폐(−50%p)
##   유닛    장수: hp = 50 + 통솔 · atk = 10 + 무력/5 · def = 무력/10 · mov 3 · rng 지력 ≥ 무력이면 2 아니면 1
##           부대: hp = 30 + 병력/200(최대 120) · atk 12 · def 2 · mov 2 · rng 1
##   차례    내 턴(장수마다 이동 한 번 + 공격 한 번) → 적 턴(AI) × 3턴
##   명중    clamp(65 + (atk − def)×2 − 엄폐, 10, 95) % · 피해 = atk × DMG_MUL(2) × (0.8~1.2) — 굴림은 판 씨앗 해시(난수 안 씀)
##   AI      닿는 적 중 명중이 가장 높은 쪽을 친다. 없으면 가장 가까운 적에게 다가가되 같은 거리면 엄폐 칸 먼저, 다가간 뒤 닿으면 친다
##   결과    적 전멸 = 대승(rout, 위력 +25% · 받는 피해 ×0.7) · 3턴 뒤 hp 비율(내/적) ≥ 1.5 = 승(win, +10%) · 그 밖 = 무승부(draw)
##           · 내 전멸 = 패(lose, −25%). 쓰러진 내 장수는 중상(wounded, 3달 출진 불가) — permadeath 를 켜면 영구 전사(fallen, 웹 기본)
##
## **판정 두 벌 금지** — 결과는 apply() 가 돌려주는 보정값 Dictionary 뿐. 판은 저장하지 않는다.
## 해시·굴림 순서·반올림(floor(x+0.5) = JS Math.round)은 웹과 같아 같은 씨앗이면 같은 판·같은 결과(probe_realm_tactics 가 웹 값과 맞춰 본다).

const COLS := 8
const ROWS := 6
const TURNS := 3
const MOV := 3
const MOV_TROOP := 2
const COVER := {"plain": 0, "forest": 30, "river": 0, "wall": 50}
const HIT_MIN := 10
const HIT_MAX := 95
const HIT_BASE := 65
const SUP_NAMES := ["C", "B", "A"]   # G-0390 realm_support.gd 와 같은 값
const SUP_BONUS := [5, 10, 15]
const OUT := {
	"rout": {"kind": "rout", "name": "대승", "winPct": 25, "lossMul": 0.7},
	"win": {"kind": "win", "name": "승", "winPct": 10, "lossMul": 1.0},
	"draw": {"kind": "draw", "name": "무승부", "winPct": 0, "lossMul": 1.0},
	"lose": {"kind": "lose", "name": "패", "winPct": -25, "lossMul": 1.0},
}
const WOUND_MONTHS := 3
## 땅 꼴 → 칸 비율(웹 MIX 그대로)
const MIX := {
	"plain": {"forest": 0.12, "river": false, "rocks": 0.0},
	"hill": {"forest": 0.28, "river": false, "rocks": 0.0},
	"river": {"forest": 0.1, "river": true, "rocks": 0.0},
	"mount": {"forest": 0.35, "river": false, "rocks": 0.08},
}
const DIRS := [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]

## 손잡이(웹 rtk.tacticsDmg · rtk.permadeath)
static var dmg_mul := 2.0
## G-0190 — 고돗은 영구 전사를 기본으로 끈다(쓰러진 내 장수는 중상 3달). G-0188 측정: 전술 패 = 판에 선 장수 전원을 영영 잃어 F(패배 비용 = 진행의 10~20%)를 크게 넘었다.
## 웹(rtk.permadeath 기본 1)과 다른 기본값 — 같은 손잡이라 켜면 웹과 같다(점검 ⓪ 웹 맞춤은 켜고 돈다).
static var permadeath := false


static func js_round(x: float) -> int:
	return int(floor(x + 0.5))


## 작은 결정적 해시 0~1 — 웹 hash(seed, salt) 와 같은 FNV-1a + 섞기(32비트)
static func hash01(seed: String, salt: String) -> float:
	var h := 2166136261
	var s := seed + "|" + salt
	for i in s.length():
		h = h ^ s.unicode_at(i)
		h = (h * 16777619) & 0xFFFFFFFF
	h = h ^ (h >> 13)
	h = (h * 1274126177) & 0xFFFFFFFF
	h = h ^ (h >> 16)
	return float(h) / 4294967296.0


## 판 안의 다음 굴림 — 굴릴 때마다 순번이 오른다
static func roll(b: Dictionary, salt: String) -> float:
	b.n = int(b.n) + 1
	return hash01(String(b.seed), salt + "#" + str(b.n))


# ── 판 ──────────────────────────────────────────────

## 판 하나 — land = plain|hill|river|mount, siege = 공성이면 수비 쪽 성벽 줄. 순수 함수(같은 씨앗 = 같은 판)
static func make_board(seed: String, land: String, siege: bool) -> Dictionary:
	var key := land if MIX.has(land) else "plain"
	var mx: Dictionary = MIX[key]
	var cells: Array = []
	for y in ROWS:
		for x in COLS:
			var t := "plain"
			var r := hash01(seed, "c%d,%d" % [x, y])
			if x >= 2 and x <= 5 and r < float(mx.forest):
				t = "forest"
			elif float(mx.rocks) > 0.0 and x >= 2 and x <= 5 and r > 1.0 - float(mx.rocks):
				t = "wall"
			cells.append(t)
	if bool(mx.river):   # 가운데 세로 강 한 줄 — 건널목 둘
		var rx := 3 + (0 if hash01(seed, "rx") < 0.5 else 1)
		var f1 := int(floor(hash01(seed, "f1") * ROWS))
		var f2 := (f1 + 2 + int(floor(hash01(seed, "f2") * (ROWS - 3)))) % ROWS
		for y in ROWS:
			cells[y * COLS + rx] = "plain" if (y == f1 or y == f2) else "river"
	if siege:
		for y in ROWS:
			if y % 2 == 0:
				cells[y * COLS + (COLS - 2)] = "wall"
	return {"seed": seed, "land": key, "siege": siege, "cols": COLS, "rows": ROWS, "cells": cells, "units": [], "turn": 1, "side": "me", "n": 0, "done": "", "log": []}


static func cell_at(b: Dictionary, x: int, y: int) -> String:
	if x < 0 or y < 0 or x >= int(b.cols) or y >= int(b.rows):
		return ""
	return String(b.cells[y * int(b.cols) + x])


static func cover_at(b: Dictionary, x: int, y: int) -> int:
	return int(COVER.get(cell_at(b, x, y), 0))


# ── 유닛 ─────────────────────────────────────────────

## 장수 유닛 — stats = {might, wisdom, command}
static func officer_unit(id: String, side: String, stats: Dictionary) -> Dictionary:
	var might := float(stats.get("might", 60))
	var wisdom := float(stats.get("wisdom", 60))
	var command := float(stats.get("command", 60))
	var hp := 50.0 + command
	return {"uid": side + ":" + id, "id": id, "side": side, "kind": "officer", "hp": hp, "max": hp, "atk": 10.0 + might / 5.0, "def": might / 10.0,
		"mov": MOV, "rng": 2 if wisdom >= might else 1, "x": 0, "y": 0, "moved": false, "acted": false, "wis": wisdom}   # wis — G-0347 화계(웹엔 없음, 덧붙임만)


static func troop_unit(n: int, side: String, troops: int) -> Dictionary:
	var hp := float(mini(120, js_round(30.0 + float(troops) / 200.0)))
	return {"uid": side + ":troop" + str(n), "id": "", "side": side, "kind": "troop", "hp": hp, "max": hp, "atk": 12.0, "def": 2.0,
		"mov": MOV_TROOP, "rng": 1, "x": 0, "y": 0, "moved": false, "acted": false}


## 판에 두 편을 세운다 — mine = 내 장수 id(셋까지), foes = 적 장수 id, foe_troops = 적 부대 병력 배열(장수와 합쳐 3~5).
## stats = {id: {might, wisdom, command}}
static func units_of(b: Dictionary, mine: Array, foes: Array, foe_troops: Array, stats: Dictionary) -> Array:
	var list: Array = []
	for id: String in mine.slice(0, 3):
		list.append(officer_unit(id, "me", stats.get(id, {})))
	var fo: Array = foes.slice(0, 3)
	for id: String in fo:
		list.append(officer_unit(id, "foe", stats.get(id, {})))
	var tr: Array = foe_troops.slice(0, maxi(0, 5 - fo.size()))
	while fo.size() + tr.size() < 3:
		tr.append(3000)
	for k in tr.size():
		list.append(troop_unit(k, "foe", int(tr[k])))
	var slots := {"me": [], "foe": []}
	for y in int(b.rows):
		for x in range(1, 3):
			slots.me.append(Vector2i(x, (y * 2 + 1) % int(b.rows)))
		for x in range(int(b.cols) - 2, int(b.cols) - 4, -1):
			slots.foe.append(Vector2i(x, (y * 2 + 1) % int(b.rows)))
	var used := {}
	for u: Dictionary in list:
		for s: Vector2i in slots[u.side]:
			var key := "%d,%d" % [s.x, s.y]
			var c := cell_at(b, s.x, s.y)
			if used.has(key) or c == "river" or c == "wall":
				continue
			used[key] = 1
			u.x = s.x
			u.y = s.y
			break
	b.units = list
	return list


static func unit(b: Dictionary, uid: String) -> Dictionary:
	for u: Dictionary in b.units:
		if String(u.uid) == uid:
			return u
	return {}


static func alive(b: Dictionary, side: String = "") -> Array:
	return (b.units as Array).filter(func(u: Dictionary) -> bool: return float(u.hp) > 0.0 and (side == "" or String(u.side) == side))


static func occupied(b: Dictionary, x: int, y: int) -> bool:
	for u: Dictionary in b.units:
		if float(u.hp) > 0.0 and int(u.x) == x and int(u.y) == y:
			return true
	return false


static func dist(a: Dictionary, c: Dictionary) -> int:
	return absi(int(a.x) - int(c.x)) + absi(int(a.y) - int(c.y))


## 갈 수 있는 칸들(제자리 포함) — 상하좌우 mov 걸음, 강·남이 선 칸은 못 지난다. [{x, y}]
static func moves(b: Dictionary, uid: String) -> Array:
	var u := unit(b, uid)
	if u.is_empty() or float(u.hp) <= 0.0:
		return []
	if bool(u.moved):
		return [{"x": int(u.x), "y": int(u.y)}]
	var seen := {"%d,%d" % [int(u.x), int(u.y)]: 1}
	var out: Array = []
	var q: Array = [[int(u.x), int(u.y), 0]]
	var qi := 0
	while qi < q.size():
		var c: Array = q[qi]
		qi += 1
		out.append({"x": c[0], "y": c[1]})
		if int(c[2]) >= int(u.mov):
			continue
		for d: Vector2i in DIRS:
			var nx: int = int(c[0]) + d.x
			var ny: int = int(c[1]) + d.y
			var kk := "%d,%d" % [nx, ny]
			var t := cell_at(b, nx, ny)
			if seen.has(kk) or t == "" or t == "river" or occupied(b, nx, ny):
				continue
			seen[kk] = 1
			q.append([nx, ny, int(c[2]) + 1])
	return out


static func move(b: Dictionary, uid: String, x: int, y: int) -> bool:
	var u := unit(b, uid)
	if u.is_empty() or String(u.side) != String(b.side) or bool(u.moved) or String(b.done) != "":
		return false
	var ok := false
	for c: Dictionary in moves(b, uid):
		if int(c.x) == x and int(c.y) == y:
			ok = true
			break
	if not ok:
		return false
	if bool(b.get("srpg", false)) and (x != int(u.x) or y != int(u.y)):
		_face_to(u, x + (x - int(u.x)), y + (y - int(u.y)))   # G-0347 ③ 걸어간 쪽을 본다
	u.x = x
	u.y = y
	u.moved = true
	if bool(b.get("srpg", false)):
		check(b)   # G-0347 R-5 성문 칸에 서는 즉시 판정(옛 판은 걸음으로 끝나지 않아 웹 맞춤 그대로)
	return true


## 명중률(%) — 순수 함수
static func hit_chance(att: Dictionary, tgt: Dictionary, cover: int) -> int:
	return maxi(HIT_MIN, mini(HIT_MAX, js_round(HIT_BASE + (float(att.atk) - float(tgt.def)) * 2.0 - float(cover))))


static func in_range(a: Dictionary, t: Dictionary) -> bool:
	return dist(a, t) <= int(a.rng)


## 친다 — {ok, hit, dmg, killed, chance}
static func attack(b: Dictionary, uid: String, tuid: String) -> Dictionary:
	var a := unit(b, uid)
	var t := unit(b, tuid)
	if a.is_empty() or t.is_empty() or float(a.hp) <= 0.0 or float(t.hp) <= 0.0 or bool(a.acted) or a.side == t.side or String(a.side) != String(b.side) or String(b.done) != "" or not in_range(a, t):
		return {"ok": false}
	var ch := hit_chance_b(b, a, t)   # G-0347 ③ SRPG 판이면 높이·상성·뒤치기까지(옛 판은 hit_chance 그대로)
	if bool(b.get("srpg", false)):
		_face_to(a, int(t.x), int(t.y))
	var hit := roll(b, "h") * 100.0 < float(ch)
	var dmg := 0
	if hit:
		dmg = maxi(1, js_round(float(a.atk) * dmg_mul * (0.8 + roll(b, "d") * 0.4)))
		if bool(b.get("campaign", false)):
			dmg = CampaignSkills.damage(b, a, t, dmg)
		t.hp = maxf(0.0, float(t.hp) - float(dmg))
	a.acted = true
	a.moved = true
	_sup_note(b, a)   # G-0390 지원 — 이웃 쌍을 이 판에 적는다(b.sup 없으면 아무것도 안 함)
	(b.log as Array).append({"t": b.turn, "a": uid, "to": tuid, "hit": hit, "dmg": dmg, "ch": ch})
	var primary_log := (b.log as Array).size() - 1
	var skills: Array = []
	if bool(b.get("campaign", false)):
		skills = CampaignSkills.after(b, a, t, hit, dmg)
		if not skills.is_empty(): (b.log as Array)[primary_log]["skills"] = skills
		CampaignUltimate.on_attack(b, a, t, hit)
	var counter: Dictionary = {}
	if bool(b.get("command", false)):
		counter = CampaignCommand.counter(b, a, t, hit_chance_b(b, t, a), dmg_mul)
		CampaignCommand.sweep(b)
	check(b)
	return {"ok": true, "hit": hit, "dmg": dmg, "killed": float(t.hp) <= 0.0, "chance": ch, "skills": skills, "counter": counter}


# ── AI(같은 규칙을 양쪽이 쓴다) ──

static func _best_target(b: Dictionary, u: Dictionary, foes: Array) -> Dictionary:
	var best := {}
	var bc := -1
	for t: Dictionary in foes:
		if float(t.hp) > 0.0 and in_range(u, t):
			var c := hit_chance_b(b, u, t)
			if bool(b.get("command", false)) and String(t.get("kind", "")) == "officer": c += 10
			if c > bc:
				bc = c
				best = t
	return best


static func act_auto(b: Dictionary, u: Dictionary) -> void:
	if float(u.hp) <= 0.0 or String(b.done) != "":
		return
	if bool(u.get("confused", false)):   # G-0347 ⑤ 혼란 — 이번 차례를 쉬고 풀린다
		u.confused = false
		u.moved = true
		u.acted = true
		return
	if bool(b.get("campaign", false)) and CampaignUltimate.ai(b, u):
		check(b)
		return
	var foes := alive(b, "foe" if String(u.side) == "me" else "me")
	if foes.is_empty():
		return
	var tg := _best_target(b, u, foes)
	if tg.is_empty():
		var sorted: Array = foes.duplicate()
		sorted.sort_custom(func(p: Dictionary, q: Dictionary) -> bool:
			var dp := dist(u, p)
			var dq := dist(u, q)
			return dp < dq or (dp == dq and String(p.uid) < String(q.uid)))
		var near: Dictionary = sorted[0]
		if bool(b.get("campaign", false)):
			var lure := SideGoal.lure(b, u)
			if not lure.is_empty(): near = lure
		var pick := {}
		var pd := 1 << 30
		var pc := -1
		for c: Dictionary in moves(b, String(u.uid)):
			var d := maxi(0, dist(c, near) - int(u.rng))
			var cv := cover_at(b, int(c.x), int(c.y))
			if d < pd or (d == pd and cv > pc):
				pick = c
				pd = d
				pc = cv
		if not pick.is_empty():
			if bool(b.get("srpg", false)) and (int(pick.x) != int(u.x) or int(pick.y) != int(u.y)):
				_face_to(u, int(pick.x) + (int(pick.x) - int(u.x)), int(pick.y) + (int(pick.y) - int(u.y)))
			u.x = int(pick.x)
			u.y = int(pick.y)
		u.moved = true
		if bool(b.get("srpg", false)) and String(check(b)) != "":
			return
		tg = _best_target(b, u, foes)
	if not tg.is_empty():
		attack(b, String(u.uid), String(tg.uid))


## 한 편의 차례를 AI 로 둔다
static func auto_side(b: Dictionary, side: String) -> void:
	var s0: String = b.side
	b.side = side
	for u: Dictionary in alive(b, side):
		act_auto(b, u)
	b.side = s0


## 적 턴 — AI 가 다 두고 다음 턴으로(내 유닛 행동 초기화). 3턴이 끝나면 결과가 선다
static func ai_turn(b: Dictionary) -> String:
	if String(b.done) != "":
		return b.done
	if bool(b.get("command", false)) and String(b.side) == "me":
		for merc: Dictionary in CampaignCommand.unacted_mercs(b):
			act_auto(b, merc)
			if String(b.done) != "": return b.done
	auto_side(b, "foe")
	if bool(b.get("campaign", false)): SideGoal.foe_turn_end(b)
	if String(b.done) != "":
		return b.done
	burn_tick(b)   # G-0347 화계 — 불 없으면 아무것도 안 함(웹 맞춤 그대로)
	if String(b.done) != "":
		return b.done
	b.turn = int(b.turn) + 1
	for u: Dictionary in b.units:
		u.moved = false
		u.acted = false
	b.side = "me"
	if bool(b.get("campaign", false)):
		CampaignSkills.turn_start(b)
	if bool(b.get("command", false)):
		CampaignCommand.turn_start(b)
	if bool(b.get("campaign", false)):
		CampaignClass.turn_start(b)
		BattleEvent.turn_start(b)
	check(b)
	return b.done


static func end_turn(b: Dictionary) -> String:
	return ai_turn(b)


# ── 결과 ─────────────────────────────────────────────

static func hp_frac(b: Dictionary, side: String) -> float:
	var now := 0.0
	var mx := 0.0
	for u: Dictionary in b.units:
		if String(u.side) == side:
			now += float(u.hp)
			mx += float(u.max)
	return now / mx if mx > 0.0 else 0.0


static func check(b: Dictionary) -> String:
	if String(b.done) != "":
		return b.done
	if bool(b.get("campaign", false)):
		BattleEvent.scan(b)
		SideGoal.scan(b)
	if bool(b.get("srpg", false)):
		return check_srpg(b)
	if alive(b, "foe").is_empty():
		b.done = "rout"
	elif alive(b, "me").is_empty():
		b.done = "lose"
	elif int(b.turn) > TURNS:
		var m := hp_frac(b, "me")
		var f := hp_frac(b, "foe")
		b.done = "win" if (f <= 0.0 or m / f >= 1.5) else "draw"
	return b.done


## 결과 — 끝나지 않았으면 {}. fallen(영구 전사)·wounded(중상) 는 쓰러진 내 장수 id
static func outcome(b: Dictionary) -> Dictionary:
	var k := check(b)
	if k == "":
		return {}
	var down: Array = []
	var foe_down: Array = []
	for u: Dictionary in b.units:
		if String(u.side) == "me" and String(u.kind) == "officer" and float(u.hp) <= 0.0:
			down.append(String(u.id))
		elif String(u.side) == "foe" and float(u.hp) <= 0.0:
			foe_down.append(String(u.id) if String(u.id) != "" else String(u.uid))
	var o: Dictionary = OUT[k]
	var res := {"kind": k, "name": o.name, "winPct": int(o.winPct), "lossMul": float(o.lossMul), "turn": int(b.turn) if bool(b.get("srpg", false)) else mini(int(b.turn), TURNS),
		"hpMe": js_round(hp_frac(b, "me") * 100.0), "hpFoe": js_round(hp_frac(b, "foe") * 100.0),
		"fallen": down if permadeath else [], "wounded": [] if permadeath else down, "foeDown": foe_down}
	if not (b.get("sup_pairs", {}) as Dictionary).is_empty():
		res["supPairs"] = (b.sup_pairs as Dictionary).keys()   # G-0390 함께 싸운 쌍(있을 때만 — 없으면 옛 결과와 같다)
	var side_result := SideGoal.result(b)
	if not side_result.is_empty(): res["side"] = side_result
	return res


## 공략 판정이 받을 보정값 — 판정을 하지 않는다(realm_rules_war.gd attack() 셋째 인자로 넘긴다)
static func apply(out: Dictionary, where: String = "") -> Dictionary:
	if out.is_empty():
		return {}
	var wounded: Array = []
	for id: String in out.wounded:
		wounded.append({"id": id, "months": WOUND_MONTHS})
	var grid := {"winPct": int(out.winPct), "lossMul": float(out.lossMul), "kind": String(out.kind),
		"fallen": (out.fallen as Array).duplicate(), "wounded": wounded, "where": where}
	if out.has("supPairs"):
		grid["sup"] = (out.supPairs as Array).duplicate()   # G-0390 attack() 이 RealmSupport.on_end 로 센다
	if out.has("side"):
		grid["side"] = (out.side as Dictionary).duplicate(true)
	return grid


## 진단·균형용 — 양쪽 다 AI 로 끝까지 둔다
static func auto_play(b: Dictionary) -> Dictionary:
	var guard := 0
	while String(b.done) == "" and guard < (SRPG_CAP + 5 if bool(b.get("srpg", false)) else 20):
		guard += 1
		auto_side(b, "me")
		check(b)
		if String(b.done) != "":
			break
		ai_turn(b)
	return outcome(b)


# ── G-0347 화계(코에이 삼국지 — 구조만, 웹엔 없음) ──
## 지력 FIRE_WIS 이상 내 장수가 이동·공격 대신 FIRE_RANGE 칸(맨해튼) 안 숲 칸에 불을 놓는다(그 장수 차례 끝).
## 성공 = clamp(40 + (지력 − 60)×2, 30, 90)% · 붙으면 그 칸 + 이웃 숲 칸마다 50% 번짐 — 불 칸 위 유닛은 적·아군 가리지 않고 곧바로 한 번,
## 그리고 적 턴이 끝날 때마다(burn_tick) 다시 탄다. 불은 FIRE_TURNS 번 타고 꺼진다. 피해 = FIRE_DMG + 지력/10.
## 굴림은 판 순번(roll)을 쓴다 — 불을 안 쓰면 판·결과가 웹과 같다. 기록은 b.fire_log(공격 log 와 따로 — 화면 diff 가 안 섞이게).

const FIRE_WIS := 70.0
const FIRE_RANGE := 3
const FIRE_TURNS := 2
const FIRE_DMG := 6.0
const FIRE_SPREAD := 0.5


static func can_fire(b: Dictionary, uid: String) -> bool:
	var u := unit(b, uid)
	return not u.is_empty() and String(u.kind) == "officer" and String(u.side) == "me" and String(b.side) == "me" and String(b.done) == "" \
		and float(u.hp) > 0.0 and not bool(u.acted) and float(u.get("wis", 0.0)) >= FIRE_WIS and int(b.get("plots", PLOTS)) > 0   # ③ 책략은 한 판 두 번


static func fire_chance(u: Dictionary) -> int:
	return clampi(40 + int((float(u.get("wis", 0.0)) - 60.0) * 2.0), 30, 90)


static func burning(b: Dictionary) -> Dictionary:
	if not b.has("fire"):
		b.fire = {}
	return b.fire


## 불 놓을 수 있는 칸 [{x, y}]
static func fire_cells(b: Dictionary, uid: String) -> Array:
	var out: Array = []
	if not can_fire(b, uid) or String(b.get("weather", "clear")) == "rain":
		return out
	var u := unit(b, uid)
	var range := FIRE_RANGE - fog_cut(b)
	for y in int(b.rows):
		for x in int(b.cols):
			if cell_at(b, x, y) == "forest" and absi(x - int(u.x)) + absi(y - int(u.y)) <= range and not burning(b).has("%d,%d" % [x, y]):
				out.append({"x": x, "y": y})
	return out


static func _burn_units(b: Dictionary, dmg: int) -> Array:
	var hits: Array = []
	for u: Dictionary in b.units:
		if float(u.hp) > 0.0 and burning(b).has("%d,%d" % [int(u.x), int(u.y)]):
			u.hp = maxf(0.0, float(u.hp) - float(dmg))
			hits.append({"uid": u.uid, "dmg": dmg, "killed": float(u.hp) <= 0.0})
	return hits


## 불을 놓는다 — {ok, lit, chance, cells:[[x,y]…], hits:[{uid,dmg,killed}…]}
static func fire(b: Dictionary, uid: String, x: int, y: int) -> Dictionary:
	if not fire_cells(b, uid).has({"x": x, "y": y}):
		return {"ok": false}
	var u := unit(b, uid)
	var ch := fire_chance(u)
	var lit := roll(b, "f") * 100.0 < float(ch)
	var cells: Array = []
	var hits: Array = []
	var dmg := js_round(FIRE_DMG + float(u.wis) / 10.0)
	if lit:
		burning(b)["%d,%d" % [x, y]] = {"left": FIRE_TURNS, "dmg": dmg}
		cells.append([x, y])
		for d: Vector2i in DIRS:
			var nx := x + d.x
			var ny := y + d.y
			if nx >= 0 and ny >= 0 and nx < int(b.cols) and ny < int(b.rows) and cell_at(b, nx, ny) == "forest" and not burning(b).has("%d,%d" % [nx, ny]) and roll(b, "s") < FIRE_SPREAD:
				burning(b)["%d,%d" % [nx, ny]] = {"left": FIRE_TURNS, "dmg": dmg}
				cells.append([nx, ny])
		hits = _burn_units(b, dmg)
	b.plots = int(b.get("plots", PLOTS)) - 1
	u.acted = true
	u.moved = true
	if not b.has("fire_log"):
		b.fire_log = []
	(b.fire_log as Array).append({"t": b.turn, "a": uid, "lit": lit, "cells": cells, "hits": hits})
	check(b)
	return {"ok": true, "lit": lit, "chance": ch, "cells": cells, "hits": hits}


## 적 턴 끝 — 불 칸 위 유닛이 타고, 불이 한 번 줄고 0 이면 꺼진다. 탄 것 [{uid,dmg,killed}…]
static func burn_tick(b: Dictionary) -> Array:
	if not b.has("fire") or (b.fire as Dictionary).is_empty():
		return []
	var hits: Array = []
	for k: String in (b.fire as Dictionary).keys():
		var f: Dictionary = b.fire[k]
		var xy := k.split(",")
		for u: Dictionary in b.units:
			if float(u.hp) > 0.0 and int(u.x) == int(xy[0]) and int(u.y) == int(xy[1]):
				u.hp = maxf(0.0, float(u.hp) - float(f.dmg))
				hits.append({"uid": u.uid, "dmg": int(f.dmg), "killed": float(u.hp) <= 0.0})
		f.left = int(f.left) - 1
		if int(f.left) <= 0:
			(b.fire as Dictionary).erase(k)
	b.burn_last = hits
	check(b)
	return hits


# ── G-0347 ③ 격자 SRPG 본전투(PLAN §5-17 · 웹 W-0401 수치) ──
## 옛 판(make_board, 8×6·3턴)은 그대로 두고(웹 맞춤 ⓪) make_board_srpg 로 만든 판(b.srpg)만 아래 규칙을 쓴다.
##   판      땅 꼴별 크기 SRPG_SIZE(평지 10×8 · 강 11×8 · 구릉 11×9 · 산 12×10) · 언덕 칸(hill — 높이 1, 위에서 치면 명중 +HEIGHT_HIT)
##           공성이면 성벽 줄 + 가운데 성문 칸(gate — 지나갈 수 있음)
##   병종    부대마다(내 부대 my_troops 둘까지도) 창·기·궁(씨앗) — 창>기>궁>창 이기면 +COUNTER_HIT, 지면 −COUNTER_HIT · 기 이동 3 · 궁 사거리 2 · 창 방어 +2
##   방향    유닛은 걸어간 쪽·친 쪽을 본다(fx, fy). 뒤에서 치면(대상이 보는 방향의 반대편) +BACK_HIT
##   승리    goal 하나: rout 전멸 · leader 적 대장(첫 적 장수) 격파 · gate 성문 칸 점령(내 유닛이 서면) · hold HOLD_TURNS 턴 버팀
##           내 전멸 = 패 · SRPG_CAP 턴 넘으면 옛 체력 비율 판정. 대장·성문 = 대승(rout) · 버팀 = 승(win)
##   책략    한 판 PLOTS 번(화계 — 혼란·회복은 ⑤ 나머지)

const SRPG_SIZE := {"plain": Vector2i(10, 8), "river": Vector2i(11, 8), "hill": Vector2i(11, 9), "mount": Vector2i(12, 10)}
const HILL_MIX := {"plain": 0.08, "river": 0.06, "hill": 0.25, "mount": 0.2}
const HEIGHT_HIT := 10
const COUNTER_HIT := 20
const BACK_HIT := 20
const ARMS := ["spear", "cav", "bow"]
const BEATS := {"spear": "cav", "cav": "bow", "bow": "spear"}
const ARM_NAME := {"spear": "창", "cav": "기", "bow": "궁"}
const GOALS := ["rout", "leader", "gate", "hold"]
const GOAL_NAME := {"rout": "적 전멸", "leader": "적 대장 격파", "gate": "성문 점령", "hold": "%d턴 버티기"}
const HOLD_TURNS := 6
const SRPG_CAP := 30
const PLOTS := 2
## G-0425/W-0485 tuning switch. Disabled forces clear weather for baseline probes.
static var weather_enabled := true

static func weather_of(seed: String) -> String:
	if not weather_enabled: return "clear"
	var roll := hash01(seed, "wx")
	return "clear" if roll < 0.55 else "rain" if roll < 0.8 else "fog"

static func fog_cut(b: Dictionary) -> int:
	return 1 if String(b.get("weather", "clear")) == "fog" else 0

static func weather_text(b: Dictionary) -> String:
	match String(b.get("weather", "clear")):
		"rain": return "🌧️ 비 · 화계 불가"
		"fog": return "🌫️ 안개 · 활·책략 사거리 −1"
	return ""


static func make_board_srpg(seed: String, land: String, siege: bool, goal: String) -> Dictionary:
	var key := land if MIX.has(land) else "plain"
	var mx: Dictionary = MIX[key]
	var sz: Vector2i = SRPG_SIZE[key]
	var cols := sz.x
	var rows := sz.y
	var cells: Array = []
	for y in rows:
		for x in cols:
			var t := "plain"
			var r := hash01(seed, "c%d,%d" % [x, y])
			var h := hash01(seed, "h%d,%d" % [x, y])
			if x >= 2 and x <= cols - 3 and r < float(mx.forest):
				t = "forest"
			elif float(mx.rocks) > 0.0 and x >= 3 and x <= cols - 4 and r > 1.0 - float(mx.rocks):
				t = "wall"
			elif x >= 1 and x <= cols - 2 and h < float(HILL_MIX[key]):
				t = "hill"
			cells.append(t)
	if bool(mx.river):
		var rx := cols / 2 - 1 + (0 if hash01(seed, "rx") < 0.5 else 1)
		var f1 := int(floor(hash01(seed, "f1") * rows))
		var f2 := (f1 + 2 + int(floor(hash01(seed, "f2") * (rows - 3)))) % rows
		for y in rows:
			cells[y * cols + rx] = "plain" if (y == f1 or y == f2) else "river"
	var g := goal if GOALS.has(goal) else "rout"
	if g == "gate" and not siege:
		g = "rout"
	var gate := Vector2i(-1, -1)
	if siege:
		for y in rows:
			if y % 2 == 0:
				cells[y * cols + (cols - 3)] = "wall"
		gate = Vector2i(cols - 3, rows / 2)
		cells[gate.y * cols + gate.x] = "gate"
	return {"seed": seed, "land": key, "siege": siege, "cols": cols, "rows": rows, "cells": cells, "units": [], "turn": 1, "side": "me", "n": 0, "done": "", "log": [], "weather": weather_of(seed),
		"srpg": true, "goal": g, "gate": [gate.x, gate.y], "hold": HOLD_TURNS, "plots": PLOTS}


## SRPG 판에 두 편 — units_of 그대로 세운 뒤 병종·방향·대장을 붙인다
static func units_of_srpg(b: Dictionary, mine: Array, foes: Array, foe_troops: Array, stats: Dictionary, my_troops: Array = []) -> Array:
	var list := units_of(b, mine, foes, foe_troops, stats)
	for k in mini(my_troops.size(), 2):   # 내 부대(옛 판엔 없음) — 내 장수 뒤 빈 자리
		var t := troop_unit(k, "me", int(my_troops[k]))
		for y in int(b.rows):
			var placed := false
			for x in [1, 2, 0]:
				var c := cell_at(b, x, (y * 2 + 1) % int(b.rows))
				if c != "river" and c != "wall" and not occupied(b, x, (y * 2 + 1) % int(b.rows)):
					t.x = x
					t.y = (y * 2 + 1) % int(b.rows)
					placed = true
					break
			if placed:
				break
		list.append(t)
	b.units = list
	var k := 0
	for u: Dictionary in list:
		u.fx = 1 if String(u.side) == "me" else -1
		u.fy = 0
		u.arm = ""
		if String(u.kind) == "troop":
			var arm: String = ARMS[(int(floor(hash01(String(b.seed), "arm") * 3.0)) + k) % 3]   # 판 씨앗 자리에서 창·기·궁 차례로(셋이면 하나씩)
			k += 1
			u.arm = arm
			match arm:
				"cav":
					u.mov = 3
				"bow":
					u.rng = 2
				"spear":
					u.def = float(u.def) + 2.0
	for u: Dictionary in list:
		if String(u.side) == "foe" and String(u.kind) == "officer":
			u.leader = true
			break
	if bool(b.get("campaign", false)):
		for u: Dictionary in list:
			if String(u.kind) == "officer":
				CampaignSkills.attach(u)
				CampaignGear.apply(u)
		b.plots = int(b.get("plots", PLOTS)) + CampaignSkills.plots_bonus(b)
		if bool(b.get("command", false)):
			CampaignCommand.setup(b, stats, my_troops, foe_troops, {"mercs": b.get("mercs", {})}, int(b.get("merc_n", 2)), float(b.get("merc_mul", 1.2)))
		CampaignClass.apply(b, b.get("classes", {}))
		BattleEvent.setup(b, b.get("events", {}))
		SideGoal.setup(b, b.get("events", {}))
	if fog_cut(b) > 0:
		for u: Dictionary in list:
			if int(u.get("rng", 1)) > 1: u.rng = int(u.rng) - 1
	return list


static func _face_to(u: Dictionary, x: int, y: int) -> void:
	var dx := x - int(u.x)
	var dy := y - int(u.y)
	if dx == 0 and dy == 0:
		return
	if absi(dx) >= absi(dy):
		u.fx = signi(dx)
		u.fy = 0
	else:
		u.fx = 0
		u.fy = signi(dy)


static func height_at(b: Dictionary, x: int, y: int) -> int:
	return 1 if cell_at(b, x, y) == "hill" else 0


## 뒤치기 — 공격자가 대상이 보는 방향의 반대편(옆은 아님)
static func is_back(att: Dictionary, tgt: Dictionary) -> bool:
	return (int(att.x) - int(tgt.x)) * int(tgt.get("fx", 0)) + (int(att.y) - int(tgt.y)) * int(tgt.get("fy", 0)) < 0


## 명중 덤 내역 [[이름, %p]…] — 화면 풀이·점검
static func hit_mods(b: Dictionary, att: Dictionary, tgt: Dictionary) -> Array:
	var out: Array = []
	_sup_mods(b, att, tgt, out)   # G-0390 지원 — 옛 판·SRPG 판 둘 다(b.sup 없으면 아무것도 안 붙는다)
	if not bool(b.get("srpg", false)):
		return out
	if height_at(b, int(att.x), int(att.y)) > height_at(b, int(tgt.x), int(tgt.y)):
		out.append(["높이", HEIGHT_HIT])
	var aa := String(att.get("arm", ""))
	var ta := String(tgt.get("arm", ""))
	if aa != "" and ta != "":
		if String(BEATS[aa]) == ta:
			out.append(["상성", COUNTER_HIT])
		elif String(BEATS[ta]) == aa:
			out.append(["상성", -COUNTER_HIT])
	if is_back(att, tgt):
		out.append(["뒤", BACK_HIT])
	if bool(b.get("campaign", false)):
		CampaignSkills.mods(b, att, tgt, out)
	if bool(b.get("command", false)):
		CampaignCommand.hit_mods(b, att, tgt, out)
	if bool(b.get("campaign", false)):
		CampaignUltimate.mods(b, att, tgt, out)
		CampaignClass.mods(b, att, tgt, out)
	return out


# ── G-0390 지원 단계(웹 support.js 짝 — 단계 표는 판을 세울 때 b.sup = {'a|b': 0~3}, realm_support.gd board_table) ──

static func _sup_key(a: String, c: String) -> String:
	return a + "|" + c if a < c else c + "|" + a


## u 와 상하좌우로 붙은 살아 있는 내 장수들 중 b.sup 에 있는 쌍의 key
static func _sup_mates(b: Dictionary, u: Dictionary) -> Array:
	var out: Array = []
	if not b.has("sup") or String(u.get("side", "")) != "me" or String(u.get("kind", "")) != "officer" or String(u.get("id", "")) == "":
		return out
	for o: Dictionary in b.units:
		if String(o.uid) != String(u.uid) and float(o.hp) > 0.0 and String(o.side) == "me" and String(o.kind) == "officer" and dist(o, u) == 1:
			var k := _sup_key(String(u.id), String(o.id))
			if (b.sup as Dictionary).has(k):
				out.append(k)
	return out


## u 이웃 중 가장 높은 지원 단계(0~3)
static func sup_best(b: Dictionary, u: Dictionary) -> int:
	var best := 0
	for k: String in _sup_mates(b, u):
		best = maxi(best, int(b.sup[k]))
	return best


static func _sup_mods(b: Dictionary, att: Dictionary, tgt: Dictionary, out: Array) -> void:
	if not b.has("sup"):
		return
	var la := sup_best(b, att)
	var lt := sup_best(b, tgt)
	if la > 0:
		out.append(["지원 " + String(SUP_NAMES[la - 1]), int(SUP_BONUS[la - 1])])
	if lt > 0:
		out.append(["지원 막음 " + String(SUP_NAMES[lt - 1]), -int(SUP_BONUS[lt - 1])])


static func _sup_note(b: Dictionary, a: Dictionary) -> void:
	for k: String in _sup_mates(b, a):
		if not b.has("sup_pairs"):
			b["sup_pairs"] = {}
		b.sup_pairs[k] = 1


static func hit_chance_b(b: Dictionary, att: Dictionary, tgt: Dictionary) -> int:
	var base := hit_chance(att, tgt, cover_at(b, int(tgt.x), int(tgt.y)))
	var mods := hit_mods(b, att, tgt)
	if mods.is_empty():
		return base
	var add := 0
	for m: Array in mods:
		add += int(m[1])
	return maxi(HIT_MIN, mini(HIT_MAX, base + add))


static func goal_text(b: Dictionary) -> String:
	var g := String(b.get("goal", "rout"))
	return (String(GOAL_NAME[g]) % int(b.hold)) if g == "hold" else String(GOAL_NAME[g])


static func check_srpg(b: Dictionary) -> String:
	if bool(b.get("command", false)):
		CampaignCommand.sweep(b)
	if alive(b, "foe").is_empty():
		b.done = "rout"
	elif alive(b, "me").is_empty():
		b.done = "lose"
	else:
		match String(b.goal):
			"leader":
				for u: Dictionary in b.units:
					if bool(u.get("leader", false)) and float(u.hp) <= 0.0:
						b.done = "rout"
			"gate":
				var g: Array = b.gate
				for u: Dictionary in alive(b, "me"):
					if int(u.x) == int(g[0]) and int(u.y) == int(g[1]):
						b.done = "rout"
			"hold":
				if int(b.turn) > int(b.hold):
					b.done = "win"
		if String(b.done) == "" and int(b.turn) > SRPG_CAP:
			var m := hp_frac(b, "me")
			var f := hp_frac(b, "foe")
			b.done = "win" if (f <= 0.0 or m / f >= 1.5) else "draw"
	return b.done


# ── G-0347 ⑤ 책략 나머지 — 혼란·회복(화계와 같은 문턱·같은 횟수 PLOTS) ──
##   혼란   PLOT_RANGE 칸 안 적 하나 — 성공 clamp(50 + (내 지력 − 그 지력)×2, 20, 90)%(부대 지력 40) · 붙으면 그 적은 다음 차례를 쉰다(confused)
##   회복   HEAL_RANGE 칸 안 아군 하나(자기 포함) — 늘 성공, HEAL_BASE + 지력/5 만큼(최대 넘지 않음)
## 기록은 b.fire_log 에 같이({"a", "plot", "to", "ok"…}) — 공격 log 와 따로.

const PLOT_RANGE := 3
const HEAL_RANGE := 2
const HEAL_BASE := 15.0
const PLOT_NAME := {"fire": "화계", "confuse": "혼란", "heal": "회복"}


static func confuse_chance(u: Dictionary, t: Dictionary) -> int:
	return clampi(50 + int((float(u.get("wis", 0.0)) - float(t.get("wis", 40.0))) * 2.0), 20, 90)


static func heal_amount(u: Dictionary) -> int:
	return js_round((HEAL_BASE + float(u.get("wis", 0.0)) / 5.0) * float(u.get("healMul", 1.0)))


## 책략을 걸 수 있는 대상 [uid…] — plot = confuse | heal
static func plot_targets(b: Dictionary, uid: String, plot: String) -> Array:
	var out: Array = []
	if not can_fire(b, uid):
		return out
	var u := unit(b, uid)
	for t: Dictionary in alive(b):
		var d := dist(u, t)
		if plot == "confuse" and String(t.side) != String(u.side) and d <= PLOT_RANGE - fog_cut(b) and not bool(t.get("confused", false)):
			out.append(String(t.uid))
		elif plot == "heal" and String(t.side) == String(u.side) and d <= HEAL_RANGE and float(t.hp) < float(t.max):
			out.append(String(t.uid))
	return out


## 혼란·회복을 건다 — {ok, plot, hit, chance, amount}
static func plot(b: Dictionary, uid: String, plot_key: String, tuid: String) -> Dictionary:
	if not plot_targets(b, uid, plot_key).has(tuid):
		return {"ok": false}
	var u := unit(b, uid)
	var t := unit(b, tuid)
	var r := {"ok": true, "plot": plot_key, "to": tuid, "hit": true, "chance": 100, "amount": 0}
	if plot_key == "confuse":
		r.chance = confuse_chance(u, t)
		r.hit = roll(b, "cf") * 100.0 < float(r.chance)
		if r.hit:
			t.confused = true
	else:
		var before := float(t.hp)
		t.hp = minf(float(t.max), before + float(heal_amount(u)))
		r.amount = js_round(float(t.hp) - before)
	b.plots = int(b.get("plots", PLOTS)) - 1
	u.acted = true
	u.moved = true
	if not b.has("fire_log"):
		b.fire_log = []
	(b.fire_log as Array).append({"t": b.turn, "a": uid, "plot": plot_key, "to": tuid, "hit": r.hit, "amount": r.amount})
	check(b)
	return r


# ── G-0347 ⑤-c 전장 안 일기토·설전(이웃 적 장수에게 거는 명령 — 미니게임은 옛 것 그대로, 여기는 결과만) ──
##   일기토  붙은(1칸) 적 장수 — 3합(베기·찌르기·막기) 이긴 합 − 진 합 > 0 이면 그 장수 −DUEL_HIT(최대 체력 비율)·기가 꺾여 한 차례 쉼,
##           < 0 이면 내 장수가 −DUEL_HIT, 같으면 둘 다 −DUEL_TIE. 적 수는 판 굴림(duel_foe_moves).
##   설전    PLOT_RANGE 칸 안 적 장수 — 문답 3문 정답 2 이상이면 그 장수 기세 꺾임(공격 ×COWED_ATK, 한 번만)·한 차례 쉼, 1 이하면 헛말(차례만 씀).
## 둘 다 장수 차례를 쓴다(책략 횟수와 따로). 기록은 b.fire_log.

const DUEL_HIT := 0.4
const DUEL_TIE := 0.1
const COWED_ATK := 0.8


static func duel_targets(b: Dictionary, uid: String) -> Array:
	var u := unit(b, uid)
	var out: Array = []
	if u.is_empty() or String(u.kind) != "officer" or String(u.side) != String(b.side) or bool(u.acted) or float(u.hp) <= 0.0 or String(b.done) != "":
		return out
	for t: Dictionary in alive(b, "foe" if String(u.side) == "me" else "me"):
		if String(t.kind) == "officer" and dist(u, t) == 1:
			out.append(String(t.uid))
	return out


static func debate_targets(b: Dictionary, uid: String) -> Array:
	var u := unit(b, uid)
	var out: Array = []
	if u.is_empty() or String(u.kind) != "officer" or String(u.side) != String(b.side) or bool(u.acted) or float(u.hp) <= 0.0 or String(b.done) != "":
		return out
	for t: Dictionary in alive(b, "foe" if String(u.side) == "me" else "me"):
		if String(t.kind) == "officer" and dist(u, t) <= PLOT_RANGE and not bool(t.get("cowed", false)):
			out.append(String(t.uid))
	return out


## 적 장수의 세 수(베기·찌르기·막기) — 판 굴림
static func duel_foe_moves(b: Dictionary) -> Array:
	var moves := ["slash", "stab", "guard"]
	var out: Array = []
	for i in 3:
		out.append(moves[mini(2, int(floor(roll(b, "dm") * 3.0)))])
	return out


## 일기토 결과 — net = 이긴 합 − 진 합
static func duel(b: Dictionary, uid: String, tuid: String, net: int) -> Dictionary:
	if not duel_targets(b, uid).has(tuid):
		return {"ok": false}
	var u := unit(b, uid)
	var t := unit(b, tuid)
	var r := {"ok": true, "net": net, "dmg_foe": 0, "dmg_me": 0}
	if net > 0:
		r.dmg_foe = js_round(float(t.max) * DUEL_HIT)
		t.confused = true
	elif net < 0:
		r.dmg_me = js_round(float(u.max) * DUEL_HIT)
	else:
		r.dmg_foe = js_round(float(t.max) * DUEL_TIE)
		r.dmg_me = js_round(float(u.max) * DUEL_TIE)
	t.hp = maxf(0.0, float(t.hp) - float(r.dmg_foe))
	u.hp = maxf(0.0, float(u.hp) - float(r.dmg_me))
	u.acted = true
	u.moved = true
	if not b.has("fire_log"):
		b.fire_log = []
	(b.fire_log as Array).append({"t": b.turn, "a": uid, "plot": "duel", "to": tuid, "net": net})
	check(b)
	return r


## 설전 결과 — correct = 정답 수(0~3)
static func debate(b: Dictionary, uid: String, tuid: String, correct: int) -> Dictionary:
	if not debate_targets(b, uid).has(tuid):
		return {"ok": false}
	var u := unit(b, uid)
	var t := unit(b, tuid)
	var won := correct >= 2
	if won:
		t.cowed = true
		t.atk = float(t.atk) * COWED_ATK
		t.confused = true
	u.acted = true
	u.moved = true
	if not b.has("fire_log"):
		b.fire_log = []
	(b.fire_log as Array).append({"t": b.turn, "a": uid, "plot": "debate", "to": tuid, "correct": correct})
	return {"ok": true, "won": won, "correct": correct}
