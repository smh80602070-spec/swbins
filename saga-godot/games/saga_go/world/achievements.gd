extends Node

## PLAN 106장 ㊸ — 원신식 업적(표는 data/achievements.gd). test_village.gd 가 다른 것을 다 붙인 뒤 붙인다.
##   셈: 신호(적 died·반응 reacted·채집 gathered·요리 cooked·낚시 caught·비경 cleared·급소 weak_hit)는 PartyState.achievements.stats 에 쌓고,
##   나머지는 이미 있는 상태에서 읽는다(Achievements.DERIVED). CHECK_SEC 마다·신호마다 단계를 보고, 새로 닿으면 알림.
##   불러온 직후 첫 확인은 알림 없이 적기만 한다(이미 해 둔 것이 한꺼번에 뜨지 않게).
##   Y(터치 "업적") = 업적 화면 — 갈래 다섯·줄마다 다음 단계 글·진척·"받기", "모두 받기".

signal achieved(id: String, tier: int)
signal changed()

const Achievements := preload("res://games/saga_go/data/achievements.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")
const Story := preload("res://games/saga_go/data/story.gd")
const Adventure := preload("res://games/saga_go/data/adventure.gd")
const Waypoints := preload("res://games/saga_go/world/waypoints.gd")
const StarShards := preload("res://games/saga_go/world/star_shards.gd")
const TreasureSpawner := preload("res://games/saga_go/world/treasure_spawner.gd")
const WorldMap := preload("res://games/saga_go/ui/world_map.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const FieldBoss := preload("res://games/saga_go/combat/field_boss.gd")
const Growth := preload("res://games/saga_go/data/growth.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const CHECK_SEC := 0.5

var is_open := false
var announced := 0 # 점검용 — 알린 단계 수
var _check_t := 0.0
var _silent := true
var _cat := "explore"
var _player: Node3D = null
var _frozen_before := false
var _layer: CanvasLayer
var _panel: PanelContainer
var _title: Label
var _tabs: HBoxContainer
var _list: VBoxContainer
var _claim_all: Button
var _open_btn: Button


func _ready() -> void:
	add_to_group("go_achievements")
	if not InputMap.has_action("go_achievements"):
		InputMap.add_action("go_achievements")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_Y
		InputMap.action_add_event("go_achievements", ev)
	_build_screen()
	get_tree().node_added.connect(_on_node_added)
	_hook.call_deferred()


## 다른 노드 신호에 붙는다(다 지어진 뒤). 적은 지금 있는 것 + 나중에 생기는 것(node_added) 모두.
func _hook() -> void:
	for e in get_tree().get_nodes_in_group("field_enemy"):
		_hook_enemy(e)
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	if fc:
		fc.connect("reacted", _on_reacted)
		var aim: Node = fc.get("aim")
		if aim:
			aim.connect("weak_hit", func() -> void: add_stat("weak_hits"))
	var ga := get_tree().get_first_node_in_group("go_gathering")
	if ga:
		ga.connect("gathered", func(_item: String) -> void: add_stat("gathered"))
	var ki := get_tree().get_first_node_in_group("go_kitchen")
	if ki:
		ki.connect("cooked", _on_cooked)
	var fi := get_tree().get_first_node_in_group("go_fishing")
	if fi:
		fi.connect("caught", func(_f: String) -> void: add_stat("fish"))
	var dm := get_tree().get_first_node_in_group("go_domains")
	if dm:
		dm.connect("state_changed", func(s: String) -> void:
			if s == "cleared":
				add_stat("domains"))
	check()
	_silent = false

func _on_node_added(n: Node) -> void:
	if n is FieldEnemy:
		_hook_enemy(n)

func _hook_enemy(e: Node) -> void:
	if not e.is_connected("died", _on_enemy_died):
		e.connect("died", _on_enemy_died)

func _on_enemy_died(enemy: Node) -> void:
	add_stat("kills", 1, false)
	var def: Variant = enemy.get("def")
	if typeof(def) == TYPE_DICTIONARY and String((def as Dictionary).get("element", "")) != "":
		add_stat("kills_elemental", 1, false)
	if enemy is FieldBoss:
		add_stat("bosses", 1, false)
	check()

func _on_reacted(reaction: String) -> void:
	add_stat("reactions", 1, false)
	add_stat("react_" + reaction)

func _on_cooked(_recipe: String, q: int) -> void:
	add_stat("cooked", 1, false)
	if q >= 2:
		add_stat("delicious", 1, false)
	check()

# ---------------------------------------------------------------- 셈

func _state() -> Dictionary:
	for k in ["stats", "tier", "claimed"]:
		if not PartyState.achievements.has(k):
			PartyState.achievements[k] = {}
	return PartyState.achievements

func add_stat(key: String, n: int = 1, check_now: bool = true) -> void:
	var st: Dictionary = _state().stats
	st[key] = int(st.get(key, 0)) + n
	if check_now:
		check()

func stat(key: String) -> int:
	return int((_state().stats as Dictionary).get(key, 0))

## 업적 셈 값 — DERIVED 는 지금 상태에서, 나머지는 stats 에서.
func value_of(stat_key: String) -> int:
	match stat_key:
		"chests":
			return TreasureSpawner.opened_count()
		"shards":
			return StarShards.collected()
		"waypoints":
			var n := 0
			for id in Waypoints.point_ids():
				if Waypoints.is_active(id):
					n += 1
			return n
		"statue":
			return StarShards.statue_level()
		"regions_full":
			var n := 0
			for rid in WorldMap.REGION_NAMES:
				if WorldMap.exploration(rid) >= 0.999:
					n += 1
			return n
		"chapters":
			return clampi(int(PartyState.story.get("ch", 0)), 0, Story.CHAPTERS.size())
		"world_quests":
			return (PartyState.world_quests.get("done", []) as Array).size()
		"ar":
			return Adventure.ar()
		"fish_kinds":
			return (PartyState.fishing.get("log", {}) as Dictionary).size()
		"reaction_kinds":
			var n := 0
			for r in Elements.REACTION_INFO:
				if stat("react_" + r) > 0:
					n += 1
			return n
	return stat(stat_key)

func progress_of(id: String) -> int:
	return value_of(String(Achievements.info(id).stat))

func tier_of(id: String) -> int:
	return int((_state().tier as Dictionary).get(id, 0))

func claimed_of(id: String) -> int:
	return int((_state().claimed as Dictionary).get(id, 0))

## 모든 업적 단계를 보고, 새로 닿은 단계를 적고 알린다(불러온 직후 첫 번은 알림 없이).
func check() -> void:
	var tiers: Dictionary = _state().tier
	var any := false
	for id in Achievements.ORDER:
		var t := Achievements.tier_for(id, progress_of(id))
		if t > tier_of(id):
			tiers[id] = t
			any = true
			if not _silent:
				announced += 1
				var d := Achievements.info(id)
				Toast.show(self, "🏆 업적 달성 — %s %s  (업적 Y 에서 보상)" % [d.name, _stars(id, t)], 3.0)
				CombatFeel.ui()
				achieved.emit(id, t)
	if any:
		changed.emit()
		if is_open:
			_refresh()

func done_tiers() -> int:
	var n := 0
	for id in Achievements.ORDER:
		n += tier_of(id)
	return n

func claimable() -> int:
	var n := 0
	for id in Achievements.ORDER:
		n += maxi(tier_of(id) - claimed_of(id), 0)
	return n

## 닿았지만 안 받은 단계 보상을 다 받는다 — 받은 것 {칸: 수}.
func claim(id: String) -> Dictionary:
	var got := {}
	var cl: Dictionary = _state().claimed
	for t in range(claimed_of(id) + 1, tier_of(id) + 1):
		var r := Achievements.reward_of(id, t)
		PartyState.add_items(r)
		for k in r:
			got[k] = int(got.get(k, 0)) + int(r[k])
	if not got.is_empty():
		cl[id] = tier_of(id)
		CombatFeel.ui()
		Toast.show(self, "업적 보상 — %s" % _items_text(got), 2.5)
		changed.emit()
		if is_open:
			_refresh()
	return got

func claim_all() -> Dictionary:
	var got := {}
	for id in Achievements.ORDER:
		var r := claim(id)
		for k in r:
			got[k] = int(got.get(k, 0)) + int(r[k])
	return got

func _physics_process(delta: float) -> void:
	_check_t -= delta
	if _check_t <= 0.0:
		_check_t = CHECK_SEC
		check()
	if _open_btn:
		var c := claimable()
		_open_btn.text = "업적 (Y)" + (" ●%d" % c if c > 0 else "")

# ---------------------------------------------------------------- 화면

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("go_achievements"):
		toggle()
		get_viewport().set_input_as_handled()
	elif is_open and event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE:
		close_screen()
		get_viewport().set_input_as_handled()

func toggle() -> void:
	if is_open:
		close_screen()
	else:
		open_screen()

func open_screen() -> bool:
	if is_open:
		return false
	_player = get_tree().get_first_node_in_group("player") as Node3D
	if _player == null or _player.get("frozen"):
		return false
	if get_tree().get_nodes_in_group("duel_active").size() > 0:
		return false
	is_open = true
	_panel.visible = true
	add_to_group("ui_modal")
	_frozen_before = bool(_player.get("frozen"))
	_player.set("frozen", true)
	_refresh()
	return true

func close_screen() -> void:
	if not is_open:
		return
	is_open = false
	_panel.visible = false
	remove_from_group("ui_modal")
	if _player:
		_player.set("frozen", _frozen_before)

func show_category(cat: String) -> void:
	_cat = cat
	_refresh()

func _build_screen() -> void:
	_layer = CanvasLayer.new()
	_layer.layer = 6
	add_child(_layer)
	_open_btn = Button.new()
	_open_btn.text = "업적 (Y)"
	_open_btn.position = Vector2(650, 20)
	_open_btn.custom_minimum_size = Vector2(96, 40)
	_open_btn.pressed.connect(toggle)
	_layer.add_child(_open_btn)
	_panel = PanelContainer.new()
	_panel.anchor_left = 0.5
	_panel.anchor_right = 0.5
	_panel.anchor_top = 0.5
	_panel.anchor_bottom = 0.5
	_panel.offset_left = -340
	_panel.offset_right = 340
	_panel.offset_top = -270
	_panel.offset_bottom = 270
	_panel.visible = false
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.07, 0.09, 0.9)
	sb.set_corner_radius_all(10)
	sb.content_margin_left = 16
	sb.content_margin_right = 16
	sb.content_margin_top = 12
	sb.content_margin_bottom = 12
	_panel.add_theme_stylebox_override("panel", sb)
	_layer.add_child(_panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	_panel.add_child(box)
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 24)
	_title.add_theme_color_override("font_color", Color(1.0, 0.86, 0.5))
	box.add_child(_title)
	_tabs = HBoxContainer.new()
	box.add_child(_tabs)
	for cat in Achievements.CATEGORIES:
		var b := Button.new()
		b.custom_minimum_size = Vector2(118, 36)
		var c: String = cat
		b.pressed.connect(func() -> void: show_category(c))
		_tabs.add_child(b)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(0, 360)
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 6)
	scroll.add_child(_list)
	var foot := HBoxContainer.new()
	box.add_child(foot)
	_claim_all = Button.new()
	_claim_all.text = "모두 받기"
	_claim_all.add_theme_font_size_override("font_size", 22)   # G-0167
	_claim_all.custom_minimum_size = Vector2(160, 40)
	_claim_all.pressed.connect(func() -> void: claim_all())
	foot.add_child(_claim_all)
	var close := Button.new()
	close.text = "닫기 (Y·Esc)"
	close.add_theme_font_size_override("font_size", 22)   # G-0167
	close.custom_minimum_size = Vector2(160, 40)
	close.pressed.connect(close_screen)
	foot.add_child(close)

