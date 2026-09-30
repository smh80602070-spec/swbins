extends SagaSaveBase

## VERTICAL_SLICE_DUNGEON.md 완료 조건의 마지막 단계 — "저장한다 → 다시
## 켜서 이어진다". GO의 save_state.gd와 같은 정신(로컬 파일 하나, 버전
## 필드)이지만 **파일·스키마를 완전히 분리한다** — PartyState/SaveState는
## GO 전용 형태(플레이어 위치+등용 인원)라 그대로 못 쓴다는 게
## 2026-09-12⑫ 조사 때 이미 나온 결론이었다. 공용 세이브 스키마로 합칠지는
## 아직 미결(LEGACY_FEATURE_AUDIT.md 4장)이지만, 파일을 분리해 두면 지금
## 당장 서로 안 건드리는 것만은 확실하고 나중에 합치기도 어렵지 않다.
##
## project.godot [autoload]에 DungeonSaveState로 등록.

const SAVE_PATH := "user://save_dungeon.json"
const SafeFile := preload("res://saga_core/data/safe_file.gd")  # 임시 파일 → .bak → 바꿔치기(쓰는 도중 꺼져도 직전본이 남는다)
const SAVE_VERSION := 2


func save_version() -> int:
	return SAVE_VERSION


func save_path() -> String:
	return SAVE_PATH


## "제외" 목록 2번(여러 방 연결) — 방 하나짜리 `room_cleared: bool`을
## 방마다 하나씩인 `rooms_cleared: Array[bool]`로 바꿨다. 기존 필드의
## "모양"이 바뀌는 진짜 스키마 변경이라(GO save_state.gd의 기준과 같음
## — 추가만이면 버전을 안 올리지만 이건 바꿔치기다) SAVE_VERSION을 1→2로
## 올리고 아래 `_migrate_step()`에 옛 `room_cleared` 하나를
## `rooms_cleared[0]`로 옮기는 경로를 처음으로 채웠다.
var rooms_cleared: Array[bool] = []
var player_pos := Vector3.ZERO

## "제외" 목록 5번(인물 등용) — 방마다 있는 역사 인물 조우가 해결됐는지
## (등용 성공 또는 설득 실패, 둘 다 "다시 안 뜬다") — rooms_cleared와
## 완전히 같은 모양(방마다 하나씩인 bool 배열)이라 같은 패턴을 그대로
## 옮겼다. 순수 추가 필드라 버전은 안 올린다.
var hero_resolved: Array[bool] = []


func is_room_cleared(index: int) -> bool:
	return index < rooms_cleared.size() and rooms_cleared[index]


func mark_room_cleared(index: int) -> void:
	while rooms_cleared.size() <= index:
		rooms_cleared.append(false)
	rooms_cleared[index] = true


func is_hero_resolved(index: int) -> bool:
	return index < hero_resolved.size() and hero_resolved[index]


func mark_hero_resolved(index: int) -> void:
	while hero_resolved.size() <= index:
		hero_resolved.append(false)
	hero_resolved[index] = true


