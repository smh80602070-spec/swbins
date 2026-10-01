extends Node3D

## VERTICAL_SLICE_FOREST.md 4절 완료 조건의 마지막 두 단계 —
## "저장한다 → 다시 켜서 이어진다"(GO test_village.gd와 같은 순서 규칙,
## 자식들의 _ready()가 먼저 돈다) + 1절 결정(구면 투영)의 중심을 매 프레임
## 플레이어 위치로 갱신하는 역할을 겸한다.

const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const VillagerBuilder := preload("res://games/saga_forest/world/villager_builder.gd")

## PLAN 105 Q-f(이 세션 판단, 2026-09-18③) — GO는 60m(48m 타일의 1.25칸)를
## 쓰지만 FOREST 지도(90×60m, 3m 타일)엔 60m가 거의 지도 전체라 empty_pct가
## 늘 0.0으로 나왔다. 타일 비율을 그대로 옮기면(3.75m) 이번엔 반대로
## 무의미해져서(전부 empty), 실측해 신호가 사는 값(r=10m: 18.0%, r=15m부터는
## 3.7%로 죽는다)으로 이 세션이 직접 골랐다 — forest_landmarks.gd 헤더 참고.
const DENSITY_RADIUS_M := 10.0

var _player: Node3D = null


func _ready() -> void:
	## 가로 화면이면 UI 기준 크기를 바꿔 글자가 깨알만 하지 않게(saga_core/ui/orientation_scale.gd).
	add_child(preload("res://saga_core/ui/orientation_scale.gd").new())
	preload("res://saga_core/audio/bgm.gd").play(self, "forest-town")  # 배경음(G-0011) — 곡 없으면 조용
	WorldCurveMaterial.ensure_global_registered()
	ForestSaveState.try_load()
	ForestSaveState.begin_session()
	## 자동 저장(saga_core/world/autosave_timer.gd) — 60초마다·앱 멈춤 때.
	preload("res://saga_core/world/autosave_timer.gd").attach(self, ForestSaveState.save, func() -> bool: return get_tree().get_first_node_in_group("player") != null)

	## 제외 목록 6번(계절행사 8일) — 오늘이 그 여덟 날 중 하나면 들어오자마자
	## 안내한다(gather_label.gd가 상시 표시하는 것과 별개로, 첫 인상은
	## 한 번 크게).
	var e := ForestFestival.event_of_today()
	if not e.is_empty():
		Toast.show(self, "🎊 %s — %s" % [e.name, e.hello], 4.0)

	if OS.get_environment("SAGA_DENSITY_REPORT") != "":
		_print_density_report()


## saga_core/ui/goal_board.gd는 ForestSaveState·VillagerBuilder를 모른다
## (GO test_village.gd 헤더와 같은 경계). FOREST엔 GO의 "단일 활성 사명"
## 개념이 없어(주민 6명이 각자 독립적으로 부탁 하나씩 들고 있다, ROSTER_SIZE)
## "지금"은 늘 부탁 완료 진행도다. gather_label.gd가 이미 폴링으로
## 골드·채집물을 매 프레임 갱신하는 것과 같은 이유로(master.md 33장 —
## FOREST엔 신호 배선이 없어 폴링이 더 단순하다) 이 판만 goal_board도
## _process()에서 폴링한다. "이번 주"는 GO·DUNGEON과 같은 이유로 "—".
func _refresh_goal_board() -> void:
	var board := get_tree().get_first_node_in_group("goal_board")
	if board == null:
		return
	var now := "주민 부탁 %d/%d" % [ForestSaveState.quests_done.size(), VillagerBuilder.ROSTER_SIZE]
	var session := "골드 +%d · 채집 +%d" % [
		ForestSaveState.session_gold_gained(), ForestSaveState.session_items_gathered()]
	board.set_goals(now, session, "—")


## PLAN.md 104-5 — 발견 밀도(§3-E), GO test_village.gd `_print_density_report()`와
## 같은 계약. FOREST엔 GO의 codex "discover" 갈래가 없어(루트 CLAUDE.md
## 원칙대로 다섯 판을 억지로 맞추지 않는다), "codex_discoverable" 그룹을
## 집·주민 5·낚시터·박물관·바이옴 생물의 실제 배치 지점으로 대신 채운다
## (villager_builder.gd·forest_house.gd·fishing_spot.gd·museum.gd·
## forest_creature_builder.gd·forest_landmarks.gd). 평소엔 안 돌린다 —
## 회귀 md5 흔들림 방지. 반경은 DENSITY_RADIUS_M(GO와 다른 값, 위 주석).
func _print_density_report() -> void:
	var density := load("res://saga_core/world/density_report.gd")
	var size: Vector2i = ForestMap.size()
	var tile: float = ForestMap.TILE_SIZE
	var half_w := size.x * 0.5 * tile
	var half_h := size.y * 0.5 * tile
	var points: Array = []
	for node in get_tree().get_nodes_in_group("codex_discoverable"):
		var p: Vector3 = (node as Node3D).global_position
		if abs(p.x) <= half_w and abs(p.z) <= half_h:
			points.append(Vector2(p.x / tile + size.x * 0.5, p.z / tile + size.y * 0.5))
	var report: Dictionary = density.report(size, tile, points, DENSITY_RADIUS_M)
	print("DENSITY village total=%d empty=%d empty_pct=%.1f" % [report.total, report.empty, report.empty_pct])


func _process(_delta: float) -> void:
	_refresh_goal_board()
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player")
		if _player == null:
			return
	WorldCurveMaterial.update_center(_player.global_position)
