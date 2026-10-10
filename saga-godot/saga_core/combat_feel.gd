extends Node

## PLAN.md 101-3 "C 손맛(다섯 판 공용 saga_core/combat_feel.gd 신설)" —
## 2026-09-17, PLAN 101-2 DUNGEON ③(손맛 2차)에서 처음 만든다. 다섯 판
## 공용 자리로 설계됐지만(101-3 원문 그대로) 그 세션은 DUNGEON 한 곳만
## 실제로 연결했다(`melee_attack.gd::_strike()` — 이미 있는 유일한 "타격
## 한 곳" 자리, 축복 3택 세션의 원소 시너지와 같은 판단 — 스킬 스크립트
## 80여 개까지 개별로 잇는 건 범위 밖, 다음 세션). **같은 날, STORY
## ①후보(손맛 표준)에서 `story_player.gd`도 이었다** — STORY는 무예마다
## 함수가 갈려 있지만(연참·횡소·기탄 등 18곳) 다 같은 3줄 패턴이라
## 한 번에 옮겼다(`story_player.gd` 헤더 참고). 옛 `trigger_hitstop()`
## (story_combat.gd, Engine.time_scale 직접 조작)은 지웠다. GO의 화면
## 플래시(0.35s)는 아직 안 건드렸다 — 다음에 그 판을 옮겨 붙일 자리로
## 남겨 둔다(PLAN 101-4 순서 2, GO·FOREST·REALM 몫).
##
## `hit(target, amount, crit)` 한 호출이 5요소를 낸다(101-3 수치 그대로):
## ① **hitstop** — `Engine.time_scale` 0.05로 70ms(치명 120ms). 여러
##    타격이 겹치면 남은 시간이 더 긴 쪽으로 늘어난다(dungeon_run_state.gd
##    `_temp_buffs`와 같은 "더 센/긴 쪽 유지" 결) — `_process()`가 실제
##    시각(Time.get_ticks_msec, time_scale의 영향을 안 받는다)으로 만료를
##    본다.
## ② **카메라 흔들림** — "camera_rig" 그룹의 첫 노드에 0.06m(4px 상당,
##    거리 8m 기준) 노이즈 120ms(`dungeon_camera_rig.gd::shake()` 참고).
##    그 그룹에 아무도 없으면(아직 안 옮긴 판) 조용히 건너뛴다.
## ③ **피격 플래시** — target의 첫 `MeshInstance3D` 자식을 본다. `cel_toon`
##    셰이더(surface override, CelShaderApply 가 입힌 Player·NPC)가 걸려
##    있으면 2026-09-18(PLAN 102-3)부터 그 `hit_flash` uniform을 80ms
##    1.0→0.0으로 쓴다. 아직 그 셰이더가 없는 대상(`dungeon_enemy.gd::
##    _spawn_visual()`의 `StandardMaterial3D` 단색 몬스터 등)은 예전처럼
##    `albedo_color`를 흰색으로 80ms 바꿨다 되돌리는 근사를 그대로 쓴다.
## ④ **숫자 팝** — `Label3D` 하나를 현재 씬 루트에 띄워 0.6초 동안 0.8m
##    떠오르며 사라진다(크리는 1.4배 크기·주황).
## ⑤ **타격음** — 103-1 `sfxgen.py`가 만든 `assets/generated/sfx/hit_0{1,2,3}.wav`·
##    `pick_0{1,2,3}.wav`를 3종 라운드로빈으로 실제로 재생한다(2026-09-20㉒,
##    "sound_triggered 신호에 실제로 연결하는 배선은 안 함"으로 남겨 뒀던
##    자리 — 사용자가 §8-1 override 재승인). `hit()`은 hit_ 계열,
##    `pickup()`은 pick_ 계열(과일·채집=피격이 아니라는 느낌 구분). 매번
##    `AudioStreamPlayer` 하나를 만들어 재생 뒤 `queue_free`(위 Label3D
##    팝업과 같은 결 — 짧은 원샷이라 풀링 없이도 부담 없다). `sound_triggered(idx)`
##    신호는 그대로 "울렸다"는 사실만 낸다(진단용, 실제 소비자 아님).
##
## 다섯 신호(hitstop_triggered·shake_triggered·flash_triggered·
## popup_triggered·sound_triggered)는 101-3이 요구한 진단("hit() 1회 →
## 5요소 신호 5개")을 그대로 세게 하려고 둔 것 — 실제 소비자는 신호가
## 아니라 이 함수가 직접 부르는 부수효과(time_scale·마커·머티리얼 등)다.
##
## project.godot [autoload]에 CombatFeel로 등록.

