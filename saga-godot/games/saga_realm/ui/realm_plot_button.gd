extends Button

## "계략" 버튼 — diplo.js PLOTS 넷(이간·유언비어·매수·화계)을 다 옮긴
## 것(2026-09-12, "1,2,3 순서대로 다해"). 유언비어·화계(성 자체가 대상)는
## 먼저 옮겼고(이 지시의 두 번째), 이간·매수(적 무장 대상)를 이번에
## 마저 옮겼다(세 번째) — 소패에 이름 있는 수비 무장(sg_guanyu·
## sg_zhangfei)이 생기면서 대상이 실제로 있어졌다(`realm_cities.gd`
## ENEMY_CITIES 참고). realm_diplo_button.gd와 같은 ChoicePrompt
## 패턴이되, "계략은 성공률을 숨기지 않는다"(diplo.js 머리말)는 원칙대로
## 메뉴에 성공률(+이간·매수는 대상 이름)을 미리 계산해 보여 준다.
##
## **2026-09-13 추가 — 하비(xiapi) 목표 추가.** realm_diplo_button.gd와
## 같은 이유로 대상 고르기(1단) → 계략 종류 고르기(2단)로 일반화했다.
##
## **2026-09-14 추가 — 주인 없는 성(77개) 목록에서 제외.**
## realm_diplo_button.gd와 같은 이유(diplo.js "주인 없는 성입니다") —
## 자세한 근거는 그쪽 머리말 참고, 여기서 반복하지 않는다.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")
const RealmDiplo := preload("res://games/saga_realm/data/realm_diplo.gd")
const Characters := preload("res://saga_core/data/characters.gd")

const TOAST_SEC := 3.5


func _ready() -> void:
	text = "계략"
	pressed.connect(_on_pressed)


func _target_name(target_id: String) -> String:
	return String(RealmCities.enemy_by_id(target_id).get("name", "상대"))


func _officer_name(id: String) -> String:
	var h = Characters.find(id)
	return String(h.name) if h != null else id


func _on_pressed() -> void:
	var layer_box := {}
	var choices: Array = []
	for e: Dictionary in RealmCities.ENEMY_CITIES:
		var eid := String(e.id)
		## **2026-09-14 추가 — 시나리오가 우리 것으로 준 성은 목록에서 뺀다**
		## (realm_attack_button.gd와 같은 이유).
		if not RealmSaveState.enemies.has(eid):
			continue
		if bool(RealmSaveState.enemies[eid].get("captured", false)):
			continue
		if RealmSaveState.force_of(eid).is_empty():
			continue
		choices.append({
			"label": String(e.get("name", eid)),
			"cb": func() -> void: _pick_plot(eid, layer_box),
		})
	if choices.is_empty():
		Toast.show(self, "계략을 쓸 상대가 없습니다", TOAST_SEC)
		return
	layer_box["layer"] = ChoicePrompt.build(self, "계략 — 누구에게", choices)


func _pick_plot(target_id: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var plot_box := {}
	var choices: Array = []
	for p: Dictionary in RealmDiplo.PLOTS:
		var key: String = String(p.key)
		var preview := RealmSaveState.plot_preview(key, target_id)
		var label: String
		if bool(preview.get("ok", false)):
			var who := ""
			var preview_target_id: String = String(preview.get("target_id", ""))
			if not preview_target_id.is_empty():
				who = " — %s" % _officer_name(preview_target_id)
			label = "%s %s%s (🪙%d, 성공률 %d%%) — %s" % [
				String(p.emoji), String(p.name), who, int(p.gold),
				roundi(float(preview.get("chance", 0.0)) * 100.0), String(p.desc)]
		else:
			label = "%s %s — %s" % [String(p.emoji), String(p.name), String(preview.get("why", "실패"))]
		choices.append({
			"label": label,
			"cb": func() -> void: _run(key, String(p.name), target_id, plot_box),
		})
	plot_box["layer"] = ChoicePrompt.build(self, "계략 — %s" % _target_name(target_id), choices)


func _run(kind: String, name_: String, target_id: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var r := RealmSaveState.plot(kind, target_id)
	if not r.get("ok", false):
		Toast.show(self, "%s — %s" % [name_, r.get("why", "실패")], TOAST_SEC)
		return

	if not bool(r.get("done", false)):
		Toast.show(self, "🕳️ %s — 들통났다 (성공률 %d%%였다)" % [name_, roundi(float(r.chance) * 100.0)], TOAST_SEC)
		return

	var msg: String
	if kind == "rumor":
		msg = "🗣️ %s — 치안 %d → %d" % [name_, int(r.sec_from), int(r.sec_to)]
	elif kind == "fire":
		msg = "🔥 %s — 군량 %d 이(가) 탔다" % [name_, int(r.burned)]
	elif kind == "discord":
		var who := _officer_name(String(r.target))
		msg = "🕸️ %s — %s 의 충성 %d → %d" % [name_, who, int(r.loyal_from), int(r.loyal_to)]
		if bool(r.defected):
			msg += " · 🚪 %s 이(가) 흔들려 재야로 흩어졌다!" % who
	elif kind == "bribe":
		msg = "💰 %s — %s 이(가) 우리 쪽으로 넘어왔다!" % [name_, _officer_name(String(r.target))]
	else:
		msg = "%s 성공" % name_
	Toast.show(self, msg, TOAST_SEC)
