extends RefCounted

## G-0335 2나락 신의 가호(하데스 2 신 계보 — 구조만) — 은사(축복 3택, data/dungeon_boons.gd) 열일곱을 다섯 신 계보로 묶는다.
##           원소 결 셋(syn_*)은 계보 밖 — "처치 시 확산만, 합산 채널 안 바꿈"(probe_dungeon_synergy) 약속 그대로.
##   계보    ⚔️ 무신 맹공·연격·일격·관통 · 🛡️ 지신 철벽·흡혈·회복술·수호부 · 🌪️ 풍신 질주·장병·분신·척후
##           · 🌀 선인 진기·현오·비급 · 💰 재신 재물운·탐색안.
##   가호    한 신의 은사를 겹쳐 3개 → 1단 · 6개 → 2단(1단 덤 포함). 덤은 그 신의 결 — 무신 공격 +8% / +치명 5%p ·
##           지신 체력 +10% / +막기 8% · 풍신 이동 +8% / +공속 8% · 선인 무예 +10% / +15% · 재신 금 +10% / +15%.
##   셈      DungeonRunState._sum_eff 아홉 번째 자리(영구 boons 만 — 난입 한정 run_boons 는 안 셈).
##   글      3택 카드 끝에 "⚔️무신 2/3"(이 은사로 단이 오르면 "→ 가호 1단!") · 단이 오르면 알림. SAGA_BLESSING=0 이면 덤·글 없음.

const STEPS := [3, 6]
const GODS := {
	"war": {"name": "무신", "hanja": "武神", "emoji": "⚔️", "boons": ["fury", "haste", "crit", "pierce"],
		"fx": [{"atkPct": 8.0}, {"critPct": 5.0}], "fx_text": ["공격 +8%", "치명 +5%p"]},
	"earth": {"name": "지신", "hanja": "地神", "emoji": "🛡️", "boons": ["wall", "drain", "mend", "ward"],
		"fx": [{"hpPct": 10.0}, {"guardPct": 8.0}], "fx_text": ["체력 +10%", "막기 +8%"]},
	"wind": {"name": "풍신", "hanja": "風神", "emoji": "🌪️", "boons": ["dash", "reach", "ghost", "scout"],
		"fx": [{"moveSpdPct": 8.0}, {"atkSpdPct": 8.0}], "fx_text": ["이동 +8%", "공속 +8%"]},
	"sage": {"name": "선인", "hanja": "仙人", "emoji": "🌀", "boons": ["skillamp1", "skillamp2", "skillpoint"],
		"fx": [{"skillPct": 10.0}, {"skillPct": 15.0}], "fx_text": ["무예 +10%", "무예 +15%"]},
	"wealth": {"name": "재신", "hanja": "財神", "emoji": "💰", "boons": ["greed", "eye"],
		"fx": [{"goldPct": 10.0}, {"goldPct": 15.0}], "fx_text": ["금 +10%", "금 +15%"]},
}
const ORDER := ["war", "earth", "wind", "sage", "wealth"]


static func on() -> bool:
	return OS.get_environment("SAGA_BLESSING") != "0"


static func god_of(boon_key: String) -> String:
	for g: String in ORDER:
		if (GODS[g].boons as Array).has(boon_key):
			return g
	return ""


## 신마다 겹친 은사 수
static func stacks(counts: Dictionary) -> Dictionary:
	var out := {}
	for g: String in ORDER:
		out[g] = 0
	for k in counts:
		var g := god_of(str(k))
		if g != "":
			out[g] = int(out[g]) + int(counts[k])
	return out


static func step_of(n: int) -> int:
	var s := 0
	for t: int in STEPS:
		if n >= t:
			s += 1
	return s


## _sum_eff 자리 — 닿은 단의 덤 합
static func eff(counts: Dictionary, eff_key: String) -> float:
	if not on():
		return 0.0
	var total := 0.0
	var st := stacks(counts)
	for g: String in ORDER:
		var s := step_of(int(st[g]))
		for i in s:
			total += float((GODS[g].fx[i] as Dictionary).get(eff_key, 0.0))
	return total


## 3택 카드 끝 글 — 이 은사를 고르면 몇 개가 되는지
static func tag(boon_key: String, counts: Dictionary) -> String:
	if not on():
		return ""
	var g := god_of(boon_key)
	if g == "":
		return ""
	var n := int(stacks(counts)[g])
	var s := step_of(n)
	var gd: Dictionary = GODS[g]
	if s >= STEPS.size():
		return "%s%s 가호 %d단" % [gd.emoji, gd.name, s]
	if step_of(n + 1) > s:
		return "%s%s %d/%d → 가호 %d단!" % [gd.emoji, gd.name, n, int(STEPS[s]), s + 1]
	return "%s%s %d/%d" % [gd.emoji, gd.name, n, int(STEPS[s])]


## 고르기 전·후 counts 로 오른 단 알림 — 없으면 ""
static func up_text(before: Dictionary, after: Dictionary) -> String:
	if not on():
		return ""
	var b := stacks(before)
	var a := stacks(after)
	for g: String in ORDER:
		var s0 := step_of(int(b[g]))
		var s1 := step_of(int(a[g]))
		if s1 > s0:
			var gd: Dictionary = GODS[g]
			return "%s %s(%s)의 가호 %d단 — %s" % [gd.emoji, gd.name, gd.hanja, s1, String(gd.fx_text[s1 - 1])]
	return ""


## 「내 정보」 등에 쓸 한 줄 — 단이 하나라도 있는 신만
static func summary(counts: Dictionary) -> String:
	if not on():
		return ""
	var st := stacks(counts)
	var p: Array = []
	for g: String in ORDER:
		var s := step_of(int(st[g]))
		if s > 0:
			p.append("%s%s %d단" % [GODS[g].emoji, GODS[g].name, s])
	return " · ".join(p)
