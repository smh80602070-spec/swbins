extends Node

## saga-godot 2026-09-29 — 사가나락 오른쪽 기술 단추 줄. DungeonHUD.tscn 은 단추 80여 개를 오른쪽 아래에서 80px 간격으로 세로로 쌓아 두고
## 직업·해금에 따라 보이는 것만 켠다 — 스무 개 가까이 켜지면 세로 1900px 쯤이라 가로 화면(기준 높이 1280)에서 위가 잘렸다.
## 보이는 단추를 아래부터 원래 순서대로 다시 쌓되, 화면 위 여백(TOP_MARGIN)을 넘으면 왼쪽 옆 새 줄로 넘긴다. 세로 화면(1920)에선 한 줄에 다 들어가 그대로다.
## G-0198 — 무예 단추 76이 자리 단추 넷(Slot1~4Button)으로 줄어 "배운 무예 단추만 보이기"는 걷어냈다. 보이는 단추만 쌓는다.
## 원래 자리(offset)는 처음 볼 때 메타로 적어 두고 거기서부터 계산한다 — 단추를 다른 코드가 옮기지 않는다(확인함).

const TOP_MARGIN := 215.0 # 우상단 목표판·경고 글자 아래
const BOTTOM_MARGIN := 40.0
const COL_GAP := 20.0
const TICK := 0.3

var _t := 0.0
var _hud: CanvasLayer = null


func _process(delta: float) -> void:
	_t -= delta
	if _t > 0.0:
		return
	_t = TICK
	if _hud == null:
		_hud = get_parent().get_node_or_null("DungeonHUD") as CanvasLayer
		if _hud == null:
			return
	_layout()


func _layout() -> void:
	var btns: Array = []
	for c in _hud.get_children():
		var b := c as Button
		if b == null or b.anchor_left != 1.0 or b.anchor_top != 1.0 or b.anchor_right != 1.0 or b.anchor_bottom != 1.0:
			continue
		if not b.has_meta("orig_rect"):
			b.set_meta("orig_rect", Rect2(b.offset_left, b.offset_top, b.offset_right - b.offset_left, b.offset_bottom - b.offset_top))
		if b.visible:
			btns.append(b)
	btns.sort_custom(func(x: Button, y: Button) -> bool: return (x.get_meta("orig_rect") as Rect2).position.y > (y.get_meta("orig_rect") as Rect2).position.y)
	var avail := _hud.get_viewport().get_visible_rect().size.y - TOP_MARGIN - BOTTOM_MARGIN
	var used := 0.0 # 이 줄에서 아래부터 쌓은 높이
	var col := 0
	for b in btns:
		var r: Rect2 = b.get_meta("orig_rect")
		if used > 0.0 and used + r.size.y > avail:
			col += 1
			used = 0.0
		b.offset_left = r.position.x - col * (r.size.x + COL_GAP)
		b.offset_right = b.offset_left + r.size.x
		b.offset_bottom = -BOTTOM_MARGIN - used
		b.offset_top = b.offset_bottom - r.size.y
		used += r.size.y + 10.0
