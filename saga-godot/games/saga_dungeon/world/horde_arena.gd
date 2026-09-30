extends Node

## PLAN 101-2 DUNGEON ⑤(난입, 2026-09-17) — `DungeonHordeState`(숫자·판정,
## 파일 헤더가 전체 설계를 적어 뒀다)의 실제 스폰·HUD를 맡는 director.
## `TestRoom.tscn`에 형제 노드로 늘 떠 있고(sigil_button.gd처럼 상시 대기),
## `DungeonHordeState.active`가 꺼져 있으면 `_process`가 곧바로 돌아간다.
##
## 새 지오메트리(웹 "3×3 방 크기")를 만들지 않는다 — 시작할 때 플레이어가
## 서 있는 반경 안에 그대로 스폰한다(dungeon_horde_state.gd 헤더 참고).

const DungeonEnemy := preload("res://games/saga_dungeon/world/dungeon_enemy.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const SPAWN_RADIUS_MIN := 4.0
const SPAWN_RADIUS_MAX := 7.0

var _hud: CanvasLayer
var _timer_label: Label
var _wave_label: Label
var _level_label: Label
var _player: Node3D
var _spawned: Array[Node] = []  # 생존 중인 난입 잡졸(종료 시 일괄 정리용)


func _ready() -> void:
	add_to_group("horde_arena")
	_player = get_tree().get_first_node_in_group("player")
	var found := get_tree().get_nodes_in_group("player_health")
	if not found.is_empty():
		found[0].died.connect(_on_player_died)
	_build_hud()


func _process(delta: float) -> void:
	if not DungeonHordeState.active:
		return
	var ev := DungeonHordeState.tick(delta)
	if ev == "wave":
		_spawn_wave(DungeonHordeState.wave)
	elif ev == "finished":
		_end_run(true)
	if DungeonHordeState.active:
		_refresh_hud()


## horde_button.gd가 확인창 뒤에 이걸 부른다 — 실제 시작·스폰은 여기서.
func start_run() -> void:
	if not DungeonHordeState.start():
		return
	_clear_spawned()
	_hud.show()
	_refresh_hud()
	Toast.show(self, "🌊 난입 시작 — 15분을 버티면 보상, 쓰러지면 그 자리에서 끝난다.", 4.0)


func _spawn_wave(w: int) -> void:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player")
		if _player == null:
			return
	var count := DungeonHordeState.enemy_count_for_wave(w)
	var mult := DungeonHordeState.enemy_stat_mult_for_wave(w)
	for i in range(count):
		var ang := randf() * TAU
		var r := lerpf(SPAWN_RADIUS_MIN, SPAWN_RADIUS_MAX, randf())
		var pos := _player.global_position + Vector3(cos(ang) * r, 0, sin(ang) * r)
		var enemy: CharacterBody3D = DungeonEnemy.new(1, false, false, false, mult)
		enemy.position = pos
		enemy.add_to_group("horde_enemy")
		## 정직하게 밝혀 둔다 — "그림자" 정예가 갈라져 낳는 분신(dungeon_enemy.gd
		## ::_die() split)은 이 died 연결을 안 물려받는다(부모가 직접
		## add_child하는 별도 경로라서). 그 분신을 잡아도 난입 처치·경험엔
		## 안 잡힌다 — 드문 조합(정예 8종 중 1종)이라 이번 범위에서 안 고친다.
		enemy.died.connect(_on_horde_kill)
		get_parent().add_child(enemy)
		_spawned.append(enemy)
	Toast.show(self, "🌊 파도 %d — 적 %d" % [w, count], 2.5)


func _on_horde_kill() -> void:
	if DungeonHordeState.register_kill():
		_open_level_choice()


## dungeon_run_state.gd::_on_exit_entered()의 은사 카드와 같은 자리 —
## 여기도 축 아이콘만 라벨 텍스트로 근사한다(새 UI를 안 만든다).
func _open_level_choice() -> void:
	var choice := DungeonHordeState.roll_choice()
	if choice.is_empty():
		return
	var layer_box := {}
	var choices: Array = []
	var axis_icons := {"skill": "🗡️", "hero": "👤", "world": "🌐"}
	for key in choice:
		var b := DungeonBoons.by_key(key)
		var axis_icon: String = axis_icons.get(str(b.get("axis", "")), "")
		choices.append({
			"label": "%s %s %s — %s" % [axis_icon, b.emoji, b.name, b.desc],
			"cb": func() -> void:
				(layer_box["layer"] as CanvasLayer).queue_free()
				DungeonHordeState.apply_boon(key),
		})
	layer_box["layer"] = ChoicePrompt.build(
		self, "🌊 난입 레벨 업 Lv.%d — 하나를 고르세요" % DungeonHordeState.level, choices)


func _on_player_died() -> void:
	if DungeonHordeState.active:
		_end_run(false)


func _end_run(survived: bool) -> void:
	var r := DungeonHordeState.finish(survived)
	if r.is_empty():
		return
	_clear_spawned()
	_hud.hide()
	var msg := "🌊 난입 %s — %d초 생존, 금 +%d" % [
		"완주" if survived else "종료", int(r.get("elapsed", 0.0)), int(r.get("gold", 0))]
	if bool(r.get("sigil", false)):
		msg += ", 부적 획득"
	Toast.show(self, msg, 5.0)


func _clear_spawned() -> void:
	for e in _spawned:
		if is_instance_valid(e):
			e.queue_free()
	_spawned.clear()


func _build_hud() -> void:
	_hud = CanvasLayer.new()
	_hud.visible = false
	add_child(_hud)
	var box := VBoxContainer.new()
	box.anchor_left = 0.5
	box.anchor_right = 0.5
	box.offset_left = -140.0
	box.offset_right = 140.0
	box.offset_top = 20.0
	box.offset_bottom = 100.0
	_hud.add_child(box)
	_wave_label = Label.new()
	_wave_label.add_theme_font_size_override("font_size", 22)
	_wave_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(_wave_label)
	_timer_label = Label.new()
	_timer_label.add_theme_font_size_override("font_size", 22)
	_timer_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(_timer_label)
	_level_label = Label.new()
	_level_label.add_theme_font_size_override("font_size", 18)
	_level_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(_level_label)


func _refresh_hud() -> void:
	var left := maxf(0.0, DungeonHordeState.RUN_LIMIT_SEC - DungeonHordeState.elapsed)
	_wave_label.text = "🌊 파도 %d" % DungeonHordeState.wave
	_timer_label.text = "%02d:%02d" % [int(left) / 60, int(left) % 60]
	_level_label.text = "Lv.%d · 처치 %d" % [DungeonHordeState.level, DungeonHordeState.kills]
