extends Node

## VERTICAL_SLICE_DUNGEON.md 3절 — "때리는 손맛"을 검증하려면 적도
## 되받아쳐야 한다. GO의 Player.tscn/player.gd는 손대지 않고, Player
## 인스턴스 밑에 이 컴포넌트 하나만 얹는 방식으로 짰다(component 패턴 —
## melee_attack.gd와 같은 경계).
##
## 은사(철벽) 적용 — max_hp가 더 이상 상수가 아니라 DungeonRunState.hp_mult()
## 로 다시 계산된다(웹판 dungeon.js hpMaxOf()와 같은 자리). 수호부(guardPct)
## 는 받는 피해를 줄인다(dungeon.js의 "amount *= 1 - boonVal('guardPct')/100"
## 그대로).
##
## "제외" 목록 6번(결사) — 결사가 켜져 있을 때만 hp 0을 "쓰러짐"으로
## 취급해 dungeon.js die()의 결사 갈래(그 판이 끝난다)를 옮긴다(`_fall()`).
## **비결사 모드는 처음엔 "죽음 범위 밖 — hp 0에서 그냥 멈춘다"였는데,
## 2026-09-17 PLAN 101-2 DUNGEON ②(유품)에서 실제 죽음·부활 루프가
## 생겼다(`_die_and_respawn()`)** — `_dead` 가드는 이제 두 갈래(결사·
## 비결사) 모두에서 "hp 0 처리를 한 번만 하기" 용도로 쓰인다(비결사는
## 처리 끝에 다시 false로 돌아온다, 결사는 화면이 멈춰 다시 물어볼 일이
## 없다).

signal hp_changed(hp: float, max_hp: float)
signal died

const Toast := preload("res://saga_core/ui/toast.gd")
const LootPickup := preload("res://games/saga_dungeon/world/loot_pickup.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")

## PLAN 101-2 DUNGEON ②(유품, 2026-09-17) — dungeon_grave_state.gd 헤더
## 참고. 웹 5.2는 "노획물 전부"지만 이 슬라이스 지갑은 이미 영구 상태라
## 전부를 걸면 너무 가혹하다 — 직접 정한 비율.
const GRAVE_GOLD_LOSS_PCT := 0.20

var _dead := false

## 이번 슬라이스엔 스탯 시스템이 없어(장비·직업 능력치 전부 제외 목록)
## 임의로 정한 값 — 잡졸(공격력≈5) 몇 대는 맞아도 버티는 정도를 노렸다.
const MAX_HP_BASE := 60.0

var max_hp := MAX_HP_BASE
var hp := MAX_HP_BASE


func _ready() -> void:
	add_to_group("player_health")
	DungeonRunState.boons_changed.connect(recalc_max_hp)
	## "제외" 목록 3번(장비 등급+접사) — hp_mult()가 이제 장비의 hpPct
	## 접사도 같이 더하므로(DungeonRunState._sum_eff 참고), 장비가 바뀔
	## 때도 다시 계산해야 한다. "제외" 목록 2번(투장·내구)에서 부적(charm)
	## 이 더해지고 부서짐(is_broken)이 hpPct 반영分을 껐다 켰다 하므로
	## charm_changed도 같이 구독한다(wear_all()이 부서뜨렸을 때도 신호를
	## 쏜다 — dungeon_equipment_state.gd::wear_all() 참고). 2026-09-14
	## 갑주(armor), 같은 날 이어서 남은 다섯 부위(helm·glove·boot·ring·
	## neck)까지 생겨 여덟 신호 전부(SLOT_NAMES 순서) 같은 이유로 구독한다
	## — 어느 부위든 hpPct 접사가 굴러 나올 수 있어서다.
	for slot_name in DungeonEquipmentState.SLOT_NAMES:
		Signal(DungeonEquipmentState, slot_name + "_changed").connect(recalc_max_hp)
	## "제외" 목록 5번(인물 등용) — DungeonPartyState도 hpPct를 보태므로
	## (dungeon_run_state.gd::_sum_eff 참고) 인원이 늘 때도 다시 계산한다.
	DungeonPartyState.party_changed.connect(recalc_max_hp)
	recalc_max_hp()


