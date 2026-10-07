extends Node3D

## VERTICAL_SLICE_STORY.md 완료 조건의 마지막 두 단계 — "저장한다 →
## 다시 켜서 이어진다"(GO test_village.gd·FOREST forest_village.gd와
## 같은 순서 규칙: 자식들의 _ready()가 부모보다 먼저 돈다).
##
## 이 판은 구면 투영이 없어(2.5D 고정 카메라, VERTICAL_SLICE_STORY.md
## 2절) WorldCurveMaterial 등록이 필요 없다 — FOREST test_village.gd와
## 달리 이 부분이 빠진다.
##
## **2026-09-13 추가 — 문(portal, 15절).** 허도에서 건너온 경우
## StorySaveState.has_pending_spawn이 서 있다 — 그때는 세이브를 안 불러오고
## (안 그러면 세이브 위치가 문으로 도착한 자리를 덮어써 버린다) 문이
## 정해 준 자리에만 세운다. story_town.gd(허도 쪽)와 같은 규칙.
##
## **G-0036 — 쓰러짐(재미 표준 F).** 플레이어 hp는 0에서 멈출 뿐이라
## (story_player_base.gd "죽음은 범위 밖") 비경(story_labyrinth.gd "패퇴")처럼
## 이 씬이 매 프레임 hp<=0을 관찰한다 — side.js die(): 이 사냥터에서 주운 금의
## 절반을 잃고 허도로. 조작 없이 1.5초 뒤 돌아간다(허도에서 체력은 가득).

const Toast := preload("res://saga_core/ui/toast.gd")
const TOWN_SCENE := "res://games/saga_story/world/HeodoField.tscn"
const TOWN_ARRIVAL_X := 24.0  # 비경 귀환(story_labyrinth.gd)과 같은 자리
const FALL_RETURN_SEC := 1.5

var save_on_fall := true  # 점검(probe_story_fall)이 끈다 — 진짜 세이브를 안 건드리게
var _start_gold := 0
var _fallen := false
var _return_timer: Timer


func _ready() -> void:
	## 가로 화면이면 UI 기준 크기를 바꿔 글자가 깨알만 하지 않게(saga_core/ui/orientation_scale.gd) — story_town.gd 와 같다(G-0039).
	add_child(preload("res://saga_core/ui/orientation_scale.gd").new())
	preload("res://saga_core/audio/bgm.gd").play(self, "story-field")  # 배경음(G-0011) — 곡 없으면 조용
	## 자동 저장(saga_core/world/autosave_timer.gd) — 60초마다·앱 멈춤 때.
	preload("res://saga_core/world/autosave_timer.gd").attach(self, StorySaveState.save, func() -> bool: return get_tree().get_first_node_in_group("player") != null)
	if StorySaveState.has_pending_spawn:
		var player := get_tree().get_first_node_in_group("player")
		var x_m: float = StorySaveState.consume_pending_spawn()
		if player != null:
			player.global_position = Vector3(x_m, 0.1, 0)
	else:
		StorySaveState.try_load()
		StorySaveState.begin_session()
	_start_gold = StorySaveState.gold
	## G-0087 이야기 엔진(세이브를 읽은 뒤 — 장면마다 새로, 진행은 StorySaveState.scenario).
	var runner: Node = preload("res://games/saga_story/world/scenario_runner.gd").new()
	runner.name = "ScenarioRunner"
	add_child(runner)


func _process(_delta: float) -> void:
	if _fallen:
		return
	var player := get_tree().get_first_node_in_group("player")
	if player != null and float(player.hp) <= 0.0:
		_on_fall(player)


func _on_fall(player: Node) -> void:
	_fallen = true
	var lost: int = StorySaveState.apply_fall(_start_gold)
	if save_on_fall:
		StorySaveState.save()
	player.set_physics_process(false)
	if player is CharacterBody3D:
		(player as CharacterBody3D).velocity = Vector3.ZERO
	Toast.show(self, "💀 쓰러졌다 — 주운 금 %d 을 잃고 허도로 돌아간다 · 경험치·장비는 그대로" % lost, 3.0)
	_return_timer = Timer.new()
	_return_timer.one_shot = true
	_return_timer.wait_time = FALL_RETURN_SEC
	_return_timer.timeout.connect(_return_to_town)
	add_child(_return_timer)
	_return_timer.start()


func _return_to_town() -> void:
	StorySaveState.set_pending_spawn(TOWN_ARRIVAL_X)
	get_tree().change_scene_to_file(TOWN_SCENE)
