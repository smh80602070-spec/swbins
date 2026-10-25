extends RefCounted

## G-0286 4종횡 「내 정보」 model(웹 saga-story/js/me-adapter.js 짝) — 열 부위 · 공격·방어(피해 줄임)·체력 · 사방 성좌.
## 공격은 story_player_base._effective_atk 의 바탕 줄(시작 + 장비 + 전직) — 그 함수는 한 방 배율을 소비해 부르지 않는다(기합·버프 뺀 값).
## 체력은 플레이어 몸의 max_hp(성좌·비경 배율 포함), 몸이 없으면 바탕 합.
## G-0374 괴물 카드 도감 줄(모은 종/전체 · 다 모음 · 공격 +%).


static func model(hud: Node) -> Dictionary:
	var slots: Array = []
	for s: String in StoryCombat.SLOT_LABEL:
		var key := String(StorySaveState.equipped.get(s, ""))
		var it: Dictionary = StoryCombat.item_def(key) if key != "" else {}
		slots.append({"label": String(StoryCombat.SLOT_LABEL[s].name), "item": String(it.get("name", ""))})
	var g: Dictionary = StorySaveState.gear_totals()
	var jg: Dictionary = StorySaveState.job_grow()
	var atk: float = StoryCombat.START_ATK + float(g.atk) + float(jg.atk)
	var def: float = float(g.def)
	var hp: float = StoryCombat.START_HP + float(g.hp) + float(jg.hp)
	var pl := _player(hud)
	if pl != null:
		hp = float(pl.get("max_hp"))
	var stats: Array = [
		{"label": "공격", "value": "%d" % roundi(atk), "detail": "시작 %d + 장비 %d + 전직 %d" % [roundi(StoryCombat.START_ATK), roundi(float(g.atk)), roundi(float(jg.atk))]},
		{"label": "방어", "value": "%d" % roundi(def), "detail": "받는 피해 −%d%%" % roundi(StoryCombat.damage_cut(def) * 100.0)},
		{"label": "체력", "value": "%d" % roundi(hp)},
	]
	var MB := preload("res://games/saga_story/data/story_monster_book.gd")
	if MB.on():
		stats.append({"label": "🃏 카드 도감", "value": "%d/%d" % [MB.found_count(StorySaveState), MB.species().size()],
			"detail": "다 모음 %d종 · 공격 +%.1f%%" % [MB.complete_count(StorySaveState), (MB.atk_mul(StorySaveState) - 1.0) * 100.0]})
	stats.append_array(preload("res://games/saga_story/data/story_gear_set.gd").me_rows(StorySaveState))   # G-0399 세트 줄
	var ufx: Dictionary = preload("res://games/saga_story/data/story_unique_fx.gd").me_row(StorySaveState)   # G-0399 고유 효과 줄
	if not ufx.is_empty():
		stats.append(ufx)
	var job := String(StoryCombat.job_info(StorySaveState.job).get("name", "")) if StorySaveState.job != "none" else "무직"
	var cb := hud.get_node_or_null("ConstellationButton") if hud != null else null
	var grow := {}
	if cb != null and cb.has_method("open_screen"):
		grow = {"label": "✨ 사방 성좌 (L)", "open": Callable(cb, "open_screen")}
	return {"name": "나", "sub": "Lv %d · %s · 금 %d" % [StorySaveState.level, job, StorySaveState.gold],
		"slots": slots, "stats": stats, "grow": grow}


static func _player(hud: Node) -> Node:
	if hud == null or hud.get_tree() == null or hud.get_tree().current_scene == null:
		return null
	for n in hud.get_tree().current_scene.find_children("*", "CharacterBody3D", true, false):
		if n is StoryPlayerBase:
			return n
	return null
