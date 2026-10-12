extends Node

## GO의 player.gd(GO·DUNGEON 공유, 손대지 않는다는 기존 원칙 —
## player_health.gd·melee_attack.gd 주석 참고)에 이동 속도 배율을 넣기
## 위한 최소한의 컴포넌트. player.gd엔 "speed_mult"라는 일반적인 필드
## 하나만 추가했다(기본값 1.0, GO는 이 필드를 아예 모르고 지나간다) —
## 이 컴포넌트가 DungeonRunState(질주 은사 등)를 읽어 그 필드에 실제
## 값을 밀어 넣는 유일한 자리다.

@onready var _player: CharacterBody3D = get_parent()


func _ready() -> void:
	DungeonRunState.boons_changed.connect(_sync)
	DungeonEquipmentState.weapon_changed.connect(_sync)   # G-0217 — 무기를 바꾸면 직업 경락도가 바뀐다
	_sync()


func _sync() -> void:
	_player.speed_mult = DungeonRunState.move_speed_mult()