func recalc_max_hp() -> void:
	max_hp = MAX_HP_BASE * DungeonRunState.hp_mult()
	hp = minf(hp, max_hp)
	hp_changed.emit(hp, max_hp)


func heal_by(amount: float) -> void:
	if amount <= 0.0:
		return
	hp = minf(max_hp, hp + amount)
	hp_changed.emit(hp, max_hp)


func take_damage(amount: float) -> void:
	if _dead or amount <= 0.0:
		return
	hp = maxf(0.0, hp - amount * DungeonRunState.guard_mult())
	hp_changed.emit(hp, max_hp)
	if hp <= 0.0:
		_dead = true
		died.emit()
		if DungeonHardcoreState.hardcore:
			_fall()
		else:
			_die_and_respawn()


## PLAN 101-2 DUNGEON ②(유품, 2026-09-17) — 비결사 사망의 실제 비용:
## 지갑 20%+지금 장착한 무기·부적을 그 자리에 남기고 **그 자리에서 곧바로
## 되살아난다**(방 이동·좌표 계산이 없다 — 웹 5.2 "사망→재도전 조작 3회
## 이하"보다도 짧다). 유품은 `LootPickup.spawn_grave_at()`이 그 자리에
## 표식으로 남기고, `DungeonGraveState`가 실제 값을 들고 있다가 마커를
## 밟으면 돌려준다.
func _die_and_respawn() -> void:
	var lost_gold: int = int(roundf(DungeonGoldState.gold * GRAVE_GOLD_LOSS_PCT))
	DungeonGoldState.add(-lost_gold)
	var lost_weapon: Dictionary = DungeonEquipmentState.weapon.duplicate(true)
	var lost_charm: Dictionary = DungeonEquipmentState.charm.duplicate(true)
	DungeonEquipmentState.equip("weapon", {})
	DungeonEquipmentState.equip("charm", {})
	var player: Node3D = get_parent()
	DungeonGraveState.set_grave(player.global_position, lost_gold, lost_weapon, lost_charm)
	LootPickup.spawn_grave_at(get_parent().get_parent(), player.global_position)
	recalc_max_hp()
	hp = max_hp
	_dead = false
	hp_changed.emit(hp, max_hp)
	_show_death_card(lost_gold)


## 웹 5.2 "사망 화면 = 세션 카드"를 이 판의 단순 패널(ChoicePrompt)로
## 근사했다 — 새 UI를 안 만든다. "닫기" 버튼 하나로 곧바로 계속한다.
func _show_death_card(lost_gold: int) -> void:
	var room: Node = get_parent().get_parent()
	var msg := "☠️ 쓰러졌다 — 금 %d 과 무기·부적을 그 자리에 두고 되살아난다.\n💀 표식을 다시 밟으면 돌려받는다." % lost_gold
	var layer_box := {}
	var choices: Array = [{
		"label": "계속",
		"cb": func() -> void: (layer_box["layer"] as CanvasLayer).queue_free(),
	}]
	layer_box["layer"] = ChoicePrompt.build(room, msg, choices)


## dungeon.js die()의 결사(決死) 갈래 — 정확한 "층"을 아는 자리(현재 방
## 인덱스)가 여기엔 없어, 이미 클리어한 방 수 + 1로 가늠한다(방 하나
## 클리어할 때마다 DungeonSaveState.rooms_cleared에 표시가 남는다 —
## dungeon_save_state.gd 참고). 스러진 순간 화면 전체를 멈춘다
## (dungeon_hardcore_state.gd 헤더 참고) — HUD 버튼도 같이 멎는다.
func _fall() -> void:
	var floor_reached: int = DungeonSaveState.rooms_cleared.count(true) + 1
	DungeonHardcoreState.mark_fallen(floor_reached)
	DungeonSaveState.save(get_parent())
	Toast.show(self, "☠️ 결사 — 제%d층에서 스러졌다. 이 판은 여기까지다." % floor_reached, 8.0)
	get_tree().paused = true
