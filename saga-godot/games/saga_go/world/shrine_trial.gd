extends Node3D

## PLAN.md 101-2 GO ④"사당(祠堂) 시련"(표준 A E F) — 웹판 PLAN.md §5-②를
## 이 판 경제·구조에 맞춰 옮긴다. 판정 층은 `duel_rules.gd` 그대로
## 재사용한다(`bandit_encounter.gd`와 같은 경계 — 그 파일 헤더의 "화면만
## 다르다"). 파도 전환만 여기서 잇는다(각 파도가 끝나고 남은 시간을
## 다음 파도의 시작 시간으로 그대로 넘겨, `DuelRules`의 내부 시간 소진
## 판정이 "전체 180초" 예산을 자연히 지키게 한다 — 별도 전체 타이머를
## 안 둔다). 클리어하면 웹의 "그 권역 인물 조우"를 `hero_encounter.gd`를
## 새로 인스턴스화해 그 골격 그대로 연다(설득 3라운드는 그 스크립트가
## 스스로 한다, 여기서 복제하지 않는다). 웹의 "인장 조각"(재화)·"사료"
## (실패 비용, 재화)는 이 판에 재화가 없어(`party_state.gd` 헤더) 클리어
## 보상은 경험치로 갈아탔고, 실패 비용은 재입장 10분 자체를 비용으로
## 본다(면제).
##
## `landmarks_builder.gd` `_add_shrine()`가 이 노드를 사당 제단 자리에 심는다.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const DuelHud := preload("res://saga_core/ui/duel_hud.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const HeroEncounter := preload("res://games/saga_go/world/hero_encounter.gd")

const TRIGGER_RADIUS := 6.0
## 웹 §5-② "wolfpack 90 → bandit 120 → scout 170" + 마지막 소보스.
const WAVE_POWERS := [90.0, 120.0, 170.0, 230.0]
const FOE_HP_MUL := 7.0 # bandit_encounter.gd와 같은 값
const TRIAL_TIME_SEC := 180.0
const DAILY_LIMIT := 3
const FAIL_COOLDOWN_SEC := 600.0 # 재입장 10분(웹 수치 그대로)
const CLEAR_EXP := 60.0 # 웹 "공적 60" 상당 — 이 판엔 공적이 없어 경험치로

## 마을 두 곳(현책·해장)·폐허 한 곳(결사)엔 이미 고정 조우가 있다 —
## 사당이 새로 여는 조우는 이 셋과 안 겹쳐야 한다.
const PLACED_HERO_IDS := ["kr_yisunsin", "sg_zhugeliang", "kr_gyebaek"]

enum State { IDLE, PROMPT, FIGHT, COOLDOWN }

var _area: Area3D
var _prompt_layer: CanvasLayer
var _combat_layer: CanvasLayer
var _hp_bar: ProgressBar
var _morale_bar: ProgressBar
var _ki_bar: ProgressBar
var _ult_button: Button
var _wave_label: Label
var _timer_label: Label
var _duel: DuelRules
var _wave_idx := 0
var _state: State = State.IDLE
var _cooldown_left := 0.0
var _uses_today := 0
var _last_reset_day := ""
var _daily_notice_shown := false


func _ready() -> void:
	_spawn_area()
	_build_prompt_ui()
	_build_combat_ui()


func _spawn_area() -> void:
	_area = Area3D.new()
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = TRIGGER_RADIUS
	cs.shape = shape
	_area.add_child(cs)
	add_child(_area)


func _process(delta: float) -> void:
	match _state:
		State.IDLE:
			var in_range := _player_in_range()
			if in_range and _daily_left() > 0:
				_state = State.PROMPT
				_prompt_layer.show()
			elif in_range and not _daily_notice_shown:
				_daily_notice_shown = true
				Toast.show(self, "🛕 사당 시련 — 오늘은 이미 다 썼다(내일 다시).", 3.0)
			elif not in_range:
				_daily_notice_shown = false
		State.FIGHT:
			_duel.step(delta)
			_refresh_combat_ui()
			if _duel.over:
				_on_wave_done()
		State.COOLDOWN:
			_cooldown_left -= delta
			if _cooldown_left <= 0.0:
				_state = State.IDLE


