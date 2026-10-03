extends CanvasLayer

## PLAN 106장 ⑩ — 원신식 인물 화면(C · 가방 B · 왼쪽 위 "인물" 단추). test_village.gd 가 붙인다(GO 만).
##   왼쪽: 인물 목록(나 + 등용한 동료 전원) · 가운데: 레벨/상한·경험 막대·돌파 단계·체력/공격/방어,
##   견문록 쓰기(한 레벨 올리기 · 권마다) · 돌파(상한에 닿고 재료가 있으면) · 오른쪽: 가방.
##   106장 ⑫: 가운데 아래 특성 셋(기본 공격·원소 스킬·원소 폭발, 줄마다 "올리기") · 운명의 자리(여섯 효과·"열기").
##   106장 ⑯: 돌파 밑에 무기(이름·종류·Lv·공격력·부옵션·효과·재련) — "강화"·"무기 돌파"·"무기 바꾸기"(같은 종류 차례로).
##   106장 ⑰: 무기 밑에 성유물 다섯 부위(세트·★·+Lv·주/부옵션) — 부위마다 "바꾸기"(차례로, 끝은 빼기)·"강화"(연마석 +1),
##   켜진 세트 효과 한 줄, "안 낀 ★4 분해".
## 열려 있는 동안 그룹 ui_modal(마우스 시점이 커서를 풀어 줌) + 플레이어 frozen.

