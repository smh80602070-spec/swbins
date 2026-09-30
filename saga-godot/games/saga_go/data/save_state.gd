extends Node

## VERTICAL_SLICE.md 26절 "저장/로드(로컬 파일 하나)" — 12단계 완료 조건의
## 마지막 단계. PLAN.md 28장은 레벨·경험치·장비·인벤토리·퀘스트·월드
## 상태까지 저장하라고 하지만 그중 이 슬라이스에 실제로 있는 상태는
## 플레이어 위치와 부대(PartyState)뿐이다 — 없는 시스템을 저장하는 코드는
## 만들지 않는다. 28장이 요구하는 "버전 필드"와 PLAN.md Phase 9(97단계)
## "Data Versioning"은 아래 _migrate_step()으로 지킨다.
##
## project.godot [autoload]에 SaveState로 등록된 싱글턴.

const SAVE_PATH := "user://save.json"
const SafeFile := preload("res://saga_core/data/safe_file.gd")

## 점검이 임시 파일로 돌릴 때만 채운다(진짜 세이브를 건드리지 않게).
var path_override := ""


func save_path() -> String:
	return path_override if path_override != "" else SAVE_PATH
const SAVE_VERSION := 3
const Growth := preload("res://games/saga_go/data/growth.gd")


func save() -> bool:
	var player := _find_player()
	if player == null:
		return false
	var data := {
		"version": SAVE_VERSION,
		"player_pos": [player.global_position.x, player.global_position.y, player.global_position.z],
		"party_members": PartyState.members,
		"party_size": PartyState.party_size,
		"party_presets": PartyState.presets,
		"party_preset": PartyState.preset_i,
		"party_exp": PartyState.exp,
		"party_perks": PartyState.perks,
		"char_growth": PartyState.growth,
		"bag": PartyState.bag,
		"weapons": PartyState.weapons,
		"equip": PartyState.equip,
		"artifacts": PartyState.artifacts,
		"artifact_seq": PartyState.artifact_seq,
		"gather_t": PartyState.gather_t,
		"cook_prof": PartyState.cook_prof,
		"commissions": PartyState.commissions,
		"resin": PartyState.resin,
		"resin_t": PartyState.resin_t,
		"weekly": PartyState.weekly,
		"wl_lowered": PartyState.wl_lowered,
		"ar_paid": PartyState.ar_paid,
		"story": PartyState.story,
		"world_quests": PartyState.world_quests,
		"fishing": PartyState.fishing,
		"achievements": PartyState.achievements,
		"dispatch": PartyState.dispatch,
		"night_echo": PartyState.night_echo,
		"eggs": PartyState.eggs,
		"home": PartyState.home,
		"cycle": PartyState.cycle,
		"tips": PartyState.tips,
		"hunt": PartyState.hunt,
		"drops": DropState.drops,
		"quest_active_id": QuestState.active_id,
		"quest_active_name": QuestState.active_name,
		"quest_done": QuestState.done,
		"quest_offered": QuestState.offered,
		"resolved_events": EventState.resolved,
		"codex_book": CodexState.book,
	}
	return SafeFile.write_text(save_path(), JSON.stringify(data))


