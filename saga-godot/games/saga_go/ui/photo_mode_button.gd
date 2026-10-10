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
##
## G-0057 — 공유용으로: 찍는 한 프레임 동안 **모든** CanvasLayer(목표판·미니맵·위쪽 단추·메뉴 등 MobileHUD 밖 층까지)를 숨기고,
## 오른쪽 아래 워터마크("1만리 · 지역 · 날짜", G-0156)만 얹어 찍는다. 저장은 사용자가 찾을 수 있는 곳 — PC 는 OS 사진 폴더/사가만리,
## 폰은 그대로 user://photos(안드로이드 공용 폴더는 권한이 따로 든다). 환경 SAGA_PHOTO_DIR 가 있으면 그쪽(점검·촬영용).

const Toast := preload("res://saga_core/ui/toast.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const WorldMap := preload("res://games/saga_go/ui/world_map.gd")

var _on := false
var _busy := false
var _hud_vis := {}   # G-0067 — 켤 때의 HUD 자식 보임(끌 때 그대로 되돌린다 — 원래 숨은 것은 숨은 채)
var _was_frozen := false
var _mark_layer: CanvasLayer = null
var _mark: Label = null
@onready var _capture_button: Button = $"../CaptureButton"


func _ready() -> void:
	text = "📷"
	pressed.connect(_on_pressed)
	_capture_button.visible = false
	_capture_button.pressed.connect(_on_capture_pressed)
	_build_watermark()


## 저장 폴더 — SAGA_PHOTO_DIR → PC 면 사진 폴더/사가만리 → user://photos.
## 폴더 이름은 옛 판 이름 그대로(G-0156) — 바꾸면 이미 찍은 사진과 새 사진이 두 폴더로 갈라진다(세이브 키와 같은 원칙).
static func photo_dir() -> String:
	var env := OS.get_environment("SAGA_PHOTO_DIR")
	if env != "":
		return env
	if OS.has_feature("pc"):
		var pics := OS.get_system_dir(OS.SYSTEM_DIR_PICTURES)
		if pics != "":
			return pics.path_join("사가만리")
	return "user://photos"


## "1만리 · 청하 마을 · 2026-10-07" — 지역 밖(경계)이면 지역 칸을 뺀다.
static func watermark_text(pos: Vector3) -> String:
	var region := String(WorldMap.REGION_NAMES.get(TestMap.region_at(pos), ""))
	var date := Time.get_date_string_from_system()
	return "1만리 · %s · %s" % [region, date] if region != "" else "1만리 · %s" % date


func _build_watermark() -> void:
	_mark_layer = CanvasLayer.new()
	_mark_layer.name = "PhotoWatermark"
	_mark_layer.layer = 120
	_mark_layer.visible = false
	add_child(_mark_layer)
	_mark = Label.new()
	_mark.anchor_left = 1.0
	_mark.anchor_right = 1.0
	_mark.anchor_top = 1.0
	_mark.anchor_bottom = 1.0
	_mark.offset_left = -900
	_mark.offset_right = -36
	_mark.offset_top = -86
	_mark.offset_bottom = -30
	_mark.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_mark.add_theme_font_size_override("font_size", 30)
	_mark.add_theme_color_override("font_color", Color(1, 1, 1, 0.9))
	_mark.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.7))
	_mark.add_theme_constant_override("outline_size", 8)
	_mark_layer.add_child(_mark)


## 보이는 CanvasLayer 를 다 숨기고 숨긴 것들을 돌려준다(워터마크 층은 뺀다).
func _hide_layers() -> Array:
	var hidden: Array = []
	for n in get_tree().root.find_children("*", "CanvasLayer", true, false):
		var cl := n as CanvasLayer
		if cl != _mark_layer and cl.visible:
			cl.visible = false
			hidden.append(cl)
	return hidden


func _restore_layers(hidden: Array) -> void:
	for cl in hidden:
		if is_instance_valid(cl):
			(cl as CanvasLayer).visible = true


func _on_pressed() -> void:
	_on = not _on
	text = "✕" if _on else "📷"
	_capture_button.visible = _on

	var hud: Node = get_parent()
	if _on:
		_hud_vis.clear()
	for child in hud.get_children():
		if child == self or child == _capture_button:
			continue
		if child is CanvasItem:
			if _on:
				_hud_vis[child] = (child as CanvasItem).visible
				(child as CanvasItem).visible = false
			else:
				(child as CanvasItem).visible = bool(_hud_vis.get(child, true))

	## G-0067 — 끌 때는 켜기 전 멈춤 값으로(대화·창이 멈춰 둔 것을 풀지 않는다).
	var player := get_tree().get_first_node_in_group("player")
	if player != null and "frozen" in player:
		if _on:
			_was_frozen = bool(player.frozen)
			player.frozen = true
		else:
			player.frozen = _was_frozen

	Toast.show(self, "사진 모드 — 화면을 끌어 구도를 잡는다" if _on else "사진 모드 해제", 2.0)


func _on_capture_pressed() -> void:
	if _busy:
		return
	_busy = true
	## G-0057 — HUD 를 다 숨기고 워터마크만 얹은 화면이 실제로 그려진 뒤(frame_post_draw)에 읽는다.
	var player := get_tree().get_first_node_in_group("player") as Node3D
	_mark.text = watermark_text(player.global_position if player != null else Vector3.ZERO)
	var hidden := _hide_layers()
	_mark_layer.visible = true
	await RenderingServer.frame_post_draw
	## G-0067 — 기다리는 동안 장면이 바뀌어 이 노드가 사라졌으면 숨긴 층만 되돌리고 끝.
	if not is_instance_valid(self) or not is_inside_tree():
		_restore_layers(hidden)
		return
	## get_image()는 화면을 실제로 그리는 렌더러가 없으면(헤드리스 null
	## 드라이버 등, ASSET_GUIDE.md "MultiMesh 인스턴스별 transform" 항목과
	## 같은 종류의 엔진 한계) null을 줄 수 있다 — 그대로 부르면 크래시라
	## 방어한다.
	var img: Image = get_viewport().get_texture().get_image() if get_viewport().get_texture() != null else null
	_mark_layer.visible = false
	_restore_layers(hidden)
	_busy = false
	if img == null:
		Toast.show(self, "사진 저장 실패 — 화면을 읽을 수 없다.", 2.5)
		return
	## 사진 도감(world/photo_album.gd) — 화면 안 적·신수·인물을 담아 점수·보상.
	get_tree().call_group("go_album", "shoot", img)
	var dir_path := photo_dir()
	DirAccess.make_dir_recursive_absolute(dir_path)
	var stem := "%s/saga_go_%s" % [dir_path, Time.get_datetime_string_from_system().replace(":", "").replace("-", "").replace("T", "_")]
	var fname := stem + ".png"
	var k := 2
	while FileAccess.file_exists(fname):   # G-0067 — 같은 초에 두 장이면 덮어쓰지 않게
		fname = "%s_%d.png" % [stem, k]
		k += 1
	var err := img.save_png(fname)
	Toast.show(self, "사진 저장됨: %s" % fname if err == OK else "사진 저장 실패(%d)" % err, 2.5)
