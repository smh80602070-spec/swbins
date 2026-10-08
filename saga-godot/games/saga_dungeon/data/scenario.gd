extends RefCounted
## G-0085 — 사가나락 이야기 표(정본 `scenario/saga-dungeon.md` "이름 없는 구덩이"). 1막 · 중원의 난 세 장 + G-0089 2막 · 잿빛과 소금 세 장.
## 대사는 웹 구현(saga-web/saga-dungeon/js/data-scenario.js SCENES)과 같다. 단계는 고돗 굴혈(방 일곱 = 1~7층, 3·6층 보스,
## 5층 미니보스 = 순장 왕릉, 마을·들판 없음)에 맞춰 바꿨다 — 바꾼 까닭은 티켓 G-0085 "단계 바꿈".
## 엔진은 world/scenario_runner.gd, 진행은 DungeonSaveState.scenario(이 파일의 fresh() 모양). 인물은 전부 가상(이름 정책).
##
## 한 장 = {id, no, title, stage, mix{past,now,future}, steps, gold, blurb}
##   steps 차례대로 하나씩:
##     {"t": "talk", "scene": 장면 id}   대화 — 단계가 되면 뜬다(선택 창·멈춤 중이면 기다림)
##     {"t": "kill", "n": n}             이 단계가 시작된 뒤 적 n 마리(난입 적 포함)
##     {"t": "boss", "n": n}             이 단계가 시작된 뒤 보스 n 마리
##     {"t": "floor", "n": n}            n층 방 출구를 나갔다(rooms_cleared[n-1]) — 이미 지났으면 바로 넘어간다
##     {"t": "rescue", "n": n, "room": i}  방 i 에 선 표지에 닿아 구한다(이 단계 동안만 선다)
##     {"t": "wboss", "n": n}            이 단계가 시작된 뒤 월드 보스 n 마리(G-0089 — 2막 폐도시 폭주룡)
##     {"t": "horde", "n": n}            이 단계가 시작된 뒤 난입에서 파도 HORDE_WAVE 에 n 번 닿는다(2막 개펄 촉수왕 — 난입은 15분 생존이라 파도로)
##     talk 의 "by": 고르기 id — 장면 id 는 scene + "_" + 그 답(CHOICES 의 고르기가 앞 장면 끝에 뜬다)
## 장면 한 줄 = [누가, 말] — 누가 = "me"(부대장) 또는 CAST 키.
## 장을 더하려면 CHAPTERS 끝에 붙인다(id 는 안 바꾼다 — 세이브는 차례 번호와 끝낸 id 를 함께 둔다).

const CAST := {
	"mukhyang": {"name": "사관 묵향", "emoji": "📜"},
	"gyogyo": {"name": "교두", "emoji": "🥋"},
	"yeoldusi": {"name": "시간 여행자 열두시", "emoji": "⌛"},
	"guard": {"name": "벌판 역참지기", "emoji": "🏮"},
	"danchu": {"name": "고물 줍는 아이 단추", "emoji": "🧒"},
	"boatman": {"name": "염전 늙은 뱃사공", "emoji": "🚣"},
	"lord": {"name": "망루성 성주의 망령", "emoji": "👑"},
}

