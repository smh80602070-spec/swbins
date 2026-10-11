extends Button

## "공격" 버튼 — war.js march()/fight()를 좁혀 옮긴 첫 전투 슬라이스
## (2026-09-12, "전쟁 외교 이어해"). 처음엔 목표가 소패 하나뿐이라
## 상수(`TARGET`)로 고정해 두고 곧장 쳤다.
##
## **2026-09-13 추가 — 하비(下邳, xiapi) 목표.** 여포령이 `ENEMY_CITIES`에
## 둘째로 늘면서 이 버튼도 realm_city_button.gd·realm_transfer_button.gd
## 처럼 ChoicePrompt 목록으로 일반화했다 — 목표가 늘 때마다 이 파일을
## 다시 고치지 않아도 `realm_cities.gd ENEMY_CITIES`만 늘리면 된다.
## 이미 함락한 곳은 목록에서 뺀다. 출진 성이 아직 없어(예: 소패를
## 함락하기 전의 하비) `attack()`이 실패해도 그 이유(예: "없는 출진
## 성")를 그대로 토스트로 보여준다 — 목록 단계에서 미리 거르지 않는다
## (realm_city_button.gd가 늘 playable_ids() 전부를 보여주는 것과 같은
## 결, 뒤가 알아서 판정한다).

