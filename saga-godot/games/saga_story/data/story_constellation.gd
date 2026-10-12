extends RefCounted

## G-0214 사방 성좌도(四方星座圖) — 4종횡 캐릭터의 PoE식 패시브 그물(웹 saga-web/saga-story/js/constellation.js W-0183 고돗판).
## 무예(SP·레벨업 3택 G-0197)는 그대로 두고 그 위의 패시브 층. 규칙·화면은 공용(saga_core/data/passive_web.gd·ui/passive_web_screen.gd),
## 정의는 data/passive_def.json(웹 생성물을 tools/passive_from_web.mjs 로 옮김), 찍은 것은 StorySaveState.passive {start, taken}.
##
## 점수 = (레벨 − 1) + 관문 대장을 처음 이긴 마을 수(weekly_champion_week 키), 상한 CAP 56(391 의 약 14%).
## 첫 점은 무명 또는 지금 직업 계열(1차 전직 뿌리 넷 — StoryCombat.job_root)에만 · 되돌리기는 사냥터 밖에서만, 한 마디 금 DROP_GOLD.
## 효과(웹 76~96 그대로): pct(k) = 1 + 합/100 · less(k, 바닥) = max(바닥, 1 − 합/100).
## 홀로서기 — 웹은 "동료·소환 없음" 대가지만 고돗 4종횡엔 동료도 소환 무예도 없어 공격 ×1.25 만 남는다(웹에서 동료를 안 쓰는 것과 같음).
## 효과 배수는 api.rev 가 바뀔 때만 다시 센다(이동 속도처럼 매 틱 묻는 곳이 있어 — has()·sum() 을 매 틱 안 돌린다).

## story_combat.gd 가 급소 때문에 이 파일을 preload 하므로 여기선 거꾸로 preload 하지 않는다(순환 — job_root 는 부를 때 load).

const DEF_PATH := "res://games/saga_story/data/passive_def.json"
## 손잡이 — 웹 st.pw.* 기본값
const CAP := 56
const DROP_GOLD := 200
const BLINK_M := 130.0 * 0.02
const BLINK_SEC := 0.6
const CHEOLGAK_JUMP := 0.7
const CHEOLGAK_TAKE := 0.8
const JILPUNG_MOVE := 1.25
const JILPUNG_HP := 0.8
const HANBANG_CD := 1.4
const HANBANG_ATK := 1.6
const YEONTA_ATK := 0.75
const MANA_HIT := 0.05
const HUNTEYE_DROP := 1.4
const HUNTEYE_EXP := 20.0
const LONE_ATK := 1.25
## 웹 134 효과 글
const LABEL := {"atkPct": ["공격", "%"], "hpPct": ["체력", "%"], "mpPct": ["마나", "%"], "critPct": ["급소", "%p"],
	"movePct": ["이동", "%"], "jumpPct": ["점프", "%"], "dodgePct": ["회피 재사용 줄임", "%"], "cdPct": ["무예 재사용 줄임", "%"],
	"dropPct": ["드롭", "%"], "expPct": ["경험", "%"], "guardPct": ["받는 피해 줄임", "%"]}

static var _def: Dictionary = {}
static var _fx: Dictionary = {}
static var _fx_api_id := 0   # 객체를 static 에 쥐면 끌 때 터진다(segfault) — id 만
static var _fx_rev := -1
static var _blink_next_ms := 0


static func definition() -> Dictionary:
	if _def.is_empty():
		_def = (load("res://saga_core/data/passive_web.gd") as GDScript).call("load_def", DEF_PATH)
	return _def


static func points_total() -> int:
	return mini(CAP, maxi(0, StorySaveState.level - 1) + StorySaveState.weekly_champion_week.size())