## 저장 파일이 있으면 부대·플레이어 위치에 적용하고 true, 없거나
## 마이그레이션 경로가 없거나 깨져 있으면 아무것도 바꾸지 않고 false
## (새 게임 취급).
func try_load() -> bool:
	var parsed: Variant = SafeFile.read_json(save_path())
	if parsed == null:
		return false
	var migrated: Variant = _migrate(parsed)
	if migrated == null:
		return false
	var data: Dictionary = migrated

	var members: Array[String] = []
	for m in data.get("party_members", []):
		members.append(str(m))
	## party_exp도 §31 이후 추가된 필드다 — 없으면 0.0(경험치 없음)으로
	## 안전하게 채워진다, 위 quest_* 필드와 같은 경계(마이그레이션 불필요).
	## party_perks(101-2)도 같은 경계 — 없으면 빈 배열(아직 특성을 안
	## 받아 본 세이브).
	var perks: Array[String] = []
	for pid in data.get("party_perks", []):
		perks.append(str(pid))
	## char_growth·bag(106장 ⑩) — v3 부터. v2 이하는 _migrate_step 이 부대 레벨로 채워 온다.
	var growth: Variant = data.get("char_growth", {})
	var bag: Variant = data.get("bag", {})
	## weapons·equip(106장 ⑯) — 없으면 빈 사전(수련용만 든 상태). 필드만 더해 버전 그대로.
	var weapons: Variant = data.get("weapons", {})
	var equip: Variant = data.get("equip", {})
	## artifacts·artifact_seq(106장 ⑰) — 없으면 빈 사전·0.
	var arts: Variant = data.get("artifacts", {})
	PartyState.restore(members, float(data.get("party_exp", 0.0)), perks,
		growth if typeof(growth) == TYPE_DICTIONARY else {}, bag if typeof(bag) == TYPE_DICTIONARY else {},
		weapons if typeof(weapons) == TYPE_DICTIONARY else {}, equip if typeof(equip) == TYPE_DICTIONARY else {},
		arts if typeof(arts) == TYPE_DICTIONARY else {}, int(data.get("artifact_seq", 0)))
	## party_size(106장 ㉝ 편성) — 없으면 PARTY_MAX(옛날처럼 앞 셋).
	PartyState.party_size = clampi(int(data.get("party_size", PartyState.PARTY_MAX)), 0, PartyState.PARTY_MAX)
	## party_presets·party_preset(106장 ㊱ 편성 여러 벌) — 없으면 지금 명단이 1번.
	PartyState.restore_presets(data.get("party_presets"), int(data.get("party_preset", 0)))
	## gather_t·cook_prof(106장 ⑱) — 없으면 빈 사전(다 자라 있고 숙련 0).
	var gt: Variant = data.get("gather_t", {})
	var cp: Variant = data.get("cook_prof", {})
	PartyState.restore_cooking(gt if typeof(gt) == TYPE_DICTIONARY else {}, cp if typeof(cp) == TYPE_DICTIONARY else {})
	## commissions(106장 ⑲) — 없거나 날이 지났으면 commissions.gd 가 오늘 것으로 새로 굴린다.
	var cm: Variant = data.get("commissions", {})
	PartyState.commissions = (cm as Dictionary).duplicate(true) if typeof(cm) == TYPE_DICTIONARY else {}
	## resin·resin_t(106장 ⑳) — 없으면 가득·아직 안 셈.
	PartyState.resin = int(data.get("resin", 160))
	PartyState.resin_t = float(data.get("resin_t", 0.0))
	## weekly(106장 ㉑) — 없으면 빈 사전(이번 주 0번).
	var wk: Variant = data.get("weekly", {})
	PartyState.weekly = (wk as Dictionary).duplicate() if typeof(wk) == TYPE_DICTIONARY else {}
	## wl_lowered·ar_paid(106장 ㉒) — 없으면 낮춤 없음·아직 안 셈.
	PartyState.wl_lowered = bool(data.get("wl_lowered", false))
	PartyState.ar_paid = int(data.get("ar_paid", -1))
	## story(106장 ㉕) — 없으면 빈 사전(1장 1단계부터).
	var sty: Variant = data.get("story", {})
	PartyState.story = (sty as Dictionary).duplicate() if typeof(sty) == TYPE_DICTIONARY else {}
	## world_quests(106장 ㊴) — 없으면 빈 사전(아무것도 안 맡음).
	var wq: Variant = data.get("world_quests", {})
	PartyState.world_quests = (wq as Dictionary).duplicate(true) if typeof(wq) == TYPE_DICTIONARY else {}
	## fishing(106장 ㊷) — 없으면 빈 사전(잡은 것 없음·낚시터 물고기 가득).
	var fi: Variant = data.get("fishing", {})
	PartyState.fishing = (fi as Dictionary).duplicate(true) if typeof(fi) == TYPE_DICTIONARY else {}
	## achievements(106장 ㊸) — 없으면 빈 사전(첫 확인이 지금 상태로 단계를 알림 없이 채운다).
	var ac: Variant = data.get("achievements", {})
	PartyState.achievements = (ac as Dictionary).duplicate(true) if typeof(ac) == TYPE_DICTIONARY else {}
	## dispatch(106장 ㊹) — 없으면 빈 사전(아무도 탐사 안 나감).
	var dp: Variant = data.get("dispatch", {})
	PartyState.dispatch = (dp as Dictionary).duplicate(true) if typeof(dp) == TYPE_DICTIONARY else {}
	## night_echo(106장 52-5) — 없으면 빈 사전(오늘 끈 잔불 없음).
	var ne: Variant = data.get("night_echo", {})
	PartyState.night_echo = (ne as Dictionary).duplicate(true) if typeof(ne) == TYPE_DICTIONARY else {}
	## eggs(2026-09-30 신수 알·동행) — 없으면 빈 사전(알·동행 없음).
	var eg: Variant = data.get("eggs", {})
	PartyState.eggs = (eg as Dictionary).duplicate(true) if typeof(eg) == TYPE_DICTIONARY else {}
	## home(2026-09-30 쉼터 마당) — 없으면 빈 사전(빈 마당).
	var hm: Variant = data.get("home", {})
	PartyState.home = (hm as Dictionary).duplicate(true) if typeof(hm) == TYPE_DICTIONARY else {}
	## cycle(2026-09-30 회차) — 없으면 0(첫 회차).
	PartyState.cycle = int(data.get("cycle", 0))
	## tips(2026-09-30 도움말) — 없으면 빈 목록(안내를 처음부터 다시 본다).
	var tp: Variant = data.get("tips", [])
	PartyState.tips = (tp as Array).duplicate() if typeof(tp) == TYPE_ARRAY else []
	## hunt(2026-09-30 사냥 기록) — 없으면 빈 사전(기록 없음).
	var hn: Variant = data.get("hunt", {})
	PartyState.hunt = (hn as Dictionary).duplicate(true) if typeof(hn) == TYPE_DICTIONARY else {}

	var pos: Array = data.get("player_pos", [])
	var player := _find_player()
	if player != null and pos.size() == 3:
		player.global_position = Vector3(float(pos[0]), float(pos[1]), float(pos[2]))

	## 이 세 필드는 §31에서 새로 추가됐다 — 그 전에 저장된 파일엔 아예 없다.
	## 값이 없어도 기본값(빈 사명·안 물어본 목록)으로 안전하게 채워지므로
	## SAVE_VERSION을 올리는 마이그레이션은 필요 없다(추가만 있고 기존 필드
	## 모양은 안 바뀌었다).
	var offered: Array[String] = []
	for id in data.get("quest_offered", []):
		offered.append(str(id))
	QuestState.restore(
		str(data.get("quest_active_id", "")),
		str(data.get("quest_active_name", "")),
		bool(data.get("quest_done", false)),
		offered
	)

	## resolved_events도 §31 이후 추가된 필드와 같은 경계(추가만 있고
	## 없으면 빈 목록으로 안전하게 채워짐, 마이그레이션 불필요). 이 시점
	## (test_village.gd의 _remove_resolved_events()가 부르기 전)에
	## 채워 둬야 정리가 제대로 된다 — 순서 삽질 기록은 test_village.gd 참고.
	var resolved: Array[String] = []
	for id in data.get("resolved_events", []):
		resolved.append(str(id))
	EventState.restore(resolved)

	## codex_book도 같은 경계(추가만, 없으면 빈 딕셔너리로 안전하게 채워짐).
	var codex_book: Variant = data.get("codex_book", {})
	CodexState.restore(codex_book if typeof(codex_book) == TYPE_DICTIONARY else {})

	## drops(101-2 ③)도 같은 경계 — 없으면 빈 딕셔너리(떨어뜨린 짐 없음).
	## 만료(10분) 판정은 실시간 유닉스 시각 기준이라 오래 쉬었다 돌아와도
	## try_recover()가 스스로 걸러 낸다(따로 여기서 정리할 필요 없음).
	var drops: Variant = data.get("drops", {})
	DropState.restore(drops if typeof(drops) == TYPE_DICTIONARY else {})
	return true


