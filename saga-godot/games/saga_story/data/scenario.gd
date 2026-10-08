extends RefCounted
## G-0087 — 사가종횡 이야기 표(정본 `scenario/saga-story.md` "이름 없는 떠돌이"). 1부 · 무명 네 장 + G-0091 2부 · 갈래 네 장.
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
##     {"t": "gate"}                               관문 대장(사냥터 주간 챔피언)을 한 번이라도 이겼다(웹 gate — 이긴 적이 있으면 그것으로 됨)
## 장마다 "part"(부)·"legacy"{level, tier}(옛 세이브 — 그만큼 왔으면 보상 없이 지나온 길).
## 장면 한 줄 = [누가, 말] — 누가 = "me"(나) · "mentor"(지금 갈래 스승) · CAST 키.

const CAST := {
	"deokbo": {"name": "신야성 촌로 덕보", "emoji": "🧓"},
	"courier": {"name": "택배 기사", "emoji": "📦"},
	"sori": {"name": "척후병 소리", "emoji": "🐎"},
	"hankeot": {"name": "여행자 한컷", "emoji": "📷"},
	"wanderer": {"name": "나그네", "emoji": "🥾"},
	"townsman": {"name": "남정성 사람", "emoji": "🏮"},
	"ieum": {"name": "탐사 대원 이음", "emoji": "🧭"},
}

## 장면 루트 이름 → 장면 키(웹 사냥터·마을 key).
const SCENE_KEYS := {"SinyaField": "sinya", "HeodoField": "heodo", "TestField": "field", "GangneungjinField": "port",
	"ForestHuntGround": "forest", "NamjeongseongField": "namjeong", "CaveHuntGround": "cave", "GisanchaeField": "gisan", "GorgeHuntGround": "gorge"}
