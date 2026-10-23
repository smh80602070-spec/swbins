extends RefCounted

## G-0331 4종횡 무기 두 벌·바꿔치기 콤보(데드 셀·엘소드 — 구조만). 고돗이 먼저(웹 "부분"은 동료 교대 — 고돗 4종횡엔 동료가 없다, 장부 story.md 우선 3).
##   두 벌   무기 칸에 새 무기를 끼우면 들던 무기는 버금(weapon2)으로 내려간다(주문서 값·남은 업횟도 그 무기와 함께) — 2나락 G-0236 줍기와 같은 결.
##   바꾸기  G(story_weapon_swap — project.godot 를 안 고치고 실행 때 InputMap 에 단다; G 는 3마을 채집 키라 4종횡에선 빈 자리) · 쿨 SWAP_CD.
##   콤보    연속 타격 중(run_combo ≥ 2, 마지막 타격 COMBO_GAP 안)에 바꾸면 다음 근접 한 타 ×COMBO_MUL "바꿔치기!" — 연속 수는 그대로 이어진다.
##   저장    StorySaveState.weapon2 = {key, sb(주문서 값), sl(남은 업횟)} 또는 {} (25→26). SAGA_WSWAP=0 이면 끔(두 벌·바꾸기 없음).
## S = StorySaveState(점검이 autoload 이름 없이 부르게 넘긴다).

const ACTION := "story_weapon_swap"
const SWAP_CD := 1.0
const COMBO_MUL := 1.3
const BONUS_MS := 1500

static var _cd_until_ms := 0
static var _bonus_until_ms := 0


static func on() -> bool:
	return OS.get_environment("SAGA_WSWAP") != "0"


static func ensure_action() -> void:
	if InputMap.has_action(ACTION):
		return
	InputMap.add_action(ACTION)
	var ev := InputEventKey.new()
	ev.physical_keycode = KEY_G
	InputMap.action_add_event(ACTION, ev)


static func pressed() -> bool:
	if not on():
		return false
	ensure_action()
	return Input.is_action_just_pressed(ACTION)


## 새 무기를 끼우기 직전 — 들던 무기를 버금으로(주문서 상태와 함께). equip_gear 가 부른다.
static func stash(S: Object, new_key: String) -> void:
	if not on():
		return
	var old := String((S.equipped as Dictionary).get("weapon", ""))
	if old == "" or old == new_key:
		return
	S.weapon2 = {"key": old, "sb": (S.scroll_bonus as Dictionary).get("weapon", {}), "sl": int((S.scroll_left as Dictionary).get("weapon", 0))}


## 바꾸기 — {ok, why("single"|"cd"|"off"), combo, key}
static func swap(S: Object, now_ms: int) -> Dictionary:
	if not on():
		return {"ok": false, "why": "off"}
	var w2: Dictionary = S.weapon2 if typeof(S.weapon2) == TYPE_DICTIONARY else {}
	if String(w2.get("key", "")) == "":
		return {"ok": false, "why": "single"}
	if now_ms < _cd_until_ms:
		return {"ok": false, "why": "cd"}
	var cur := {"key": String((S.equipped as Dictionary).get("weapon", "")), "sb": (S.scroll_bonus as Dictionary).get("weapon", {}), "sl": int((S.scroll_left as Dictionary).get("weapon", 0))}
	S.equipped["weapon"] = String(w2.key)
	if typeof(w2.get("sb")) == TYPE_DICTIONARY and not (w2.sb as Dictionary).is_empty():
		S.scroll_bonus["weapon"] = w2.sb
	else:
		(S.scroll_bonus as Dictionary).erase("weapon")
	S.scroll_left["weapon"] = int(w2.get("sl", 0))
	S.weapon2 = cur if String(cur.key) != "" else {}
	_cd_until_ms = now_ms + int(SWAP_CD * 1000.0)
	var combo := int(S.run_combo) >= 2 and now_ms - int(S.get("_run_last_hit_ms")) <= int(S.COMBO_GAP_MS)
	if combo:
		_bonus_until_ms = now_ms + BONUS_MS
	return {"ok": true, "combo": combo, "key": String(w2.key)}


## 근접 한 타 배율 — 바꿔치기 덤이 살아 있으면 COMBO_MUL 을 한 번 쓰고 끈다
static func take_mul(now_ms: int) -> float:
	if _bonus_until_ms > 0 and now_ms <= _bonus_until_ms:
		_bonus_until_ms = 0
		return COMBO_MUL
	return 1.0


static func reset_runtime() -> void:
	_cd_until_ms = 0
	_bonus_until_ms = 0
