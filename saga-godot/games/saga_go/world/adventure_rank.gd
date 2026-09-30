extends Node

## PLAN 106장 ㉒ — 모험 등급 보상·세계 등급 변화(규칙은 data/adventure.gd). test_village.gd 가 로드 뒤에 붙인다.
##   부대 레벨이 오르면(PartyState.level_up) 지난 보상 등급(ar_paid) 다음부터 지금 등급까지 보상을 한꺼번에 준다.
##   세계 등급이 바뀌면 알리고 PartyState.world_changed — 들판 적 무리(field_spawner)가 다시 앉힌다.
##   lower_world(): 한 단계 낮추기/되돌리기(의뢰판 U 의 단추).

const Adventure := preload("res://games/saga_go/data/adventure.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

var _last_wl := 0

func _ready() -> void:
	add_to_group("go_adventure")
	if PartyState.ar_paid < 0:
		PartyState.ar_paid = Adventure.ar()
	_last_wl = Adventure.world_level()
	PartyState.level_up.connect(func(_lv: int) -> void: sync())

## 밀린 모험 등급 보상을 주고 세계 등급이 바뀌었는지 본다. 준 등급 수.
func sync() -> int:
	var paid := 0
	while PartyState.ar_paid < Adventure.ar():
		PartyState.ar_paid += 1
		PartyState.add_items(Adventure.reward_for(PartyState.ar_paid))
		paid += 1
	if paid > 0:
		var r := Adventure.reward_for(PartyState.ar_paid)
		Toast.show(self, "모험 등급 %d — 냥 %d·짧은 견문록 %d·강화석 조각 %d%s" % [Adventure.ar(), int(r.mora) * paid, int(r.book_s) * paid,
			int(r.ore_s) * paid, " · 인연 매듭" if r.has("fate_knot") else ""], 3.0)
	_check_world()
	return paid

func _check_world() -> void:
	var wl := Adventure.world_level()
	if wl == _last_wl:
		return
	var up := wl > _last_wl
	_last_wl = wl
	Toast.show(self, "세계 등급 %d — 들판 적이 %s (Lv.%d)" % [wl, "강해졌다" if up else "약해졌다", Adventure.enemy_level(wl)], 3.0)
	PartyState.world_changed.emit()

## 한 단계 낮추기 ↔ 되돌리기. 바뀌었으면 true.
func lower_world() -> bool:
	if not PartyState.wl_lowered and not Adventure.can_lower():
		return false
	PartyState.wl_lowered = not PartyState.wl_lowered
	_check_world()
	return true

func summary() -> String:
	var pr := Adventure.ar_progress()
	var wl := Adventure.world_level()
	var s := "모험 등급 %d (%d/%d) · 세계 등급 %d (들판 적 Lv.%d)" % [Adventure.ar(), int(pr.x), int(pr.y), wl, Adventure.enemy_level(wl)]
	if PartyState.wl_lowered:
		s += " — 한 단계 낮춤"
	var nxt := wl + (1 if PartyState.wl_lowered else 0) + 1
	if Adventure.ar_for_wl(nxt) > 0:
		s += "\n다음 세계 등급: 모험 등급 %d" % Adventure.ar_for_wl(nxt)
	return s
