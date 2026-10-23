extends RefCounted

## G-0315 3마을 유적 발굴·복원 — 웹 saga-web/saga-forest/js/relics.js(W-0309) 이식. 갈래 셋·조각 넷은 그대로.
##   발굴   갈라진 자리(gatherable_builder gather_fossil)를 팔 때 가끔(CHANCE, 날·자리 해시 — 결정적) 유적 조각이 함께 나온다.
##          아직 다 안 모은·안 복원한 갈래 중 하나. 웹은 갈라진 자리가 여럿이라 0.3 — 고돗 마을은 한 자리·하루 한 번이라 0.5.
##   복원   사고(world/museum.gd) [G] 창에서 넷 모인 갈래를 복원 → 사고 둘레에 전시대(그림은 museum.gd) · 금 +GOLD.
##          셋 다 되살리면 그날 "옛터 잔치" 금 +FEAST 한 번. 고돗 3마을엔 명성이 없어 웹 명성 +150/+300 자리를 금으로(× 2).
##   저장   ForestSaveState.relics = {got: {key: n}, restored: [key…], feast: 날|-1} — 순수 추가 칸(버전 안 올림).
## 방문객 확률 + 는 웹처럼 안 함. F = ForestSaveState(forest_livestock.gd 와 같은 꼴). SAGA_RELICS=0 이면 끔.

const SETS := [
	{"key": "bowl", "name": "옛 그릇", "emoji": "🏺"},
	{"key": "stele", "name": "옛 비석", "emoji": "🗿"},
	{"key": "tile", "name": "옛 망와", "emoji": "🏯"},
]
const PIECES := 4
const CHANCE := 0.5
const GOLD := 300
const FEAST := 600
const DIG_ID := "gather_fossil"


static func on() -> bool:
	return OS.get_environment("SAGA_RELICS") != "0"


static func st(F: Node) -> Dictionary:
	if typeof(F.relics) != TYPE_DICTIONARY:
		F.relics = {}
	var R: Dictionary = F.relics
	if typeof(R.get("got")) != TYPE_DICTIONARY:
		R["got"] = {}
	if typeof(R.get("restored")) != TYPE_ARRAY:
		R["restored"] = []
	if not R.has("feast"):
		R["feast"] = -1
	return R


static func by_key(key: String) -> Dictionary:
	for s: Dictionary in SETS:
		if String(s.key) == key:
			return s
	return {}


static func got(F: Node, key: String) -> int:
	return int(st(F).got.get(key, 0))


static func restored(F: Node, key: String) -> bool:
	return (st(F).restored as Array).has(key)


static func _h01(seed: String) -> float:
	return float(absi(seed.hash()) % 100000) / 100000.0


## 이 파기에서 나오는 갈래 key — 안 나오면 "". 날·자리로 결정적.
static func roll(F: Node, day: int, prop_id: String) -> String:
	var open: Array = []
	for s: Dictionary in SETS:
		if not restored(F, String(s.key)) and got(F, String(s.key)) < PIECES:
			open.append(String(s.key))
	var seed := "%d|%s" % [day, prop_id]
	if open.is_empty() or _h01(seed + "|77") >= CHANCE:
		return ""
	return String(open[int(_h01(seed + "|78") * open.size()) % open.size()])


static func add_piece(F: Node, key: String) -> int:
	var R := st(F)
	R.got[key] = mini(PIECES, int(R.got.get(key, 0)) + 1)
	return int(R.got[key])


## 갈라진 자리를 판 뒤 — 조각이 나오면 알림 꼬리 글, 아니면 "".
static func on_dig(F: Node, day: int, prop_id: String) -> String:
	if not on() or prop_id != DIG_ID:
		return ""
	var k := roll(F, day, prop_id)
	if k == "":
		return ""
	var n := add_piece(F, k)
	var s := by_key(k)
	return " · %s %s 조각 %d/%d%s" % [s.emoji, s.name, n, PIECES, " — 사고에서 복원" if n >= PIECES else ""]


## 복원 — {ok, why, feast, gold}
static func restore(F: Node, key: String, day: int) -> Dictionary:
	var s := by_key(key)
	if not on():
		return {"ok": false, "why": "꺼져 있다"}
	if s.is_empty():
		return {"ok": false, "why": "없는 유적"}
	if restored(F, key):
		return {"ok": false, "why": "이미 복원했다"}
	if got(F, key) < PIECES:
		return {"ok": false, "why": "조각이 모자란다 (%d/%d)" % [got(F, key), PIECES]}
	var R := st(F)
	R.got[key] = 0
	(R.restored as Array).append(key)
	var g := GOLD
	var feast := false
	if (R.restored as Array).size() >= SETS.size() and int(R.feast) < 0:
		R.feast = day
		g += FEAST
		feast = true
	F.add_gold(g)
	return {"ok": true, "feast": feast, "gold": g}


## 사고 창 선택지 — [{key, label, ready}] (복원 못 하는 것도 줄로 보인다)
static func lines(F: Node) -> Array:
	var out: Array = []
	if not on():
		return out
	for s: Dictionary in SETS:
		var k := String(s.key)
		var done := restored(F, k)
		var n := got(F, k)
		out.append({"key": k, "ready": not done and n >= PIECES,
			"label": "%s %s — %s" % [s.emoji, s.name, "✓ 전시 중" if done else ("🏛️ 복원해 전시 (💰 +%d)" % GOLD if n >= PIECES else "🧩 %d/%d" % [n, PIECES])]})
	return out
