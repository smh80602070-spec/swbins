extends Node

## "제외" 목록 5번(인물 등용) — GO의 party_state.gd와 같은 개념(등용한
## 인원이 부대 전투력을 올린다)이지만, DUNGEON은 이미 장비 기반 전투 채널
## (DungeonEquipmentState의 flat/pct 공식)이 있어 GO의 flat 60/35 스탯
## 체계를 새로 만들지 않는다. 대신 `dungeon_run_state.gd::_sum_eff()`가
## 이미 쓰는 world eff 어휘(atkPct·hpPct)로 인원 수만큼 보태 — 은사·장비·
## 부대 셋이 전부 같은 집계 지점을 거치게 한다(atk_mult()·hp_mult()를
## 쓰는 melee_attack.gd·player_health.gd는 손 안 대도 그대로 반영된다).
##
## project.godot [autoload]에 DungeonPartyState로 등록.

signal party_changed

## 원작(웹판)엔 이런 수치가 없다 — 직접 정함. 장비 world 접사(dungeon_items.gd
## AFFIXES의 atk/hp 항목, 각각 2~6%·2~7% 범위)와 비슷한 무게로 잡아, 인원
## 하나가 대략 장비 접사 하나만큼의 보탬이 되게 했다.
const ATK_PCT_PER_MEMBER := 4.0
const HP_PCT_PER_MEMBER := 5.0

var members: Array[String] = []


func recruit(id: String) -> void:
	members.append(id)
	DungeonSaveState.tutorial_action("recruit")
	party_changed.emit()


## dungeon_save_state.gd가 저장 파일을 불러온 뒤 여기로 넘긴다.
func restore(saved_members: Array[String]) -> void:
	members = saved_members.duplicate()
	party_changed.emit()


## DungeonRunState._sum_eff()가 boons·장비와 나란히 더하는 세 번째 자리 —
## atkPct·hpPct 두 키만 반응한다(그 외 키는 0, 새 채널을 안 만든다).
func world_eff_sum(eff_key: String) -> float:
	match eff_key:
		"atkPct":
			return float(members.size()) * ATK_PCT_PER_MEMBER
		"hpPct":
			return float(members.size()) * HP_PCT_PER_MEMBER
		_:
			return 0.0