## 효과 배수 묶음 — 성좌가 비면 전부 1(또는 0)이라 기존 수치 그대로
static func fx() -> Dictionary:
	var api: RefCounted = StorySaveState.passive_api()
	if api.get_instance_id() == _fx_api_id and int(api.rev) == _fx_rev:
		return _fx
	_fx_api_id = api.get_instance_id()
	_fx_rev = int(api.rev)
	var pct := func(k: String) -> float: return 1.0 + float(api.sum(k)) / 100.0
	var less := func(k: String, floor_v: float) -> float: return maxf(floor_v, 1.0 - float(api.sum(k)) / 100.0)
	var rules := {}
	for r in ["biyeon", "cheolgak", "jilpung", "hanbang", "yeonta", "manadrink", "hunteye", "lone"]:
		rules[r] = bool(api.has(r))
	_fx = {
		"atk": pct.call("atkPct") * (HANBANG_ATK if rules.hanbang else 1.0) * (YEONTA_ATK if rules.yeonta else 1.0) * (LONE_ATK if rules.lone else 1.0),
		"hp": pct.call("hpPct") * (JILPUNG_HP if rules.jilpung else 1.0),
		"mp": pct.call("mpPct"),
		"crit": float(api.sum("critPct")) / 100.0,
		"move": pct.call("movePct") * (JILPUNG_MOVE if rules.jilpung else 1.0),
		"jump": pct.call("jumpPct") * (CHEOLGAK_JUMP if rules.cheolgak else 1.0),
		"dodge": less.call("dodgePct", 0.4),
		"cd": less.call("cdPct", 0.5) * (HANBANG_CD if rules.hanbang else 1.0),
		"take": less.call("guardPct", 0.5) * (CHEOLGAK_TAKE if rules.cheolgak else 1.0),
		"drop": pct.call("dropPct") * (HUNTEYE_DROP if rules.hunteye else 1.0),
		"exp": 1.0 + (float(api.sum("expPct")) - (HUNTEYE_EXP if rules.hunteye else 0.0)) / 100.0,
		"rules": rules,
	}
	return _fx


static func mul(key: String) -> float:
	return float(fx().get(key, 1.0))


## 비연 쿨(0.6초) — 되면 다음 시각을 밀고 true
static func blink_ready() -> bool:
	var now := Time.get_ticks_msec()
	if now < _blink_next_ms:
		return false
	_blink_next_ms = now + int(BLINK_SEC * 1000.0)
	return true


static func has_rule(rule: String) -> bool:
	return bool((fx().rules as Dictionary).get(rule, false))


## 화면 막음 — "" 면 됨. 첫 시작점은 무명·지금 계열만 · 되돌리기는 사냥터 밖·금 DROP_GOLD
static func gate(tree: SceneTree, id: String) -> String:
	var api: RefCounted = StorySaveState.passive_api()
	var nd: Dictionary = api.node(id)
	if nd.is_empty():
		return ""
	if String(nd.k) == "o":
		if api.store.start != null:
			return ""
		var root := String((load("res://games/saga_story/data/story_combat.gd") as GDScript).call("job_root", StorySaveState.job))
		var key := String(nd.get("s", ""))
		return "" if key == "none" or key == root else "첫 점은 무명의 별이나 지금 계열의 별에만"
	if api.state(id) == "taken":
		if not tree.get_nodes_in_group("story_hunt_events").is_empty():
			return "되돌리기는 사냥터 밖에서만"
		if StorySaveState.gold < DROP_GOLD:
			return "되돌리기 금 %d 이 모자란다" % DROP_GOLD
	return ""


## 되돌릴 때 금을 받는다(화면 on_drop) — gate 가 이미 금·자리를 봤다
static func pay_drop() -> void:
	StorySaveState.spend_gold(DROP_GOLD)


static func fmt(stats: Dictionary) -> String:
	var parts: Array = []
	for k in stats:
		var lab: Array = LABEL.get(k, [k, ""])
		var v := float(stats[k])
		parts.append("%s %s%s%s" % [lab[0], "+" if v >= 0.0 else "", str(snappedf(v, 0.1)).trim_suffix(".0"), lab[1]])
	return " · ".join(parts)