const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")
const RealmWar := preload("res://games/saga_realm/data/realm_war.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const TacticsView := preload("res://games/saga_realm/world/realm_tactics_view.gd")   # G-0183
const RealmTactics := preload("res://games/saga_realm/data/realm_tactics.gd")
const Characters := preload("res://saga_core/data/characters.gd")

const TOAST_SEC := 3.5


func _ready() -> void:
	text = "공격"
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	var layer_box := {}
	var choices: Array = []
	for e: Dictionary in RealmCities.ENEMY_CITIES:
		var eid := String(e.id)
		## **2026-09-14 추가 — 시나리오가 우리 것으로 준 성은 목록에서
		## 아예 뺀다.** `ENEMY_CITIES`는 정적(107개 지도 전체)이라 시나리오와
		## 무관하지만, `RealmSaveState.enemies`는 지금 시나리오의 실제 적만
		## 담는다(`_init_enemies()` 참고) — 그 안에 없으면 애초에 우리 성이다.
		if not RealmSaveState.enemies.has(eid):
			continue
		if bool(RealmSaveState.enemies[eid].get("captured", false)):
			continue
		choices.append({
			"label": "%s(%s)" % [String(e.get("name", eid)), String(e.get("hanja", ""))],
			"cb": func() -> void: _attack(eid, layer_box),
		})
	if choices.is_empty():
		Toast.show(self, "칠 곳이 남지 않았습니다", TOAST_SEC)
		return
	layer_box["layer"] = ChoicePrompt.build(self, "공격 — 어디를", choices)


## **2026-09-17 추가 — PLAN 101-2 REALM ④후보 "일기토".** 목표를 고른
## 다음, 치기 전에 3합 일기토를 걸지 물을지 정한다. 걸면 `RealmWar.
## DUEL_MOVES` 셋(베기·찌르기·막기) 중 하나를 3번 고르는 화면이 이어진다
## (`realm_promote_button.gd`류 다단 ChoicePrompt와 같은 결).
func _attack(target_id: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var ask_box := {}
	var choices: Array = [
		{"label": "♟️ 전술판을 펼친다(3턴 격자 — 이기면 위력↑, 지면 위력↓ · 쓰러진 장수는 3달 다친다)",
			"cb": func() -> void: _open_tactics(target_id, ask_box)},
		{"label": "⚔️ 일기토를 건다(3합 — 이기면 위력↑, 지면 위력↓)",
			"cb": func() -> void: _duel_round(target_id, [])},
		{"label": "바로 친다",
			"cb": func() -> void: _finish_attack(target_id, [], ask_box)},
	]
	ask_box["layer"] = ChoicePrompt.build(self, "%s — 일기토를 걸까" % _target_name(target_id), choices)


func _duel_round(target_id: String, moves: Array) -> void:
	var box := {}
	var n := moves.size() + 1
	var choices: Array = []
	for mv: String in RealmWar.DUEL_MOVES:
		choices.append({
			"label": String(RealmWar.DUEL_MOVE_NAME.get(mv, mv)),
			"cb": func() -> void: _duel_pick(target_id, moves, mv, box),
		})
	box["layer"] = ChoicePrompt.build(self, "일기토 — %d합째" % n, choices)


func _duel_pick(target_id: String, moves: Array, mv: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var next_moves: Array = moves.duplicate()
	next_moves.append(mv)
	if next_moves.size() < RealmWar.DUEL_ROUNDS:
		_duel_round(target_id, next_moves)
	else:
		_finish_attack(target_id, next_moves, {})


## G-0183 — 전술판(realm_tactics_view.gd)을 연다. 못 열면(병력·장수·군량…) attack() 과 같은 이유를 토스트로.
## 판이 끝나면 그 보정값으로 친다 — 물러나기(Esc)면 보정 없이 그냥 친다(웹과 같음).
func _open_tactics(target_id: String, layer_box: Dictionary) -> void:
	if layer_box.has("layer"):
		(layer_box["layer"] as CanvasLayer).queue_free()
	var tb: Dictionary = RealmSaveState.tactics_board(target_id)
	if not bool(tb.get("ok", false)):
		Toast.show(self, "공격 — %s" % tb.get("why", "실패"), TOAST_SEC)
		return
	TacticsView.open(self, target_id, tb, func(grid: Dictionary) -> void: _finish_attack(target_id, [], {}, grid))


func _target_name(target_id: String) -> String:
	return String(RealmCities.enemy_by_id(target_id).get("name", target_id))


func _finish_attack(target_id: String, duel_moves: Array, layer_box: Dictionary, grid: Dictionary = {}) -> void:
	if layer_box.has("layer"):
		(layer_box["layer"] as CanvasLayer).queue_free()
	var r := RealmSaveState.attack(target_id, duel_moves, grid)
	if not r.get("ok", false):
		Toast.show(self, "공격 — %s" % r.get("why", "실패"), TOAST_SEC)
		return

	var target_name := _target_name(target_id)
	var msg: String
	var toast_sec := TOAST_SEC
	var duel_rounds: Array = r.get("duel_rounds", [])
	if not duel_rounds.is_empty():
		var wins := 0
		for rd: Dictionary in duel_rounds:
			if String(rd.result) == "win":
				wins += 1
		msg = "⚔️ 일기토 %d합 %d승 (위력 ×%.2f)\n" % [duel_rounds.size(), wins, float(r.get("duel_mul", 1.0))]
	else:
		msg = ""
	if r.has("grid"):   # G-0183 전술판 결과 한 줄 + 쓰러진·다친 장수
		var gk := String(r.grid)
		msg += "♟️ 전술판 %s (위력 %s%d%%)
" % [String(RealmTactics.OUT.get(gk, {}).get("name", gk)), "+" if int(grid.get("winPct", 0)) >= 0 else "", int(grid.get("winPct", 0))]
		for id: String in r.get("fallen", []):
			var h = Characters.find(id)
			msg += "⚰️ %s 이(가) 쓰러졌다
" % (String(h.name) if h != null else id)
		for id: String in r.get("hurt", []):
			var h2 = Characters.find(id)
			msg += "🩹 %s 이(가) 크게 다쳐 물러났다(3달)
" % (String(h2.name) if h2 != null else id)
		toast_sec = TOAST_SEC + 1.5
	if r.won:
		msg += "🚩 %s 함락! (아군 손실 %d · 적 손실 %d)" % [target_name, int(r.loss_a), int(r.loss_d)]
		var boss_beaten := String(r.get("boss_beaten", ""))
		if not boss_beaten.is_empty():
			msg += "\n👑 보스급 수비 무장 %s 을(를) 꺾었다! 금 %d" % [boss_beaten, RealmSaveState.BOSS_BONUS_GOLD]
			toast_sec = TOAST_SEC + 1.5
	elif r.routed:
		msg += "↩️ 물러났다 (아군 손실 %d · 적 손실 %d)" % [int(r.loss_a), int(r.loss_d)]
	else:
		msg += "🌒 날이 저물었다 — 못 떨어뜨렸다 (아군 손실 %d · 적 손실 %d)" % [int(r.loss_a), int(r.loss_d)]
	Toast.show(self, msg, toast_sec)