func _refresh() -> void:
	_title.text = "업적 — %d/%d 단계 · 받을 보상 %d" % [done_tiers(), Achievements.total_tiers(), claimable()]
	for i in Achievements.CATEGORIES.size():
		var cat: String = Achievements.CATEGORIES[i]
		var got := 0
		var all := 0
		for id in Achievements.ORDER:
			if String(Achievements.info(id).cat) == cat:
				got += tier_of(id)
				all += Achievements.tier_count(id)
		var b := _tabs.get_child(i) as Button
		b.text = "%s%s %d/%d" % ["▶ " if cat == _cat else "", Achievements.CATEGORY_NAMES[cat], got, all]
	for c in _list.get_children():
		_list.remove_child(c)
		c.queue_free()
	for id in Achievements.ORDER:
		var d := Achievements.info(id)
		if String(d.cat) != _cat:
			continue
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		var l := Label.new()
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		var t := tier_of(id)
		var n := Achievements.tier_count(id)
		var tiers: Array = d.tiers
		var next_t := mini(t + 1, n)
		var goal := int(tiers[next_t - 1])
		var line2 := "다 이룸" if t >= n else "%s — %d/%d" % [Achievements.desc_of(id, next_t), mini(progress_of(id), goal), goal]
		l.text = "%s %s\n%s" % [d.name, _stars(id, t), line2]
		l.add_theme_font_size_override("font_size", 19)
		if t >= n:
			l.add_theme_color_override("font_color", Color(0.75, 0.95, 0.7))
		row.add_child(l)
		var b := Button.new()
		b.custom_minimum_size = Vector2(150, 40)
		var owed := t - claimed_of(id)
		if owed > 0:
			b.text = "받기 · %s" % _items_text(Achievements.reward_of(id, claimed_of(id) + 1))
			var aid: String = id
			b.pressed.connect(func() -> void: claim(aid))
		else:
			b.text = "받음" if t > 0 else "—"
			b.disabled = true
		row.add_child(b)
		_list.add_child(row)
	_claim_all.disabled = claimable() == 0

## 단계 별 — 닿은 것 ★, 남은 것 ☆.
func _stars(id: String, t: int) -> String:
	return "★".repeat(t) + "☆".repeat(maxi(Achievements.tier_count(id) - t, 0))

func _items_text(items: Dictionary) -> String:
	var out: Array[String] = []
	for k in items:
		var nm := String(Growth.ITEMS.get(k, {}).get("name", k))
		out.append("%s %d" % [nm, int(items[k])])
	return " · ".join(out)

## 점검용 — 지금 갈래 목록 줄 글.
func list_text() -> String:
	var out: Array[String] = []
	for row in _list.get_children():
		out.append(((row as HBoxContainer).get_child(0) as Label).text.replace("\n", " / "))
	return "\n".join(out)