func _player_in_range() -> bool:
	for b in _area.get_overlapping_bodies():
		if b.is_in_group("player"):
			return true
	return false


func _unhandled_input(event: InputEvent) -> void:
	if _state != State.FIGHT:
		return
	if event.is_action_pressed("combat_quick"):
		_do_act("quick")
	elif event.is_action_pressed("combat_ult"):
		_do_act("ult")
	elif event.is_action_pressed("combat_dodge"):
		_do_act("dodge")


func _today_key() -> String:
	var d := Time.get_date_dict_from_system()
	return "%04d-%02d-%02d" % [d.year, d.month, d.day]


## 실시간(벽시계) 날짜 기준 — time_of_day.gd의 밤/낮 판정과 같은 원칙.
func _daily_left() -> int:
	var today := _today_key()
	if today != _last_reset_day:
		_last_reset_day = today
		_uses_today = 0
	return DAILY_LIMIT - _uses_today


## ── 입구 ────────────────────────────────────────────────────────────
func _build_prompt_ui() -> void:
	_prompt_layer = ChoicePrompt.build(self, "🛕 사당 시련\n\"파도 셋과 그 뒤를 지키는 것을 넘으면 인연이 열린다.\"", [
		{"label": "들어간다", "cb": _choose_enter},
		{"label": "물러난다", "cb": _choose_leave},
	])
	_prompt_layer.visible = false


func _choose_enter() -> void:
	_prompt_layer.hide()
	_uses_today += 1
	_wave_idx = 0
	_start_wave(TRIAL_TIME_SEC)


func _choose_leave() -> void:
	_prompt_layer.hide()
	_enter_cooldown(4.0) # 하루 횟수는 안 쓴다, 짧은 재접근 대기만


## ── 전투 화면(bandit_encounter.gd와 같은 조각, DuelHud 공용) ────────
func _build_combat_ui() -> void:
	_combat_layer = CanvasLayer.new()
	_combat_layer.visible = false
	add_child(_combat_layer)

	var box := VBoxContainer.new()
	box.anchor_right = 1.0
	box.offset_left = 40.0
	box.offset_right = -40.0
	box.offset_top = 40.0
	box.offset_bottom = 280.0
	box.add_theme_constant_override("separation", 6)
	_combat_layer.add_child(box)

	var head := HBoxContainer.new()
	box.add_child(head)
	_wave_label = Label.new()
	_wave_label.add_theme_font_size_override("font_size", 24)
	_wave_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(_wave_label)
	_timer_label = Label.new()
	_timer_label.add_theme_font_size_override("font_size", 24)
	head.add_child(_timer_label)

	_hp_bar = DuelHud.add_bar_row(box, "기세")
	_morale_bar = DuelHud.add_bar_row(box, "사기")
	_ki_bar = DuelHud.add_bar_row(box, "기(氣)")

	var pad := HBoxContainer.new()
	pad.add_theme_constant_override("separation", 12)
	box.add_child(pad)
	pad.add_child(DuelHud.make_combat_button("속공\n(J)", func() -> void: _do_act("quick")))
	_ult_button = DuelHud.make_combat_button("필살\n(K)", func() -> void: _do_act("ult"))
	pad.add_child(_ult_button)
	pad.add_child(DuelHud.make_combat_button("회피\n(L)", func() -> void: _do_act("dodge")))
	pad.add_child(DuelHud.make_combat_button("물러난다", func() -> void: _duel.flee()))


func _start_wave(time_left: float) -> void:
	_state = State.FIGHT
	## PLAN 106장 ③ — 결투 중엔 들판 전투(field_combat.gd)가 입력·피해를 안 받는다.
	add_to_group("duel_active")
	var foe_hp := maxf(1.0, roundf(WAVE_POWERS[_wave_idx] * FOE_HP_MUL))
	_duel = DuelRules.create(foe_hp, PartyState.atk, PartyState.def, time_left)
	_combat_layer.show()
	_refresh_combat_ui()


