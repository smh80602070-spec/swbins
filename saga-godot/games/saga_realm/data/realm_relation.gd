extends RefCounted

## G-0316 5천하 장수 관계망 — 웹 saga-web/saga-realm/js/relation.js(W-0308)·data-relation.js 짝 표 이식. 수치 그대로(의형제 +5%·원수 충성 -2/달·사제 +3).
##   의형제 🤝  출진하는 장수의 의형제가 우리 무장으로 같은 출진 성에 있으면 공 위력 ×(1 + SWORN_ATK).
##              웹은 "같은 군대에 함께" — 고돗 출진은 장수 하나(attack() officer_count 1)라 "같은 성에서 보낸다"로 바꿨다.
##   원수 🗡️    둘 다 우리 무장이면 달마다 둘 다 충성 FOE_LOYAL(웹의 사연 화해도가 고돗엔 없어 늘 깎는다).
##   사제 📖    스승이 쓰러지면(annals — 전술판 전사) 우리 무장인 제자 능력(무력·지력·통솔) +MASTER_BONUS 영구, 한 번(rel_master).
##   호적수 ⚔️  표시만(웹도 효과 없음).
##   인물 줄   officer_hint 꼬리 — 승진·이동 등 무장 고르는 창마다 보인다.
## 웹 지역 수비 무장 자동 짝(autoPairs)은 고돗에 그 명단이 없어 뺐다. AI 세력 무장엔 안 건다(고돗 AI 무장은 충성 칸만 있다).
## S = RealmSaveState(realm_trade.gd 와 같은 꼴). 저장 rel_master(25→26). SAGA_RELATION=0 이면 끔.

const Characters := preload("res://saga_core/data/characters.gd")

const SWORN_ATK := 0.05
const FOE_LOYAL := -2
const MASTER_BONUS := 3
const MASTER_STATS := ["might", "wisdom", "command"]
const KINDS := {
	"sworn": {"name": "의형제", "emoji": "🤝"},
	"foe": {"name": "원수", "emoji": "🗡️"},
	"master": {"name": "사제", "emoji": "📖"},
	"rival": {"name": "호적수", "emoji": "⚔️"},
}
## [a, b, kind] — master 는 a 가 스승(웹 data-relation.js PAIRS 그대로, 고돗 도감에 없는 id 는 저절로 빠진다)
const PAIRS := [
	["sg_liubei", "sg_guanyu", "sworn"],
	["sg_liubei", "sg_zhangfei", "sworn"],
	["sg_guanyu", "sg_zhangfei", "sworn"],
	["rf_sunce", "sg_zhouyu", "sworn"],
	["rf_wenchou", "rf_yanliang", "sworn"],
	["rf_xiahouyuan", "sg_xiahoudun", "sworn"],
	["rf_caohong", "sg_caocao", "sworn"],
	["rf_mizhu", "rf_jianyong", "sworn"],
	["jp_nobunaga", "jp_ieyasu", "sworn"],
	["sg_guanyu", "rf_yanliang", "foe"],
	["sg_lubu", "sg_zhangfei", "foe"],
	["sg_machao", "sg_caocao", "foe"],
	["sg_machao", "rf_hansui", "foe"],
	["rf_yuanshao", "rf_yuanshu", "foe"],
	["rf_lijue", "rf_guosi", "foe"],
	["sg_menghuo", "sg_zhugeliang", "foe"],
	["kr_yisunsin", "jp_hideyoshi", "foe"],
	["eu_scipio", "eu_hannibal", "foe"],
	["eu_napoleon", "eu_nelson", "foe"],
	["jp_yoritomo", "jp_yoshitsune", "foe"],
	["kr_kimyusin", "kr_gyebaek", "foe"],
	["sg_xunyu", "rf_guojia", "master"],
	["sg_zhouyu", "sg_luxun", "master"],
	["kr_sejong", "kr_jangyeongsil", "master"],
	["kr_yihwang", "kr_yii", "master"],
	["wd_genghis", "wd_khubilai", "master"],
	["jp_nobunaga", "jp_hideyoshi", "master"],
	["sg_zhugeliang", "sg_simayi", "rival"],
	["sg_zhouyu", "sg_zhugeliang", "rival"],
	["rf_yuanshao", "sg_caocao", "rival"],
	["rf_tianfeng", "rf_shenpei", "rival"],
	["jp_shingen", "jp_kenshin", "rival"],
	["wd_saladin", "eu_richard", "rival"],
]


static func on() -> bool:
	return OS.get_environment("SAGA_RELATION") != "0"


static func pairs_of(id: String) -> Array:
	var out: Array = []
	for p: Array in PAIRS:
		if (p[0] == id or p[1] == id) and Characters.find(String(p[0])) != null and Characters.find(String(p[1])) != null:
			out.append(p)
	return out


static func _other(p: Array, id: String) -> String:
	return String(p[1]) if String(p[0]) == id else String(p[0])


## 출진 공 위력 곱 — 의형제가 같은 성에 우리 무장으로 있으면 1 + SWORN_ATK
static func attack_mul(S: Object, officer_id: String, from_city: String) -> float:
	if not on():
		return 1.0
	for p: Array in pairs_of(officer_id):
		var o := _other(p, officer_id)
		if String(p[2]) == "sworn" and (S.roster as Array).has(o) and String(S.officer_city.get(o, "")) == from_city:
			return 1.0 + SWORN_ATK
	return 1.0


## 달 끝 — 원수 충성 깎기(조용히 — 달마다 알림이면 시끄럽다, 무장 줄에 🗡️ 로 보인다) · 스승 잃은 제자 능력. 소식 글 배열.
static func monthly(S: Object) -> Array:
	var msgs: Array = []
	if not on():
		return msgs
	var seen := {}
	for id: String in (S.roster as Array).duplicate():
		for p: Array in pairs_of(id):
			var key := "%s|%s" % [p[0], p[1]]
			if seen.has(key):
				continue
			seen[key] = true
			var a := String(p[0])
			var b := String(p[1])
			match String(p[2]):
				"foe":
					if (S.roster as Array).has(a) and (S.roster as Array).has(b):
						for x: String in [a, b]:
							S.officer_loyal[x] = clampi(int(S.officer_loyal.get(x, 50)) + FOE_LOYAL, 0, 100)
				"master":
					if (S.annals as Dictionary).has(a) and (S.roster as Array).has(b) and not (S.rel_master as Dictionary).has(b):
						S.rel_master[b] = a
						for st: String in MASTER_STATS:
							S._add_growth_bonus(b, st, MASTER_BONUS)
						msgs.append("📖 %s 이(가) 스승 %s 을(를) 잃고 뜻을 이었다 — 능력 +%d" % [_nm(b), _nm(a), MASTER_BONUS])
	return msgs


static func _nm(id: String) -> String:
	var h = Characters.find(id)
	return String(h.name) if h != null else id


## 무장 줄 꼬리 — 없으면 ""
static func hint(S: Object, id: String) -> String:
	if not on():
		return ""
	var bits: Array = []
	for p: Array in pairs_of(id):
		var o := _other(p, id)
		var role := ""
		if String(p[2]) == "master":
			role = "(제자)" if String(p[0]) == id else "(스승)"
		var gone := " †" if (S.annals as Dictionary).has(o) else ""
		bits.append("%s%s%s%s" % [KINDS[p[2]].emoji, _nm(o), role, gone])
	if (S.rel_master as Dictionary).has(id):
		bits.append("📖+%d" % MASTER_BONUS)
	return "" if bits.is_empty() else " 🔗" + " ".join(bits)