func save(player: Node3D) -> void:
	player_pos = player.global_position
	var data := {
		"version": SAVE_VERSION,
		"rooms_cleared": rooms_cleared,
		"player_pos": [player_pos.x, player_pos.y, player_pos.z],
		## §"제외" 1번(은사) — GO의 save_state.gd와 같은 경계(순수 추가
		## 필드는 SAVE_VERSION을 안 올린다, 없으면 빈 Dictionary로 안전하게
		## 채워짐).
		"boons": DungeonRunState.boons,
		## §"제외" 3번(장비 등급+접사) — 같은 경계, 순수 추가 필드.
		"weapon": DungeonEquipmentState.weapon,
		## §"제외" 2번(소켓+부문어·투장·내구) — 부적(charm)도 무기와 같은
		## 경계(순수 추가 필드). 소켓(sock)·내구(dur)·세트(set)는 weapon/
		## charm 안에 이미 들어 있어 따로 안 적는다(item Dictionary 그대로
		## 저장). 부문(룬) 주머니는 별도 최상위 필드.
		"charm": DungeonEquipmentState.charm,
		## PLAN.md 51장 "장비→빌드"(2026-09-14) — 갑주도 같은 경계(순수
		## 추가 필드, 버전 안 올림).
		"armor": DungeonEquipmentState.armor,
		## 같은 날 이어서 — 남은 다섯 부위도 전부 순수 추가 필드(버전 안 올림).
		"helm": DungeonEquipmentState.helm,
		"glove": DungeonEquipmentState.glove,
		"boot": DungeonEquipmentState.boot,
		"ring": DungeonEquipmentState.ring,
		"neck": DungeonEquipmentState.neck,
		"runes": DungeonMaterialsState.rune_counts,
		## §"제외" 3번(행상/투전/연단·단약/요대·감정·창고) — 전부 순수
		## 추가 필드(창고는 안 만들었으니 저장할 것도 없다).
		"scrolls": DungeonMaterialsState.scrolls,
		"gold": DungeonGoldState.gold,
		"belt": DungeonPotionState.belt,
		## §"제외" 4번(원소 6결+저항) — 순수 추가 필드, 버전 안 올림.
		"gems": DungeonMaterialsState.gem_counts,
		"jewels": DungeonMaterialsState.jewels,
		## §"제외" 5번(인물 등용) — 순수 추가 필드, 버전 안 올림.
		"hero_resolved": hero_resolved,
		"party_members": DungeonPartyState.members,
		## §"제외" 6번(결사) — 순수 추가 필드, 버전 안 올림.
		"hardcore": DungeonHardcoreState.hardcore,
		"fallen": DungeonHardcoreState.fallen,
		## PLAN.md 51장 "장비→빌드"(2026-09-14) — 무예 랭크도 순수 추가
		## 필드(버전 안 올림).
		"skill_points": DungeonSkillState.points,
		"skill_ranks": DungeonSkillState.ranks,
		## PLAN 101-2 DUNGEON ②(유품, 2026-09-17) — 순수 추가 필드(버전 안
		## 올림). {} 면 유품 없음(dungeon_grave_state.gd 참고).
		"grave": DungeonGraveState.grave,
		## PLAN 101-2 DUNGEON ④(부적 던전, 2026-09-17) — 순수 추가 필드
		## (버전 안 올림). dungeon_sigil_state.gd 참고.
		"sigils": DungeonSigilState.sigils,
		"sigil_active": DungeonSigilState.active_index,
		"sigil_best": DungeonSigilState.best_tier_cleared,
		"sigil_next_id": DungeonSigilState.next_id_for_save(),
		## PLAN 101-2 DUNGEON ⑤(난입, 2026-09-17) — 순수 추가 필드(버전 안
		## 올림). 웹 5.5 "save.dungeon.horde = {best, runs}" 그대로 — 진행
		## 중 상태(active·wave 등)는 회차를 안 넘겨(dungeon_horde_state.gd
		## 헤더 참고) 저장하지 않는다.
		"horde_best": DungeonHordeState.best_survive_sec,
		"horde_runs": DungeonHordeState.runs,
		## PLAN 101-2 DUNGEON ⑥(월드 보스, 2026-09-17) — 순수 추가 필드
		## (버전 안 올림). "마지막으로 보상한 슬롯"만 저장(dungeon_worldboss_
		## state.gd 헤더 참고 — 슬롯은 벽시계로만 늘어나 이 값 하나로 "같은
		## 슬롯 두 번 보상 안 함"이 계속 유지된다).
		"worldboss_last_slot": DungeonWorldBossState.last_rewarded_slot,
	}
	SafeFile.write_text(SAVE_PATH, JSON.stringify(data))


