extends RefCounted

## G-0242 3마을 땅 아래 층 — 굴 다섯 층(웹 W-0285 cave-depth.js 이식, 테라리아·마인크래프트식 구조만).
##   층 0     입구 방(마을 문·횃불 받침·내려가는 사다리 — 짐승 없음). 웹은 보물상자 방이 0층이지만 고돗 3마을엔 굴이 없어 빈 방.
##   층 1~5   캐는 자리 둘(하루 한 번씩, 횃불이 타면 ×2) · 짐승 하나(사다리를 지킨다 — 쫓아야 내려감) · 횃불 받침(솔방울 1 → 120초).
##   5층      사다리 대신 옛 유물(화석 +1, 한 번뿐).
##   가방     웹 광석 이름(철석·구리·은괴·옛 동전 / 토기 조각·고사리 화석·물고기 화석)은 표시만 — 가방엔 GATHER_LABELS "광석"·"화석".
##   저장     ForestSaveState.cave = {deepest, torch_until(unix 초), relic, dug: {day, got: {"층:id": true}}} — 순수 추가 칸(버전 안 올림).
##            지금 층·쫓은 짐승은 판 안 상태(run = {floor, shooed}) — 저장 안 함(웹 fl·shooed 짝).
##   시각     횃불은 실제 시각(웹 Date.now 짝) — 점검은 now_override 로 주입. 하루는 ForestDay.today_key(채집 하루 한 번과 같은 날).
## F = ForestSaveState(forest_lots.gd 와 같은 꼴 — SceneTree 점검이 오토로드 이름 없이 부른다).

const FLOORS := 5
const TORCH_SEC := 120
const ORES := {1: ["iron", "shard"], 2: ["copper", "iron"], 3: ["silver", "copper"], 4: ["oldcoin", "silver"], 5: ["fern", "fishf"]}
const ORE_INFO := {
	"iron": {"name": "철석", "emoji": "⛏️", "label": "광석"},
	"copper": {"name": "구리", "emoji": "🟤", "label": "광석"},
	"silver": {"name": "은괴", "emoji": "⚪", "label": "광석"},
	"oldcoin": {"name": "옛 동전", "emoji": "💰", "label": "광석"},
	"shard": {"name": "토기 조각", "emoji": "🏺", "label": "화석"},
	"fern": {"name": "고사리 화석", "emoji": "🌿", "label": "화석"},
	"fishf": {"name": "물고기 화석", "emoji": "🐟", "label": "화석"},
}
const BEASTS := {1: {"name": "동굴 박쥐", "emoji": "🦇"}, 2: {"name": "굴 들쥐", "emoji": "🐀"}, 3: {"name": "어둠 거미", "emoji": "🕷️"},
	4: {"name": "돌 구렁이", "emoji": "🐍"}, 5: {"name": "잠든 곰", "emoji": "🐻"}}
const RELIC := {"key": "fishf", "name": "땅속 옛 유물(물고기 화석)", "emoji": "🏺", "label": "화석"}
const TORCH_ITEM := "솔방울"

## 사물 자리 — 웹 방 좌표(타일, 방 8×9) 그대로. 고돗 방이 타일 × CELL 미터로 늘린다(world/forest_cave_view.gd).
const SPOT := {"torch": Vector2(1.5, 1.8), "ore0": Vector2(2.5, 3.5), "ore1": Vector2(6.5, 3.5), "beast": Vector2(4.5, 6.2),
	"ladder": Vector2(4.5, 8.1), "relic": Vector2(4.5, 8.1), "door": Vector2(4.5, 0.6)}

static var now_override: float = -1.0   # 점검용 — 0 이상이면 이 unix 초를 지금으로


static func now() -> float:
	return now_override if now_override >= 0.0 else Time.get_unix_time_from_system()


static func new_run() -> Dictionary:
	return {"floor": 0, "shooed": {}}


static func st(F: Node) -> Dictionary:
	var c: Dictionary = F.cave
	if not c.has("deepest"):
		c["deepest"] = 0
	if not c.has("torch_until"):
		c["torch_until"] = 0.0
	if not c.has("relic"):
		c["relic"] = false
	if typeof(c.get("dug")) != TYPE_DICTIONARY:
		c["dug"] = {"day": -1, "got": {}}
	return c


static func lit(F: Node) -> bool:
	return float(st(F).torch_until) > now()


static func torch_left(F: Node) -> int:
	return maxi(0, int(ceil(float(st(F).torch_until) - now())))


static func ores_of(f: int) -> Array:
	return ORES.get(f, ORES[FLOORS])


static func beast_of(f: int) -> Dictionary:
	return BEASTS.get(f, BEASTS[FLOORS])


static func dug(F: Node) -> Dictionary:
	var d: Dictionary = st(F).dug
	var day := ForestDay.today_key()
	if int(d.get("day", -1)) != day or typeof(d.get("got")) != TYPE_DICTIONARY:
		d["day"] = day
		d["got"] = {}
	return d.got


## 층 f 의 사물 [{t, id, key?}] — 0층은 횃불·사다리뿐, 5층은 사다리 대신 유물.
static func objects(f: int) -> Array:
	var out: Array = [{"t": "torch", "id": "torch"}]
	if f > 0:
		var o := ores_of(f)
		out.append({"t": "ore", "id": "ore0", "key": String(o[0])})
		out.append({"t": "ore", "id": "ore1", "key": String(o[1])})
		out.append({"t": "beast", "id": "beast"})
	out.append({"t": "ladder", "id": "ladder"} if f < FLOORS else {"t": "relic", "id": "relic"})
	return out