signal hitstop_triggered(dur_ms: int)
signal shake_triggered(amp_m: float, dur_ms: int)
signal flash_triggered(target: Node)
signal popup_triggered(amount: float, crit: bool)
signal sound_triggered(idx: int)
signal pickup_triggered(label: String)

const HITSTOP_MS := 70
const HITSTOP_CRIT_MS := 120
const HITSTOP_SCALE := 0.05
const SHAKE_AMP_M := 0.06
const SHAKE_MS := 120
const FLASH_MS := 80
const POPUP_SEC := 0.6
const POPUP_RISE_M := 0.8
const POPUP_CRIT_SCALE := 1.4
## G-0169 — 숫자가 적 머리 위 이름표·체력 바(+1.2m 근처)에 정확히 겹쳐 묻혔다 — 화면 기준 좌우로 번갈아 비켜 띄운다.
const POPUP_SIDE_M := 0.8
const POPUP_DRIFT_M := 0.25
var _pop_side := 1.0
const SOUND_CUE_COUNT := 3
const Voice := preload("res://saga_core/audio/voice.gd")   # G-0111 대사 음성
const CEL_SHADER := preload("res://saga_core/shaders/cel_toon.gdshader")
## 2026-09-29 — GO 코드 짐승(creature_builder.gd)은 정점색 셀 셰이더에 같은 hit_flash 를 둔다.
const CEL_VC_SHADER := preload("res://saga_core/shaders/cel_vertex_color.gdshader")
const HIT_SOUNDS: Array[AudioStream] = [
	preload("res://assets/generated/sfx/hit_01.wav"),
	preload("res://assets/generated/sfx/hit_02.wav"),
	preload("res://assets/generated/sfx/hit_03.wav"),
]
const PICK_SOUNDS: Array[AudioStream] = [
	preload("res://assets/generated/sfx/pick_01.wav"),
	preload("res://assets/generated/sfx/pick_02.wav"),
	preload("res://assets/generated/sfx/pick_03.wav"),
]
const UI_SOUNDS: Array[AudioStream] = [
	preload("res://assets/generated/sfx/ui_01.wav"),
	preload("res://assets/generated/sfx/ui_02.wav"),
	preload("res://assets/generated/sfx/ui_03.wav"),
]

var _hitstop_until_msec := 0
var _flash_state: Dictionary = {}  # MeshInstance3D 인스턴스ID -> {mesh, orig, until}
var _sound_idx := 0
var _pick_sound_idx := 0
var _ui_sound_idx := 0
## G-0177 — 판이 자기 효과음을 낼 때 건다(1만리 go_sfx.gd). call(kind "hit"|"pick"|"ui", target, crit) 이 true 면
## 아래 기본 wav 를 안 낸다(sound_triggered 는 그대로). 안 걸면 다른 판은 지금과 같다.
var sound_hook: Callable


## tune(선택, G-0018): {stop_ms 히트스톱 길이(치명이면 +50), shake_mul 흔들림 배율(0=없음), pop_mul 숫자 크기 배율, quiet 타격음 끔}.
## 비우면 위 기본 상수 그대로 — 사가나락·스토리·다른 호출은 동작이 안 바뀐다.
func hit(target: Node3D, amount: float, crit: bool, tune: Dictionary = {}) -> void:
	_do_hitstop(crit, int(tune.get("stop_ms", -1)))
	_do_shake(float(tune.get("shake_mul", 1.0)))
	if is_instance_valid(target):
		_do_flash(target)
		_do_popup(target, amount, crit, float(tune.get("pop_mul", 1.0)))
	if not bool(tune.get("quiet", false)):
		if _hooked("hit", target, crit):
			sound_triggered.emit(_sound_idx)
		else:
			_do_sound("hit")


