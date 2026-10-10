extends RefCounted

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
##           · 내 전멸 = 패(lose, −25%). 쓰러진 내 장수는 영구 전사(fallen) — PERMADEATH 를 끄면 중상(wounded, 3달 출진 불가)
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
static var permadeath := true


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
		"mov": MOV, "rng": 2 if wisdom >= might else 1, "x": 0, "y": 0, "moved": false, "acted": false}


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
	u.x = x
	u.y = y
	u.moved = true
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
	var ch := hit_chance(a, t, cover_at(b, int(t.x), int(t.y)))
	var hit := roll(b, "h") * 100.0 < float(ch)
	var dmg := 0
	if hit:
		dmg = maxi(1, js_round(float(a.atk) * dmg_mul * (0.8 + roll(b, "d") * 0.4)))
		t.hp = maxf(0.0, float(t.hp) - float(dmg))
	a.acted = true
	a.moved = true
	(b.log as Array).append({"t": b.turn, "a": uid, "to": tuid, "hit": hit, "dmg": dmg, "ch": ch})
	check(b)
	return {"ok": true, "hit": hit, "dmg": dmg, "killed": float(t.hp) <= 0.0, "chance": ch}


# ── AI(같은 규칙을 양쪽이 쓴다) ──

static func _best_target(b: Dictionary, u: Dictionary, foes: Array) -> Dictionary:
	var best := {}
	var bc := -1
	for t: Dictionary in foes:
		if float(t.hp) > 0.0 and in_range(u, t):
			var c := hit_chance(u, t, cover_at(b, int(t.x), int(t.y)))
			if c > bc:
				bc = c
				best = t
	return best


static func act_auto(b: Dictionary, u: Dictionary) -> void:
	if float(u.hp) <= 0.0 or String(b.done) != "":
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
			u.x = int(pick.x)
			u.y = int(pick.y)
		u.moved = true
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
	auto_side(b, "foe")
	if String(b.done) != "":
		return b.done
	b.turn = int(b.turn) + 1
	for u: Dictionary in b.units:
		u.moved = false
		u.acted = false
	b.side = "me"
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
	return {"kind": k, "name": o.name, "winPct": int(o.winPct), "lossMul": float(o.lossMul), "turn": mini(int(b.turn), TURNS),
		"hpMe": js_round(hp_frac(b, "me") * 100.0), "hpFoe": js_round(hp_frac(b, "foe") * 100.0),
		"fallen": down if permadeath else [], "wounded": [] if permadeath else down, "foeDown": foe_down}


## 공략 판정이 받을 보정값 — 판정을 하지 않는다(realm_rules_war.gd attack() 셋째 인자로 넘긴다)
static func apply(out: Dictionary, where: String = "") -> Dictionary:
	if out.is_empty():
		return {}
	var wounded: Array = []
	for id: String in out.wounded:
		wounded.append({"id": id, "months": WOUND_MONTHS})
	return {"winPct": int(out.winPct), "lossMul": float(out.lossMul), "kind": String(out.kind),
		"fallen": (out.fallen as Array).duplicate(), "wounded": wounded, "where": where}


## 진단·균형용 — 양쪽 다 AI 로 끝까지 둔다
static func auto_play(b: Dictionary) -> Dictionary:
	var guard := 0
	while String(b.done) == "" and guard < 20:
		guard += 1
		auto_side(b, "me")
		check(b)
		if String(b.done) != "":
			break
		ai_turn(b)
	return outcome(b)
