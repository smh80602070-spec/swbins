extends Node

## saga-godot 2026-09-28 "그래픽 먼저" — 가로 화면 UI 크기. 기준 화면이 세로 1080×1920(project.godot, canvas_items·expand)이라
## 가로로 들면(PC 창 1280×720·폰 가로) 배율이 min(1280/1080, 720/1920) = 0.375 로 글자가 깨알만 했다(알려진 오류 "UI 56%", 09-28 창 모드 촬영).
## 가로일 때만 기준을 LANDSCAPE 로 바꿔 배율을 올린다(1280×720 이면 0.5625 — 1.5배). 세로(폰 기본)는 그대로.
## 세로를 1920 → 1280 로 줄여 쓰는 셈이라 키 큰 창(지도·인물 화면)이 모자라지 않은지는 probe_shots ui_* 로 본다.
## GO·사가마을·사가종횡·사가천하 루트 스크립트가 _ready 첫머리에서 단다(2026-09-29 GO 만이던 것을 넓힘).
## 사가나락도 단다(test_room.gd) — 기술 단추 줄이 길면 옆 줄로 접는 hud_column_layout.gd 와 함께(세로 1900px 쯤이라 혼자면 위가 잘렸다).
## 개발용: SAGA_QUICK_SHOT=<png 경로> 가 있으면 2.5초(SAGA_QUICK_SHOT_DELAY) 뒤 화면을 저장하고 끝낸다(창 모드 가로 UI 확인용).

const PORTRAIT := Vector2i(1080, 1920)
const LANDSCAPE := Vector2i(1920, 1280)


func _ready() -> void:
	get_tree().root.size_changed.connect(_fit)
	_fit()
	if OS.get_environment("SAGA_QUICK_SHOT") != "":
		await get_tree().create_timer(float(OS.get_environment("SAGA_QUICK_SHOT_DELAY")) if OS.get_environment("SAGA_QUICK_SHOT_DELAY") != "" else 2.5).timeout
		get_viewport().get_texture().get_image().save_png(OS.get_environment("SAGA_QUICK_SHOT"))
		get_tree().quit()


func _fit() -> void:
	var win := get_window()
	var s := win.size
	var want := LANDSCAPE if s.x > s.y else PORTRAIT
	if win.content_scale_size != want:
		win.content_scale_size = want