const SCENES := {
	"moru1": [
		["mukhyang", "부임 첫날부터 황건 떼가 마을 어귀를 쳤습니다. 다행히 담이 버텼지요. 저는 이 마을 사관 묵향입니다."],
		["me", "기와 담 너머로 이상한 것이 지나갔습니다. 하늘을 나는 작은 쇠 눈알 같은 것이요."],
		["mukhyang", "정찰 드론이라 하더군요. 택배 기사 손님이 짐을 떨어뜨리고 도망갔는데, 그 짐도 이 시대 것이 아니었습니다."],
		["mukhyang", "그보다 큰일이 있습니다. 요즘 죽은 이들의 이름이 비석에서 지워집니다. 굴혈 쪽에서 시작된 일입니다. 우선 어귀의 무리부터 쓸어 주십시오."],
	],
	"moru2": [
		["mukhyang", "어귀가 조용해졌습니다. 무리의 창끝에 쓰인 글자 하나 없는 것을 보셨습니까? 이름을 모르는 병사들이었습니다."],
		["me", "굴혈이 저 아래에 열려 있다고 하셨지요. 첫 층을 보고 오겠습니다."],
	],
	"moru3": [
		["me", "첫 층에 닿았습니다. 벽에 이름 자국이 긁혀 있었는데, 누가 새겼다 지운 듯했습니다."],
		["mukhyang", "굴혈이 사람들의 이름을 먹고 있다는 소문이 사실인가 봅니다. 이 기록을 잇는 것이 제 일입니다. 더 내려가시면 제가 적겠습니다."],
		["gyogyo", "거기 새 부임자. 교두 노릇을 맡은 늙은이요. 벌판의 흑기 도적부터 정리하시오. 결사의 비석도 그다음에 알려 주겠소."],
	],
	"flag1": [
		["guard", "벌판 역참을 밤마다 검은 깃발 무리가 턴다오. 그 깃발에는 이름 하나 적혀 있지 않소. 대장의 갑옷에는 빛나는 문양이 박혀 있다는 소문도 있고."],
		["me", "폭주하는 젊은이들까지 도적 편에 붙었다지요. 이 벌판부터 잠재우겠습니다."],
	],
	"flag2": [
		["guard", "흑기 대장이 쓰러졌소! 이제 수레가 다시 다니겠소."],
		["gyogyo", "결사비가 열렸소. 결사로 들어서면 한 번 죽으면 끝이라, 각오가 있어야 하오."],
		["me", "깃발에 이름이 없던 까닭은 결국 알 수 없었습니다. 굴혈 안에 답이 있을 것 같습니다."],
	],
	"tomb1": [
		["mukhyang", "굴혈 다섯째 층에는 옛 왕릉이 있습니다. 순장된 병사들이 아직도 칼을 쥐고 서 있다지요. 가장 안쪽 현실에 녹슨 장군이 있습니다."],
		["me", "왕릉의 벽마다 도굴꾼의 손전등 자국이 남아 있었습니다. 누군가 먼저 드나든 흔적입니다."],
		["mukhyang", "그 벽에 새 이름을 적는 빛 비석이 있다는 이야기도 들었습니다. 잘 살펴봐 주십시오."],
	],
	"tomb2": [
		["yeoldusi", "살았다! 저는 시간 여행자 열두시입니다. 이 굴혈의 구멍은 우리 시대 지도에 없습니다 — 무명혈이라 불리는 지도에 없는 구멍이죠."],
		["me", "지도에 없는 구멍이라니. 이 땅의 이름을 먹는 것과 관계가 있습니까?"],
		["yeoldusi", "있습니다. 이름이 지워진 곳은 앞날의 기록에서도 지워지지요. 더 깊은 곳에서 그 주인이 이름을 모으고 있을 겁니다."],
		["mukhyang", "기록해 두겠습니다. 1막은 여기까지입니다. 이름이 지워지는 나라의 끝을 함께 찾아봅시다."],
	],
	"fac1": [
		["danchu", "아저씨, 공장 굴뚝에서 쇠 긁는 소리가 밤새 나요. 무서워서 못 가겠어요. 고물을 주우러 가야 하는데."],
		["me", "공장 아래에 옛 성벽이 있다더군요. 방역복 차림의 누가 폐도시를 훑고 다닌다는 말도 들었습니다."],
		["danchu", "맞아요, 회색 옷 입은 이들이 있어요. 공장의 심장이 굴혈로 이어진 관이래요. 부탁이에요!"],
	],
	"fac2": [
		["danchu", "소리가 멎었어요! 폭주룡도 없어졌고요. 고철을 한 아름 주웠어요."],
		["me", "공장 심장의 관은 굴혈로 이어져 있었습니다. 굴혈의 이름 먹는 소리와 같은 결이더군요."],
		["danchu", "이 고물 상점은 아저씨께 드릴게요. 필요한 부품이 있을 거예요."],
	],
	"tide1": [
		["boatman", "썰물 때마다 갯벌 밑에서 무언가 운다오. 배가 셋이나 사라졌소. 바다가 이름을 부르며 물러갔다고들 하지."],
		["me", "녹슨 관측탑이 갯벌 한가운데 서 있다지요. 실험실 장갑을 두른 것들도 보입니다."],
		["boatman", "뱃노래 가락이 갯벌 밑에서 되돌아 나오는 밤이 있소. 촉수왕이 그걸 흉내 내는 것 같소."],
	],
	"tide2": [
		["boatman", "밀물이 제 소리로 돌아왔소. 소금 한 섬을 받아 주시오."],
		["me", "갯벌이 부르던 이름은 결국 배 셋의 사공들 이름이었습니다. 이제 그 이름이 굴혈에 남는 일은 없겠지요."],
		["gyogyo", "망루성 성주가 이름을 잃어 성을 떠나지 못한다는 소문이오. 굴혈 맨 아래층으로 내려가 보시오."],
	],
	"fort1": [
		["lord", "내… 이름이 무엇이었더냐. 비상등만 깜박이는 성문 앞에서 수백 해를 서 있었다. 투구 속의 이 기계 눈은 누가 심었느냐."],
		["mukhyang", "제 기록에 남은 성주의 이름을 찾았습니다. 돌려주면 망령이 성을 떠나겠지만, 이름을 봉인하면 성이 그 갑주를 내놓을 것입니다."],
		["me", "이름을 돌려줄지, 봉인할지 — 결정은 제가 하겠습니다."],
	],
	"fort2_restore": [
		["lord", "이제 기억난다. 그 이름을 내 것이라 부르니 가슴이 가볍다. 성을 떠나마. 네게 가호를 남긴다."],
		["mukhyang", "이름 하나가 돌아왔습니다. 굴혈이 삼킨 이름들 중 하나를 되찾은 셈이지요."],
	],
	"fort2_seal": [
		["lord", "이름을 빼앗겼지만… 성을 지킬 갑주는 남는군. 가져가라, 이 조각을."],
		["mukhyang", "봉인된 이름은 제 기록에 따로 적어 두겠습니다. 어떤 결정이든 기록은 남습니다."],
	],
}

