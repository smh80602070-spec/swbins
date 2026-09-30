extends Node3D

## VERTICAL_SLICE_DUNGEON.md 1·5절 — DUNGEON 첫 방(고분 테마). CC0 Kenney
## Modular Cave Kit(assets/dungeon/, GO의 동굴 입구 gate-rock.glb와 같은
## 킷 — 이미 받아 둔 것을 재사용, 새 킷 다운로드 없음)의 room-small.glb
## (실측 12x4.4x12, 바닥 중앙 피벗 — 측정 스크립트로 직접 확인)를 쓴다.
## 이 GLB엔 충돌이 없어(단순 장식 메시라 Godot이 자동 생성 안 함) 벽·
## 바닥은 직접 만든다(GO의 terrain_builder.gd와 같은 방식) — 한쪽 벽에는
## 출구(gate.glb, 실측 폭 4.4) 폭만큼 틈을 낸다.
##
## "제외" 목록 2번(층 전체 — 여러 방 연결) 최소 착수 — §28-8 "진짜 이어진
## 세계" A안(웹판, 완전한 오픈월드)은 여전히 더 큰 다음 슬라이스 몫이다.
## 이번엔 그 정신(로딩 없이 걸어서 이어진다)만 가장 작게 증명한다: 방을
## `ROOM_COUNT`개 한 씬 안에 나란히 세우고 같은 킷의 `corridor.glb`
## (실측 4.0x4.05x4.0, 바닥 중앙 피벗 — 측정 스크립트로 확인)로 잇는다.
## 방 사이를 오갈 때 씬 전환이 전혀 없다 — 문을 지나면 그냥 다음 방이다.

