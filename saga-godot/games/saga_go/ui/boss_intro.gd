extends CanvasLayer

## G-0338 1만리 보스 등장 컷(원신 주간 보스·엘든 링 보스 이름 — 구조만) — 보스 바(ui/boss_bar.gd)가 새 보스를 처음 고를 때:
##   카메라   camera_rig.talk_shot(보스, 나) 로 보스를 내 어깨 너머로 SHOT_SEC 잡고 end_talk 로 원래 시점(대화 구도 그대로 — 새 카메라 길 없음).
##            대화 중(in_talk)이면 카메라는 안 건드리고 띠만.
##   띠       가운데 큰 이름 + 아랫줄 "원소 · Lv" — 0.3초 나타남 · HOLD_SEC 머묾 · 0.4초 사라짐.
##   틈       패턴 중이 아니면 보스 skill_cd 를 SHOT_SEC + GRACE_SEC 이상으로 — 화면을 뺏긴 사이 첫 패턴에 맞지 않게.
##   한 번    보스 몸(인스턴스)마다 이 씬에서 한 번 — 멀어졌다 다시 와도 또 안 함(_seen). 비경 보스(Lv 없음)도 같다.
##   SAGA_BOSS_INTRO=0 이면 끔(보스 바만, 옛 길).

const Elements := preload("res://games/saga_go/combat/elements.gd")
const Adventure := preload("res://games/saga_go/data/adventure.gd")

const SHOT_SEC := 1.3
const HOLD_SEC := 1.4
const GRACE_SEC := 0.8   # 컷이 끝나고 첫 패턴까지 더 두는 틈
const NAME_FONT := 54
const SUB_FONT := 24

static var _seen := {}   # 보스 인스턴스 id → true
static var played := 0   # 점검용 — 몇 번 틀었나

var _box: VBoxContainer


static func on() -> bool:
	return OS.get_environment("SAGA_BOSS_INTRO") != "0"


## 보스 바가 새 보스를 고를 때 부른다 — 틀었으면 true
static func maybe_play(host: Node, boss: Node3D) -> bool:
	if not on() or boss == null or not is_instance_valid(boss):
		return false
	var key := boss.get_instance_id()
	if _seen.has(key):
		return false
	_seen[key] = true
	played += 1
	if boss.get("skill_cd") != null and String(boss.get("skill")) == "":   # 컷 동안 첫 패턴을 미룬다(화면을 뺏긴 사이 맞지 않게)
		boss.set("skill_cd", maxf(float(boss.get("skill_cd")), SHOT_SEC + GRACE_SEC))
	var n: CanvasLayer = load("res://games/saga_go/ui/boss_intro.gd").new()
	n.name = "BossIntro"
	host.add_child(n)
	n.call("_play", boss)
	return true


static func sub_text(boss: Node3D) -> String:
	var def: Dictionary = boss.get("def") if boss.get("def") is Dictionary else {}
	var p: Array = []
	var el := String(def.get("element", ""))
	if Elements.INFO.has(el):
		p.append("%s 원소" % String(Elements.INFO[el].name))
	var wl := int(boss.get("world_lv")) if boss.get("world_lv") != null else -1
	if wl >= 0:
		p.append("Lv.%d" % Adventure.enemy_level(wl))
	return " · ".join(p)


func _play(boss: Node3D) -> void:
	layer = 6
	var def: Dictionary = boss.get("def") if boss.get("def") is Dictionary else {}
	_box = VBoxContainer.new()
	_box.set_anchors_preset(Control.PRESET_CENTER)
	_box.anchor_top = 0.38
	_box.anchor_bottom = 0.38
	_box.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_box.alignment = BoxContainer.ALIGNMENT_CENTER
	_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_box.modulate.a = 0.0
	add_child(_box)
	var el := String(def.get("element", ""))
	var tint: Color = Elements.INFO[el].color if Elements.INFO.has(el) else Color(1.0, 0.9, 0.7)
	_box.add_child(_label(String(def.get("name", "")), NAME_FONT, Color(1.0, 0.93, 0.78), 6))
	var sub := sub_text(boss)
	if sub != "":
		_box.add_child(_label(sub, SUB_FONT, tint.lerp(Color.WHITE, 0.35), 4))
	var tw := create_tween()
	tw.tween_property(_box, "modulate:a", 1.0, 0.3)
	tw.tween_interval(HOLD_SEC)
	tw.tween_property(_box, "modulate:a", 0.0, 0.4)
	tw.tween_callback(queue_free)
	var rig := get_tree().get_first_node_in_group("camera_rig")
	var pl := get_tree().get_first_node_in_group("player") as Node3D
	if rig != null and pl != null and rig.has_method("talk_shot") and not bool(rig.call("in_talk")):
		rig.call("talk_shot", boss.global_position, pl.global_position)
		var mine: Vector3 = (rig.call("talk_target") as Dictionary).eye
		get_tree().create_timer(SHOT_SEC).timeout.connect(func() -> void:
			## 그 사이 대화가 제 구도로 바꿨으면(눈 자리가 다르면) 대화 몫이라 안 끊는다
			if is_instance_valid(rig) and bool(rig.call("in_talk")) and ((rig.call("talk_target") as Dictionary).eye as Vector3).is_equal_approx(mine):
				rig.call("end_talk"))


func _label(t: String, size: int, col: Color, outline: int) -> Label:
	var l := Label.new()
	l.text = t
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 1))
	l.add_theme_constant_override("outline_size", outline)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l