## PLAN 101-4 순서 2(FOREST 연결), 2026-09-18. 웹 §5 "채집 손맛" 후보용 —
## hit()의 5요소 중 hitstop·흔들림·피격 플래시는 "맞았다"는 전투 신호라
## 채집(forest_creature.gd 헤더 "전투·포획·HP는 이번에도 안 만든다")엔
## 안 맞는다. 순간성 있는 둘(숫자 팝·타격음)만 추려 label 문자열로 띄운다
## (데미지 숫자 대신 "과일 +1" 같은 텍스트 — _do_popup은 amount:float
## 포맷 고정이라 따로 둔다). REALM은 대상이 없어 못 붙였다 — 일기토·
## 공성 전부 ChoicePrompt/토스트로 푸는 턴제 판정이라 카메라 rig도
## MeshInstance3D 타겟도 씬에 없다(realm_war.gd 헤더 "실시간 타이밍
## 입력은 안 넣는다"와 같은 결).
func pickup(target: Node3D, label: String) -> void:
	if is_instance_valid(target):
		_do_pickup_popup(target, label)
	if _hooked("pick", target, false, label):
		sound_triggered.emit(_pick_sound_idx)
	else:
		_do_sound("pick")
	Voice.say("pickup")   # G-0111 — 말하는 이 = Voice.speaker
	pickup_triggered.emit(label)


## 103-1 `sfxgen.py`가 hit_·pick_ 과 같이 만들어 둔 `ui_0{1,2,3}.wav`(67장
## "UI" 계열)를 처음 연결한다(2026-09-21). target·팝업 없이 소리만 —
## 화면 안 3D 좌표가 없는 CanvasLayer 버튼 자리라 `_do_popup`류가 필요
## 없다. `session_card.gd`(다섯 판 공용 "닫기") 호출용.
func ui() -> void:
	if _hooked("ui", null, false):
		return
	_ui_sound_idx = (_ui_sound_idx + 1) % SOUND_CUE_COUNT
	_play_one_shot(UI_SOUNDS[_ui_sound_idx])


func _do_hitstop(crit: bool, stop_ms: int = -1) -> void:
	var dur := HITSTOP_CRIT_MS if crit else HITSTOP_MS
	if stop_ms >= 0:
		dur = stop_ms + (HITSTOP_CRIT_MS - HITSTOP_MS if crit else 0)
	if dur <= 0:
		return # 지속 피해 틱 같은 것 — 멈추지 않는다
	var until := Time.get_ticks_msec() + dur
	_hitstop_until_msec = maxi(_hitstop_until_msec, until)
	Engine.time_scale = HITSTOP_SCALE
	hitstop_triggered.emit(dur)


## G-0173 — 짧은 느려짐(회피 성공 등). 히트스톱과 같은 틀 — 더 느린 쪽·더 늦게 풀리는 쪽을 따르고 _process 가 실제 시간으로 푼다.
func slow(ms: int, scale: float) -> void:
	if ms <= 0:
		return
	_hitstop_until_msec = maxi(_hitstop_until_msec, Time.get_ticks_msec() + ms)
	Engine.time_scale = minf(Engine.time_scale, scale)


func _process(_delta: float) -> void:
	if _hitstop_until_msec > 0 and Time.get_ticks_msec() >= _hitstop_until_msec:
		Engine.time_scale = 1.0
		_hitstop_until_msec = 0
	_tick_flash()


func _do_shake(mul: float = 1.0) -> void:
	if mul <= 0.0:
		return
	var rig := get_tree().get_first_node_in_group("camera_rig")
	if rig != null and rig.has_method("shake"):
		rig.shake(SHAKE_AMP_M * mul, SHAKE_MS / 1000.0)
	shake_triggered.emit(SHAKE_AMP_M * mul, SHAKE_MS)


