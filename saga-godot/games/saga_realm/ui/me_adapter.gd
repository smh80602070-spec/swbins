extends RefCounted

## G-0286 5천하 「내 정보」 model(웹 saga-realm/js/me-adapter.js 짝) — 플레이어 = 세력, 창 = 지금 군주 한 명(current_lord_id).
## 능력치는 realm_rules._effective_stat 만(성장·야망 보너스·일인지하 그대로). 보물 체계가 없어(realm_state 252) 입은 것 칸 대신 세력 수치.

const Characters := preload("res://saga_core/data/characters.gd")
const STATS := [["might", "무력"], ["wisdom", "지력"], ["command", "통솔"]]


static func model(hud: Node) -> Dictionary:
	var id: String = RealmSaveState.current_lord_id
	var h = Characters.find(id)
	var stats: Array = []
	for s: Array in STATS:
		var base: int = int(h.stats.get(s[0], 0)) if h != null else 0
		stats.append({"label": s[1], "value": "%d" % roundi(RealmSaveState._effective_stat(id, s[0])), "detail": "바탕 %d" % base})
	var slots: Array = [
		{"label": "성", "item": "%d" % RealmSaveState.cities.size()},
		{"label": "무장", "item": "%d" % RealmSaveState.roster.size()},
		{"label": "금고", "item": "%d" % RealmSaveState.gold},
	]
	var sb := hud.get_node_or_null("StatecraftButton") if hud != null else null
	var grow := {}
	if sb != null and sb.has_method("open_screen"):
		grow = {"label": "🧭 경륜도 (F2)", "open": Callable(sb, "open_screen")}
	return {"name": String(h.name) if h != null else "군주", "sub": "군주", "slots_head": "세력", "slots": slots, "stats": stats, "grow": grow}