## 장면 끝 고르기(웹 SCENES.choice). 답은 st.choices[id]. reward: gold(금) · boon(축복 키 하나 — DungeonRunState.apply_boon).
## 정본 "이름을 돌려줌 → 성주의 가호(받는 피해 −5%)"는 고돗에 같은 손잡이가 없어 기존 축복 철벽(鐵壁) +1 로, "봉인 → 망령 갑주 조각"은 웹 보상 금 3000 으로.
const CHOICES := {
	"fort1": {"id": "fort", "prompt": "성주의 이름을 어떻게 할 것인가", "options": [
		{"key": "restore", "label": "이름을 돌려준다 — 성주의 가호(철벽 +1)", "reward": {"boon": "wall"}},
		{"key": "seal", "label": "이름을 봉인한다 — 금 3000", "reward": {"gold": 3000}}]},
}
const HORDE_WAVE := 3

const CHAPTERS := [
	{"id": "a1_moru", "no": 1, "title": "모루골 부임", "stage": "모루골 · 굴혈 1층",
		"blurb": "부임 첫날 황건 떼가 마을 어귀를 친다. 사관 묵향이 \"죽은 이들 이름이 비석에서 지워진다\"고 털어놓는다.",
		"mix": {"past": "황건적·기와 마을", "now": "택배 기사 손님이 떨어뜨린 짐", "future": "정찰 드론"},
		"steps": [{"t": "talk", "scene": "moru1"}, {"t": "kill", "n": 5}, {"t": "talk", "scene": "moru2"}, {"t": "floor", "n": 1}, {"t": "talk", "scene": "moru3"}],
		"gold": 300},
	{"id": "a1_blackflag", "no": 2, "title": "흑기 도적의 밤", "stage": "굴혈 3층",
		"blurb": "역참지기의 부탁으로 흑기 대장을 친다. 대장의 깃발에도 이름이 없다.",
		"mix": {"past": "흑기 도적·역참", "now": "도적 편에 붙은 폭주 청년", "future": "대장 갑옷의 빛 문양"},
		"steps": [{"t": "talk", "scene": "flag1"}, {"t": "boss", "n": 1}, {"t": "talk", "scene": "flag2"}],
		"gold": 800},
	{"id": "a1_tomb", "no": 3, "title": "순장 왕릉", "stage": "굴혈 5~6층",
		"blurb": "5층 왕릉의 녹슨 순장장군. 갇힌 시간 여행자 열두시가 \"이 구멍은 미래 지도에 없다\"고 말한다.",
		"mix": {"past": "순장 왕릉", "now": "도굴꾼 손전등·굴착기", "future": "빛 비석·시간 여행자"},
		"steps": [{"t": "talk", "scene": "tomb1"}, {"t": "floor", "n": 5}, {"t": "rescue", "n": 1, "room": 5}, {"t": "talk", "scene": "tomb2"}],
		"gold": 1500},
	## G-0089 2막 · 잿빛과 소금 — 고돗엔 폐도시·개펄 지역과 10층이 없어: 폐도시 폭주룡 = 월드 보스, 개펄 사슬 = 난입 파도 3, 망루성 = 7층(맨 아래 방).
	{"id": "a2_factory", "no": 4, "title": "멈춘 공장의 심장", "stage": "굴혈 · 월드 보스",
		"blurb": "단추의 부탁 — 멈춘 공장 굴뚝에서 폭주룡이 난다. 공장 심장은 굴혈로 이어진 관.",
		"mix": {"past": "공장 밑 옛 성벽", "now": "공장·급수탑·단추", "future": "방역복 추적자"},
		"steps": [{"t": "talk", "scene": "fac1"}, {"t": "wboss", "n": 1}, {"t": "talk", "scene": "fac2"}],
		"gold": 2500},
	{"id": "a2_tideflat", "no": 5, "title": "물 빠진 바다의 노래", "stage": "난입",
		"blurb": "염전 늙은 뱃사공이 \"바다가 이름을 부르며 물러갔다\"고 한다. 녹슨 관측탑 아래 촉수왕.",
		"mix": {"past": "염전·뱃노래", "now": "녹슨 관측탑", "future": "실험실 장갑벌"},
		"steps": [{"t": "talk", "scene": "tide1"}, {"t": "horde", "n": 1}, {"t": "talk", "scene": "tide2"}],
		"gold": 3500},
	{"id": "a2_watchtower", "no": 6, "title": "무너진 망루성", "stage": "굴혈 7층",
		"blurb": "맨 아래층 성주의 망령은 제 이름을 잃어 성을 떠나지 못한다. 묵향의 기록에서 이름을 찾아 줄지 고른다.",
		"mix": {"past": "망루성·성주", "now": "성 안 비상등·철문", "future": "성주 투구에 박힌 기계 눈"},
		"steps": [{"t": "floor", "n": 7}, {"t": "talk", "scene": "fort1"}, {"t": "talk", "scene": "fort2", "by": "fort"}],
		"gold": 5000},
]