func _do_flash(target: Node3D) -> void:
	var mesh := _first_mesh(target)
	if mesh != null:
		var key := mesh.get_instance_id()
		var shader_mats := _cel_shader_materials(mesh)
		if not shader_mats.is_empty():
			for m in shader_mats:
				(m as ShaderMaterial).set_shader_parameter("hit_flash", 1.0)
			_flash_state[key] = {"kind": "shader", "mats": shader_mats,
				"until": Time.get_ticks_msec() + FLASH_MS}
		elif mesh.material_override is StandardMaterial3D:
			var mat: StandardMaterial3D = mesh.material_override
			if not _flash_state.has(key) or _flash_state[key].get("kind") != "standard":
				_flash_state[key] = {"kind": "standard", "mesh": mesh, "orig": mat.albedo_color}
			mat.albedo_color = Color.WHITE
			_flash_state[key]["until"] = Time.get_ticks_msec() + FLASH_MS
	flash_triggered.emit(target)


## mesh의 서피스 override 재질 중 cel_toon 셰이더를 쓰는 것만 모은다
## (CelShaderApply.apply_to가 이 셰이더를 surface override로 입힌다 —
## material_override 통짜가 아니라 서피스별이라 여기서 따로 훑는다).
func _cel_shader_materials(mesh: MeshInstance3D) -> Array:
	var result: Array = []
	if mesh.mesh == null:
		return result
	for i in mesh.mesh.get_surface_count():
		var mat := mesh.get_surface_override_material(i)
		if mat is ShaderMaterial and ((mat as ShaderMaterial).shader == CEL_SHADER or (mat as ShaderMaterial).shader == CEL_VC_SHADER):
			result.append(mat)
	return result


func _tick_flash() -> void:
	if _flash_state.is_empty():
		return
	var now := Time.get_ticks_msec()
	var done: Array = []
	for key in _flash_state:
		var info: Dictionary = _flash_state[key]
		if now >= int(info.until):
			if info.kind == "shader":
				for m in info.mats:
					if is_instance_valid(m):
						(m as ShaderMaterial).set_shader_parameter("hit_flash", 0.0)
			else:
				var mesh: MeshInstance3D = info.mesh
				if is_instance_valid(mesh) and mesh.material_override is StandardMaterial3D:
					(mesh.material_override as StandardMaterial3D).albedo_color = info.orig
			done.append(key)
	for key in done:
		_flash_state.erase(key)


## 재귀 탐색(2026-09-18, GO 연결 때 고침) — DUNGEON 몬스터·STORY 무예는
## 캡슐 하나(직속 자식)라 예전 얕은 탐색으로도 됐지만, GO/FOREST가 쓰는
## 뼈대 있는 GLB(character-*.glb 등)는 실제 MeshInstance3D가 2단 이상
## 안쪽(Skeleton3D 밑)에 있어 못 찾았다 — 얕은 경우엔 그대로 같은 결과를
## 주니(첫 자식에서 바로 걸림) 기존 두 판은 동작이 안 바뀐다.
func _first_mesh(target: Node) -> MeshInstance3D:
	if target is MeshInstance3D:
		return target
	for child in target.get_children():
		var found := _first_mesh(child)
		if found != null:
			return found
	return null