const Growth := preload("res://games/saga_go/data/growth.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const Story := preload("res://games/saga_go/data/story.gd")
const Weapons := preload("res://games/saga_go/data/weapons.gd")
const Artifacts := preload("res://games/saga_go/data/artifacts.gd")
const ItemIcons := preload("res://games/saga_go/data/item_icons.gd")
const Kits := preload("res://games/saga_go/data/kits.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

var is_open := false
var selected := "self"

var _player: Node = null
var _root: Control = null
var _list: VBoxContainer = null
var _title: Label = null
var _level: Label = null
var _exp_bar: ProgressBar = null
var _stats: Label = null
var _asc_label: Label = null
var _asc_button: Button = null
var _book_buttons: Dictionary = {}
var _once_button: Button = null
var _bag_label: Label = null
var _talent_title: Label = null
var _weapon_label: Label = null
var _weapon_icon: TextureRect = null # G-0016 K-0035 아이콘 — 그림이 없으면 숨김, 글자만
var _art_icons: Dictionary = {}
var _weapon_level_btn: Button = null
var _weapon_asc_btn: Button = null
var _weapon_swap_btn: Button = null
var _art_title: Label = null
var _art_labels: Dictionary = {}
var _art_swap: Dictionary = {}
var _art_up: Dictionary = {}
var _salvage_btn: Button = null
var _talent_buttons: Dictionary = {}
var _con_label: Label = null
var _con_button: Button = null
var _party_btn: Button = null # 106장 ㉛·㉝ 편성 넣기·빼기
var _party_up_btn: Button = null # 106장 ㉝ 명단 앞 자리로
var _party_label: Label = null # 106장 ㉝ 지금 들판 명단 한 줄
var _preset_btns: Array = [] # 106장 ㊱ 편성 1~4 단추
var _frozen_before := false

func _ready() -> void:
	layer = 6
	add_to_group("go_character_screen")
	for pair in [["go_character", KEY_C], ["go_bag", KEY_B]]:
		if not InputMap.has_action(pair[0]):
			InputMap.add_action(pair[0])
			var ev := InputEventKey.new()
			ev.physical_keycode = pair[1]
			InputMap.action_add_event(pair[0], ev)
	_build()
	_wrap_row_buttons(_root)
	var open_btn := Button.new()
	open_btn.text = "인물 (C)"
	open_btn.position = Vector2(222, 20)
	open_btn.size = Vector2(96, 40)
	open_btn.pressed.connect(open_screen)
	add_child(open_btn)
	PartyState.bag_changed.connect(_refresh)
	PartyState.growth_changed.connect(func(_id: String) -> void: _refresh())
	PartyState.weapon_changed.connect(_refresh)
	PartyState.artifact_changed.connect(_refresh)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("go_character") or event.is_action_pressed("go_bag"):
		if is_open:
			close_screen()
		else:
			open_screen()
		get_viewport().set_input_as_handled()
	elif is_open and event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE:
		close_screen()
		get_viewport().set_input_as_handled()

## 나 + 등용한 동료 전원(겹치는 id 는 한 번).
func owned() -> Array[String]:
	var out: Array[String] = ["self"]
	for id in PartyState.members:
		if not out.has(id):
			out.append(id)
	return out

func _name(id: String) -> String:
	if id == "self":
		return "나"
	var h: Variant = _hero_of(id)
	return h.name if h != null else id

func _rarity(id: String) -> int:
	if id == "self":
		return 5
	var h: Variant = _hero_of(id)
	return int(h.get("rarity", 2)) if h != null else 2

## 도감 인물, 아니면 이야기 동료(106장 ㉛ data/story.gd MEMBERS).
func _hero_of(id: String) -> Variant:
	var h: Variant = Characters.find(id)
	return h if h != null else Story.member(id)

# ---------------------------------------------------------------- 짓기

func _build() -> void:
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.visible = false
	add_child(_root)
	var dim := ColorRect.new()
	dim.color = Color(0.05, 0.06, 0.1, 0.82)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.add_child(dim)

	var cols := HBoxContainer.new()
	cols.set_anchors_preset(Control.PRESET_FULL_RECT)
	cols.offset_left = 30
	cols.offset_right = -30
	cols.offset_top = 70
	cols.offset_bottom = -30
	cols.add_theme_constant_override("separation", 24)
	_root.add_child(cols)

	var left := ScrollContainer.new()
	left.custom_minimum_size = Vector2(220, 0)
	cols.add_child(left)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left.add_child(_list)

	var mid_scroll := ScrollContainer.new()
	mid_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mid_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	cols.add_child(mid_scroll)
	var mid := VBoxContainer.new()
	mid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mid.add_theme_constant_override("separation", 10)
	mid_scroll.add_child(mid)
	_title = _label(mid, 28)
	_level = _label(mid, 20)
	_exp_bar = ProgressBar.new()
	_exp_bar.custom_minimum_size = Vector2(0, 14)
	_exp_bar.show_percentage = false
	mid.add_child(_exp_bar)
	_asc_label = _label(mid, 16)
	var srow := HBoxContainer.new()
	srow.add_theme_constant_override("separation", 6)
	mid.add_child(srow)
	for k in PartyState.PRESET_COUNT:
		var sb := Button.new()
		sb.custom_minimum_size = Vector2(0, 36)
		sb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var kk: int = k
		sb.pressed.connect(func() -> void: use_preset(kk))
		srow.add_child(sb)
		_preset_btns.append(sb)
	_party_label = _label(mid, 16)
	var prow := HBoxContainer.new()
	prow.add_theme_constant_override("separation", 8)
	mid.add_child(prow)
	_party_btn = Button.new()
	_party_btn.custom_minimum_size = Vector2(0, 40)
	_party_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_party_btn.pressed.connect(toggle_party)
	prow.add_child(_party_btn)
	_party_up_btn = Button.new()
	_party_up_btn.text = "◀ 앞 자리로"
	_party_up_btn.custom_minimum_size = Vector2(0, 40)
	_party_up_btn.pressed.connect(func() -> void:
		if not _combat_blocked() and PartyState.move_up_in_party(selected):
			CombatFeel.ui()
			_refresh())
	prow.add_child(_party_up_btn)
	_stats = _label(mid, 18)
	var books := HBoxContainer.new()
	books.add_theme_constant_override("separation", 8)
	mid.add_child(books)
	_once_button = Button.new()
	_once_button.text = "한 레벨 올리기"
	_once_button.custom_minimum_size = Vector2(0, 44)
	_once_button.pressed.connect(func() -> void: PartyState.level_up_once(selected))
	books.add_child(_once_button)
	for book in Growth.BOOKS:
		var b := Button.new()
		b.custom_minimum_size = Vector2(0, 44)
		var bk: String = book
		b.pressed.connect(func() -> void: PartyState.use_book(selected, bk, 1))
		books.add_child(b)
		_book_buttons[book] = b
	_asc_button = Button.new()
	_asc_button.text = "돌파"
	_asc_button.custom_minimum_size = Vector2(0, 48)
	_asc_button.pressed.connect(func() -> void: PartyState.ascend(selected))
	mid.add_child(_asc_button)

	var wl_row := HBoxContainer.new()
	wl_row.add_theme_constant_override("separation", 10)
	mid.add_child(wl_row)
	_weapon_icon = ItemIcons.blank_rect(64)
	wl_row.add_child(_weapon_icon)
	_weapon_label = _label(wl_row, 16)
	_weapon_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var wrow := HBoxContainer.new()
	wrow.add_theme_constant_override("separation", 8)
	mid.add_child(wrow)
	_weapon_level_btn = Button.new()
	_weapon_level_btn.custom_minimum_size = Vector2(0, 40)
	_weapon_level_btn.pressed.connect(func() -> void: PartyState.weapon_level_once(PartyState.weapon_of(selected)))
	wrow.add_child(_weapon_level_btn)
	_weapon_asc_btn = Button.new()
	_weapon_asc_btn.custom_minimum_size = Vector2(0, 40)
	_weapon_asc_btn.pressed.connect(func() -> void: PartyState.weapon_ascend(PartyState.weapon_of(selected)))
	wrow.add_child(_weapon_asc_btn)
	_weapon_swap_btn = Button.new()
	_weapon_swap_btn.custom_minimum_size = Vector2(0, 40)
	_weapon_swap_btn.pressed.connect(swap_weapon)
	wrow.add_child(_weapon_swap_btn)

	_art_title = _label(mid, 18)
	for slot in Artifacts.SLOTS:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		mid.add_child(row)
		var l := Label.new()
		l.add_theme_font_size_override("font_size", 14)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var ic := ItemIcons.blank_rect(40)
		row.add_child(ic)
		row.add_child(l)
		var s: String = slot
		var sw := Button.new()
		sw.text = "바꾸기"
		sw.custom_minimum_size = Vector2(80, 36)
		sw.pressed.connect(func() -> void: swap_artifact(s))
		row.add_child(sw)
		var up := Button.new()
		up.text = "강화"
		up.custom_minimum_size = Vector2(64, 36)
		up.pressed.connect(func() -> void: PartyState.artifact_level_once(PartyState.artifact_of(selected, s)))
		row.add_child(up)
		_art_labels[slot] = l
		_art_icons[slot] = ic
		_art_swap[slot] = sw
		_art_up[slot] = up
	_salvage_btn = Button.new()
	_salvage_btn.custom_minimum_size = Vector2(0, 36)
	_salvage_btn.pressed.connect(func() -> void: PartyState.salvage_unused(4))
	mid.add_child(_salvage_btn)

	_talent_title = _label(mid, 20)
	for kind in Growth.TALENTS:
		var tb := Button.new()
		tb.custom_minimum_size = Vector2(0, 40)
		tb.alignment = HORIZONTAL_ALIGNMENT_LEFT
		var k: String = kind
		tb.pressed.connect(func() -> void: PartyState.talent_up(selected, k))
		mid.add_child(tb)
		_talent_buttons[kind] = tb
	_con_label = _label(mid, 16)
	_con_button = Button.new()
	_con_button.custom_minimum_size = Vector2(0, 44)
	_con_button.pressed.connect(func() -> void: PartyState.unlock_constellation(selected))
	mid.add_child(_con_button)

	var right := VBoxContainer.new()
	right.custom_minimum_size = Vector2(240, 0)
	cols.add_child(right)
	var bag_title := _label(right, 22)
	bag_title.text = "가방"
	_bag_label = _label(right, 16)

	var close := Button.new()
	close.text = "닫기"
	close.position = Vector2(30, 18)
	close.size = Vector2(90, 42)
	close.pressed.connect(close_screen)
	_root.add_child(close)

## 2026-09-26 창 모드 촬영 — 가로줄의 긴 단추 글자(무기 돌파 재료 목록·편성 인원)가 줄을 화면보다 넓혀 오른쪽이 잘렸다.
## 가로줄 안 단추는 글자를 줄바꿈하고 줄 폭을 나눠 갖는다(단추 높이만 늘어난다).
func _wrap_row_buttons(root: Node) -> void:
	for c in root.find_children("*", "Button", true, false):
		var b := c as Button
		if b.get_parent() is HBoxContainer:
			b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			b.size_flags_horizontal = Control.SIZE_EXPAND_FILL

func _label(parent: Control, size_px: int) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", size_px)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	parent.add_child(l)
	return l

# ---------------------------------------------------------------- 보여 주기

func _refresh() -> void:
	if _root == null or not is_open:
		return
	for c in _list.get_children():
		c.queue_free()
	for id in owned():
		var b := Button.new()
		var el := Elements.element_of(id)
		b.text = "%s%s  Lv.%d  [%s]" % ["⚔ " if PartyState.in_party(id) else ("🧭 " if PartyState.is_away(id) else ""), _name(id), PartyState.char_level(id), Elements.name_of(el)]
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.custom_minimum_size = Vector2(0, 40)
		b.modulate = Elements.color_of(el).lightened(0.45) if id != selected else Color.WHITE
		var pick: String = id
		b.pressed.connect(func() -> void: select(pick))
		_list.add_child(b)

	var id := selected
	var g := PartyState.growth_of(id)
	var lv := int(g.lv)
	var asc := int(g.asc)
	var cap := Growth.cap_of(asc)
	var el := Elements.element_of(id)
	_title.text = "%s  %s  [%s]" % [_name(id), "★".repeat(_rarity(id)), Elements.name_of(el)]
	_title.add_theme_color_override("font_color", Elements.color_of(el).lightened(0.3))
	_level.text = "Lv. %d / %d" % [lv, cap]
	_exp_bar.max_value = Growth.exp_to_next(lv)
	_exp_bar.value = float(g.exp) if lv < cap else _exp_bar.max_value
	_asc_label.text = "돌파 %s" % ("◆".repeat(asc) + "◇".repeat(Growth.MAX_ASC - asc))
	var in_p := PartyState.in_party(id)
	var pl := PartyState.party()
	var slots: Array[String] = ["1 나"]
	for i in pl.size():
		slots.append("%d %s" % [i + 2, _name(pl[i])])
	for i in range(pl.size(), PartyState.PARTY_MAX):
		slots.append("%d (빈자리)" % (i + 2))
	_party_label.text = "들판 명단: " + " · ".join(slots)
	for k in _preset_btns.size():
		var n := PartyState.preset_party(k).size()
		var sb: Button = _preset_btns[k]
		sb.text = ("▶ 편성 %d" if k == PartyState.preset_i else "편성 %d") % (k + 1) + " (%d명)" % (n + 1)
		sb.disabled = k == PartyState.preset_i
	if id == "self":
		_party_btn.text = "⚔ 나는 늘 첫 자리"
	elif in_p:
		_party_btn.text = "⚔ 들판 명단에서 빼기"
	elif PartyState.is_away(id):
		_party_btn.text = "🧭 탐사 중 — 역참 곁 탐사 게시판에서 부르기"
	elif pl.size() >= PartyState.PARTY_MAX:
		_party_btn.text = "⚔ 들판 명단에 넣기 (%s 와 바뀐다)" % _name(pl[pl.size() - 1])
	else:
		_party_btn.text = "⚔ 들판 명단에 넣기"
	_party_btn.disabled = id == "self" or PartyState.is_away(id)
	_party_up_btn.disabled = not in_p or id == "self" or pl.find(id) <= 0
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	var hp: float = fc.call("max_hp_of", id) if fc else 0.0
	var atk: float = fc.call("char_atk", id) if fc else PartyState.char_atk(id)
	_stats.text = "체력 %d   공격 %d   방어 %d" % [int(hp), int(atk), int(PartyState.char_def(id))]

	var at_cap := lv >= cap
	_once_button.disabled = at_cap
	for book in Growth.BOOKS:
		var b: Button = _book_buttons[book]
		var gain: int = Growth.ITEMS[book].exp
		b.text = "%s ×%d (%d냥)" % [Growth.item_name(book), PartyState.count(book), int(ceil(gain * Growth.MORA_PER_EXP))]
		b.disabled = at_cap or PartyState.count(book) <= 0
	var cost := Growth.ascend_cost(id, asc)
	if cost.is_empty():
		_asc_button.text = "돌파 끝"
		_asc_button.disabled = true
	else:
		var parts: Array[String] = []
		for item in cost:
			parts.append("%s %d/%d" % [Growth.item_name(item), PartyState.count(item), int(cost[item])])
		_asc_button.text = ("돌파 → Lv.%d 까지  |  " % Growth.cap_of(asc + 1)) + " · ".join(parts)
		_asc_button.disabled = not PartyState.can_ascend(id)
		if not at_cap:
			_asc_button.text += "  (Lv.%d 에 닿아야)" % cap

	_refresh_weapon(id)
	_refresh_artifacts(id)

	var t_cap := PartyState.talent_cap(id)
	_talent_title.text = "특성  (상한 Lv.%d%s)" % [t_cap, "" if t_cap >= Growth.TALENT_MAX else " — 돌파하면 늘어난다"]
	for kind in Growth.TALENTS:
		var tb: Button = _talent_buttons[kind]
		var t_lv := PartyState.talent_level(id, kind)
		var bonus := PartyState.talent_effective(id, kind) - t_lv
		## 106장 ㉔ — 스킬·폭발은 그 인물 고유 이름(없으면 원소 기본 이름), 설명은 마우스를 올리면.
		var t_name: String = Growth.TALENT_NAMES[kind]
		if kind != "normal":
			var which := "skill" if kind == "skill" else "burst"
			t_name += " 「%s」" % Kits.name_of(id, which, Elements.element_of(id))
			var fam := Kits.family_label(id)
			tb.tooltip_text = ("[%s] " % fam if fam != "" else "") + Kits.text_of(id, which)
		var head := "%s  Lv.%d%s  ×%.2f" % [t_name, t_lv, " (+%d)" % bonus if bonus > 0 else "", PartyState.talent_mul(id, kind)]
		var t_cost := Growth.talent_cost(id, t_lv)
		if t_cost.is_empty():
			tb.text = head + "  |  끝"
			tb.disabled = true
			continue
		var t_parts: Array[String] = []
		for item in t_cost:
			t_parts.append("%s %d/%d" % [Growth.item_name(item), PartyState.count(item), int(t_cost[item])])
		tb.text = head + "  |  올리기: " + " · ".join(t_parts)
		if t_lv >= t_cap:
			tb.text += "  (돌파 먼저)"
		tb.disabled = not PartyState.can_talent_up(id, kind)
	var con := PartyState.constellation(id)
	var con_lines: Array[String] = ["운명의 자리  %s" % ("●".repeat(con) + "○".repeat(Growth.CONSTELLATION_MAX - con))]
	for i in Growth.CONSTELLATION_MAX:
		con_lines.append("%s %d. %s" % ["◆" if i < con else "◇", i + 1, Growth.CONSTELLATION_TEXT[i]])
	_con_label.text = "\n".join(con_lines)
	if con >= Growth.CONSTELLATION_MAX:
		_con_button.text = "운명의 자리 다 열었다"
		_con_button.disabled = true
	else:
		_con_button.text = "%d번째 자리 열기  |  %s %d/%d" % [con + 1, Growth.item_name("fate_knot"), PartyState.count("fate_knot"), int(Growth.CONSTELLATION_COST.fate_knot)]
		_con_button.disabled = not PartyState.can_unlock_constellation(id)

	var lines: Array[String] = []
	for item in Growth.ITEMS:
		var n := PartyState.count(item)
		if n > 0 or item == "mora":
			lines.append("%s  %d" % [Growth.item_name(item), n])
	_bag_label.text = "\n".join(lines)

func _refresh_weapon(id: String) -> void:
	var wid := PartyState.weapon_of(id)
	ItemIcons.apply(_weapon_icon, "weapon", wid)
	var w: Dictionary = Weapons.info(wid)
	var ws := PartyState.weapon_state(wid)
	var cap := PartyState.weapon_cap(wid)
	var lines: Array[String] = ["무기  %s  %s  [%s]  Lv.%d/%d  재련 %d" % [w.name, "★".repeat(int(w.rarity)), Weapons.TYPE_NAMES[w.type], int(ws.lv), cap, int(ws.ref)]]
	var parts: Array[String] = ["공격력 %d" % int(PartyState.weapon_atk(id))]
	if w.has("sub"):
		parts.append("%s +%.1f%%" % [Weapons.STAT_NAMES[w.sub], Weapons.sub_at(wid, int(ws.lv)) * 100.0])
	if w.has("passive"):
		parts.append("%s +%d%%" % [Weapons.PASSIVE_NAMES[w.passive], int(round(Weapons.passive_at(wid, int(ws.ref)) * 100.0))])
	lines.append("   ".join(parts))
	lines.append("치명타 확률 %.1f%%  ·  치명타 피해 %.1f%%" % [PartyState.crit_rate(id) * 100.0, PartyState.crit_dmg(id) * 100.0])
	_weapon_label.text = "\n".join(lines)
	var ores: Array[String] = []
	for ore in Weapons.ORES:
		ores.append("%s %d" % [Growth.item_name(ore), PartyState.count(ore)])
	_weapon_level_btn.text = "강화 (%s)" % " · ".join(ores)
	_weapon_level_btn.disabled = int(ws.lv) >= cap
	var cost := Weapons.ascend_cost(wid, int(ws.asc))
	if cost.is_empty():
		_weapon_asc_btn.text = "무기 돌파 끝"
		_weapon_asc_btn.disabled = true
	else:
		var cp: Array[String] = []
		for item in cost:
			cp.append("%s %d/%d" % [Growth.item_name(item), PartyState.count(item), int(cost[item])])
		_weapon_asc_btn.text = "무기 돌파  |  " + " · ".join(cp)
		_weapon_asc_btn.disabled = not PartyState.can_weapon_ascend(wid)
	var choices := PartyState.weapons_for(id)
	_weapon_swap_btn.text = "무기 바꾸기 (%d)" % choices.size()
	_weapon_swap_btn.disabled = choices.size() <= 1

func _refresh_artifacts(id: String) -> void:
	var counts := PartyState.set_counts(id)
	var on: Array[String] = []
	for set_id in counts:
		var n := int(counts[set_id])
		var sd: Dictionary = Artifacts.SETS[set_id]
		if n >= 2:
			on.append("%s 2: %s" % [sd.name, sd.text2])
		if n >= 4:
			on.append("%s 4: %s" % [sd.name, sd.text4])
	_art_title.text = "성유물  (연마석 %d · 가진 것 %d)%s" % [PartyState.count("polish"), PartyState.artifacts.size(),
		("\n" + "\n".join(on)) if not on.is_empty() else ""]
	for slot in Artifacts.SLOTS:
		var l: Label = _art_labels[slot]
		var uid := PartyState.artifact_of(id, slot)
		ItemIcons.apply(_art_icons[slot], "artifact_set", String(PartyState.artifacts[uid].set) if uid != "" else "")
		var choices := PartyState.artifacts_for_slot(slot)
		(_art_swap[slot] as Button).disabled = choices.is_empty()
		if uid == "":
			l.text = "%s — 비었음 (%d개 있음)" % [Artifacts.SLOT_NAMES[slot], choices.size()]
			(_art_up[slot] as Button).disabled = true
			continue
		var a: Dictionary = PartyState.artifacts[uid]
		var subs: Array[String] = []
		for s in a.subs:
			subs.append(Artifacts.stat_text(s[0], float(s[1])))
		l.text = "%s  %s %s +%d  |  %s  |  %s" % [Artifacts.SLOT_NAMES[slot], Artifacts.SETS[a.set].name, "★".repeat(int(a.rarity)), int(a.lv),
			Artifacts.stat_text(a.main, Artifacts.main_value(a)), " · ".join(subs)]
		(_art_up[slot] as Button).disabled = int(a.lv) >= int(Artifacts.MAX_LV[int(a.rarity)]) or PartyState.count("polish") <= 0
	var spare := 0
	for k in PartyState.artifacts:
		var a2: Dictionary = PartyState.artifacts[k]
		if a2.owner == "" and int(a2.rarity) <= 4 and int(a2.lv) == 0:
			spare += 1
	_salvage_btn.text = "안 낀 ★4(+0) 분해 — %d개" % spare
	_salvage_btn.disabled = spare == 0

## 그 부위 성유물을 차례로 낀다 — 끝까지 가면 뺀다.
func swap_artifact(slot: String) -> void:
	var choices := PartyState.artifacts_for_slot(slot)
	if choices.is_empty():
		return
	var cur := PartyState.artifact_of(selected, slot)
	var i := choices.find(cur)
	if i == choices.size() - 1:
		PartyState.unequip_artifact(selected, slot)
	else:
		PartyState.equip_artifact(selected, choices[i + 1])

## 같은 종류 가진 무기를 차례로 쥐여 준다.
func swap_weapon() -> void:
	var choices := PartyState.weapons_for(selected)
	if choices.size() <= 1:
		return
	var i := choices.find(PartyState.weapon_of(selected))
	PartyState.equip_weapon(selected, choices[(i + 1) % choices.size()])

## 고른 인물을 들판 명단에 넣거나 뺀다(PartyState.put_in_party·remove_from_party).
func toggle_party() -> void:
	if _combat_blocked():
		return
	var done: bool = PartyState.remove_from_party(selected) if PartyState.in_party(selected) else PartyState.put_in_party(selected)
	if done:
		CombatFeel.ui()
		_refresh()

func put_in_party() -> void:
	if not _combat_blocked() and PartyState.put_in_party(selected):
		CombatFeel.ui()
		_refresh()

## 106장 ㊱ 편성 칸 k 로 — 싸우는 중이면 막는다. 지금 인물은 첫 자리(나)로 돌아간다. 바꿨으면 true.
func use_preset(k: int) -> bool:
	if _combat_blocked() or not PartyState.use_preset(k):
		return false
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	if fc:
		fc.set("active", 0)
	CombatFeel.ui()
	Toast.show(self, "편성 %d — %s" % [k + 1, " · ".join(["나"] + PartyState.party().map(func(id: String) -> String: return _name(id)))], 2.0)
	_refresh()
	return true

## 싸우는 중이면(field_combat.in_combat) 알리고 true — 원신처럼 편성을 못 바꾼다.
func _combat_blocked() -> bool:
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	if fc and fc.call("in_combat"):
		Toast.show(self, "싸우는 중에는 편성을 바꿀 수 없다", 2.0)
		return true
	return false

func select(id: String) -> void:
	selected = id
	_refresh()

func open_screen() -> void:
	if is_open:
		return
	if get_tree().get_nodes_in_group("duel_active").size() > 0:
		return
	for g in ["go_world_map", "go_cooking_screen"]:
		var other := get_tree().get_first_node_in_group(g)
		if other and other.get("is_open"):
			return
	_player = get_tree().get_first_node_in_group("player")
	is_open = true
	_root.visible = true
	add_to_group("ui_modal")
	if _player:
		_frozen_before = bool(_player.get("frozen"))
		_player.set("frozen", true)
	if not owned().has(selected):
		selected = "self"
	_refresh()

func close_screen() -> void:
	if not is_open:
		return
	is_open = false
	_root.visible = false
	remove_from_group("ui_modal")
	if _player:
		_player.set("frozen", _frozen_before)
