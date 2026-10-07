extends RefCounted
## G-0087 — 사가종횡 이야기 표(정본 `scenario/saga-story.md` "이름 없는 떠돌이"). 1부 · 무명 네 장.
## 대사는 웹 구현(saga-web/saga-story/js/data-scenario.js SCENES)과 같다(감정 칸만 뺌). 단계는 웹과 거의 같다 — 고돗에도 신야성·허도·
## 허창 들판 장면과 사명 q_first·q_gear1·q_field·q_boss1, 1차 전직이 그대로 있다.
## 엔진은 world/scenario_runner.gd(장면마다 새로 뜬다), 진행은 StorySaveState.scenario(fresh() 모양). 인물은 가상, {스승}은 도감 가명.
##
## 한 장 = {id, no, title, stage, need(열리는 레벨), mix{past,now,future}, steps, exp, gold, blurb}
##   steps 차례대로:
##     {"t": "stage", "stage": 장면 키}           그 장면에 들어선다(키 = SCENE_KEYS 값)
##     {"t": "talk", "scene": id, "at"?: 장면 키}  대화(at 이 있으면 그 장면에서만 뜬다)
##     {"t": "mission", "quest": 사명 key}         그 사명을 완수했다(StorySaveState.quests_done)
##     {"t": "job", "tier": n}                     n차 전직을 했다
## 장면 한 줄 = [누가, 말] — 누가 = "me"(나) · "mentor"(지금 갈래 스승) · CAST 키.

const CAST := {
	"deokbo": {"name": "신야성 촌로 덕보", "emoji": "🧓"},
	"courier": {"name": "택배 기사", "emoji": "📦"},
	"sori": {"name": "척후병 소리", "emoji": "🐎"},
}

## 장면 루트 이름 → 장면 키(웹 사냥터·마을 key).
const SCENE_KEYS := {"SinyaField": "sinya", "HeodoField": "heodo", "TestField": "field", "GangneungjinField": "port",
	"ForestHuntGround": "forest", "NamjeongseongField": "namjeong", "CaveHuntGround": "cave", "GisanchaeField": "gisan", "GorgeHuntGround": "gorge"}
const STAGE_NAMES := {"sinya": "신야성", "heodo": "허도", "field": "허창 들판"}

const SCENES := {
	"sinya1": [
		["deokbo", "성 밖이 도적 천지라네. 그런데 자네, 이름이 어떻게 되나?"],
		["me", "…기억나지 않습니다. 서쪽에서 걸어왔다는 것밖에는."],
		["deokbo", "이름 없는 떠돌이라. 요즘은 그런 사람이 많지. 성 밖에서 주운 건데, 이 네모난 판이 자네 것인가? 만지면 불이 들어와."],
		["me", "처음 봅니다. 그런데… 손에 익습니다."],
		["deokbo", "도적 하나는 칼 대신 푸른 빛이 나는 검을 들었다더군. 예삿놈들이 아닐세."],
		["me", "그럼 길부터 트겠습니다. 들판에서 열을 베고 오지요."],
	],
	"sinya2": [
		["deokbo", "벌써 열을 베고 왔나! 이름 없는 손이 제일 빠르다더니."],
		["deokbo", "허도로 가게. 장터에 없는 것이 없어. 신야성 밖 소식도 그리로 모이지."],
	],
	"heodo1": [
		["courier", "저기요! 이 짐, 주소가 없어요. 받는 이 칸에 옛 땅 이름만 잔뜩이고…"],
		["courier", "상자를 흔들면 푸른 빛이 지도처럼 펼쳐져요. 이런 길은 어디에도 없는데."],
		["me", "길이 없어도 짐은 어디론가 가려던 것이겠지요. 저도 몸부터 갖춰야겠습니다."],
	],
	"heodo2": [
		["courier", "든든해 보이시네요! 저자가 이 근방에서 제일 큽니다. 부족하면 언제든 들르세요."],
		["courier", "짐은… 제가 좀 더 헤매 보겠습니다. 들판 소식이 궁금하시면 척후병을 찾으세요."],
	],
	"field1": [
		["sori", "황건 두목의 진에 요즘 못 보던 병기가 들어갔소. 잿빛 떼쥐가 뛰고, 하늘엔 작은 눈알 같은 것이 뜨오."],
		["me", "눈알 같은 것이라니, 정찰 짐승입니까?"],
		["sori", "짐승이 아니라 날아다니는 쇠붙이요. 들판을 비우지 않고는 두목 근처에도 못 가오."],
		["me", "먼저 들판을 비우고, 그다음에 두목의 목을 보겠습니다."],
	],
	"field2": [
		["sori", "두목이 쓰러졌소! 진 한복판에서 푸른 빛 조각이 나왔는데, 누가 남긴 건지 모르겠소."],
		["me", "누가 대 주지 않고서야 도적이 저런 병기를 가질 수 없지요."],
		["sori", "이제 허도의 스승을 찾아가 보시오. 열 번은 넘게 해가 진 자라면 배울 자격이 있소."],
	],
	"job1": [
		["mentor", "이름 없는 자가 제일 빨리 배운다. 이름에 매여 있지 않으니까."],
		["mentor", "저 표적지를 보아라. 누가 세웠는지 모르나, 이 땅의 것이 아닌 나무로 만들었다. 내 무기도 그렇다. 어느 시대 것인지 나도 모른다."],
		["mentor", "🥋 허도의 수련장에서 네 길을 골라라. 무사·궁수·협객·방사 — 고른 길이 네 첫 이름이 된다."],
	],
	"job2": [
		["mentor", "골랐구나. 이제 너는 이름 없는 채로 한 갈래를 얻었다."],
		["mentor", "동쪽 강릉진 부두에 쇠로 된 배가 걸려 있다더라. 그 배의 사진을 찍는 여행자가 있다지 — 만나 보아라."],
		["me", "가겠습니다. 이름은 가는 길에서 찾지요."],
	],
}