## data의 "version"이 SAVE_VERSION보다 낮으면 _migrate_step()을 한 단계씩
## 적용해 최신 모양으로 바꿔 돌려준다(딱 맞으면 그대로). 마이그레이션
## 경로가 없거나(_migrate_step이 null을 돌려줌) 이 빌드보다 나중 버전
## (다운그레이드)이면 null — 데이터를 반쯤 바꾼 채로 적용하지 않는다.
func _migrate(data: Dictionary) -> Variant:
	var version := int(data.get("version", 0))
	while version < SAVE_VERSION:
		var stepped: Variant = _migrate_step(version, data)
		if stepped == null:
			return null
		data = stepped
		version = int(data.get("version", version + 1))
	if version > SAVE_VERSION:
		return null
	return data


## 버전 from_version에서 온 data를 from_version+1 모양으로 바꿔 돌려준다.
## 등록된 경로가 없으면 null. 지금은 SAVE_VERSION이 1뿐이라 등록된
## 마이그레이션이 없다 — 스키마를 실제로 바꿀 때(필드 추가·이름 변경 등)
## SAVE_VERSION을 올리고 여기 match에 그 버전 분기를 추가하면 된다(예:
## `1: data["new_field"] = ...; data["version"] = 2; return data`).
func _migrate_step(from_version: int, data: Dictionary) -> Variant:
	match from_version:
		0, 1:
			## 106장 ⑤(2026-09-23) — 포구·폐허 원점을 8000m 밖에서 마을 옆으로
			## 옮겼다. 그 지역에 서서 저장한 좌표를 새 원점 기준으로 옮긴다.
			var pos: Array = data.get("player_pos", [])
			if pos.size() == 3:
				var p := Vector3(float(pos[0]), float(pos[1]), float(pos[2]))
				if p.x > 4000.0:
					p += Vector3(480.0 - 8000.0, 0.0, 0.0)
				elif p.z > 4000.0:
					p += Vector3(0.0, 0.0, 432.0 - 8000.0)
				data["player_pos"] = [p.x, p.y, p.z]
			data["version"] = 2
			return data
		2:
			## 106장 ⑩(2026-09-24) — 인물 육성. 옛 부대 레벨(경험 100마다 1)만큼 인물을 미리 키워
			## 둔다(주인공·등용한 동료 모두, 첫 상한 20 까지). 가방은 빈 채로 시작.
			var party_level := int(float(data.get("party_exp", 0.0)) / 100.0)
			var lv := Growth.seed_level(party_level)
			var growth := {"self": {"lv": lv, "exp": 0.0, "asc": 0}}
			for m in data.get("party_members", []):
				growth[str(m)] = {"lv": lv, "exp": 0.0, "asc": 0}
			data["char_growth"] = growth
			data["bag"] = {}
			data["version"] = 3
			return data
		_:
			return null


func _find_player() -> Node3D:
	var found := get_tree().get_nodes_in_group("player")
	return found[0] if found.size() > 0 else null