func _do_popup(target: Node3D, amount: float, crit: bool, pop_mul: float = 1.0) -> void:
	var scene := get_tree().current_scene
	if scene == null:
		popup_triggered.emit(amount, crit)
		return
	var label := Label3D.new()
	label.text = str(int(roundf(amount)))
	label.modulate = Color(1.0, 0.55, 0.1) if crit else Color(1.0, 1.0, 1.0)
	if _is_player(target):
		label.modulate = Color(1.0, 0.35, 0.3)   # G-0171 — 내가 받은 피해는 붉게(적에게 준 흰 숫자와 가르게)
	label.font_size = 48
	label.pixel_size = 0.01 * (POPUP_CRIT_SCALE if crit else 1.0) * pop_mul
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = true
	label.outline_size = 12   # G-0169 — 풀밭·하늘 어디서나 읽히게
	label.outline_modulate = Color(0, 0, 0, 0.9)
	label.render_priority = 10   # 체력 바 위에 그린다
	## 2026-09-18 고침 — 트리 밖 노드의 global_position 대입은 Godot 4가
	## 조용히 항등행렬 기준으로 계산한다(glb_utils.gd fit_height와 같은
	## 함정, GO 연결 자가진단으로 처음 걸림 — scene 루트가 원점이라 지금
	## 판들에선 우연히 값이 맞았을 뿐이다). add_child를 먼저 하면 정상.
	scene.add_child(label)
	var cam := get_viewport().get_camera_3d()
	var right := cam.global_basis.x if cam != null else Vector3.RIGHT
	right.y = 0.0
	right = right.normalized() if right.length() > 0.01 else Vector3.RIGHT
	_pop_side = -_pop_side
	var side := right * (_pop_side * POPUP_SIDE_M)
	label.global_position = target.global_position + Vector3(0, 0.85 + randf() * 0.25, 0) + side   # 몸 높이에서 시작해 바 옆으로 올라간다
	var tw := label.create_tween()
	tw.tween_property(label, "position", label.position + side.normalized() * POPUP_DRIFT_M + Vector3(0, POPUP_RISE_M, 0), POPUP_SEC)   # 올라가며 바깥으로
	tw.parallel().tween_property(label, "modulate:a", 0.0, POPUP_SEC)
	tw.tween_callback(label.queue_free)
	popup_triggered.emit(amount, crit)


func _is_player(n: Node) -> bool:
	while n != null:
		if n.is_in_group("player"):
			return true
		n = n.get_parent()
	return false


func _do_pickup_popup(target: Node3D, label: String) -> void:
	var scene := get_tree().current_scene
	if scene == null:
		return
	var lbl := Label3D.new()
	lbl.text = label
	lbl.modulate = Color(0.6, 1.0, 0.6)
	lbl.font_size = 40
	lbl.pixel_size = 0.01
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.no_depth_test = true
	## _do_popup과 같은 함정(2026-09-18) — add_child 먼저, global_position 나중.
	scene.add_child(lbl)
	lbl.global_position = target.global_position + Vector3(0, 1.2, 0)
	var tw := lbl.create_tween()
	tw.tween_property(lbl, "position:y", lbl.position.y + POPUP_RISE_M, POPUP_SEC)
	tw.parallel().tween_property(lbl, "modulate:a", 0.0, POPUP_SEC)
	tw.tween_callback(lbl.queue_free)


func _hooked(kind: String, target: Node3D, crit: bool, label: String = "") -> bool:
	return sound_hook.is_valid() and bool(sound_hook.call(kind, target, crit, label))


func _do_sound(kind: String = "hit") -> void:
	if kind == "pick":
		_pick_sound_idx = (_pick_sound_idx + 1) % SOUND_CUE_COUNT
		_play_one_shot(PICK_SOUNDS[_pick_sound_idx])
		sound_triggered.emit(_pick_sound_idx)
	else:
		_sound_idx = (_sound_idx + 1) % SOUND_CUE_COUNT
		_play_one_shot(HIT_SOUNDS[_sound_idx])
		sound_triggered.emit(_sound_idx)


## `_do_popup`·`_do_pickup_popup`과 같은 결(짧은 원샷 하나 만들고 끝나면
## `queue_free`) — 이 자리도 풀링 없이 매번 새로 만든다. 씬 전환 중처럼
## `current_scene`이 없는 순간엔 조용히 건너뛴다.
func _play_one_shot(stream: AudioStream) -> void:
	var scene := get_tree().current_scene
	if scene == null or stream == null:
		return
	var player := AudioStreamPlayer.new()
	player.stream = stream
	scene.add_child(player)
	player.play()
	player.finished.connect(player.queue_free)