const GLBUtils := preload("res://saga_core/world/glb_utils.gd")
const DungeonEnemy := preload("res://games/saga_dungeon/world/dungeon_enemy.gd")
const DungeonHeroEncounter := preload("res://games/saga_dungeon/world/dungeon_hero_encounter.gd")
const LootPickup := preload("res://games/saga_dungeon/world/loot_pickup.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
## GO의 사건 선택지 패널을 그대로 재사용한다(GLBUtils·Toast와 같은 cross-game
## 재사용 경계 — GO 전용 로직이 아니라 순수 UI 빌더라 옮길 필요가 없다).
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Characters := preload("res://saga_core/data/characters.gd")
## 표준 A/B(목표판·세션 카드, PLAN.md 101-4 공통 순서 1번) — GO
## test_village.gd·save_button.gd와 같은 경계.
const SessionCard := preload("res://saga_core/ui/session_card.gd")
const CompanionFollow := preload("res://saga_core/world/companion_follow.gd")

const ROOM_GLB := "res://assets/dungeon/room-small.glb"
const GATE_GLB := "res://assets/dungeon/gate.glb"
const CORRIDOR_GLB := "res://assets/dungeon/corridor.glb"

## PLAN 103-3 "굴혈 mood 3(흙·석회·용암)" — 09-19 `palette.py`가 room-small·
## gate·corridor 셋 다 세 결로 스냅해 뒀는데(ASSET_GUIDE 해당 날짜) 그동안
## 방이 전부 원본(`ROOM_GLB` 등) 한 가지로만 세워졌다. 방마다 정해진 서사적
## 규칙은 없어(어느 방이 "용암"이어야 한다는 근거가 원작에 없다) 방 순서를
## 3색으로 그냥 순환시킨다 — 결정적이라 헤드리스 회귀 md5는 그대로 안정.
const ROOM_MOODS := ["dirt", "limestone", "lava"]
const MOOD_ROOM_GLB := {
	"dirt": "res://assets/generated/variants/room-small__dungeon_dirt.glb",
	"limestone": "res://assets/generated/variants/room-small__dungeon_limestone.glb",
	"lava": "res://assets/generated/variants/room-small__dungeon_lava.glb",
}
const MOOD_GATE_GLB := {
	"dirt": "res://assets/generated/variants/gate__dungeon_dirt.glb",
	"limestone": "res://assets/generated/variants/gate__dungeon_limestone.glb",
	"lava": "res://assets/generated/variants/gate__dungeon_lava.glb",
}
const MOOD_CORRIDOR_GLB := {
	"dirt": "res://assets/generated/variants/corridor__dungeon_dirt.glb",
	"limestone": "res://assets/generated/variants/corridor__dungeon_limestone.glb",
	"lava": "res://assets/generated/variants/corridor__dungeon_lava.glb",
}


func _mood_for_room(room_index: int) -> String:
	return ROOM_MOODS[room_index % ROOM_MOODS.size()]

## "제외" 목록 7번(보스층) — data-dungeon.js `isBossFloor(floor) =
## floor % 3 === 0`을 그대로 옮긴다(이 슬라이스에서 방=층 취급, 각 방의
## floor_num은 i+1). **2026-09-14, 51장 확장(GO/STORY/REALM이 각자
## "제외" 목록을 다 채운 뒤 "던전 증가"를 골랐다) — 방 3개(보스 1명)에서
## 6개(보스 2명, 3층·6층)로 늘렸다.** 웹판은 층수 제한이 없는 끝없는
## 하강(roguelike)이지만, 이 슬라이스는 여전히 "한 씬 안에 방을 나란히
## 세운다"는 방식(§28-8 A안 진짜 오픈월드는 다음 몫)이라 무한 대신
## 작은 폭으로 늘리는 쪽을 택했다 — REALM이 3→8→107로 단계를 밟은 것과
## 같은 결.
## **2026-09-14, 채광(cave) 이식 — 6→7로 한 칸 늘렸다.** 기존 6개(0~5)의
## kind·floor_num·보스 판정은 손 안 댔다(순서를 안 흔들고 뒤에 하나만
## 덧붙였다, REALM 3→8→107이 이미 쓴 것과 같은 "덧붙이기" 결) — 새 방
## (index6, floor7)은 `(7)%3!=0`이라 보스 판정에 안 걸린다.
const ROOM_COUNT := 7

## **2026-09-14, 51장 확장 이어서** — GO/DUNGEON/FOREST/STORY/REALM 다섯
## 판이 각자 "제외" 목록을 다 채운 뒤 REALM이 "다음은 밖을 고려할 자리"라고
## 적어 둔 것을 다시 좁혀, DUNGEON PLAN.md 51장 축("던전 증가→엘리트→
## 보스→장비→빌드")에서 실제로 안 옮긴 것을 웹판과 대조해 찾았다. 웹판
## `data-dungeon.js ROOMS`는 방 종류가 11갈래(fight·trove·well·shrine·
## elite·miniboss·cave·merchant·puzzle·event·forage, `dungeon.js
## pickRoomKind()`)인데 이 슬라이스는 지금까지 방마다 전부 "fight"뿐이었다
## — "보스"·"장비"는 이미 이 슬라이스에 상당히 있어 51장이 말하는 진짜
## 남은 폭은 방 종류 다양성 쪽이었다. 한 번에 11갈래를 다 옮기지 않고
## (토큰 절약 규칙 3) 가장 단순한 것부터: 상자(trove)·우물(well, 원작
## 손짓이 "닿으면 끝"이라 별도 UI가 안 필요함) 다음으로, **정예 소굴
## (elite)·미니보스(miniboss)** — 둘 다 이미 있는 정예 강제 굴림·보스
## 스폰을 방 단위로 쓰기만 하면 돼 새 UI가 필요 없었다. 보스층(3층·6층)은
## 그대로 fight 유지, 나머지 두 fight 방(0·4번)을 elite·miniboss로 바꿨다.
## **채광(cave)** — 원작 손짓("닿으면 재료 확정 지급")이 우물과 같은
## 구조라 이어서 옮겼다. 기존 6칸을 재배치하지 않고 7번째 방(index6)을
## 새로 붙였다(위 ROOM_COUNT 주석 참고) — cave는 새 자리를 요구하지
## 않고 fight 방 하나를 갈아 끼워도 됐지만, 이미 elite·trove·well·
## miniboss·fight×2로 여섯 자리가 다 찬 상태라 하나를 지우는 대신 늘리는
## 쪽이 "이미 검증된 방을 다시 안 건드린다"는 토큰 절약 규칙에 더 맞았다.
const ROOM_KINDS: Array[String] = ["elite", "trove", "fight", "well", "miniboss", "fight", "cave"]

## "제외" 목록 5번(인물 등용) — 방마다 실제 역사 인물 하나씩(saga_core
## 105명 중 새로 골랐다 — GO가 이미 kr_yisunsin을 쓰고 있어 안 겹치게).
## 둘 다 삼국지·rarity 5(기질이 처음엔 가려진다, GO의 "기질 불명 ❓"과
## 같은 경로도 같이 검증된다) — 하나는 virtue(은창), 하나는 wisdom(현책).
const ROOM_HERO_IDS: Array[String] = ["sg_zhaoyun", "sg_zhugeliang"]

## "제외" 목록 5번(출사표) — 웹판 starter.js의 문턱(희귀도 낮은 인물만
## 시작에 고른다)을 그대로 옮겼다. 원작은 정해진 셋을 주지만, 이 판은
## "누구를 등용했는가"가 핵심이라(root CLAUDE.md 첫 줄) 후보 중 직접
## 고르게 했다 — 새 UI가 아니라 기존 ChoicePrompt를 그대로 재사용.
const STARTER_PICK_COUNT := 3
const STARTER_POOL_SIZE := 5
const STARTER_RARITY_CAP := 3

const ROOM_HALF := Vector3(6.0, 0.0, 6.0)
const WALL_HEIGHT := 4.4
const WALL_THICK := 1.0
const GATE_HALF_WIDTH := 2.2 # gate.glb 실측 폭(4.4)의 절반

const CORRIDOR_TILE_LEN := 4.0 # corridor.glb 실측 깊이(측정 스크립트로 확인)
const CORRIDOR_TILES_PER_GAP := 2 # 방 사이 복도 길이 = 4.0 * 2 = 8.0
const CORRIDOR_HALF_WIDTH := 2.0 # corridor.glb 실측 폭의 절반
const CORRIDOR_GAP := CORRIDOR_TILE_LEN * CORRIDOR_TILES_PER_GAP
const ROOM_SPACING := ROOM_HALF.z * 2.0 + CORRIDOR_GAP # 방 원점 사이 거리(z)

var _exit_used: Array[bool] = []
var _room_origin_z: Array[float] = []
var _session_start_cleared := 0  # 표준 B(세션 카드) — 이번 세션에 새로 연 방 수 계산용


func _ready() -> void:
	## 가로 화면이면 UI 기준 크기를 바꿔 글자가 깨알만 하지 않게 + 기술 단추 줄이 길면 옆 줄로(hud_column_layout.gd).
	add_child(preload("res://saga_core/ui/orientation_scale.gd").new())
	add_child(preload("res://games/saga_dungeon/ui/hud_column_layout.gd").new())
	for i in range(ROOM_COUNT):
		var origin_z := -float(i) * ROOM_SPACING
		_room_origin_z.append(origin_z)
		_spawn_room_mesh(origin_z, i)
		_spawn_walls(origin_z, i > 0)
		_spawn_torch(origin_z)
		_spawn_gate(origin_z, true, i) # 북쪽(출구) 문은 방마다
		if i > 0:
			_spawn_gate(origin_z, false, i) # 남쪽(입구) 문 — 복도 쪽에서 보이는 면
			_spawn_corridor(origin_z + ROOM_SPACING, origin_z, i)
		_spawn_exit_trigger(origin_z, i)
		_exit_used.append(false)

	## GO의 test_village.gd::_ready()와 같은 순서 규칙(자식이 부모보다
	## 먼저 ready되므로 Player는 이미 트리에 있다) — 이미 클리어한 방이면
	## 잡졸을 다시 세우지 않는다(EventState의 "이미 끝난 사건은 되살아나지
	## 않는다"와 같은 경계, 이제 방마다 따로 확인한다).
	var loaded: bool = DungeonSaveState.try_load()
	for i in range(ROOM_COUNT):
		var cleared: bool = loaded and DungeonSaveState.is_room_cleared(i)
		if not cleared:
			var kind: String = ROOM_KINDS[i]
			if kind == "trove":
				## dungeon.js makeRoom() 'trove' 갈래 — "상자를 지키는 잡졸이
				## 있을 때도, 없을 때도 있다"(50% 확률), 정예·보스는 아니다.
				if randf() < 0.5:
					_spawn_enemy(_room_origin_z[i], i + 1, false)
				_spawn_chest(_room_origin_z[i], i + 1)
			elif kind == "well":
				## dungeon.js makeRoom() 'well' 갈래 — 지킴이 없이 우물만.
				_spawn_well(_room_origin_z[i])
			elif kind == "elite":
				_spawn_elite_den(_room_origin_z[i], i + 1)
			elif kind == "miniboss":
				_spawn_miniboss(_room_origin_z[i], i + 1)
			elif kind == "cave":
				_spawn_cave_vein(_room_origin_z[i], i + 1)
			else:
				## data-dungeon.js isBossFloor(floor)=floor%3==0 그대로 —
				## 마지막 방뿐 아니라 3층마다(이 슬라이스는 3층·6층) 보스가
				## 선다. trove·well이 아닌 방은 전부 이 'fight' 갈래다.
				_spawn_enemy(_room_origin_z[i], i + 1, (i + 1) % 3 == 0)
		else:
			## 클리어한 방을 불러오면 저장된 위치가 그 방의 출구 트리거
			## 안일 수 있다(마지막으로 나간 자리 그대로 복원하니까) —
			## _exit_used를 미리 true로 앉혀 두지 않으면 로드 직후 트리거가
			## 다시 걸려 매번 재저장(위치가 벽 depenetration으로 조금씩
			## 밀림)이 반복된다. 실제로 두 번째 프로세스 실행에서 이
			## 재발화를 헤드리스로 잡아냄(아래 검증 참고) — 추측이 아니라
			## 실측으로 찾은 문제다.
			_exit_used[i] = true
		## "제외" 목록 5번(인물 등용) — 이미 등용했거나(성공) 떠나보낸
		## (실패) 인물은 다시 세우지 않는다(위 잡졸의 rooms_cleared와 같은
		## 경계, hero_resolved).
		var hero_done: bool = loaded and DungeonSaveState.is_hero_resolved(i)
		if not hero_done and i < ROOM_HERO_IDS.size():
			_spawn_hero_encounter(_room_origin_z[i], i, ROOM_HERO_IDS[i])
	if loaded:
		var player: Node3D = get_tree().get_first_node_in_group("player")
		if player:
			player.global_position = DungeonSaveState.player_pos
	else:
		_maybe_show_starter_pick()

	## PLAN 101-2 DUNGEON ②(유품, 2026-09-17) — 껐다 켜도 마커가 남아
	## 있어야 한다(player_health.gd::_die_and_respawn()은 죽는 순간에만
	## 세운다 — 저장 파일을 새로 불러온 이번 자리에서는 여기서 대신 세운다).
	if DungeonGraveState.has_grave():
		LootPickup.spawn_grave_at(self, DungeonGraveState.grave_position())

	## "제외" 목록 6번(결사) — 지난 회차가 결사로 스러진 채 저장됐으면
	## (dungeon_hardcore_state.gd::fallen) 이번에 불러오자마자 바로 그
	## 자리에서 멈춘다 — player_health.gd::_fall()과 같은 얼림
	## (get_tree().paused = true), 다시 내려갈 수 없다는 웹판 enter()의
	## fallen() 가드와 같은 뜻이다.
	if not DungeonHardcoreState.fallen.is_empty():
		Toast.show(self, "☠️ 결사로 스러진 판입니다(제%d층) — 이어서 내려갈 수 없다." %
			int(DungeonHardcoreState.fallen.get("floor", 0)), 8.0)
		get_tree().paused = true

	## 표준 A/B(목표판·세션 카드, PLAN.md 101-4 공통 순서 1번, 2026-09-17) —
	## GO test_village.gd와 같은 자리(로드가 끝난 뒤 세션을 연다 — 세션
	## 델타의 기준점이 로드 전 값이면 안 된다).
	_session_start_cleared = DungeonSaveState.rooms_cleared.count(true)
	DungeonGoldState.begin_session()
	DungeonGoldState.gold_changed.connect(_refresh_goal_board)
	DungeonHordeState.horde_changed.connect(_refresh_goal_board)
	DungeonSigilState.sigil_changed.connect(_refresh_goal_board)
	_refresh_goal_board()

	## 101-3 G "동행 실루엣" — GO test_village.gd와 같은 배선(등용 인원 수만큼
	## Player 뒤를 따르는 실루엣, 전투·충돌 없음).
	var companions := CompanionFollow.new()
	add_child(companions)
	companions.setup(get_tree().get_first_node_in_group("player"))
	companions.set_count(DungeonPartyState.members.size())
	DungeonPartyState.party_changed.connect(func() -> void: companions.set_count(DungeonPartyState.members.size()))


## saga_core/ui/goal_board.gd는 DungeonSaveState·DungeonHordeState·
## DungeonSigilState를 모른다(GO test_village.gd 헤더와 같은 경계) — 이
## 판의 월드 스크립트가 셋을 조립해 넣는다. "지금"은 진행 중인 특수 모드
## (난입·부적 던전)가 있으면 그쪽을 우선 보여주고, 없으면 방 진행도.
## "이번 주"는 DUNGEON에도 주간 축이 없어 GO와 같은 이유로 "—".
func _refresh_goal_board() -> void:
	var board := get_tree().get_first_node_in_group("goal_board")
	if board == null:
		return
	var now: String
	if DungeonHordeState.active:
		now = "난입 — 파도 %d" % DungeonHordeState.wave
	elif DungeonSigilState.is_active():
		now = "부적 던전 — 티어 %d" % int(DungeonSigilState.active_sigil().get("tier", 0))
	else:
		now = "방 클리어 %d/%d" % [DungeonSaveState.rooms_cleared.count(true), ROOM_COUNT]
	var session := "금 +%d · 새로 연 방 +%d" % [
		DungeonGoldState.session_gold_gained(),
		DungeonSaveState.rooms_cleared.count(true) - _session_start_cleared]
	board.set_goals(now, session, "—")


func _spawn_room_mesh(origin_z: float, room_index: int) -> void:
	var glb: String = MOOD_ROOM_GLB.get(_mood_for_room(room_index), ROOM_GLB)
	var mesh := GLBUtils.extract_mesh(glb)
	if mesh == null:
		return
	var mi := MeshInstance3D.new()
	mi.name = "RoomMesh"
	mi.mesh = mesh
	mi.position = Vector3(0, 0, origin_z)
	add_child(mi)

	var floor_body := StaticBody3D.new()
	floor_body.name = "FloorCollision"
	var floor_cs := CollisionShape3D.new()
	var floor_box := BoxShape3D.new()
	floor_box.size = Vector3(ROOM_HALF.x * 2, 0.4, ROOM_HALF.z * 2)
	floor_cs.shape = floor_box
	floor_body.position = Vector3(0, -0.2, origin_z)
	floor_body.add_child(floor_cs)
	add_child(floor_body)


## 09-20 조명 버그 — `TestRoom.tscn`에 방 하나 몫(원점) 횃불만 고정으로
## 박혀 있어 ROOM_SPACING(20m)만큼 떨어진 나머지 6개 방은 앰비언트뿐이라
## 실기에서 새까맣게 보였다(PROJECT_STATE "DUNGEON 조명 부족"). 방마다
## 하나씩 원점에 심는 걸로 고친다 — energy도 1.4→3.2로 올렸다(env_pc.tres
## tonemap AgX가 Reinhard보다 중간톤을 어둡게 눌러 같은 수치가 더
## 어두워 보인다, 다섯 판 공유 env라 여기서 못 올리고 광원 쪽에서 보정).
func _spawn_torch(origin_z: float) -> void:
	var torch := OmniLight3D.new()
	torch.name = "Torch"
	torch.position = Vector3(0, 3.5, origin_z)
	torch.light_color = Color(1.0, 0.78, 0.5)
	torch.light_energy = 3.2
	torch.omni_range = 14.0
	torch.shadow_enabled = true
	add_child(torch)


## 벽 넷 중 북쪽(-z, 출구)은 항상 틈을 남긴다. 남쪽(+z)은 첫 방(입구가
## 필요 없다)만 온전히 막고, 나머지 방은 복도로 이어지는 틈을 같은
## 자리에 남긴다(`has_south_gap`).
func _spawn_walls(origin_z: float, has_south_gap: bool) -> void:
	if has_south_gap:
		var side_len_s: float = ROOM_HALF.x - GATE_HALF_WIDTH
		if side_len_s > 0.0:
			var side_center_x_s: float = GATE_HALF_WIDTH + side_len_s * 0.5
			_wall(Vector3(side_len_s, WALL_HEIGHT, WALL_THICK),
				Vector3(side_center_x_s, WALL_HEIGHT * 0.5, origin_z + ROOM_HALF.z + WALL_THICK * 0.5))
			_wall(Vector3(side_len_s, WALL_HEIGHT, WALL_THICK),
				Vector3(-side_center_x_s, WALL_HEIGHT * 0.5, origin_z + ROOM_HALF.z + WALL_THICK * 0.5))
	else:
		_wall(Vector3(ROOM_HALF.x * 2, WALL_HEIGHT, WALL_THICK),
			Vector3(0, WALL_HEIGHT * 0.5, origin_z + ROOM_HALF.z + WALL_THICK * 0.5))

	_wall(Vector3(WALL_THICK, WALL_HEIGHT, ROOM_HALF.z * 2),
		Vector3(ROOM_HALF.x + WALL_THICK * 0.5, WALL_HEIGHT * 0.5, origin_z))
	_wall(Vector3(WALL_THICK, WALL_HEIGHT, ROOM_HALF.z * 2),
		Vector3(-ROOM_HALF.x - WALL_THICK * 0.5, WALL_HEIGHT * 0.5, origin_z))

	var side_len: float = ROOM_HALF.x - GATE_HALF_WIDTH
	if side_len > 0.0:
		var side_center_x: float = GATE_HALF_WIDTH + side_len * 0.5
		_wall(Vector3(side_len, WALL_HEIGHT, WALL_THICK),
			Vector3(side_center_x, WALL_HEIGHT * 0.5, origin_z - ROOM_HALF.z - WALL_THICK * 0.5))
		_wall(Vector3(side_len, WALL_HEIGHT, WALL_THICK),
			Vector3(-side_center_x, WALL_HEIGHT * 0.5, origin_z - ROOM_HALF.z - WALL_THICK * 0.5))


func _wall(size: Vector3, pos: Vector3) -> void:
	var body := StaticBody3D.new()
	body.position = pos
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	cs.shape = box
	body.add_child(cs)
	add_child(body)


## at_north=true면 그 방의 출구(북쪽, -z), false면 입구(남쪽, +z) — 같은
## gate.glb를 방향만 반대로 놓는다(아치는 앞뒤가 대칭이라 뒤집을 필요 없음).
func _spawn_gate(origin_z: float, at_north: bool, room_index: int) -> void:
	var glb: String = MOOD_GATE_GLB.get(_mood_for_room(room_index), GATE_GLB)
	var mesh := GLBUtils.extract_mesh(glb)
	if mesh == null:
		return
	var mi := MeshInstance3D.new()
	mi.name = "ExitGate" if at_north else "EntranceGate"
	## 2026-09-23 발견 — 2026-09-12 "여러 방 연결" 리팩터(1ea68c57, at_north
	## 인자 추가)가 `mi.mesh = mesh`를 빠뜨렸다(git blame으로 확인, 그 전엔
	## 있었다). 그날부터 지금까지 문 아치가 실제로는 한 번도 렌더된 적 없는
	## 빈 MeshInstance3D였다는 뜻 — mood 배선과 무관한 기존 버그라 별도로
	## 고친다.
	mi.mesh = mesh
	var z_off: float = -ROOM_HALF.z if at_north else ROOM_HALF.z
	mi.position = Vector3(0, 0, origin_z + z_off)
	add_child(mi)


## from_z(앞 방의 출구 쪽, 더 큰 z)에서 to_z(다음 방의 입구, 더 작은 z)
## 까지 corridor.glb 타일을 이어 붙인다 + 옆벽·바닥 충돌(GLB 자체엔 충돌이
## 없다 — room-small.glb·gate.glb와 같은 이유).
func _spawn_corridor(from_z: float, to_z: float, room_index: int) -> void:
	var start_z: float = from_z - ROOM_HALF.z # 앞 방 북쪽 벽
	var glb: String = MOOD_CORRIDOR_GLB.get(_mood_for_room(room_index), CORRIDOR_GLB)
	var mesh := GLBUtils.extract_mesh(glb)
	for i in range(CORRIDOR_TILES_PER_GAP):
		var tile_center_z: float = start_z - CORRIDOR_TILE_LEN * (i + 0.5)
		if mesh != null:
			var mi := MeshInstance3D.new()
			mi.name = "CorridorTile%d" % i
			mi.mesh = mesh
			mi.position = Vector3(0, 0, tile_center_z)
			add_child(mi)

	var corridor_len: float = start_z - (to_z + ROOM_HALF.z) # 항상 CORRIDOR_GAP과 같음
	var corridor_center_z: float = (start_z + (to_z + ROOM_HALF.z)) * 0.5
	var floor_body := StaticBody3D.new()
	floor_body.name = "CorridorFloor"
	var floor_cs := CollisionShape3D.new()
	var floor_box := BoxShape3D.new()
	floor_box.size = Vector3(CORRIDOR_HALF_WIDTH * 2, 0.4, corridor_len)
	floor_cs.shape = floor_box
	floor_body.position = Vector3(0, -0.2, corridor_center_z)
	floor_body.add_child(floor_cs)
	add_child(floor_body)

	_wall(Vector3(WALL_THICK, WALL_HEIGHT, corridor_len),
		Vector3(CORRIDOR_HALF_WIDTH + WALL_THICK * 0.5, WALL_HEIGHT * 0.5, corridor_center_z))
	_wall(Vector3(WALL_THICK, WALL_HEIGHT, corridor_len),
		Vector3(-CORRIDOR_HALF_WIDTH - WALL_THICK * 0.5, WALL_HEIGHT * 0.5, corridor_center_z))


func _spawn_exit_trigger(origin_z: float, room_index: int) -> void:
	var area := Area3D.new()
	area.name = "ExitTrigger%d" % room_index
	area.position = Vector3(0, 1.0, origin_z - ROOM_HALF.z - 1.0)
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(GATE_HALF_WIDTH * 2, 3.0, 2.0)
	cs.shape = shape
	area.add_child(cs)
	add_child(area)
	## .bind()는 인자를 그 자리에서 바로 값으로 굳힌다 — 아래 은사 콜백
	## 람다에서 실제로 밟은 "생성 시점 값 캡처" 문제와 달리 여기 room_index는
	## 지역 변수가 아니라 함수 매개변수라 안전하다.
	area.body_entered.connect(_on_exit_entered.bind(room_index))


## "제외" 목록 1번(은사) — 웹판 dungeon.js의 descend()가 층을 내려가기 전에
## 은사 셋 중 하나를 고르게 하는 것과 같은 자리. 방마다(각 방의 출구에서)
## 한 번씩 고른다(웹판이 "층 클리어마다" 은사를 주는 것과 같은 리듬) —
## 마지막 방만 완주 저장을 겸한다.
func _on_exit_entered(body: Node3D, room_index: int) -> void:
	if _exit_used[room_index] or not body.is_in_group("player"):
		return
	_exit_used[room_index] = true
	var is_final: bool = room_index == ROOM_COUNT - 1
	var choice := DungeonRunState.roll_choice()
	if choice.is_empty():
		## 모든 은사가 상한까지 찬 드문 경우 — 고를 게 없으니 그냥 나간다.
		_finish_exit(body, room_index, is_final)
		return
	## GDScript 람다는 바깥 지역 변수를 "생성 시점 값"으로 캡처한다 —
	## `layer`를 ChoicePrompt.build() 호출 **전에** 만든 콜백에서 그대로
	## 참조하면 항상 null을 캡처한다(실측으로 확인: "Cannot call method
	## 'queue_free' on a null value"). Dictionary는 참조 타입이라 그 안에
	## 나중에 채워 넣으면 콜백도 같은 내용을 보게 된다 — 그 우회로 고쳤다.
	var layer_box := {}
	var choices: Array = []
	## PLAN 101-2 DUNGEON ①(축복 3택, 2026-09-17) — 카드에 축 아이콘·희귀도를
	## 얹는다(웹 5.1 "카드 위 축 아이콘·희귀도 테두리색"을 이 판의 단순 버튼
	## UI 결에 맞춰 라벨 텍스트로 근사 — 새 UI를 안 만든다).
	var axis_icons := {"skill": "🗡️", "hero": "👤", "world": "🌐"}
	var rarity_tags := {"common": "", "rare": "[희귀] ", "legendary": "[전설] "}
	for key in choice:
		var b := DungeonBoons.by_key(key)
		var axis_icon: String = axis_icons.get(str(b.get("axis", "")), "")
		var rarity_tag: String = rarity_tags.get(str(b.get("rarity", "common")), "")
		choices.append({
			"label": "%s %s%s %s — %s" % [axis_icon, rarity_tag, b.emoji, b.name, b.desc],
			"cb": func() -> void: _on_boon_picked(key, body, layer_box, room_index, is_final),
		})
	## 5.1 "거절" — 골드를 즉시 넣고 라벨에 그 값을 미리 보여 준다.
	var reject_gold: int = (room_index + 1) * 30
	choices.append({
		"label": "🚫 거절 — 금 %d" % reject_gold,
		"cb": func() -> void: _on_boon_rejected(body, layer_box, room_index, is_final),
	})
	layer_box["layer"] = ChoicePrompt.build(self, "🎴 은사를 고르세요", choices)


func _on_boon_picked(key: String, body: Node3D, layer_box: Dictionary, room_index: int, is_final: bool) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	DungeonRunState.apply_boon(key)
	_finish_exit(body, room_index, is_final)


func _on_boon_rejected(body: Node3D, layer_box: Dictionary, room_index: int, is_final: bool) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var gold := DungeonRunState.reject_choice(room_index)
	Toast.show(self, "🚫 은사를 거절하고 금 %d 을(를) 얻었다." % gold, 3.0)
	_finish_exit(body, room_index, is_final)


## 방마다 진행 상황을 저장한다(중간에 그만둬도 이미 클리어한 방은 안
## 되풀이된다) — 마지막 방만 "이번 슬라이스는 여기까지" 토스트를 겸한다
## (VERTICAL_SLICE_DUNGEON.md 완료 조건 8단계의 마지막 자리).
##
## "제외" 목록 2번(내구) — item.js::wearAll(), "층을 내려갈 때마다 1
## 닳는다"를 그대로 여기(방 출구 = descend)에서 부른다. **수리(修理)는
## 이번 세션에 안 붙인다** — repairCost()가 price()(물건 값어치)를 필요로
## 하는데 이 슬라이스엔 아직 골드 시스템이 없다("제외" 목록 3번 몫). 부서진
## 장비는 그냥 다음 노획으로 갈아 들 때까지 능력치를 못 낸다(원작처럼
## 사라지지는 않는다).
func _finish_exit(body: Node3D, room_index: int, is_final: bool) -> void:
	var broke := DungeonEquipmentState.wear_all(1.0)
	for slot_name in broke:
		var it := DungeonEquipmentState.item_for(slot_name)
		Toast.show(self, "🔧 %s 이(가) 부서졌다 — 새로 주울 때까지 능력치를 못 낸다." % DungeonItems.item_name(it), 4.0)
	## PLAN.md 51장 "장비→빌드"(2026-09-14) — 원작은 "인물 레벨만큼" 무예
	## 점수를 주지만 이 슬라이스엔 인물 레벨이 없다. 은사와 같은 리듬(방
	## 클리어마다 하나)을 그대로 빌려, 그 순간 장착 중인 무기가 정하는
	## 직업에 점 하나를 준다(dungeon_skill_state.gd 헤더 참고).
	var cls_key := DungeonItems.class_key_for_weapon(DungeonEquipmentState.weapon)
	DungeonSkillState.award_point(cls_key)
	DungeonSaveState.mark_room_cleared(room_index)
	## PLAN 101-2 DUNGEON ④(부적 던전, 2026-09-17) — 이 슬라이스의 "클리어"
	## = 마지막 방(is_final)에 부적을 켠 채로 닿았을 때(dungeon_sigil_
	## state.gd::clear_run() 헤더 참고). 저장 앞에 둬야 다음 티어 부적이
	## 나왔으면 그것도 같이 저장된다.
	if is_final and DungeonSigilState.is_active():
		var cleared_tier: int = int(DungeonSigilState.active_sigil().get("tier", 0))
		DungeonSigilState.clear_run()
		Toast.show(self, "🔺 부적 던전(티어 %d) 완주 — 부적이 꺼졌다." % cleared_tier, 5.0)
	DungeonSaveState.save(body)
	_refresh_goal_board()
	## 표준 B(세션 마무리 카드, PLAN.md 101-4) — GO save_button.gd와 같은
	## 문구("저장했다 — 이번 세션"). DUNGEON엔 수동 저장 버튼이 없어(방
	## 출구 = 자동 저장) 마지막 방(이번 슬라이스의 자연스러운 "세션 끝")
	## 에서만 카드로, 중간 방은 계속 토스트로 남긴다(매 방마다 모달을
	## 띄우면 7번 연속 막혀 손맛을 해친다).
	if is_final:
		SessionCard.show(self, "저장했다 — 이번 세션", [
			"금 +%d" % DungeonGoldState.session_gold_gained(),
			"새로 연 방 +%d" % (DungeonSaveState.rooms_cleared.count(true) - _session_start_cleared),
			"부대 %d명" % DungeonPartyState.members.size(),
		])
	else:
		Toast.show(self, "다음 방으로 향한다 — 진행 상황을 저장했다.", 3.0)


## dungeon.js makeRoom() 'trove' 갈래 — `dropItem(room, chest.x, chest.y, 22)`를
## 1~2회(원작 `1 + Math.floor(Math.random()*2)`), `dropGold(...,3)`가 같이
## 따라붙는다. **정직하게 밝혀 둔다** — 이 슬라이스의 `LootPickup.spawn_at()`은
## 원작처럼 "물건 굴림 bias"와 "골드 배율"을 따로 받지 않고 boss/elite
## 플래그 하나로 묶여 있다(dungeon_enemy.gd가 정예·보스를 그렇게 이식해
## 둔 그대로). bias=22를 ilvl에 그대로 더하면(=floor_num+22) 골드 계산도
## 같은 ilvl을 타 넘겨(지수 배율이라) 수십 배로 튀므로 그렇게 하지 않았다
## — 대신 이미 검증된 정예(elite) 갈래(ilvl+14·금×2.2)를 재사용해 "상자는
## 정예급 노획을 준다"로 근사했다. 새 bias 상수를 만들어 물건과 골드
## 계산을 갈라 정확히 22를 맞추는 것은 다음에 더 좁힐 자리로 남긴다.
func _spawn_chest(origin_z: float, floor_num: int) -> void:
	var bonus_count := 1 + (1 if randf() < 0.5 else 0)
	for b in range(bonus_count):
		LootPickup.spawn_at(self, Vector3(2.6 + float(b) * 1.1, 0, origin_z), floor_num, false, true)
	Toast.show(self, "🎁 보물상자!", 3.0)


## dungeon.js 우물 손짓 그대로 — `healBy(run.hpMax * 0.4)`, 한 번만 쓸 수
## 있다(area.queue_free()로 자기 자신을 지운다, loot_pickup.gd의 픽업들과
## 같은 "한 번 닿으면 끝" 방식).
func _spawn_well(origin_z: float) -> void:
	var area := Area3D.new()
	area.name = "Well"
	area.position = Vector3(2.6, 1.0, origin_z)
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 1.4
	cs.shape = shape
	area.add_child(cs)
	var mi := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.9
	mesh.bottom_radius = 0.9
	mesh.height = 0.6
	mi.mesh = mesh
	mi.position = Vector3(0, 0.3, 0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.25, 0.55, 0.85) # dungeon.js potion.js 'heal' 계열과 구분되는 우물색(물)
	mi.material_override = mat
	area.add_child(mi)
	add_child(area)
	area.body_entered.connect(func(body: Node3D) -> void:
		if not body.is_in_group("player"):
			return
		var hp_node: Node = get_tree().get_first_node_in_group("player_health")
		if hp_node:
			hp_node.heal_by(float(hp_node.max_hp) * 0.4)
		Toast.show(area, "💧 우물 · 체력 40% 회복", 3.0)
		area.queue_free()
	)


## dungeon.js makeRoom() 'cave' 갈래(POI: Cave, PLAN 12절 "희귀 광석") —
## 35% 확률 지킴이(우물·상자와 같은 확률형 지킴이) + 광맥은 세공 재료를
## 확정으로 둘 낸다(`dropMat` 두 번 그대로). **정직하게 밝혀 둔다** —
## 원작 `dropMat(room, x, y, 26)`의 bias=26은 이 슬라이스에 안 옮긴다.
## `DungeonItems.roll_material_drop(floor_num)`가 애초에 bias 인자를
## 안 받는 형태로 이미 단순화돼 있다(loot_pickup.gd 헤더의 "이중 구조를
## 하나로 수렴시켰다"는 결정 그대로, 이번에 새로 만든 문제가 아니다) —
## 그래서 bias 없이 floor_num만 두 번 굴린다.
func _spawn_cave_vein(origin_z: float, floor_num: int) -> void:
	if randf() < 0.35:
		_spawn_enemy(origin_z, floor_num, false)
	LootPickup.spawn_mat_at(self, Vector3(2.6, 0, origin_z), floor_num)
	LootPickup.spawn_mat_at(self, Vector3(3.6, 0, origin_z), floor_num)
	Toast.show(self, "⛏️ 광맥 · 세공 재료를 캤다", 3.0)


func _spawn_enemy(origin_z: float, floor_num: int, is_boss: bool = false) -> void:
	_spawn_enemy_at(Vector3(0, 0, origin_z - 1.5), floor_num, is_boss, true, false)


## `_spawn_enemy()`가 쓰는 공용 자리 — 정예 소굴(elite)이 같은 방에 둘째
## 자리(다른 pos)를 더 쓰려고 갈라냈다(재사용, 새 스폰 경로를 안 만든다).
## grant_hero_reward=false면 is_boss=true라도 `_on_boss_defeated`(인물
## 자동 합류)를 안 건다 — 미니보스는 보스급 노획만 주고 인물 보상은
## 진짜 층 끝 보스 전용으로 남겨 둔다(dungeon.js miniboss 주석 "따로 더
## 챙길 것은 없다" 그대로).
func _spawn_enemy_at(pos: Vector3, floor_num: int, is_boss: bool, grant_hero_reward: bool, force_elite: bool) -> void:
	var enemy: CharacterBody3D = DungeonEnemy.new(floor_num, is_boss, false, force_elite)
	enemy.position = pos
	add_child(enemy)
	if is_boss and grant_hero_reward:
		## LEGACY_FEATURE_AUDIT.md KEEP "인물은 던전에서 등용(출사표3+보스층
		## 합류)" 의 후반부 — 2026-09-12㉔가 "7번이 생긴 뒤로 미룬다"고
		## 남겨 둔 그 경로. game.js bossReward()를 그대로 옮긴다: 보스가
		## 죽는 순간(문을 나가는 시점이 아니라) 인물 하나가 자동으로 합류.
		enemy.died.connect(_on_boss_defeated.bind(floor_num - 1))


## dungeon.js makeRoom() 'elite' 갈래 — 원작은 3~8마리(정예 하나 강제+
## 나머지 일반) 무리지만, 이 슬라이스는 fight 방이 이미 "방당 1마리"로
## 크게 줄여 둔 상태라(원작 4~12마리 대신) 같은 비율로 줄여 **정예 1
## (강제)+일반 1 = 2마리**로 잡았다 — 새 밀도를 상상하지 않고 기존 fight
## 방보다 확실히 붐빈다는 것만 살린다.
func _spawn_elite_den(origin_z: float, floor_num: int) -> void:
	_spawn_enemy_at(Vector3(0, 0, origin_z - 1.5), floor_num, false, true, true)
	_spawn_enemy_at(Vector3(1.8, 0, origin_z - 0.6), floor_num, false, true, false)


## dungeon.js makeRoom() 'miniboss' 갈래 — 부하 없이 혼자, 보스급 노획
## (`loot_pickup.gd`가 is_boss만 보고 이미 챙겨 준다). 인물 자동 합류는
## 위 `_spawn_enemy_at()` 주석 참고 — 진짜 층 끝 보스에만 남긴다.
func _spawn_miniboss(origin_z: float, floor_num: int) -> void:
	_spawn_enemy_at(Vector3(0, 0, origin_z - 1.5), floor_num, true, false, false)


## room_index별 hero_resolved를 재사용한다 — 뜻은 다르지만("설득 성공/실패"
## 대신 "보스 격파로 자동 합류") "이 방의 인물 관련 사건이 끝났다"는 같은
## 경계라 새 저장 필드를 안 만든다. rooms_cleared[room_index]가 이미
## enemy 재생성을 막고(§ _ready 위쪽), 저장은 그 방을 나갈 때(`_finish_exit`)
## 이 값과 함께 한 번에 기록되므로 이중 지급 경로가 없다.
func _on_boss_defeated(room_index: int) -> void:
	if DungeonSaveState.is_hero_resolved(room_index):
		return
	DungeonSaveState.mark_hero_resolved(room_index)
	var floor_num: int = room_index + 1
	## game.js bossReward()의 등급 상한 그대로: floor>=21→5·>=12→4·>=6→3·그외 2.
	var max_rarity: int = 5 if floor_num >= 21 else (4 if floor_num >= 12 else (3 if floor_num >= 6 else 2))
	var pool: Array[Dictionary] = []
	for h: Dictionary in Characters.HEROES:
		if int(h.rarity) <= max_rarity and not DungeonPartyState.members.has(str(h.id)):
			pool.append(h)
	## game.js pickNewHero()가 다 모았으면(pool 없음) 중복으로라도 준다.
	var hero: Dictionary = (pool[randi() % pool.size()] if not pool.is_empty()
		else Characters.HEROES[randi() % Characters.HEROES.size()])
	DungeonPartyState.recruit(str(hero.id))
	Toast.show(self, "🤝 %s(%s) 합류! (제%d층 보스 격파)" % [str(hero.name), str(hero.hanja), floor_num], 4.0)


## "제외" 목록 5번(인물 등용) — 잡졸은 방 중심에서 북쪽(출구 쪽, -z)으로
## 살짝 치우쳐 있고 출구 트리거는 더 북쪽이라(_spawn_exit_trigger), 인물은
## 반대로 남쪽(입구 쪽, +z)에 옆으로 비켜(x=±3.5) 세운다 — 걸어 들어오자마자
## 잡졸과 겹치지 않게, 복도 폭(±2.0) 밖이라 지나가는 길도 안 막는다.
func _spawn_hero_encounter(origin_z: float, room_index: int, hero_id: String) -> void:
	var encounter: Node3D = DungeonHeroEncounter.new(hero_id, room_index)
	var side: float = 3.5 if room_index % 2 == 0 else -3.5
	encounter.position = Vector3(side, 0, origin_z + 2.0)
	add_child(encounter)


## "제외" 목록 5번(출사표) — 새 저장(불러온 게 없을 때)에만 딱 한 번,
## 함께할 인물 셋을 순서대로 고른다. 웹판 starter.js의 희귀도 문턱
## (rarity ≤ STARTER_RARITY_CAP)을 그대로 쓰되, 원작처럼 정해진 셋을
## 주는 대신 후보 다섯 중 직접 고르게 했다(위 상수 주석 참고).
func _maybe_show_starter_pick() -> void:
	var pool: Array[Dictionary] = []
	for h: Dictionary in Characters.HEROES:
		if int(h.rarity) <= STARTER_RARITY_CAP:
			pool.append(h)
	pool.shuffle()
	var candidates: Array[Dictionary] = pool.slice(0, mini(STARTER_POOL_SIZE, pool.size()))
	_show_starter_round(candidates, 1)


func _show_starter_round(candidates: Array[Dictionary], round_num: int) -> void:
	if candidates.is_empty() or round_num > STARTER_PICK_COUNT:
		Toast.show(self, "출사표를 마쳤다 — 부대 %d명." % DungeonPartyState.members.size(), 3.0)
		return
	## test_room.gd의 은사 선택지와 같은 "생성 시점 값 캡처" 우회(위
	## _on_exit_entered 주석 참고) — layer_box에 나중에 채워 넣는다.
	var layer_box := {}
	var choices: Array = []
	for h: Dictionary in candidates:
		choices.append({
			"label": "%s %s(%s) · %s·%s" % [h.emoji, h.name, h.hanja, h.era, h.faction],
			"cb": func() -> void: _on_starter_picked(h, candidates, round_num, layer_box),
		})
	layer_box["layer"] = ChoicePrompt.build(
		self, "📜 출사표 — 함께할 인물을 고르세요 (%d/%d)" % [round_num, STARTER_PICK_COUNT], choices)


func _on_starter_picked(hero: Dictionary, candidates: Array[Dictionary], round_num: int, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	DungeonPartyState.recruit(str(hero.id))
	candidates.erase(hero)
	_show_starter_round(candidates, round_num + 1)