func _do_act(kind: String) -> void:
	if _duel:
		_duel.act(kind)


func _refresh_combat_ui() -> void:
	var is_boss := _wave_idx == WAVE_POWERS.size() - 1
	_wave_label.text = "👹 소보스" if is_boss else "🌊 파도 %d/%d" % [_wave_idx + 1, WAVE_POWERS.size() - 1]
	_hp_bar.value = clampf(_duel.hp / _duel.foe_hp * 100.0, 0.0, 100.0)
	_morale_bar.value = clampf(_duel.morale / _duel.morale_max * 100.0, 0.0, 100.0)
	_ki_bar.value = clampf(_duel.ki / DuelRules.KI_MAX * 100.0, 0.0, 100.0)
	_timer_label.text = str(ceili(maxf(0.0, _duel.left))) + "초"
	_ult_button.disabled = _duel.ki < DuelRules.KI_MAX


func _on_wave_done() -> void:
	if not _duel.cleared:
		_fail_trial()
		return
	var time_left: float = _duel.left
	_wave_idx += 1
	if _wave_idx >= WAVE_POWERS.size():
		_clear_trial()
		return
	_start_wave(time_left) # 다음 파도로 — 웹 onDone 체인과 같은 뜻


func _fail_trial() -> void:
	_combat_layer.hide()
	_duel = null
	Toast.show(self, "🛕 사당 시련 실패 — 물러났다. (재입장 10분)", 4.0)
	_enter_cooldown(FAIL_COOLDOWN_SEC)


func _clear_trial() -> void:
	_combat_layer.hide()
	_duel = null
	PartyState.add_exp(CLEAR_EXP)
	var hero_id := _pick_hero_id()
	if hero_id == "":
		Toast.show(self, "🛕 사당 시련 클리어! (경험치 +%d, 이미 인연이 다 열렸다)" % int(CLEAR_EXP), 4.0)
	else:
		Toast.show(self, "🛕 사당 시련 클리어! (경험치 +%d) — 인연이 열렸다." % int(CLEAR_EXP), 4.0)
		_spawn_hero(hero_id)
	_enter_cooldown(4.0)


func _enter_cooldown(sec: float) -> void:
	_state = State.COOLDOWN
	remove_from_group("duel_active")
	_cooldown_left = sec


## 웹 "genchar ★3~4 또는 HEROES 미보유 중 해시" — rarity 3~4를 먼저
## 찾고, 없으면(다 등용/배치됨) 나머지 미보유 중 아무거나. 이미 배치된
## 고정 조우 셋(위 PLACED_HERO_IDS)과 이미 등용한 인물은 뺀다.
func _pick_hero_id() -> String:
	var candidates: Array = []
	var fallback: Array = []
	for h in Characters.HEROES:
		var id: String = h.id
		if PLACED_HERO_IDS.has(id) or PartyState.members.has(id):
			continue
		fallback.append(id)
		if int(h.rarity) >= 3 and int(h.rarity) <= 4:
			candidates.append(id)
	var pool: Array = candidates if not candidates.is_empty() else fallback
	if pool.is_empty():
		return ""
	return pool[randi() % pool.size()]


## 사당 바로 앞에 그 인물을 세운다(같은 격자 "village"·같은 자리) —
## hero_encounter.gd 골격 그대로, 설득 3라운드는 그 스크립트가 스스로
## 한다(여기서 복제하지 않는다).
func _spawn_hero(hero_id: String) -> void:
	var he := HeroEncounter.new()
	he.hero_id = hero_id
	he.grid = Vector2i(2, 1) # landmarks_builder.gd _add_shrine()과 같은 자리
	he.name = "ShrineHero_" + hero_id
	get_parent().add_child(he)
