extends Node3D

## VERTICAL_SLICE.md Phase 6(61~71단계, Combat) — 29·34·35절의 "도적의 습격"
## 사건 + 실시간 전투를 잇는다. Vertical Slice 승인(PLAN.md 100단계, 2026-09-11
## 실기 확인) 이후 §30 "도적 두목 같은 강화형 사건"을 콘텐츠 확장 1호로 이
## 스크립트를 데이터 구동으로 바꿔 재사용했다 — TestVillage.tscn의
## BanditEncounter(산적)·BanditLeaderEncounter(도적 두목) 둘 다 이 스크립트고,
## @export 값만 다르다.
##
## 승패를 가르는 수식은 `data/duel_rules.gd`(웹판 js/duel.js 그대로)가 맡는다 —
## 여기는 그 상태를 3D 세계에 그려 보여주는 화면 층일 뿐이다(duel.js가
## 판정/화면 두 층으로 나눈 것과 같은 경계).
##
## "값을 치른다"·"달아난다"(사건 선택지)는 골드·소지품 시스템이 아직 Godot
## 쪽에 없어(Phase 9 몫) 대사만 보여주고 넘어간다 — 여기서 새 경제 시스템을
## 만들지 않는다. 내 공격력·방어력은 예전엔 이 파일의 임시 상수였는데,
## VERTICAL_SLICE.md 12단계 루프의 "도적이 부대에 합류한다"를 최소
## 구현하면서 games/saga_go/data/party_state.gd(자동 로드 싱글턴)의
## PartyState.atk/def로 옮겼다 — 도적을 이길 때마다 등용돼 이 값이 오른다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const GLBUtils := preload("res://games/saga_go/world/glb_utils.gd")
const ChoicePrompt := preload("res://games/saga_go/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const DuelHud := preload("res://saga_core/ui/duel_hud.gd")
const CelShaderApply := preload("res://saga_core/shaders/cel_shader_apply.gd")

## 2026-09-11 GLB 교체 — 플레이어(character-a)·주민(b·c)과 다른 글자를 써서
## 산적임을 옷 색만으로도 구별한다(docs/ASSET_GUIDE.md). 실측·스케일 근거는
## Player.tscn과 동일(2.7m 실측 → 1.25배).
const BANDIT_GLB := "res://assets/characters/character-d.glb"
const VroidBody := preload("res://games/saga_go/world/vroid_body.gd")
const CreatureBuilder := preload("res://games/saga_go/world/creature_builder.gd")
## PLAN 106장 ④ — 씬 노드 이름 → 겉모습(씬 파일은 안 고친다).
const LOOK_BY_NODE := {
	"BanditLeaderEncounter": "leader",
	"WolfPackEvent": "wolf",
	"EnemyScoutEvent": "scout",
}
const LOOK_CLOTH := {
	"bandit": Color(0.55, 0.28, 0.25),
	"leader": Color(0.35, 0.18, 0.2),
	"scout": Color(0.45, 0.55, 0.7),
}

## 2026-09-12 — 늑대 무리·정찰병은 사람이 아니다(늑대 무리는 짐승,
## 정찰병은 그냥 사람이지만 character-d를 또 쓰면 "산적이 사실 정찰병?"
## 하는 혼란이 생긴다, simple_event.gd의 부상병과 같은 경계). 어울리는
## GLB가 없으면(짐승 킷을 새로 안 받음) 빈 문자열로 두면 캡슐 fallback을
## 쓴다 — @export로 인스턴스마다 GLB 경로와 캡슐 색을 다르게 잡을 수 있다.
@export var visual_glb_path := BANDIT_GLB

const AMBUSH_RADIUS := 20.0
const RETRY_COOLDOWN_SEC := 8.0
const TOAST_SEC := 4.0

## 2026-09-11② — GO 사건 다양화(VERTICAL_SLICE §30). 예전엔 이 값들이 전부
## const라 "도적의 습격" 사건 하나만 표현할 수 있었다. @export로 바꿔
## 같은 스크립트를 인스턴스마다 다른 값으로 씬에 놓을 수 있게 했다 — 이번에
## 새로 만든 "도적 두목"(TestVillage.tscn의 BanditLeaderEncounter)이 이
## 스크립트를 그대로 재사용한다(§30 "새로 설계하지 않는다"와 같은 원칙).
@export var grid := Vector2i(7, 5) # 2026-09-11㉒ 지도 확장(+2,+2)
@export var foe_name := "산적"
@export var foe_power := 120.0
@export var foe_hp_mul := 7.0           # 웹판 event.js "event.foeHpMul" 기본값
@export var bandit_scale := 0.625  # 105 Q-h 결정(c, 2026-09-19) — 1.7m 표준, 옛 1.25배의 절반
@export var event_title := "🗡️ 도적의 습격"
@export var event_quote := "\"길세를 내고 가라. 아니면 두고 가든지.\""
## PLAN.md 101-2 GO ⑥"75초 토벌" — 이 인스턴스가 "토벌" 대상이면 75.0
## 으로 덮어쓴다(export, 기본값은 duel_rules.gd TIME_SEC 그대로라 기존
## 산적·도적 두목·늑대 무리·정찰병 넷은 하나도 안 바뀐다).
@export var time_sec := DuelRules.TIME_SEC

## 2026-09-21 — PLAN.md 101-2 GO ⑥"부위 파괴"(duel_rules.gd 헤더 참고).
## "토벌" 대상만 켠다(웹의 create({raid:true})와 같은 자리, 기본 false라
## 기존 넷은 안 바뀐다). 웹의 보상 "단사"(재료)는 3D GO 경제에 없어
## 경험치로 대체 — 한 번 스태거마다 stagger_exp_reward만큼 즉시 지급.
@export var is_raid := false
@export var stagger_exp_reward := 10.0

## 물리친 적이 부대에 등용될 때 PartyState에 남기는 id. 아직 인물별
## 개성(saga_core 인물 데이터 연동)은 없다 — 이번 슬라이스는 "합류했다는
## 사실 자체"만 loop에 채운다.
@export var recruit_id := "산적"

## 비어 있지 않으면 승리 시 QuestState.complete(quest_id_to_complete)도
## 같이 부른다(§31 "마을의 부탁" — 도적 두목을 물리치면 사명이 끝난다).
@export var quest_id_to_complete := ""

## 2026-09-12 — 웹판 event.js를 보면 "도적"만 이겼을 때 등용된다(사람이라
## 부대에 합류). 늑대 무리("무리를 흩었다")·정찰병("잡았다")은 승리해도
## 등용 문구가 없다 — 흩거나 붙잡을 뿐, 부대원이 되진 않는다. 이 차이를
## 무시하고 전부 등용시키면 원문을 왜곡하게 되니 꺼 둘 수 있게 뺐다.
@export var grants_recruit := true
## grants_recruit == false일 때만 쓰는 승리 토스트 문구(웹판 각 사건의
## win:true 결과 text 그대로).
@export var victory_text := ""

## 웹판 event.js "bandit_ambush" 승리 시 exp:40과 같은 값. 도적 두목은
## 전투력 차이(약 2배)에 맞춰 TestVillage.tscn에서 더 높게 덮어쓴다.
@export var foe_exp_reward := 40.0

## 2026-09-12 — 웹판 event.js의 `when:'night'` 사건(늑대 무리·정찰병)을
## 이식하려고 추가. 켜져 있으면 낮에는 안 보이고 안 걸린다(TimeOfDay 참고) —
## 새 State를 만들지 않고 IDLE일 때만 확인해서, 전투 중에 자정을 넘겨도
## 싸움이 갑자기 끊기지 않는다.
@export var night_only := false

## 2026-09-12 — 세 선택지의 이름·문구도 @export로 뺐다. "도적의 습격"
## 하나만 있을 땐 하드코딩이어도 됐지만, 늑대 무리(불을 피운다/천천히
## 물러난다)·정찰병(숨는다/보낸다)은 웹판에서 이미 도적과 다른 문구를 쓴다
## (event.js 그대로 — 여기서 새로 짓지 않았다).
@export var choice_fight_label := "맞선다"
@export var choice_pay_label := "값을 치른다"
@export var choice_pay_text := "길세를 치르고 지나갔다."
@export var choice_flee_label := "달아난다"
@export var choice_flee_text := "어둠 속으로 달아났다."

enum State { IDLE, PROMPT, FIGHT, COOLDOWN }

var _state := State.IDLE
var _duel: DuelRules = null
var _pre_stagger_count := 0
var _cooldown_left := 0.0

var _area: Area3D
var _visual: Node3D
## GLB로 바뀐 뒤로는 평소엔 텍스처 그대로 보여준다(material_override를
## 걸지 않는다) — "강타 예고" 순간에만 몸 전체를 물들이고 바로 원래
## 텍스처로 되돌린다. _base_color는 GLB를 못 받아 왔을 때의 캡슐
## 대체용으로만 쓴다.
@export var visual_fallback_color := Color(0.5, 0.14, 0.14)
## _ready()가 _spawn_visual()에서 visual_fallback_color로 채운다 — 필드
## 초기값에서 바로 복사하면 씬이 덮어쓴 @export 값보다 먼저 굳어 버린다
## (Godot가 export 오버라이드를 적용하는 시점은 _init 이후·_ready 이전).
var _base_color := Color(0.5, 0.14, 0.14)
var _using_glb := false

var _prompt_layer: CanvasLayer
var _fight_button: Button
var _combat_layer: CanvasLayer
var _flash_rect: ColorRect
var _hp_bar: ProgressBar
var _morale_bar: ProgressBar
var _ki_bar: ProgressBar
var _timer_label: Label
var _ult_button: Button

func _ready() -> void:
	_spawn_visual()
	_spawn_area()
	_build_prompt_ui()
	_build_combat_ui()
	if night_only:
		_apply_night_visibility(TimeOfDay.is_night())

func _spawn_visual() -> void:
	var ch: String = TestMap.tile_at(grid.x, grid.y)
	var ground: float = TerrainBuilder.LEGEND[ch].height
	position = TestMap.world_pos(grid.x, grid.y) + Vector3(0, ground, 0)

	_base_color = visual_fallback_color
	## PLAN 106장 ④ — 사람은 VRoid 몸(무리마다 옷색 하나), 늑대는 코드로 그린 짐승.
	## Kenney 블록·캡슐은 이제 둘 다 못 쓸 때만의 대비책이다.
	var look: String = LOOK_BY_NODE.get(String(name), "bandit" if visual_glb_path == BANDIT_GLB else "")
	var scene: PackedScene = load(visual_glb_path) if visual_glb_path != "" and look == "" else null
	if look == "wolf":
		_visual = CreatureBuilder.build("wolf", [Color(0.42, 0.4, 0.38), Color(0.62, 0.6, 0.56), Color(0.95, 0.8, 0.25)], {"enemy": true})
		_visual.scale = Vector3.ONE * 0.9
		bandit_scale = 0.9
		_using_glb = true
	elif look != "":
		_visual = VroidBody.build(String(name), 4 if look == "leader" else 2, LOOK_CLOTH[look])
		bandit_scale = _visual.scale.x
		_using_glb = true
	elif scene != null:
		_visual = scene.instantiate()
		_visual.scale = Vector3.ONE * bandit_scale
		_using_glb = true
	else:
		## GLB가 없거나(visual_glb_path 비움) 못 받아 왔으면 캡슐 — 아예 안
		## 보이는 것보단 낫다(hurt_soldier 등 다른 primitive 사건과 같은 경계).
		var mi := MeshInstance3D.new()
		var mesh := CapsuleMesh.new()
		mesh.radius = 0.45
		mesh.height = 1.7
		mi.mesh = mesh
		mi.position = Vector3(0, 0.85, 0)
		var mat := StandardMaterial3D.new()
		mat.albedo_color = _base_color
		mi.material_override = mat
		_visual = mi
	add_child(_visual)
	## PLAN 101-2 GO(2026-09-18, combat_feel.gd 연결) — npc_builder.gd·
	## player.gd와 같은 한 줄. GLB 쪽만 실제로 먹는다(캡슐 fallback은
	## albedo_texture가 없어 CelShaderApply가 조용히 건너뛴다) — 이걸
	## 붙여야 cel_toon 재질이 생기고, 그래야 combat_feel.gd 피격 플래시
	## (hit_flash uniform)가 실제로 걸린다.
	if not _visual.has_meta("cel_applied"):
		CelShaderApply.apply_to(_visual)

func _spawn_area() -> void:
	_area = Area3D.new()
	_area.name = "AmbushArea"
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = AMBUSH_RADIUS
	cs.shape = shape
	_area.add_child(cs)
	add_child(_area)

func _apply_night_visibility(active: bool) -> void:
	_visual.visible = active
	_area.monitoring = active

func _process(delta: float) -> void:
	if night_only and _state == State.IDLE:
		var active := TimeOfDay.is_night()
		if _visual.visible != active:
			_apply_night_visibility(active)
		if not active:
			return
	match _state:
		State.IDLE:
			if _player_in_range():
				_state = State.PROMPT
				CodexState.discover("event", name)
				_refresh_fight_odds()
				_prompt_layer.show()
		State.FIGHT:
			if _duel:
				var events: Array = _duel.step(delta)
				for e in events:
					_on_duel_event(e)
				_refresh_combat_ui()
				if _duel.over:
					_finish_fight()
		State.COOLDOWN:
			_cooldown_left -= delta
			if _cooldown_left <= 0.0:
				_state = State.IDLE

## PLAN 101-2 GO(2026-09-18, combat_feel.gd 연결) — 적이 플레이어를
## 때렸을 때 hit_flash·숫자 팝을 걸 대상. Player.tscn "Visual"(character-a.glb
## 인스턴스) 자식까지 내려가야 실제 메시가 잡힌다(combat_feel.gd
## _first_mesh가 재귀 탐색으로 고쳐졌지만, "Visual"이 아예 없으면
## Player 루트를 그냥 준다 — CombatFeel.hit()은 메시를 못 찾아도
## hitstop·흔들림·팝은 그대로 낸다).
func _player_visual() -> Node3D:
	var player := get_tree().get_first_node_in_group("player")
	if player == null:
		return null
	var visual := (player as Node).get_node_or_null("Visual")
	return (visual as Node3D) if visual != null else player


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

## ── 사건 선택지 (event.js bandit_ambush) ────────────────────────────
func _build_prompt_ui() -> void:
	_prompt_layer = ChoicePrompt.build(self, event_title + "\n" + event_quote, [
		{"label": choice_fight_label, "cb": _choose_fight},
		{"label": choice_pay_label, "cb": _choose_pay},
		{"label": choice_flee_label, "cb": _choose_flee_event},
	])
	_prompt_layer.visible = false
	_fight_button = _prompt_layer.find_children("*", "Button", true, false)[0]

## `duel_rules.gd::win_chance()`는 웹판 winChance()를 옮겨 둔 뒤 "전투 중엔
## 안 쓰고 사건에 맞설지 고를 때 참고용으로만" 남겨 뒀는데(그 파일 주석),
## 실제로는 이 판 어디서도 부르는 곳이 없어 죽어 있었다(2026-09-20 감사로
## 발견) — 정확히 그 파일 주석이 말하는 자리(맞선다 버튼)에 붙인다.
func _refresh_fight_odds() -> void:
	if _fight_button == null:
		return
	var pct := int(round(DuelRules.win_chance(PartyState.atk + PartyState.def, foe_power) * 100.0))
	_fight_button.text = "%s (승산 %d%%)" % [choice_fight_label, pct]

func _choose_fight() -> void:
	_prompt_layer.hide()
	_start_fight()

func _choose_pay() -> void:
	_prompt_layer.hide()
	_toast(foe_name + " — " + choice_pay_text)
	_enter_cooldown()

func _choose_flee_event() -> void:
	_prompt_layer.hide()
	_toast(choice_flee_text)
	_enter_cooldown()

## ── 전투 화면 ────────────────────────────────────────────────────
func _build_combat_ui() -> void:
	_combat_layer = CanvasLayer.new()
	_combat_layer.visible = false
	add_child(_combat_layer)

	_flash_rect = ColorRect.new()
	_flash_rect.color = Color(1, 0.15, 0.15, 0.0)
	_flash_rect.anchor_right = 1.0
	_flash_rect.anchor_bottom = 1.0
	_flash_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_combat_layer.add_child(_flash_rect)

	var box := VBoxContainer.new()
	box.anchor_right = 1.0
	box.offset_left = 40.0
	box.offset_right = -40.0
	box.offset_top = 40.0
	box.offset_bottom = 260.0
	box.add_theme_constant_override("separation", 6)
	_combat_layer.add_child(box)

	var head := HBoxContainer.new()
	box.add_child(head)
	var title := Label.new()
	title.text = "🗡️ " + foe_name
	title.add_theme_font_size_override("font_size", 24)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(title)
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
	pad.add_child(DuelHud.make_combat_button("물러난다", _flee_combat))

func _start_fight() -> void:
	_state = State.FIGHT
	## PLAN 106장 ③ — 결투 중엔 들판 전투(field_combat.gd)가 입력·피해를 안 받는다.
	add_to_group("duel_active")
	var foe_hp := maxf(1.0, roundf(foe_power * foe_hp_mul))
	_duel = DuelRules.create(foe_hp, PartyState.atk, PartyState.def, time_sec, is_raid)
	_pre_stagger_count = 0
	_combat_layer.show()
	_refresh_combat_ui()

func _do_act(kind: String) -> void:
	if not _duel:
		return
	var r: Dictionary = _duel.act(kind)
	if r.get("ok", false):
		if kind == "quick":
			_pulse_visual(1.15)
			CombatFeel.hit(_visual, float(r.get("dmg", 0.0)), false)
		elif kind == "ult":
			_pulse_visual(1.4)
			## PLAN 101-2 GO(2026-09-18, combat_feel.gd 연결) — 필살은 이
			## 판에 별도 치명타 판정이 없어(속공/필살 둘뿐) crit=true로
			## 올려 hitstop 120ms(치명 값)를 빌려 쓴다 — 무게감 차이만
			## 필요하지 실제 "치명타" 개념을 새로 두는 게 아니다.
			CombatFeel.hit(_visual, float(r.get("dmg", 0.0)), true)
		if r.get("stagger", false):
			for i in _duel.stagger_count - _pre_stagger_count:
				PartyState.add_exp(stagger_exp_reward)
			_screen_flash(Color(1.0, 0.85, 0.2, 0.5))
			_toast("💥 %s 자세가 무너졌다!" % foe_name)
	_pre_stagger_count = _duel.stagger_count
	_refresh_combat_ui()
	if _duel.over:
		_finish_fight()

func _flee_combat() -> void:
	if _duel:
		_duel.flee()
		_finish_fight()

func _on_duel_event(e: Dictionary) -> void:
	match e.t:
		"tell":
			_toast("강타가 온다 — 피하라!")
			_set_visual_color(Color(1.0, 0.55, 0.1))
		"heavy":
			_clear_visual_color()
			var dodged: bool = e.get("dodged", false)
			var just: bool = e.get("just", false)
			## PLAN.md 101-2 GO ⑥"저스트 회피" — 예고 끝 0.25초 창 안에
			## 회피하면 화면 플래시(밝은 청록)+"간발!" 팝(웹 §5-③ UI 그대로).
			if just:
				_screen_flash(Color(0.3, 0.95, 1.0, 0.55))
				_toast("⚡ 간발!")
			else:
				var col: Color = Color(0.2, 1.0, 0.4, 0.35) if dodged else Color(1.0, 0.15, 0.15, 0.45)
				_screen_flash(col)
			## PLAN 101-2 GO(2026-09-18, combat_feel.gd 연결) — 완전히
			## 피했으면(dmg 0) 손맛을 걸 대미지 자체가 없다, 건너뛴다.
			var heavy_dmg: float = e.get("dmg", 0.0)
			if heavy_dmg > 0.0:
				CombatFeel.hit(_player_visual(), heavy_dmg, false)
		"hit":
			_screen_flash(Color(1.0, 0.15, 0.15, 0.3))
			CombatFeel.hit(_player_visual(), float(e.get("dmg", 0.0)), false)

func _refresh_combat_ui() -> void:
	if not _duel:
		return
	_hp_bar.value = clampf(_duel.hp / _duel.foe_hp * 100.0, 0.0, 100.0)
	_morale_bar.value = clampf(_duel.morale / _duel.morale_max * 100.0, 0.0, 100.0)
	_ki_bar.value = clampf(_duel.ki / DuelRules.KI_MAX * 100.0, 0.0, 100.0)
	_timer_label.text = str(ceili(maxf(0.0, _duel.left))) + "초"
	_ult_button.disabled = _duel.ki < DuelRules.KI_MAX

func _finish_fight() -> void:
	var cleared: bool = _duel.cleared
	var dealt: float = _duel.dealt
	_combat_layer.hide()
	_duel = null
	if cleared:
		PartyState.add_exp(foe_exp_reward)
		var msg: String
		if grants_recruit:
			PartyState.recruit(recruit_id)
			msg = foe_name + "을 물리쳤다 — 부대에 합류했다! (전투력 %d)" % int(PartyState.atk + PartyState.def)
		else:
			msg = victory_text
		## PLAN.md 101-2 GO ③"패배 비용과 회수" — 이 자리에서 예전에
		## 진 적이 있으면(drop_state.gd) 여기서 되찾는다.
		var recovered := DropState.try_recover(name)
		if recovered > 0.0:
			PartyState.add_exp(recovered)
			msg += "\n💰 전에 떨어뜨린 짐(경험치 +%d)을 되찾았다!" % int(recovered)
		if quest_id_to_complete != "":
			QuestState.complete(quest_id_to_complete)
			msg += "\n📋 사명을 완료했다!"
		_toast(msg)
		EventState.mark_resolved(name)
		queue_free() # 물리친 적은 사라진다 — 이번 슬라이스에서는 다시 나지 않는다
		return
	if dealt <= 0.0:
		# 한 대도 못 때리고 물러난 것은 패배로 안 친다(웹판 event.js와 같은 경계)
		_toast("물러났다.")
	else:
		## PLAN.md 101-2 GO ③ — 여기부터가 웹 §5-⑧의 "패배"다(위 주석과
		## 같은 경계, 죽어도 남는 것 = 도감·인물·인연·비석은 그대로 안
		## 건드린다, 경험치 일부만 그 자리에 남는다).
		var dropped := DropState.drop_at(name, PartyState.exp)
		if dropped > 0.0:
			_toast("밀렸다. 물러났다 — 경험치 %d 을 떨어뜨렸다(10분 안에 다시 이기면 되찾는다)." % int(dropped))
		else:
			_toast("밀렸다. 물러났다.")
	_enter_cooldown()

func _enter_cooldown() -> void:
	_state = State.COOLDOWN
	remove_from_group("duel_active")
	_cooldown_left = RETRY_COOLDOWN_SEC

func _pulse_visual(scale_to: float) -> void:
	## GLB는 평소 스케일이 1.0이 아니라 bandit_scale이다 — 원래 크기로
	## 돌아오는 지점도 그 값이어야 "펀치 후 원래 크기"가 맞는다.
	var base := bandit_scale if _using_glb else 1.0
	var tw := create_tween()
	tw.tween_property(_visual, "scale", Vector3.ONE * scale_to * base, 0.08)
	tw.tween_property(_visual, "scale", Vector3.ONE * base, 0.16)

## GLB로 바뀐 뒤로는 캡슐 하나가 아니라 몸통·팔·다리·머리가 각각 다른
## MeshInstance3D다 — "강타 예고" 때 몸 전체를 물들이려면 전부 찾아
## 같이 바꿔야 한다(games/saga_go/world/glb_utils.gd 참고).
func _set_visual_color(color: Color) -> void:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	for mi in GLBUtils.find_all_mesh_instances(_visual):
		mi.material_override = mat

## 텔레그래프가 끝나면 원래 텍스처로 되돌린다(GLB일 때). 캡슐 대체
## 상태였다면 기본 색으로 되돌린다.
func _clear_visual_color() -> void:
	if _using_glb:
		for mi in GLBUtils.find_all_mesh_instances(_visual):
			mi.material_override = null
	else:
		_set_visual_color(_base_color)

func _screen_flash(color: Color) -> void:
	_flash_rect.color = color
	var tw := create_tween()
	tw.tween_property(_flash_rect, "color:a", 0.0, 0.35)

func _toast(text: String) -> void:
	Toast.show(self, text, TOAST_SEC)