static func label_of(F: Node, run: Dictionary, o: Dictionary) -> String:
	var f := int(run.floor)
	match String(o.t):
		"ore":
			var info: Dictionary = ORE_INFO[String(o.key)]
			return "%s %s%s" % [info.emoji, info.name, " (오늘은 다 캤다)" if dug(F).has("%d:%s" % [f, o.id]) else " — 캔다 [G]"]
		"beast":
			var b := beast_of(f)
			return "%s %s%s" % [b.emoji, b.name, " (달아났다)" if (run.shooed as Dictionary).has(f) else " — 쫓는다 [G]"]
		"torch":
			return "🔥 횃불 받침 — " + ("%d초 남음" % torch_left(F) if lit(F) else "솔방울 1 로 2분 밝힌다 [G]")
		"ladder":
			return "🧗 %d층으로 내려간다 [G]%s" % [f + 1, "" if f == 0 or (run.shooed as Dictionary).has(f) else " (짐승이 지킨다)"]
		"relic":
			return "🏺 유물 자리 (가져갔다)" if bool(st(F).relic) else "🏺 옛 유물 — 가져간다 [G]"
	return String(o.t)


## 사물 하나를 쓴다 → {ok, kind, text}. kind: torch·ore·beast·down·relic·no.
static func act(F: Node, run: Dictionary, o: Dictionary) -> Dictionary:
	var s := st(F)
	var f := int(run.floor)
	var shooed: Dictionary = run.shooed
	match String(o.t):
		"torch":
			if lit(F):
				return {"ok": false, "kind": "no", "text": "🔥 아직 %d초 탄다" % torch_left(F)}
			if F.item_count(TORCH_ITEM) < 1:
				return {"ok": false, "kind": "no", "text": "🌰 솔방울이 있어야 횃불을 만든다"}
			F.add_item(TORCH_ITEM, -1)
			s["torch_until"] = now() + TORCH_SEC
			return {"ok": true, "kind": "torch", "text": "🔥 횃불을 밝혔다 — 2분"}
		"ore":
			var k := "%d:%s" % [f, o.id]
			var got := dug(F)
			if got.has(k):
				return {"ok": false, "kind": "no", "text": "오늘은 다 캤다 — 내일 다시"}
			var info: Dictionary = ORE_INFO[String(o.key)]
			var n := 2 if lit(F) else 1
			got[k] = true
			F.add_item(String(info.label), n)
			return {"ok": true, "kind": "ore", "n": n, "label": String(info.label),
				"text": "⛏️ %d층에서 %s %s ×%d → %s +%d%s" % [f, info.emoji, info.name, n, info.label, n, " (횃불 덕에 둘)" if n == 2 else ""]}
		"beast":
			var b := beast_of(f)
			if shooed.has(f):
				return {"ok": false, "kind": "no", "text": "%s 이미 달아났다" % b.emoji}
			shooed[f] = true
			return {"ok": true, "kind": "beast", "text": "%s %s이(가) 어둠 속으로 달아났다 — 사다리가 열렸다" % [b.emoji, b.name]}
		"ladder":
			if f > 0 and not shooed.has(f):
				var b2 := beast_of(f)
				return {"ok": false, "kind": "no", "text": "%s %s이(가) 사다리를 지킨다 — 먼저 쫓는다" % [b2.emoji, b2.name]}
			return down(F, run)
		"relic":
			if bool(s.relic):
				return {"ok": false, "kind": "no", "text": "유물은 이미 가져갔다"}
			s["relic"] = true
			F.add_item(String(RELIC.label), 1)
			return {"ok": true, "kind": "relic", "text": "🏺 5층 바닥에서 옛 유물(%s)을 찾았다 — %s +1" % [ORE_INFO[RELIC.key].name, RELIC.label]}
	return {"ok": false, "kind": "no", "text": ""}


static func down(F: Node, run: Dictionary) -> Dictionary:
	var f := int(run.floor)
	if f >= FLOORS:
		return {"ok": false, "kind": "no", "text": "여기가 맨 아래다"}
	f += 1
	run["floor"] = f
	var s := st(F)
	if f > int(s.deepest):
		s["deepest"] = f
	return {"ok": true, "kind": "down", "floor": f, "text": "🧗 지하 %d층 — %s" % [f, "횃불이 밝다" if lit(F) else "어둡다, 횃불 받침을 찾자"]}


## 위로 — 0층에서 부르면 {kind: "leave"}(마을로 나간다).
static func up(run: Dictionary) -> Dictionary:
	var f := int(run.floor)
	if f <= 0:
		return {"ok": true, "kind": "leave", "text": "밖으로 나왔다 — 다시 마을이 둥글게 휘어 보인다."}
	run["floor"] = f - 1
	return {"ok": true, "kind": "up", "floor": f - 1, "text": "🧗 지하 %d층으로 올라왔다" % (f - 1) if f - 1 > 0 else "🧗 굴 첫 방으로 올라왔다"}


static func hud(F: Node, run: Dictionary) -> String:
	return "지하 %d층 / %d · %s · 가장 깊이 %d층" % [int(run.floor), FLOORS, ("🔥 %d초" % torch_left(F)) if lit(F) else "🌑 어둡다", int(st(F).deepest)]