## 셈 칸 — 단계 종류 → 합계 칸 이름.
const COUNTER := {"kill": "kills", "boss": "boss_kills", "rescue": "rescues", "wboss": "wbosses", "horde": "hordes"}


static func fresh() -> Dictionary:
	return {"ch": 0, "step": 0, "base": 0, "kills": 0, "boss_kills": 0, "rescues": 0, "wbosses": 0, "hordes": 0, "done": [], "choices": {}}


## 옛 세이브·빈 칸·모자란 칸을 채운 새 사전(원본은 안 건드린다).
static func normalize(st: Variant) -> Dictionary:
	var out := fresh()
	if st is Dictionary:
		for k in out:
			if (st as Dictionary).has(k):
				out[k] = (st as Dictionary)[k]
	out.done = (out.done as Array).duplicate()
	out.choices = (out.choices as Dictionary).duplicate() if out.choices is Dictionary else {}
	return out


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


## 지금 단계가 talk 면 그 장면 id(by 면 답을 붙인 id), 아니면 "".
static func pending_scene(st: Dictionary) -> String:
	var s := step(st)
	if String(s.get("t", "")) != "talk":
		return ""
	if s.has("by"):
		var opts: Array = []
		for k in CHOICES:
			if String(CHOICES[k].id) == String(s.by):
				opts = CHOICES[k].options
		var ans := String((st.get("choices", {}) as Dictionary).get(String(s.by), String(opts[0].key) if not opts.is_empty() else ""))
		return "%s_%s" % [String(s.scene), ans]
	return String(s.scene)