## GO의 save_state.gd::try_load()와 같은 계약 — 있으면 읽어서 true,
## 없거나 마이그레이션 경로가 없거나 깨져 있으면 false(안전하게 포기).
func try_load() -> bool:
	var parsed: Variant = SafeFile.read_json(SAVE_PATH)
	if parsed == null:
		return false
	var migrated: Variant = _migrate(parsed)
	if migrated == null:
		return false
	var data: Dictionary = migrated

	var rc: Variant = data.get("rooms_cleared", [])
	rooms_cleared.clear()
	if rc is Array:
		for v in rc:
			rooms_cleared.append(bool(v))

	var hr: Variant = data.get("hero_resolved", [])
	hero_resolved.clear()
	if hr is Array:
		for v in hr:
			hero_resolved.append(bool(v))

	var p: Variant = data.get("player_pos", [0.0, 0.0, 0.0])
	if not (p is Array) or p.size() < 3:
		return false # 손상된 저장 파일 — 인덱스 에러 대신 안전하게 포기
	player_pos = Vector3(p[0], p[1], p[2])
	var boons: Variant = data.get("boons", {})
	DungeonRunState.restore(boons if typeof(boons) == TYPE_DICTIONARY else {})
	## restore()가 slot_name -> item Dictionary 하나를 받는 방식으로 바뀌었다
	## (다섯 부위가 더 늘며 위치 인자로는 못 버틴다 — dungeon_equipment_state.gd
	## 참고). 저장 안 된 슬롯(옛 세이브)은 {}로 안전하게 채워진다.
	var equip_saved: Dictionary = {}
	for slot_name in DungeonEquipmentState.SLOT_NAMES:
		var v: Variant = data.get(slot_name, {})
		equip_saved[slot_name] = v if typeof(v) == TYPE_DICTIONARY else {}
	DungeonEquipmentState.restore(equip_saved)
	var runes: Variant = data.get("runes", {})
	var scrolls: Variant = data.get("scrolls", 0)
	var gems: Variant = data.get("gems", {})
	var jewels: Variant = data.get("jewels", [])
	DungeonMaterialsState.restore(
		runes if typeof(runes) == TYPE_DICTIONARY else {},
		int(scrolls) if (typeof(scrolls) == TYPE_INT or typeof(scrolls) == TYPE_FLOAT) else 0,
		gems if typeof(gems) == TYPE_DICTIONARY else {},
		jewels if jewels is Array else [])
	var gold: Variant = data.get("gold", 0)
	DungeonGoldState.restore(int(gold) if (typeof(gold) == TYPE_INT or typeof(gold) == TYPE_FLOAT) else 0)
	var belt: Variant = data.get("belt", [])
	DungeonPotionState.restore(belt if belt is Array else [])
	var party_members: Variant = data.get("party_members", [])
	var members: Array[String] = []
	if party_members is Array:
		for v in party_members:
			members.append(str(v))
	DungeonPartyState.restore(members)
	var hardcore: Variant = data.get("hardcore", false)
	var fallen: Variant = data.get("fallen", {})
	DungeonHardcoreState.restore(
		bool(hardcore),
		fallen if typeof(fallen) == TYPE_DICTIONARY else {})
	var skill_points: Variant = data.get("skill_points", {})
	var skill_ranks: Variant = data.get("skill_ranks", {})
	DungeonSkillState.restore(
		skill_points if typeof(skill_points) == TYPE_DICTIONARY else {},
		skill_ranks if typeof(skill_ranks) == TYPE_DICTIONARY else {})
	var grave: Variant = data.get("grave", {})
	DungeonGraveState.restore(grave if typeof(grave) == TYPE_DICTIONARY else {})
	var sigils: Variant = data.get("sigils", [])
	var sigil_active: Variant = data.get("sigil_active", -1)
	var sigil_best: Variant = data.get("sigil_best", 0)
	var sigil_next_id: Variant = data.get("sigil_next_id", 1)
	DungeonSigilState.restore(
		sigils if sigils is Array else [],
		int(sigil_active) if (typeof(sigil_active) == TYPE_INT or typeof(sigil_active) == TYPE_FLOAT) else -1,
		int(sigil_best) if (typeof(sigil_best) == TYPE_INT or typeof(sigil_best) == TYPE_FLOAT) else 0,
		int(sigil_next_id) if (typeof(sigil_next_id) == TYPE_INT or typeof(sigil_next_id) == TYPE_FLOAT) else 1)
	var horde_best: Variant = data.get("horde_best", 0)
	var horde_runs: Variant = data.get("horde_runs", 0)
	DungeonHordeState.restore(
		int(horde_best) if (typeof(horde_best) == TYPE_INT or typeof(horde_best) == TYPE_FLOAT) else 0,
		int(horde_runs) if (typeof(horde_runs) == TYPE_INT or typeof(horde_runs) == TYPE_FLOAT) else 0)
	var worldboss_last_slot: Variant = data.get("worldboss_last_slot", -1)
	DungeonWorldBossState.restore(
		int(worldboss_last_slot) if (typeof(worldboss_last_slot) == TYPE_INT or typeof(worldboss_last_slot) == TYPE_FLOAT) else -1)
	return true


func _migrate_step(from_version: int, data: Dictionary) -> Variant:
	match from_version:
		1:
			## 방 하나뿐이던 시절의 room_cleared를 방 0 하나짜리 배열로.
			data["rooms_cleared"] = [bool(data.get("room_cleared", false))]
			data.erase("room_cleared")
			data["version"] = 2
			return data
		_:
			return null