const CHAPTERS := [
	{"id": "p1_sinya", "no": 1, "title": "서막 · 신야성", "stage": "신야성", "need": 1,
		"blurb": "이름을 묻는 촌로 앞에서 대답하지 못한다. 성 밖은 도적 천지다.",
		"mix": {"past": "성문·촌로", "now": "성 밖에서 주운 휴대폰", "future": "도적이 든 빛 칼"},
		"steps": [{"t": "stage", "stage": "sinya"}, {"t": "talk", "scene": "sinya1", "at": "sinya"}, {"t": "mission", "quest": "q_first"}, {"t": "talk", "scene": "sinya2"}],
		"exp": 80, "gold": 300},
	{"id": "p1_heodo", "no": 2, "title": "허도 가는 길", "stage": "허도", "need": 1,
		"blurb": "허도 장터의 택배 기사가 주소 없는 짐을 들고 헤맨다.",
		"mix": {"past": "허도 장터", "now": "택배 기사", "future": "짐 속 빛 지도"},
		"steps": [{"t": "stage", "stage": "heodo"}, {"t": "talk", "scene": "heodo1", "at": "heodo"}, {"t": "mission", "quest": "q_gear1"}, {"t": "talk", "scene": "heodo2"}],
		"exp": 150, "gold": 500},
	{"id": "p1_field", "no": 3, "title": "허창 들판의 두목", "stage": "허창 들판", "need": 1,
		"blurb": "척후병과 들판을 정찰한다. 황건 두목의 진에 다른 시대의 병기가 섞였다.",
		"mix": {"past": "황건적", "now": "잿빛 떼쥐", "future": "정찰 드론"},
		"steps": [{"t": "stage", "stage": "field"}, {"t": "talk", "scene": "field1", "at": "field"}, {"t": "mission", "quest": "q_field"},
			{"t": "mission", "quest": "q_boss1"}, {"t": "talk", "scene": "field2"}],
		"exp": 400, "gold": 1200},
	{"id": "p1_job", "no": 4, "title": "첫 스승", "stage": "허도", "need": 10,
		"blurb": "허도의 스승에게 첫 전직을 배운다. \"이름 없는 자가 제일 빨리 배운다.\"",
		"mix": {"past": "스승 도장", "now": "연습용 표적지", "future": "스승이 가진 시대 모를 무기"},
		"steps": [{"t": "talk", "scene": "job1", "at": "heodo"}, {"t": "job", "tier": 1}, {"t": "talk", "scene": "job2"}],
		"exp": 600, "gold": 2000},
]

## 옛 세이브(웹 legacy {level 10, tier 1}) — 이만큼 왔으면 1부는 지나온 길.
const LEGACY_LEVEL := 10
const LEGACY_TIER := 1


static func fresh() -> Dictionary:
	return {"ch": 0, "step": 0, "done": [], "legacy": false}


static func normalize(st: Variant) -> Dictionary:
	var out := fresh()
	if st is Dictionary:
		for k in out:
			if (st as Dictionary).has(k):
				out[k] = (st as Dictionary)[k]
	out.done = (out.done as Array).duplicate()
	return out


