extends Label

## "제외" 목록 5번(인물 등용) — HpLabel·JobLabel·MaterialsLabel과 같은
## 경계(상시 표시). GO의 party_label.gd처럼 등용한 인물 이름을 saga_core
## 데이터에서 찾아 같이 보여준다 — "누구를 얻었는가"가 잠깐 뜨는 토스트
## 에만 남고 사라지면 안 된다는 GO 쪽 교훈(party_label.gd 헤더 참고)을
## 그대로 따랐다. GO와 달리 "전투력"·"Lv." 표기는 없다 — DUNGEON은 그
## 개념 대신 atk/hpPct 보탬으로만 반영된다(dungeon_party_state.gd 참고).

const Characters := preload("res://saga_core/data/characters.gd")

func _ready() -> void:
	add_to_group("dungeon_party_label")   # G-0341 — 방을 깨면 우정 꼬리표를 다시 그린다(party_changed 는 동행 몸까지 다시 세워 안 쏜다)
	DungeonPartyState.party_changed.connect(_refresh)
	_refresh()

func _refresh() -> void:
	var names: Array = []
	for id in DungeonPartyState.members:
		var h: Variant = Characters.find(id)
		names.append(preload("res://games/saga_dungeon/data/dungeon_bond.gd").name_tag(id, h.name if h != null else id))   # G-0341 우정 꼬리표
	var names_text := " (" + "·".join(names) + ")" if not names.is_empty() else ""
	text = "🛡️ 부대 %d명%s" % [DungeonPartyState.members.size(), names_text]
