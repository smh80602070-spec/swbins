extends Node

## saga-godot 2026-09-29 — 사가블로 오른쪽 기술 단추 줄. DungeonHUD.tscn 은 단추 80여 개를 오른쪽 아래에서 80px 간격으로 세로로 쌓아 두고
## 직업·해금에 따라 보이는 것만 켠다 — 스무 개 가까이 켜지면 세로 1900px 쯤이라 가로 화면(기준 높이 1280)에서 위가 잘렸다.
## 보이는 단추를 아래부터 원래 순서대로 다시 쌓되, 화면 위 여백(TOP_MARGIN)을 넘으면 왼쪽 옆 새 줄로 넘긴다. 세로 화면(1920)에선 한 줄에 다 들어가 그대로다.
## 배우지 않은 무예(rank 0) 단추는 숨긴다 — 단추 이름 "XxxYyyButton" ↔ 무예 노드 그룹 "skill_xxx_yyy"(무예 스크립트의 SKILL_KEY)로 이어 본다.
##   이어지지 않는 단추(공격·소켓·상인·대장간·하드코어·무예 창)는 늘 보인다.
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
		var learned := _learned(b)
		if b.visible != learned:
			b.visible = learned
		if learned:
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


## 이 단추의 무예를 배웠는가 — 이어지는 무예 노드가 없으면 true(늘 보이는 단추).
func _learned(b: Button) -> bool:
	var nm := String(b.name)
	if not nm.ends_with("Button") or nm == "AttackButton":
		return true
	var group := "skill_" + nm.trim_suffix("Button").to_snake_case().replace("_2","2").replace("_3","3").replace("_4","4").replace("_5","5").replace("_6","6") # 숫자 앞엔 밑줄이 없다(skill_bolt_archer2)
	var found := get_tree().get_nodes_in_group(group)
	if found.is_empty():
		return true
	var scr := (found[0] as Node).get_script() as GDScript
	if scr == null:
		return true
	var consts := scr.get_script_constant_map()
	if not consts.has("SKILL_KEY"):
		return true
	return DungeonSkillState.rank_of(String(consts["SKILL_KEY"])) > 0
