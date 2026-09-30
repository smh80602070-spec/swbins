extends Button

## VERTICAL_SLICE.md 26절 "제외" 목록의 "사진 모드" 착수(2026-09-14) —
## GO 26절 마지막 두 항목(소문 시스템·사진 모드) 중 새 UI/콘텐츠 설계
## 없이 기존 조각(HUD 라벨들·camera_rig.gd의 드래그 회전/줌·Toast)만
## 조립하면 되는 쪽을 먼저 골랐다. 소문 시스템은 여전히 범위 밖(웹판도
## "모양만 잡아 두고" 실제 내용은 안 만든 미완성 기능 — js/npc.js 참고,
## 새 콘텐츠 설계가 필요해 이번 슬라이스에 안 맞는다).
##
## 누르면(켜짐): 이 버튼·CaptureButton 말고 HUD의 나머지(조이스틱·
## PartyLabel·QuestLabel·CodexLabel·WeatherLabel·SaveButton·
## RendererDebugLabel)를 전부 숨기고 플레이어 이동을 멈춘다
## (player.gd의 frozen). 카메라 회전/줌은 camera_rig.gd가 이 버튼과
## 무관하게 이미 직접 입력을 받으므로 그대로 된다 — "가만히 서서
## 카메라만 돌려 구도를 잡는다"는 사진 모드의 핵심만 최소로 구현했다.
## 다시 누르면(꺼짐) 전부 원상복구.
##
## CaptureButton(켜진 동안만 보임)을 누르면 현재 화면을 PNG로 저장한다
## (`get_viewport().get_texture().get_image()`) — user://photos/ 밑에
## 저장, Toast로 파일 경로를 보여준다.

const Toast := preload("res://saga_core/ui/toast.gd")

var _on := false
@onready var _capture_button: Button = $"../CaptureButton"


func _ready() -> void:
	text = "📷"
	pressed.connect(_on_pressed)
	_capture_button.visible = false
	_capture_button.pressed.connect(_on_capture_pressed)


func _on_pressed() -> void:
	_on = not _on
	text = "✕" if _on else "📷"
	_capture_button.visible = _on

	var hud: Node = get_parent()
	for child in hud.get_children():
		if child == self or child == _capture_button:
			continue
		if child is CanvasItem:
			(child as CanvasItem).visible = not _on

	var player := get_tree().get_first_node_in_group("player")
	if player != null and "frozen" in player:
		player.frozen = _on

	Toast.show(self, "사진 모드 — 화면을 끌어 구도를 잡는다" if _on else "사진 모드 해제", 2.0)


func _on_capture_pressed() -> void:
	## get_image()는 화면을 실제로 그리는 렌더러가 없으면(헤드리스 null
	## 드라이버 등, ASSET_GUIDE.md "MultiMesh 인스턴스별 transform" 항목과
	## 같은 종류의 엔진 한계) null을 줄 수 있다 — 그대로 부르면 크래시라
	## 방어한다.
	var img: Image = get_viewport().get_texture().get_image() if get_viewport().get_texture() != null else null
	if img == null:
		Toast.show(self, "사진 저장 실패 — 화면을 읽을 수 없다.", 2.5)
		return
	## 사진 도감(world/photo_album.gd) — 화면 안 적·신수·인물을 담아 점수·보상.
	get_tree().call_group("go_album", "shoot", img)
	var dir_path := "user://photos"
	DirAccess.make_dir_recursive_absolute(dir_path)
	var fname := "%s/photo_%d.png" % [dir_path, Time.get_unix_time_from_system()]
	var err := img.save_png(fname)
	Toast.show(self, "사진 저장됨: %s" % fname if err == OK else "사진 저장 실패(%d)" % err, 2.5)