## 지금 단계(talk 아닌 것)가 끝났나. rooms_cleared = DungeonSaveState.rooms_cleared.
static func step_met(st: Dictionary, rooms_cleared: Array) -> bool:
	var s := step(st)
	var t := String(s.get("t", ""))
	match t:
		"kill", "boss", "rescue", "wboss", "horde":
			return int(st.get(COUNTER[t], 0)) - int(st.get("base", 0)) >= int(s.n)
		"floor":
			var i := int(s.n) - 1
			return i < rooms_cleared.size() and bool(rooms_cleared[i])
	return false


## 다음 단계로. 장이 끝나면 {"chapter": 장} 를 돌려준다(보상은 부르는 쪽이 준다), 아니면 {}.
static func advance(st: Dictionary) -> Dictionary:
	var ch := chapter(st)
	if ch.is_empty():
		return {}
	st.step = int(st.step) + 1
	var out := {}
	if int(st.step) >= (ch.steps as Array).size():
		(st.done as Array).append(String(ch.id))
		st.ch = int(st.ch) + 1
		st.step = 0
		out = {"chapter": ch}
	var t := String(step(st).get("t", ""))
	st.base = int(st.get(COUNTER[t], 0)) if COUNTER.has(t) else 0
	return out


## talk 아닌 단계를 끝난 만큼 넘긴다. 끝난 장들의 목록.
static func check(st: Dictionary, rooms_cleared: Array) -> Array:
	var done: Array = []
	var guard := 0
	while not finished(st) and pending_scene(st) == "" and step_met(st, rooms_cleared) and guard < 32:
		var r := advance(st)
		if r.has("chapter"):
			done.append(r.chapter)
		guard += 1
	return done


## 대화를 다 읽었다(answer = 그 장면 고르기 답, 없으면 "") → 다음 단계. 끝난 장(있으면) 목록.
static func finish_talk(st: Dictionary, rooms_cleared: Array, answer := "") -> Array:
	var scene := pending_scene(st)
	if scene == "":
		return []
	if CHOICES.has(scene) and answer != "":
		if not st.has("choices") or not (st.choices is Dictionary):
			st.choices = {}
		(st.choices as Dictionary)[String(CHOICES[scene].id)] = answer
	var done: Array = []
	var r := advance(st)
	if r.has("chapter"):
		done.append(r.chapter)
	return done + check(st, rooms_cleared)


## 목표판 한 줄. 다 끝났으면 "".
static func objective(st: Dictionary) -> String:
	var ch := chapter(st)
	if ch.is_empty():
		return ""
	var s := step(st)
	var t := String(s.get("t", ""))
	var have := int(st.get(COUNTER.get(t, ""), 0)) - int(st.get("base", 0)) if COUNTER.has(t) else 0
	var what := ""
	match t:
		"talk":
			what = "이야기"
		"kill":
			what = "적 처치 %d/%d" % [mini(have, int(s.n)), int(s.n)]
		"boss":
			what = "보스 처치 %d/%d" % [mini(have, int(s.n)), int(s.n)]
		"floor":
			what = "%d층 출구로" % int(s.n)
		"rescue":
			what = "%d층에 갇힌 이를 구하라" % (int(s.room) + 1)
		"wboss":
			what = "월드 보스(폐도시 폭주룡) 처치 %d/%d" % [mini(have, int(s.n)), int(s.n)]
		"horde":
			what = "난입에서 파도 %d 버티기" % HORDE_WAVE
	return "📜 %d장 %s — %s" % [int(ch.no), String(ch.title), what]


static func speaker(who: String) -> String:
	if who == "me":
		return "부대장"
	var c: Dictionary = CAST.get(who, {})
	return "%s %s" % [String(c.get("emoji", "")), String(c.get("name", who))]
