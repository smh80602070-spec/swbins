extends "res://saga_core/ui/save_transfer_screen.gd"
## G-0035 — 사가만리 세이브 옮기기 화면(메뉴 → "세이브 옮기기"). 화면 본문은 G-0037 에서 다섯 판 공용 saga_core/ui/save_transfer_screen.gd 로 옮겼다.
## 여기는 사가만리 설정만: 판 이름 "go" · SaveState · 그룹 go_save_transfer(메뉴·점검이 찾는다). 불러온 뒤엔 마을(test_village.gd)이 다시 뜨며 세이브를 읽는다.

const GAME_ID := "go"

func _init() -> void:
	game_id = GAME_ID
	group_name = "go_save_transfer"
	save_call = func() -> void: SaveState.save()

func _ready() -> void:
	state = SaveState
	super._ready()
