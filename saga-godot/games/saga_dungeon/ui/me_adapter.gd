extends RefCounted

## G-0286 2나락 「내 정보」 model(웹 saga-dungeon/js/me-adapter.js 짝) — 여덟 부위 · 무력(평타 한 대)·체력·막기·치명 · 경락도.
## 값은 판 기존 함수 그대로: 평타 = melee_attack._strike 식(ATK_DAMAGE × (atk_mult + atk_pct/100) + atk_flat) · 체력 = player_health.recalc_max_hp 식.

const Melee := preload("res://games/saga_dungeon/player/melee_attack.gd")
const Health := preload("res://games/saga_dungeon/player/player_health.gd")
const Vendor := preload("res://games/saga_dungeon/ui/vendor_button.gd")


static func model(hud: Node) -> Dictionary:
	var slots: Array = []
	for s: String in DungeonEquipmentState.SLOT_NAMES:
		var it: Dictionary = DungeonEquipmentState.item_for(s)
		slots.append({"label": String(Vendor._SLOT_LABELS.get(s, s)), "item": "" if it.is_empty() else DungeonItems.item_name(it) + preload("res://games/saga_dungeon/data/dungeon_mastery.gd").tag(it)})   # G-0317 숙련 ★
	var pct: float = DungeonRunState.atk_mult() + DungeonEquipmentState.atk_pct_bonus() / 100.0
	var atk: float = Melee.ATK_DAMAGE * pct + DungeonEquipmentState.atk_flat_bonus()
	var guard: float = DungeonRunState.guard_mult()
	var stats: Array = [
		{"label": "평타 피해", "value": "%d" % roundi(atk), "detail": "바탕 %d × %d%% + %d" % [roundi(Melee.ATK_DAMAGE), roundi(pct * 100.0), roundi(DungeonEquipmentState.atk_flat_bonus())]},
		{"label": "체력", "value": "%d" % roundi(Health.MAX_HP_BASE * DungeonRunState.hp_mult())},
		{"label": "받는 피해", "value": "×%.2f" % guard},
		{"label": "치명", "value": "%d%%" % roundi(DungeonRunState.crit_chance())},
	]
	var skill := hud.get_node_or_null("SkillButton") if hud != null else null
	var grow := {}
	if skill != null and skill.has_method("open_meridian"):
		grow = {"label": "☯ 경락도 (F2)", "open": Callable(skill, "open_meridian")}
	return {"name": "나", "sub": "%s · 금 %d" % [DungeonItems.class_name_for_weapon(DungeonEquipmentState.weapon), DungeonGoldState.gold],
		"slots": slots, "stats": stats, "grow": grow}
