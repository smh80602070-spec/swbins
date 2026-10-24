extends RefCounted

## G-0333 4종횡 문파(메이플 길드 — 구조만, NPC 문파). 고돗이 먼저(웹·유니티 짝 없음, 장부 story.md 우선 3).
##   들기    ☰ 「🏯 문파」 — 셋 중 하나(나가면 공이 0 으로). 문파마다 덤 갈래 하나:
##           ⚔️ 검각(劍閣) 공격 · 💰 상단(商團) 금 · 📜 서원(書院) 경험 — 단계마다 +STEP_PCT%(최고 5단 = +10%).
##   공      잡졸·보스 처치마다 +1(보스 +BOSS_PTS) · 오늘의 문파 의뢰 사냥터(날마다 돌아감, 문파마다 다름)에서 잡으면 ×2.
##   단계    공 문턱 RANKS(100·300·700·1500·3000) → 입문·제자·사형·장로·부문주·문주.
##   저장    StorySaveState.guild = {id, pts} (26→27). 사람 몸·말 걸기 없이 창으로(새 NPC 에셋 없음). SAGA_GUILD=0 이면 끔.
## S = StorySaveState(점검이 autoload 이름 없이 부르게 넘긴다).

const GUILDS := {
	"blade": {"name": "검각", "hanja": "劍閣", "emoji": "⚔️", "fx": "atk", "fx_name": "공격"},
	"merchant": {"name": "상단", "hanja": "商團", "emoji": "💰", "fx": "gold", "fx_name": "금"},
	"academy": {"name": "서원", "hanja": "書院", "emoji": "📜", "fx": "exp", "fx_name": "경험"},
}
const ORDER := ["blade", "merchant", "academy"]
const RANKS := [0, 100, 300, 700, 1500, 3000]
const RANK_NAMES := ["입문", "제자", "사형", "장로", "부문주", "문주"]
const STEP_PCT := 2.0
const BOSS_PTS := 10
const HUNT := ["field", "forest", "cave", "gorge", "port", "namjeong", "gisan"]


static func on() -> bool:
	return OS.get_environment("SAGA_GUILD") != "0"


static func st(S: Object) -> Dictionary:
	if typeof(S.guild) != TYPE_DICTIONARY or (S.guild as Dictionary).is_read_only():
		S.guild = (S.guild as Dictionary).duplicate() if typeof(S.guild) == TYPE_DICTIONARY else {}
	return S.guild


static func joined(S: Object) -> String:
	return String(st(S).get("id", "")) if on() else ""


static func pts(S: Object) -> int:
	return int(st(S).get("pts", 0))


static func rank(S: Object) -> int:
	var r := 0
	for i in RANKS.size():
		if pts(S) >= int(RANKS[i]):
			r = i
	return r


## 오늘의 의뢰 사냥터 — 날(yyyymmdd)과 문파로 돌아감
static func hunt_today(gid: String, day_key: int) -> String:
	var gi := maxi(0, ORDER.find(gid))
	return String(HUNT[(day_key + gi * 3) % HUNT.size()])


static func day_key() -> int:
	var d := Time.get_datetime_dict_from_system(false)
	return int(d.year) * 10000 + int(d.month) * 100 + int(d.day)


static func join(S: Object, gid: String) -> String:
	if not on():
		return "꺼져 있다"
	if not GUILDS.has(gid):
		return "없는 문파"
	if joined(S) == gid:
		return "이미 든 문파다"
	S.guild = {"id": gid, "pts": 0}
	return ""


static func leave(S: Object) -> void:
	S.guild = {}


## 처치 — 공 +1(보스 +10), 오늘 의뢰 사냥터면 ×2. 단계가 오르면 새 단계(아니면 -1).
static func on_kill(S: Object, stage_key: String, boss: bool, dk: int) -> int:
	var gid := joined(S)
	if gid == "":
		return -1
	var before := rank(S)
	var n := BOSS_PTS if boss else 1
	if stage_key != "" and stage_key == hunt_today(gid, dk):
		n *= 2
	st(S)["pts"] = pts(S) + n
	var after := rank(S)
	return after if after > before else -1


## 덤 곱 — fx 키("atk"·"gold"·"exp")가 내 문파 갈래면 1 + 단계 × 2%
static func mul(S: Object, fx: String) -> float:
	var gid := joined(S)
	if gid == "" or String(GUILDS[gid].fx) != fx:
		return 1.0
	return 1.0 + STEP_PCT * float(rank(S)) / 100.0


static func rank_text(S: Object) -> String:
	var gid := joined(S)
	if gid == "":
		return "문파 없음"
	var g: Dictionary = GUILDS[gid]
	var r := rank(S)
	var nxt := "" if r >= RANKS.size() - 1 else " · 다음 %s까지 %d" % [RANK_NAMES[r + 1], int(RANKS[r + 1]) - pts(S)]
	return "%s %s(%s) %s · 공 %d%s · %s +%d%%" % [g.emoji, g.name, g.hanja, RANK_NAMES[r], pts(S), nxt, g.fx_name, int(STEP_PCT * r)]