const STAGE_NAMES := {"sinya": "신야성", "heodo": "허도", "field": "허창 들판", "port": "강릉진", "forest": "오림 숲", "namjeong": "남정성", "cave": "한중 굴혈"}

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
	"port1": [
		["hankeot", "아, 마침 잘 오셨어요! 이 사진 좀 보세요. 부두에 쇠 화물선이 걸려 있는데, 배 뒤로 바다가 안 찍혀요. 텅 빈 하늘만요."],
		["me", "옛 나루에 쇠로 된 배라니… 실물은 더 기이하겠군요."],
		["hankeot", "조종실엔 푸른 빛 판이 깜박여요. 그 배를 차지한 게 왜구 선장인데, 사냥터 관문 대장 노릇을 하죠."],
		["me", "선장부터 만나 보겠습니다. 문이 그 사람 손에 있다면요."],
	],
	"port2": [
		["hankeot", "선장이 쓰러졌어요! 쇠배 조종실 판에서 지도 같은 게 나왔는데요."],
		["me", "이 나루도, 이 바다도 아닌 물길이 그려져 있습니다. 없는 바다의 지도군요."],
		["hankeot", "지도 끝이 오림 숲 쪽을 가리켜요. 거기서 발소리가 자기 것만 들리지 않는다는 말이 돌고요."],
	],
	"forest1": [
		["wanderer", "숲 그늘에선 발소리가 제 것만 들리지 않소. 그림자를 조심하시오."],
		["me", "그림자가 짙을수록 눈을 크게 뜨면 됩니다."],
	],
	"forest2": [
		["wanderer", "그림자의 정체가 벼락 말벌 떼였다니… 나무에 박혀 서 있던 쇠 보행기도 봤소?"],
		["me", "경비를 서듯 서 있었습니다. 지키는 것이 무엇인지는 알 수 없고요."],
		["wanderer", "남정성으로 가 보시오. 성 사람들이 무슨 소문을 알고 있소."],
	],
	"nam2": [
		["townsman", "밤마다 굴 쪽에서 빛이 샌다오. 가로등 하나 없는 골목에 하나만 켜져 있고, 그 불빛이 굴 입구와 똑같은 색이오."],
		["me", "가로등과 굴 입구의 빛이 한 줄기라는 말씀이십니까?"],
		["townsman", "위군 도독이 굴혈에 진을 친 뒤로 시작된 일이오. 누가 가서 좀 봐 주시오."],
		["me", "길을 정했습니다. 굴혈로 가겠습니다."],
	],
	"cave1": [
		["ieum", "살았다… 도독 진 깊은 곳에 묶여 있었습니다. 저는 탐사 대원 이음, 먼 시대에서 문을 쫓아 왔습니다."],
		["ieum", "이 땅의 전쟁에 다른 시대 병기가 섞이는 건 새어 든 것입니다. 동쪽 끝에 난세의 문이 있어요."],
		["me", "문이라. 그렇다면 이름 없는 제 손에도 할 일이 있겠군요."],
		["ieum", "마을마다 서 있겠습니다. 소식이 닿으면 어디서든 말을 거세요. 우선 둘째 스승부터 찾으세요."],
	],
	"cave2": [
		["mentor", "이름 없는 채로 둘째 자리에 올랐구나. 이름이 없으니 남의 시대 기술도 그대로 배우는군."],
		["mentor", "더 큰 불길이 기산채 쪽에서 오른다 한다. 다음 길은 스스로 정하되, 잿빛 자를 조심하라."],
		["me", "명심하겠습니다. 이름을 얻을 때까지 걷겠습니다."],
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
	## G-0091 2부 · 갈래(현대 중심) — 웹 단계 그대로(관문 대장 = 사냥터 주간 챔피언 아무 곳이나 한 번, 오림 숲 첫 장면 forest1 은 웹의 첫 발 장면 대사).
	{"id": "p2_port", "no": 5, "part": 2, "title": "강릉진 부두", "stage": "강릉진", "need": 10, "legacy": {"level": 25, "tier": 2},
		"blurb": "부두에 쇠 화물선이 걸려 있다. 여행자 한컷의 사진 속 배는 \"없는 바다\"에 떠 있다.",
		"mix": {"past": "옛 나루", "now": "쇠 화물선·한컷", "future": "화물선 조종실 빛 판"},
		"steps": [{"t": "stage", "stage": "port"}, {"t": "talk", "scene": "port1", "at": "port"}, {"t": "gate"}, {"t": "talk", "scene": "port2"}],
		"exp": 1200, "gold": 3000},
	{"id": "p2_forest", "no": 6, "part": 2, "title": "오림의 그늘", "stage": "오림 숲", "need": 10, "legacy": {"level": 25, "tier": 2},
		"blurb": "나그네 \"그림자를 조심하라\". 그림자는 벼락 말벌 떼.",
		"mix": {"past": "숲 사당", "now": "벼락 말벌(변이 곤충)", "future": "나무에 박힌 경비 보행기"},
		"steps": [{"t": "stage", "stage": "forest"}, {"t": "talk", "scene": "forest1", "at": "forest"}, {"t": "mission", "quest": "q_forest"}, {"t": "mission", "quest": "q_gather1"}, {"t": "talk", "scene": "forest2"}],
		"exp": 1500, "gold": 3000},
	{"id": "p2_namjeong", "no": 7, "part": 2, "title": "민심을 살핀다", "stage": "남정성", "need": 12, "legacy": {"level": 25, "tier": 2},
		"blurb": "성 사람들이 \"밤마다 굴에서 빛이 샌다\"고 한다.",
		"mix": {"past": "성 민가", "now": "가로등 하나가 켜진 골목", "future": "굴 입구 빛"},
		"steps": [{"t": "stage", "stage": "namjeong"}, {"t": "mission", "quest": "q_talk1"}, {"t": "mission", "quest": "q_job"}, {"t": "talk", "scene": "nam2"}],
		"exp": 2000, "gold": 4000},
	{"id": "p2_cave", "no": 8, "part": 2, "title": "한중 굴혈", "stage": "한중 굴혈", "need": 25, "legacy": {"level": 25, "tier": 2},
		"blurb": "위군 도독의 진 깊은 곳에서 탐사 대원 이음을 구한다. 둘째 스승.",
		"mix": {"past": "위군 진", "now": "굴 속 발전기", "future": "이음·탐사 장비"},
		"steps": [{"t": "stage", "stage": "cave"}, {"t": "mission", "quest": "q_cave"}, {"t": "talk", "scene": "cave1"}, {"t": "job", "tier": 2}, {"t": "talk", "scene": "cave2"}],
		"exp": 4000, "gold": 8000},
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


## 옛 세이브 — 빈 칸(scenario 없는 세이브)이거나 이미 legacy 로 건너뛴 진행이면, 지금 장부터 차례로 그 장의 legacy 문턱
## (없으면 1부 문턱 Lv10·1차)을 넘은 장을 보상 없이 끝낸 것으로. 건너뛴 장 수.
static func apply_legacy(st: Dictionary, raw_was_empty: bool, level: int, tier: int) -> int:
	if not raw_was_empty and not bool(st.get("legacy", false)):
		return 0
	if int(st.get("step", 0)) != 0:
		return 0
	var n := 0
	while not finished(st):
		var c := chapter(st)
		var lg: Dictionary = c.get("legacy", {"level": LEGACY_LEVEL, "tier": LEGACY_TIER})
		if level < int(lg.level) and tier < int(lg.tier):
			break
		(st.done as Array).append(String(c.id))
		st.ch = int(st.ch) + 1
		n += 1
	if n > 0:
		st.legacy = true
	return n


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
		"gate":
			return int(ctx.get("champions", 0)) >= 1
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
			"gate":
				what = "사냥터 관문 대장을 한 번 이기기"
	return "📜 %d부 %d장 %s — %s" % [part(ch), int(ch.no), String(ch.title), what]


static func part(ch: Dictionary) -> int:
	return int(ch.get("part", 1))


## 말한 이 표시 — mentor 는 부르는 쪽이 넘긴 스승 이름.
static func speaker(who: String, mentor_name: String) -> String:
	if who == "me":
		return "나 · 무명"
	if who == "mentor":
		return "🥋 " + (mentor_name if mentor_name != "" else "스승")
	var c: Dictionary = CAST.get(who, {})
	return "%s %s" % [String(c.get("emoji", "")), String(c.get("name", who))]