## 빈 칸(scenario 없는 세이브)인데 이미 1부를 지난 사람 → 1부를 보상 없이 끝낸 것으로. 했으면 true.
static func apply_legacy(st: Dictionary, raw_was_empty: bool, level: int, tier: int) -> bool:
	if not raw_was_empty or (level < LEGACY_LEVEL and tier < LEGACY_TIER):
		return false
	for c: Dictionary in CHAPTERS:
		(st.done as Array).append(String(c.id))
	st.ch = CHAPTERS.size()
	st.step = 0
	st.legacy = true
	return true


static func chapter(st: Dictionary) -> Dictionary:
	var i := int(st.get("ch", 0))
	return CHAPTERS[i] if i >= 0 and i < CHAPTERS.size() else {}


static func step(st: Dictionary) -> Dictionary:
	var ch := chapter(st)
	if ch.is_empty():
		return {}
	var steps: Array = ch.steps
	var i := int(st.get("step", 0))
	return steps[i] if i < steps.size() else {}


static func finished(st: Dictionary) -> bool:
	return chapter(st).is_empty()


## ctx: level:int · stage:String(지금 장면 키) · quests:{key: true} · tier:int
static func locked(st: Dictionary, ctx: Dictionary) -> bool:
	return int(ctx.get("level", 1)) < int(chapter(st).get("need", 1))


## 지금 띄울 대화 장면 id(at 장면이 아니거나 레벨이 모자라면 "").
static func pending_scene(st: Dictionary, ctx: Dictionary) -> String:
	var s := step(st)
	if String(s.get("t", "")) != "talk" or locked(st, ctx):
		return ""
	if s.has("at") and String(s.at) != String(ctx.get("stage", "")):
		return ""
	return String(s.scene)


static func step_met(st: Dictionary, ctx: Dictionary) -> bool:
	if locked(st, ctx):
		return false
	var s := step(st)
	match String(s.get("t", "")):
		"stage":
			return String(ctx.get("stage", "")) == String(s.stage)
		"mission":
			return bool((ctx.get("quests", {}) as Dictionary).get(String(s.quest), false))
		"job":
			return int(ctx.get("tier", 0)) >= int(s.tier)
	return false


## 다음 단계로. 장이 끝나면 {"chapter": 장}.
static func advance(st: Dictionary) -> Dictionary:
	var ch := chapter(st)
	if ch.is_empty():
		return {}
	st.step = int(st.step) + 1
	if int(st.step) >= (ch.steps as Array).size():
		(st.done as Array).append(String(ch.id))
		st.ch = int(st.ch) + 1
		st.step = 0
		return {"chapter": ch}
	return {}


static func check(st: Dictionary, ctx: Dictionary) -> Array:
	var out: Array = []
	var guard := 0
	while not finished(st) and String(step(st).get("t", "")) != "talk" and step_met(st, ctx) and guard < 32:
		out.append(advance(st))
		guard += 1
	return out


static func finish_talk(st: Dictionary, ctx: Dictionary) -> Array:
	if String(step(st).get("t", "")) != "talk":
		return []
	return [advance(st)] + check(st, ctx)


static func objective(st: Dictionary, ctx: Dictionary, quest_names: Dictionary = {}) -> String:
	var ch := chapter(st)
	if ch.is_empty():
		return ""
	var what := ""
	if locked(st, ctx):
		what = "Lv %d 되면" % int(ch.need)
	else:
		var s := step(st)
		match String(s.get("t", "")):
			"stage":
				what = "%s(으)로" % STAGE_NAMES.get(String(s.stage), String(s.stage))
			"talk":
				what = "이야기" if not s.has("at") or String(s.at) == String(ctx.get("stage", "")) else "%s에서 이야기" % STAGE_NAMES.get(String(s.at), String(s.at))
			"mission":
				what = "사명 「%s」" % String(quest_names.get(String(s.quest), String(s.quest)))
			"job":
				what = "%d차 전직(허도 수련장)" % int(s.tier)
	return "📜 1부 %d장 %s — %s" % [int(ch.no), String(ch.title), what]


## 말한 이 표시 — mentor 는 부르는 쪽이 넘긴 스승 이름.
static func speaker(who: String, mentor_name: String) -> String:
	if who == "me":
		return "나 · 무명"
	if who == "mentor":
		return "🥋 " + (mentor_name if mentor_name != "" else "스승")
	var c: Dictionary = CAST.get(who, {})
	return "%s %s" % [String(c.get("emoji", "")), String(c.get("name", who))]
