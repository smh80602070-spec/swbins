extends Node3D

## PLAN 106장 ㉕ — 원신식 이야기 임무(진행·대화·목표 표시). 표는 data/story.gd, 상태는 PartyState.story {ch, step}.
##   임무 인물 셋(마을 촌장·포구 사공·폐허 학자)이 늘 서 있다. 3m 안 F(터치 "대화 (F)")로 말을 건다 —
##   지금 단계의 인물이면 대화가 이어지고(끝나면 다음 단계), 아니면 한 줄 혼잣말.
##   대화 창: 아래 가운데, 말하는 이·글. F·Space·Enter·누르기로 넘기고, 고르는 줄은 단추(대답만 다르다).
##   목표: 금빛 기둥 + "◆ 거리" 글자, 왼쪽 미니맵 밑 추적 글자, 지도·미니맵 금빛 마름모(world_map.gd 가 target_pos() 를 읽음).
##   임무 목록: O(터치 "임무" 단추) — 장마다 단계 ✔·▶·○.
## 세이브: PartyState.story 한 필드. 임무 적·제단 불은 저장하지 않는다(불러오면 그 단계 처음부터).

const Story := preload("res://games/saga_go/data/story.gd")
const Adventure := preload("res://games/saga_go/data/adventure.gd")
const Domains := preload("res://games/saga_go/data/domains.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const FieldBosses := preload("res://games/saga_go/world/field_bosses.gd")
const FieldBoss := preload("res://games/saga_go/combat/field_boss.gd")
const VroidBody := preload("res://games/saga_go/world/vroid_body.gd")
const CreatureBuilder := preload("res://games/saga_go/world/creature_builder.gd")
const TalkFace := preload("res://games/saga_go/world/talk_face.gd")
const SkyIsle := preload("res://games/saga_go/world/sky_isle.gd")
const RiftEnd := preload("res://games/saga_go/world/rift_end.gd")
const SkyRoute := preload("res://games/saga_go/world/sky_route.gd")
const StormEye := preload("res://games/saga_go/world/storm_eye.gd")
const WorldQuests := preload("res://games/saga_go/data/world_quests.gd")
const WQ_BLUE := Color(0.45, 0.8, 1.0)
const Toast := preload("res://saga_core/ui/toast.gd")

signal step_changed(ch: int, step: int)
signal chapter_done(ch: int)
## 106장 ㊴ 세계 임무 — 단계가 바뀔 때(끝나면 step = -1)·따라가는 임무가 바뀔 때.
signal wq_changed(id: String, step: int)
signal track_changed(id: String)

const GOLD := Color(1.0, 0.84, 0.35)
const KILL_SPREAD := 4.5
const ALTAR_REACH := 1.5
const DUEL_FALL := 5.0
const DUEL_CLEAR := 4.0

var _player: Node3D = null
var _npcs: Dictionary = {} # id → Node3D
var _npc_pos: Dictionary = {} # id → Vector3
var _quest_enemies: Array = []
var _altar: Node3D = null
var _altar_flame: Node3D = null
var _seal: Array = [] # seal 단계 석등 [{node, mark, flame, lit}]
var _seal_next := 0 # seal — 다음에 밝힐 order 칸
var _was_locked := false
var _marker: Node3D = null
var _marker_label: Label3D = null
var _tracker: Label = null
var _talk_btn: Button = null
var _journal: Control = null
var _journal_label: Label = null
var _wq_label: Label = null # 106장 ㊴ 임무 목록 오른쪽 칸 — 세계 임무
var _track_box: VBoxContainer = null
var _mark_t := 0.0
var _journal_open := false
var _dlg: Control = null
var _dlg_name: Label = null
var _dlg_text: Label = null
var _dlg_choices: VBoxContainer = null
var _dlg_lines: Array = []
var _dlg_i := 0
var _dlg_waiting_choice := false
var _dlg_open := false
var _dlg_done: Callable
var _dlg_npc := "" # 말 거는 임무 인물(대화 카메라가 그쪽을 잡는다, 비면 카메라 그대로)
var _frozen_before := false
var _count := 0 # gather 단계에서 캔 수(저장 안 함)
var _follow_i := 0 # follow 단계 — 다음에 걸어갈 길 점
var _follow_far := false # follow 단계 — 내가 FOLLOW_LOST 밖인가(추적 글자)
var follow_speed_mul := 1.0 # 점검이 걸음을 빠르게 돌릴 때만
## 106장 ㉙ 대화 몸짓 — 임무 인물 id → TalkFace(world/talk_face.gd), 나는 첫 대화 때 붙인다. 글자는 REVEAL_CPS 로 흘린다.
const REVEAL_CPS := 30.0
var _faces: Dictionary = {}
var _player_tf: Node = null
var _reveal := -1.0 # 흘러나온 글자 수(음수면 다 보임)
var _reveal_face: Node = null
## 106장 ㉞ defend — 물결 차례(-1 = 아직 시작 전), 이번 물결이 나온 뒤 흐른 초, 제단 글자. 제단 체력은 SiegeAltar 가 든다.
var _wave := -1
var _wave_t := 0.0
var _defend_label: Label3D = null
var _defend_warned := false
var _defend_hold := 0.0 # 무너진 뒤 다시 첫 물결까지 쉬는 초
const DEFEND_REST := 4.0
## 106장 ㊲ chase — 도둑(VRoid 몸)·다음 길 점·달리는 중인가·숨 고르는 남은 초.
var _thief: Node3D = null
var _chase_i := 0
var _chase_run := false
var _chase_pause := 0.0
var chase_speed_mul := 1.0 # 점검이 도둑을 느리게/빠르게 돌릴 때만

## defend 제단 — field_enemy.siege 가 이 노드를 친다(siege_hit·siege_radius).
class SiegeAltar extends Node3D:
	signal hit(amount: float)
	var hp := 1.0
	var max_hp := 1.0
	func siege_radius() -> float:
		return 0.9
	func siege_hit(amount: float, _from: Node) -> void:
		if hp <= 0.0:
			return
		hp = maxf(0.0, hp - amount)
		hit.emit(amount)

func _ready() -> void:
	add_to_group("go_story")
	_player = get_tree().get_first_node_in_group("player")
	_ensure_actions()
	for id in Story.NPCS:
		_build_npc(id)
	for id in WorldQuests.NPCS:
		_build_npc(id)
	_build_marker()
	_build_ui()
	var fb := get_tree().get_first_node_in_group("go_field_bosses")
	if fb:
		for bid in FieldBosses.FB.ORDER:
			var b: Node = fb.call("boss", bid)
			if b:
				b.connect("died", func(_e: Node) -> void: _on_boss_died(bid))
	var dm := get_tree().get_first_node_in_group("go_domains")
	if dm:
		dm.connect("state_changed", func(s: String) -> void:
			if s == "cleared":
				_on_domain_cleared(String(dm.get("current"))))
	var ga := get_tree().get_first_node_in_group("go_gathering")
	if ga:
		ga.connect("gathered", _on_gathered)
	var ki := get_tree().get_first_node_in_group("go_kitchen")
	if ki:
		ki.connect("cooked", func(_r: String, _q: int) -> void: _on_cooked())
	_join_past()
	_enter_step()

func _ensure_actions() -> void:
	if not InputMap.has_action("go_domain"):
		InputMap.add_action("go_domain")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_F
		InputMap.action_add_event("go_domain", ev)
	if not InputMap.has_action("go_journal"):
		InputMap.add_action("go_journal")
		var ej := InputEventKey.new()
		ej.physical_keycode = KEY_O
		InputMap.action_add_event("go_journal", ej)

# ---------------------------------------------------------------- 상태

func ch() -> int:
	return int(PartyState.story.get("ch", 0))

func st() -> int:
	return int(PartyState.story.get("step", 0))

func current_step() -> Dictionary:
	var t := track()
	if t != "":
		return WorldQuests.step_of(t, wq_step(t))
	if locked():
		return {}
	return Story.step_of(ch(), st())

# ---------------------------------------------------------------- 세계 임무(106장 ㊴)

## 이야기 인물이든 세계 임무 인물이든 그 표 칸.
func _npc_info(id: String) -> Dictionary:
	return Story.NPCS[id] if Story.NPCS.has(id) else WorldQuests.NPCS.get(id, {})

## 따라가는 세계 임무 id(빈 글자 = 이야기 임무).
func track() -> String:
	var t := String(PartyState.world_quests.get("track", ""))
	return t if wq_started(t) else ""

## 그 세계 임무의 단계 — 안 맡았거나 끝났으면 -1.
func wq_step(id: String) -> int:
	var steps: Dictionary = PartyState.world_quests.get("steps", {})
	return int(steps.get(id, -1))

func wq_started(id: String) -> bool:
	return id != "" and wq_step(id) >= 0

func wq_done(id: String) -> bool:
	return (PartyState.world_quests.get("done", []) as Array).has(id)

## 모험 등급이 닿았고 아직 안 끝났는가.
func wq_open(id: String) -> bool:
	var q := WorldQuests.quest(id)
	return not q.is_empty() and not wq_done(id) and Adventure.ar() >= int(q.ar)

## 그 인물에게 말을 걸면 이어지는 세계 임무(맡기 전이면 첫 대화, 맡은 뒤면 다음 단계가 그 인물과의 대화) — 없으면 "".
func _wq_for_npc(id: String) -> String:
	for q in WorldQuests.ORDER:
		if not wq_open(q):
			continue
		var s := WorldQuests.step_of(q, maxi(wq_step(q), 0))
		if String(s.get("type", "")) == "talk" and String(s.npc) == id:
			return q
	return ""

## 이야기 임무 지금 단계가 대화면 그 인물 id(따라가는 임무와 상관없이) — 아니면 "".
func _story_talk_npc() -> String:
	if locked():
		return ""
	var s := Story.step_of(ch(), st())
	return String(s.npc) if String(s.get("type", "")) == "talk" else ""

## 따라가는 임무 바꾸기("" = 이야기 임무로). 맡은 임무만. 바꾸면 그 임무 단계를 처음부터 세운다.
func set_track(id: String) -> bool:
	if id != "" and not wq_started(id):
		return false
	if id == track():
		return true
	PartyState.world_quests["track"] = id
	_enter_step()
	track_changed.emit(id)
	var qn := String(WorldQuests.quest(id).name) if id != "" else "이야기 임무"
	Toast.show(self, "따라가는 임무 — %s" % qn, 2.0)
	return true

## 세계 임무 맡기(첫 대화 전에) — 그 임무를 따라간다.
func _wq_begin(id: String) -> void:
	if not PartyState.world_quests.has("steps"):
		PartyState.world_quests["steps"] = {}
	var steps: Dictionary = PartyState.world_quests["steps"]
	if not steps.has(id):
		steps[id] = 0
		wq_changed.emit(id, 0)
	PartyState.world_quests["track"] = id
	_enter_step()

func _advance_wq(id: String) -> void:
	var q := WorldQuests.quest(id)
	PartyState.add_exp(WorldQuests.STEP_EXP)
	var steps: Dictionary = PartyState.world_quests["steps"]
	var next := wq_step(id) + 1
	if next >= (q.steps as Array).size():
		steps.erase(id)
		if not PartyState.world_quests.has("done"):
			PartyState.world_quests["done"] = []
		(PartyState.world_quests["done"] as Array).append(id)
		PartyState.world_quests["track"] = ""
		PartyState.add_items(q.reward)
		PartyState.add_exp(float(q.exp))
		Toast.show(self, "세계 임무 완료 — %s\n보상: %s" % [q.name, _reward_text(q.reward)], 4.0)
		CombatFeel.ui()
		wq_changed.emit(id, -1)
		track_changed.emit("")
	else:
		steps[id] = next
		Toast.show(self, "◇ %s" % String(WorldQuests.step_of(id, next).text), 2.5)
		wq_changed.emit(id, next)
	_enter_step()

## 지금 장이 모험 등급에 막혀 있는가.
func locked() -> bool:
	var c := Story.chapter(ch())
	return not c.is_empty() and Adventure.ar() < int(c.ar)

func npc_pos(id: String) -> Vector3:
	return _npc_pos.get(id, Vector3.INF)

## 지금 목표 자리(없으면 INF) — 지도·미니맵·기둥이 쓴다.
func target_pos() -> Vector3:
	return _step_target(current_step(), true)

## 106장 ㊶ 지도 표식 — [{kind, pos, quest, name, text}]. kind:
##   "wq_open"    맡을 수 있는 세계 임무(맡길 사람 자리, 푸른 !)
##   "wq_idle"    맡았지만 안 따라가는 세계 임무(그 단계 자리, 푸른 빈 마름모)
##   "wq_track"   따라가는 세계 임무(푸른 찬 마름모 — 미니맵 가장자리에 붙음)
##   "story"      따라가는 이야기 임무(금빛 찬 마름모) · "story_idle" 세계 임무를 따라가는 동안의 이야기 임무(금빛 빈 마름모)
## quest 는 세계 임무 id, 이야기면 "". 자리를 못 정하는 단계(쫓기 도둑이 아직 안 선 것 등)는 빠진다.
func map_marks() -> Array:
	var out: Array = []
	var t := track()
	for q in WorldQuests.ORDER:
		var d := WorldQuests.quest(q)
		if wq_started(q):
			var s := WorldQuests.step_of(q, wq_step(q))
			var p := _step_target(s, q == t)
			if p != Vector3.INF:
				out.append({"kind": "wq_track" if q == t else "wq_idle", "pos": p, "quest": q, "name": String(d.name), "text": String(s.get("text", ""))})
		elif wq_open(q):
			var gp := npc_pos(String(d.giver))
			if gp != Vector3.INF:
				out.append({"kind": "wq_open", "pos": gp, "quest": q, "name": String(d.name),
					"text": "%s에게 말 걸기" % String(_npc_info(String(d.giver)).get("name", ""))})
	if not locked():
		var ss := Story.step_of(ch(), st())
		if not ss.is_empty():
			var sp := _step_target(ss, t == "")
			if sp != Vector3.INF:
				out.append({"kind": "story" if t == "" else "story_idle", "pos": sp, "quest": "",
					"name": String(Story.chapter(ch()).get("name", "이야기 임무")), "text": String(ss.get("text", ""))})
	return out

## 한 단계의 목표 자리 — tracked 가 아니면 세상에 아직 안 선 것(쫓기 도둑·임무 적) 대신 그 단계 칸 자리.
func _step_target(s: Dictionary, tracked: bool) -> Vector3:
	if s.is_empty():
		return Vector3.INF
	if not tracked:
		match String(s.type):
			"chase":
				return _path_pos(s, (s.path as Array)[0])
			"duel":
				return _spot_pos(s)
			"gather", "cook":
				if _player == null:
					return Vector3.INF
	match String(s.type):
		"talk":
			return npc_pos(String(s.npc))
		"go", "kill", "light", "seal", "climb", "defend":
			return _spot_pos(s)
		"sky":
			return SkyIsle.center()
		"duel":
			for e in _quest_enemies:
				if is_instance_valid(e) and not e.call("is_dead"):
					return (e as Node3D).global_position
			return _spot_pos(s)
		"boss":
			var fb := get_tree().get_first_node_in_group("go_field_bosses")
			if fb and fb.call("boss", String(s.boss)):
				return FieldBosses.home_of(String(s.boss))
		"domain":
			var dm := get_tree().get_first_node_in_group("go_domains")
			if dm:
				return dm.call("gate_pos", String(s.domain))
		"follow", "sail":
			return npc_pos(String(s.npc))
		"chase":
			return _thief.global_position if _thief else Vector3.INF
		"gather":
			var ga := get_tree().get_first_node_in_group("go_gathering")
			if ga and _player:
				return ga.call("nearest", String(s.item), _player.global_position)
		"cook":
			var ki := get_tree().get_first_node_in_group("go_kitchen")
			if ki and _player:
				var best := Vector3.INF
				for p in ki.call("pots"):
					if best == Vector3.INF or _player.global_position.distance_to(p) < _player.global_position.distance_to(best):
						best = p
				return best
	return Vector3.INF

func tracker_text() -> String:
	return _tracker.text

## 지금 단계 목표 글(gather 는 센 수까지).
func step_text() -> String:
	var s := current_step()
	if s.is_empty():
		return ""
	if String(s.type) == "gather":
		return "%s %d/%d" % [s.text, _count, int(s.count)]
	if String(s.type) == "follow" and _follow_far:
		return "%s — 너무 멀다, 가까이!" % s.text
	if String(s.type) == "chase" and _thief:
		if not _chase_run:
			return "%s — 다가가면 달아난다" % s.text
		return "%s — %s이(가) 달아난다" % [s.text, String(s.name)] # 거리는 _refresh_marker 가 붙인다
	if String(s.type) == "defend":
		if _wave < 0:
			return "%s — 제단 곁으로 가면 무리가 온다" % s.text
		return "%s — 제단 %d/%d · 물결 %d/%d" % [s.text, ceili(defend_hp()), ceili(defend_max()), _wave + 1, (s.waves as Array).size()]
	if String(s.type) == "party":
		var marks: Array[String] = []
		var miss := party_missing(s)
		for e in s.eras:
			marks.append("%s %s" % [e, "✗" if miss.has(e) else "✔"])
		return "%s — %s" % [s.text, " · ".join(marks)]
	if String(s.type) == "seal":
		var names: Array[String] = []
		for m in s.order:
			names.append(String(Story.SEAL_MARKS[m].name))
		return "%s %d/%d (%s)" % [s.text, _seal_next, (s.order as Array).size(), " → ".join(names)]
	return String(s.text)

## party 단계 — 들판 명단(PartyState.party())의 이야기 동료가 아직 못 채운 시대(eras 차례).
func party_missing(s: Dictionary) -> Array:
	var have: Array = []
	for id in PartyState.party():
		var m: Variant = Story.member(id)
		if m != null:
			have.append(String((m as Dictionary).get("era", "")))
	return (s.get("eras", []) as Array).filter(func(e: String) -> bool: return not have.has(e))

## 지금 장·단계에 맞는 칸(appear·stations, data/story.gd) — 없으면 {}.
## 세계 임무 칸({"wq": id, …})은 그 임무 단계로 본다(따라가든 아니든).
func _window_now(v: Variant) -> Dictionary:
	for w in Story.windows(v):
		if (w as Dictionary).has("wq"):
			var q := wq_step(String(w.wq))
			if q >= int(w.from) and q <= int(w.to):
				return w
		elif not locked() and (ch() == int(w.ch) or (w.has("ch_to") and ch() >= int(w.ch) and ch() <= int(w.ch_to))) \
				and st() >= int(w.from) and st() <= int(w.to):
			return w
	return {}

## 그 인물이 지금 세상에 서 있는가 — appear 가 있으면 그 칸의 장·단계에만.
func npc_visible(id: String) -> bool:
	var info: Dictionary = _npc_info(id)
	if not info.has("appear"):
		return true
	return not _window_now(info.appear).is_empty()

## 인물을 보이거나 숨기고 제자리에 세운다(불러오기·단계마다·장이 풀릴 때) — 칸에 cell 이 있으면 거기,
## 따라가기를 지난 뒤면 길 끝, 아니면 집 자리.
func _place_npcs() -> void:
	for id in _npcs:
		var info: Dictionary = _npc_info(id)
		var root: Node3D = _npcs[id]
		root.visible = npc_visible(id)
		var p := _cell_pos(String(info.region), info.cell)
		var c := Story.chapter(ch())
		if not locked() and not c.is_empty():
			var steps: Array = c.steps
			for j in mini(st(), steps.size()):
				var sj: Dictionary = steps[j]
				if String(sj.type) == "follow" and String(sj.npc) == id:
					var path: Array = sj.path
					p = _cell_pos(String(sj.region), path[path.size() - 1])
		for w in [_window_now(info.get("appear")), _window_now(Story.STATIONS.get(id))]:
			if (w as Dictionary).has("cell"):
				p = _spot_pos(w)
		root.global_position = p
		_npc_pos[id] = p

## follow 단계 — 내가 가까우면 다음 길 점으로 걷고, 멀면 서서 기다린다. 길 끝이면 다음 단계.
func _follow_tick(s: Dictionary, delta: float) -> void:
	var id := String(s.npc)
	var root: Node3D = _npcs.get(id)
	if root == null:
		return
	var path: Array = s.path
	var body := root.get_node_or_null("Body") as Node3D
	var anim := body.get_node_or_null("AnimationPlayer") as AnimationPlayer if body else null
	var to_p := _player.global_position - root.global_position
	to_p.y = 0.0
	var far := to_p.length() > Story.FOLLOW_LOST
	if far != _follow_far:
		_follow_far = far
		_refresh()
	if _follow_i >= path.size():
		advance()
		return
	var walking := to_p.length() <= Story.FOLLOW_NEAR
	if walking:
		var goal := _cell_pos(String(s.region), path[_follow_i])
		var step := goal - root.global_position
		step.y = 0.0
		var move := Story.FOLLOW_SPEED * follow_speed_mul * delta
		if step.length() <= move:
			root.global_position = goal
			_follow_i += 1
		else:
			var np := root.global_position + step.normalized() * move
			np.y = _ground_y(String(s.region), np)
			root.global_position = np
			if body:
				body.rotation.y = lerp_angle(body.rotation.y, atan2(step.x, step.z), 0.2)
		_npc_pos[id] = root.global_position
	if anim:
		var want := "walk" if walking and anim.has_animation("walk") else "idle"
		if anim.current_animation != want and anim.has_animation(want):
			anim.play(want)

func follow_index() -> int:
	return _follow_i

## 걷는 인물의 발 높이 — 레이어 1 을 아래로 쏜다(다리 상판·바위 위). 나·적은 빼고, 못 맞히면 지형 높이.
func _ground_y(region: String, p: Vector3) -> float:
	var h := TerrainBuilder.height_at(region, p)
	var q := PhysicsRayQueryParameters3D.create(Vector3(p.x, h + 12.0, p.z), Vector3(p.x, h - 6.0, p.z), 1)
	var skip: Array[RID] = []
	if _player is CollisionObject3D:
		skip.append((_player as CollisionObject3D).get_rid())
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if e is CollisionObject3D:
			skip.append((e as CollisionObject3D).get_rid())
	q.exclude = skip
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	return float((hit.position as Vector3).y) if not hit.is_empty() else h

func gathered_count() -> int:
	return _count

## sky = 구름섬 윗면 높이(106장 ㊳ 9장, world/sky_isle.gd) — 아니면 땅 높이 + lift(106장 ㊼-2 14장 떠 있는 관측대 윗면 등).
static func _cell_pos(region: String, cell: Vector2, sky := false, lift := 0.0) -> Vector3:
	var p := TestMap.world_pos(cell.x, cell.y, region)
	p.y = SkyIsle.top_y() if sky else TerrainBuilder.height_at(region, p) + lift
	return p

## 단계·인물 칸(region·cell + sky·lift·rift_end) 자리. rift_end = 갈림길 끝 섬 윗면 높이(106장 ㊾-3 20장, world/rift_end.gd).
static func _spot_pos(d: Dictionary) -> Vector3:
	## isle = "<id>" 면 그 칸의 높이는 구름 위 항로 그 섬 윗면(106장 51 7부, world/sky_route.gd).
	if d.has("isle"):
		var q := TestMap.world_pos(d.cell.x, d.cell.y, String(d.region))
		q.y = SkyRoute.top_y(String(d.isle))
		return q
	## eye = true 면 먹구름 눈 윗면(106장 52 8부, world/storm_eye.gd).
	if bool(d.get("eye", false)):
		var e := TestMap.world_pos(d.cell.x, d.cell.y, String(d.region))
		e.y = StormEye.top_y()
		return e
	if bool(d.get("rift_end", false)):
		var p := TestMap.world_pos(d.cell.x, d.cell.y, String(d.region))
		p.y = RiftEnd.top_y()
		return p
	return _cell_pos(String(d.region), d.cell, bool(d.get("sky", false)), float(d.get("lift", 0.0)))

## 쫓기 길 점 자리 — 단계에 isle 이 있으면 그 섬 윗면(51 7부), 아니면 땅.
static func _path_pos(s: Dictionary, cell: Vector2) -> Vector3:
	if s.has("isle"):
		return _spot_pos({"region": s.region, "cell": cell, "isle": s.isle})
	return _cell_pos(String(s.region), cell)

## 떠 있는 자리인가(구름섬·떠 있는 구조물·갈림길 끝) — 둘레·물결·석등도 그 윗면 높이로.
static func _floating(d: Dictionary) -> bool:
	return bool(d.get("sky", false)) or float(d.get("lift", 0.0)) > 0.0 or bool(d.get("rift_end", false)) or d.has("isle") or bool(d.get("eye", false))

# ---------------------------------------------------------------- 단계

## 단계에 들어설 때 — 임무 적·제단을 세우고 표시를 새로.
func _enter_step() -> void:
	_clear_step_objects()
	_count = 0
	_follow_i = 0
	_follow_far = false
	_seal_next = 0
	_wave = -1
	_wave_t = 0.0
	_defend_warned = false
	_chase_i = 0
	_chase_run = false
	_chase_pause = 0.0
	_was_locked = locked()
	_place_npcs()
	var s := current_step()
	match String(s.get("type", "")):
		"kill":
			var sky := _floating(s) # 떠 있는 자리면 둘레도 그 윗면 높이로
			var center := _spot_pos(s)
			var kinds: Array = s.kinds
			for i in kinds.size():
				var a := TAU * float(i) / float(kinds.size())
				var p := center + Vector3(cos(a), 0.0, sin(a)) * KILL_SPREAD
				p.y = (center.y if sky else TerrainBuilder.height_at(String(s.region), p)) + 0.3
				var e: CharacterBody3D = FieldEnemy.new()
				e.name = "StoryEnemy_%d" % i
				e.setup(String(kinds[i]), p, 20260824 + 900 + i)
				e.respawns = false
				e.drops = false
				e.apply_world_level(Adventure.world_level())
				add_child(e)
				_quest_enemies.append(e)
		"light":
			_build_altar(_spot_pos(s))
			## 17장 bell — 제단 돌 대신 종각에 건 종이 받는다(world/region5_skyport.gd ring_bell) · 18장 bare — 돌 없이 그 자리 장치(변전함)가 받는다.
			if bool(s.get("bell", false)) or bool(s.get("bare", false)):
				for mi in _altar.get_children():
					(mi as Node3D).visible = false
		"duel":
			## 106장 ㉜ 이야기 보스 — field_boss.gd 틀, 한 번뿐. 위 보스 막대(world/field_bosses.gd)가 go_story_boss 를 본다.
			var bp := _spot_pos(s) + Vector3.UP * 0.3
			## 내가 그 자리에 서 있으면 몸이 겹쳐 서로 밀어 올린다(구름섬에서 둘이 20m 솟았다) — 나에게서 DUEL_CLEAR m 떨어뜨려 세운다.
			if _player:
				var away := bp - _player.global_position
				away.y = 0.0
				if away.length() < DUEL_CLEAR:
					var dir := away.normalized() if away.length() > 0.1 else Vector3.BACK
					bp = Vector3(_player.global_position.x, bp.y, _player.global_position.z) + dir * DUEL_CLEAR
			var boss: CharacterBody3D = FieldBoss.new()
			boss.name = "StoryBoss_" + String(s.kind)
			boss.setup(String(s.kind), bp, 20260824 + 950)
			boss.respawns = false
			boss.drops = false
			boss.apply_world_level(Adventure.world_level())
			add_child(boss)
			boss.global_position = bp
			boss.add_to_group("go_story_boss")
			_quest_enemies.append(boss)
		"seal":
			_build_altar(_spot_pos(s))
			## bare = 제단 돌 없이 석등 셋이 그 자리 장치를 둘러싼다(31장 장터 결정 돔 — 다 켜면 그 지역 파일이 장·단계를 보고 깬다).
			if bool(s.get("bare", false)):
				for mi in _altar.get_children():
					if mi is MeshInstance3D:
						(mi as Node3D).visible = false
			_build_seal(String(s.region), _floating(s))
		"chase":
			_build_thief(s)
		"defend":
			_build_altar(_spot_pos(s), true)
			## bare = 제단 돌 없이 그 자리 장치가 받는다(29장 먹구름 눈 매듭 등불 — 머리 글자만 남긴다).
			if bool(s.get("bare", false)):
				for mi in _altar.get_children():
					if mi is MeshInstance3D:
						(mi as Node3D).visible = false
			var sa := _altar as SiegeAltar
			sa.max_hp = float(s.hp) * Adventure.atk_mul(Adventure.world_level())
			sa.hp = sa.max_hp
			sa.hit.connect(_on_altar_hit)
			remove_from_group("element_receiver") # 지키는 제단엔 불을 안 붙인다
			_refresh_defend_label()
		"boss":
			## 이미 쓰러뜨려 보상 꽃을 기다리는 중이면(다시 서지 않으니) 그대로 넘긴다.
			var fb := get_tree().get_first_node_in_group("go_field_bosses")
			var b: Node = fb.call("boss", String(s.boss)) if fb else null
			if b and b.call("is_dead"):
				call_deferred("advance")
	_refresh()

func _clear_step_objects() -> void:
	for e in _quest_enemies:
		if is_instance_valid(e):
			e.queue_free()
	_quest_enemies.clear()
	if _altar:
		_altar.queue_free()
		_altar = null
		_altar_flame = null
		_defend_label = null
	_seal.clear() # 석등은 제단 자식이라 함께 사라진다
	if _thief:
		_thief.queue_free()
		_thief = null
	if is_in_group("element_receiver"):
		remove_from_group("element_receiver")

## 지금 단계를 끝내고 다음으로(장 끝이면 보상).
func advance() -> void:
	if track() != "":
		_advance_wq(track())
		return
	var c := Story.chapter(ch())
	if c.is_empty() or locked():
		return
	PartyState.add_exp(Story.STEP_EXP)
	var next := st() + 1
	if next >= (c.steps as Array).size():
		PartyState.add_items(c.reward)
		PartyState.add_exp(float(c.exp))
		PartyState.story = {"ch": ch() + 1, "step": 0}
		var joined := _join(String(c.get("join", "")))
		Toast.show(self, "이야기 임무 완료 — %s\n보상: %s%s" % [c.name, _reward_text(c.reward), _join_text(joined)], 4.0)
		CombatFeel.ui()
		chapter_done.emit(ch() - 1)
	else:
		PartyState.story = {"ch": ch(), "step": next}
		var s := current_step()
		if not s.is_empty():
			Toast.show(self, "◆ %s" % s.text, 2.5)
	step_changed.emit(ch(), st())
	_enter_step()

## 106장 ㉛ 장 끝 이야기 동료(data/story.gd join·MEMBERS) — 이미 있으면 안 넣는다. 넣었으면 그 id.
func _join(id: String) -> String:
	if id == "" or not Story.MEMBERS.has(id) or PartyState.members.has(id):
		return ""
	PartyState.recruit(id)
	return id

func _join_text(id: String) -> String:
	if id == "":
		return ""
	var t := "\n%s 이(가) 동료가 되었다" % String(Story.MEMBERS[id].name)
	if not PartyState.in_party(id):
		t += " — 인물 화면(C)에서 들판 명단에 넣을 수 있다"
	return t

## 이미 지난 장의 동료가 명단에 없으면 조용히 넣는다(이 기능 전에 그 장을 끝낸 세이브).
func _join_past() -> void:
	for i in mini(ch(), Story.CHAPTERS.size()):
		_join(String(Story.CHAPTERS[i].get("join", "")))

func _reward_text(r: Dictionary) -> String:
	var parts: Array[String] = []
	var growth := preload("res://games/saga_go/data/growth.gd")
	for item in r:
		parts.append("%s %d" % [growth.item_name(item), int(r[item])])
	return " · ".join(parts)

func _on_boss_died(bid: String) -> void:
	var s := current_step()
	if String(s.get("type", "")) == "boss" and String(s.boss) == bid:
		advance()

func _on_domain_cleared(did: String) -> void:
	var s := current_step()
	if String(s.get("type", "")) == "domain" and String(s.domain) == did:
		advance()

func _on_gathered(item: String) -> void:
	var s := current_step()
	if String(s.get("type", "")) != "gather" or String(s.item) != item:
		return
	_count += 1
	if _count >= int(s.count):
		advance()
	else:
		_refresh()

func _on_cooked() -> void:
	if String(current_step().get("type", "")) == "cook":
		advance()

## 옛 제단(element_receiver 그룹) — 어느 원소든 스킬·폭발이 닿으면 불이 붙고 다음 단계.
func receive_element(pos: Vector3, radius: float, element: String) -> void:
	if _altar == null or element == "":
		return
	if not _seal.is_empty():
		_seal_hit(pos, radius)
		return
	var ap := _altar.global_position
	if Vector2(ap.x - pos.x, ap.z - pos.z).length() > radius + ALTAR_REACH:
		return
	var s := current_step()
	if bool(s.get("bell", false)):
		get_tree().call_group("go_skyport_region", "ring_bell")
		Toast.show(self, "뎅— 종소리가 은하 나루에 울려 퍼진다", 2.5)
	elif s.has("hit_text"):
		Toast.show(self, String(s.hit_text), 2.5)
	if not bool(s.get("bell", false)) and not bool(s.get("bare", false)):
		_altar_flame.visible = true
	remove_from_group("element_receiver")
	if String(s.get("type", "")) == "light":
		_advance_later(0.8)

## 잠깐 뒤 다음 단계로 — 그 사이 따라가는 임무·단계가 바뀌었으면(세계 임무 ↔ 이야기) 넘기지 않는다.
func _advance_later(sec: float) -> void:
	var at := [track(), ch(), st(), wq_step(track())]
	get_tree().create_timer(sec).timeout.connect(func() -> void:
		if [track(), ch(), st(), wq_step(track())] == at:
			advance())

## seal — 원소가 닿은 꺼진 석등 가운데 다음 차례가 있으면 그것만 켜고, 없고 다른 것만 닿았으면 다 끈다.
func _seal_hit(pos: Vector3, radius: float) -> void:
	var s := current_step()
	if String(s.get("type", "")) != "seal":
		return
	var order: Array = s.order
	if _seal_next >= order.size():
		return
	var want := String(order[_seal_next])
	var hit_want := false
	var hit_other := false
	for t in _seal:
		if t.lit:
			continue
		var tp: Vector3 = (t.node as Node3D).global_position
		if Vector2(tp.x - pos.x, tp.z - pos.z).length() > radius + ALTAR_REACH:
			continue
		if String(t.mark) == want:
			hit_want = true
		else:
			hit_other = true
	if hit_want:
		for t in _seal:
			if String(t.mark) == want:
				t.lit = true
				(t.flame as Node3D).visible = true
		_seal_next += 1
		CombatFeel.ui()
		if _seal_next >= order.size():
			_altar_flame.visible = not bool(s.get("bare", false))
			remove_from_group("element_receiver")
			Toast.show(self, String(s.get("hit_text", "봉인이 풀린다 — 제단에 불이 붙었다")), 2.5)
			_advance_later(0.8)
		else:
			_refresh()
	elif hit_other:
		for t in _seal:
			t.lit = false
			(t.flame as Node3D).visible = false
		var had := _seal_next > 0
		_seal_next = 0
		Toast.show(self, "석등이 모두 꺼졌다 — 차례가 틀렸다" if had else "이 석등이 먼저가 아니다", 2.0)
		_refresh()

func seal_lit() -> int:
	return _seal_next

## 원소 시야(106장 ⑬)가 짚는 다음 차례 석등 [{pos, color}] — seal 단계일 때만.
func seal_hint() -> Array:
	var s := current_step()
	if String(s.get("type", "")) != "seal" or _seal_next >= (s.order as Array).size():
		return []
	var want := String(s.order[_seal_next])
	for t in _seal:
		if String(t.mark) == want:
			return [{"pos": (t.node as Node3D).global_position, "color": Story.SEAL_MARKS[want].color}]
	return []

## 석등 자리(점검용) — 표지 → 월드 좌표.
func seal_lamp_pos(mark: String) -> Vector3:
	for t in _seal:
		if String(t.mark) == mark:
			return (t.node as Node3D).global_position
	return Vector3.INF

func _physics_process(delta: float) -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
		return
	## 모험 등급이 올라 장이 풀리거나 잠기면 인물 자리·표시를 다시(stations 로 옮겨 서는 인물).
	if locked() != _was_locked:
		_was_locked = locked()
		_place_npcs()
		_refresh()
	var s := current_step()
	var walker := String(s.npc) if String(s.get("type", "")) == "follow" else ""
	match String(s.get("type", "")):
		"follow":
			if not _dlg_open:
				_follow_tick(s, delta)
			if current_step() != s:
				return
		"go":
			var t := _cell_pos(String(s.region), s.cell)
			if Vector2(_player.global_position.x - t.x, _player.global_position.z - t.z).length() <= float(s.radius):
				advance()
				return
		"kill", "duel":
			if String(s.type) == "duel" or _floating(s):
				## 봉우리 보스·구름섬 무리가 밑으로 떨어지면(집보다 DUEL_FALL m 아래) 제자리로 되돌린다 — 밑에서 못 올라와 멈추지 않게.
				for e in alive_quest_enemies():
					var home: Vector3 = e.get("home")
					if (e as Node3D).global_position.y < home.y - DUEL_FALL:
						(e as Node3D).global_position = home
						(e as CharacterBody3D).velocity = Vector3.ZERO
			if not _quest_enemies.is_empty() and alive_quest_enemies().is_empty():
				if String(s.type) == "duel":
					Toast.show(self, String(s.get("flee", "%s의 가면에 금이 가고 — 먹구름 속으로 달아났다" % String(FieldEnemy.KINDS[String(s.kind)].name))), 3.0)
				_quest_enemies.clear()
				advance()
				return
		"defend":
			if _defend_tick(s, delta):
				return
		"chase":
			if _chase_tick(s, delta):
				return
		"sky":
			if SkyIsle.on_isle(_player.global_position):
				advance()
				return
		"party":
			if party_missing(s).is_empty():
				advance()
				return
		"climb":
			var t := _cell_pos(String(s.region), s.cell)
			var pp := _player.global_position
			## isle = 구름 위 항로 그 섬 윗면에 서면(51 7부 — 바람 기둥을 타고 올라 활공으로 건너와서)
			if s.has("isle"):
				if SkyRoute.on_isle(String(s.isle), pp) and _player.is_on_floor():
					advance()
					return
			elif bool(s.get("eye", false)): # 먹구름 눈 윗면에 서면(52 8부 — 구름섬 서쪽 바람 기둥으로)
				if StormEye.on_eye(pp) and _player.is_on_floor():
					advance()
					return
			elif Vector2(pp.x - t.x, pp.z - t.z).length() <= float(s.radius) and pp.y >= t.y + float(s.get("above", 0.0)) - Story.CLIMB_SLACK:
				advance()
				return
	## 세계 임무 "!" — 모험 등급이 올라 새로 맡을 수 있게 되면(1초마다 본다).
	_mark_t -= delta
	if _mark_t <= 0.0:
		_mark_t = 1.0
		_refresh_quest_marks()
	var near := near_npc()
	_talk_btn.visible = near != "" and not _dlg_open and not _modal_open()
	for id in _npcs:
		var n: Node3D = _npcs[id]
		if _npc_info(id).has("appear"):
			n.visible = npc_visible(id) # 모험 등급이 올라 장이 풀릴 때도
		if id == walker or not n.visible:
			continue
		var to_p := _player.global_position - n.global_position
		to_p.y = 0.0
		if to_p.length() < 6.0 and to_p.length() > 0.1:
			var body := n.get_node_or_null("Body") as Node3D
			if body:
				body.rotation.y = lerp_angle(body.rotation.y, atan2(to_p.x, to_p.z), 0.15)
	_refresh_marker()

## chase 한 프레임 — 가까이 오면 달아나기 시작, 길 점마다 숨 고르기, 따라잡으면 끝(true), 길 끝이면 처음 자리로.
func _chase_tick(s: Dictionary, delta: float) -> bool:
	if _thief == null:
		return false
	var path: Array = s.path
	var to_me := _player.global_position - _thief.global_position
	to_me.y = 0.0
	if _chase_run and to_me.length() <= Story.CHASE_CATCH:
		Toast.show(self, String(s.get("caught", "%s을(를) 따라잡았다 — 노를 되찾았다" % String(s.name))), 2.5)
		CombatFeel.ui()
		advance()
		return true
	if not _chase_run:
		if to_me.length() <= Story.CHASE_START:
			_chase_run = true
			_chase_i = 1
			Toast.show(self, "%s이(가) 달아난다 — 달려서 쫓아라!" % String(s.name), 2.0)
			_refresh()
		_thief_anim(false)
		return false
	if _chase_pause > 0.0:
		_chase_pause -= delta
		_thief_anim(false)
		return false
	if _chase_i >= path.size():
		## 놓쳤다 — 처음 자리로 돌아가 다시 기다린다.
		_thief.global_position = _path_pos(s, path[0])
		_chase_run = false
		_chase_i = 0
		Toast.show(self, "%s을(를) 놓쳤다 — 처음 자리로 돌아갔다. 다시 쫓아 보자" % String(s.name), 2.5)
		_refresh()
		return false
	var goal := _path_pos(s, path[_chase_i])
	var step := goal - _thief.global_position
	step.y = 0.0
	var move := Story.CHASE_SPEED * chase_speed_mul * delta
	if step.length() <= move:
		_thief.global_position = goal
		_chase_i += 1
		_chase_pause = Story.CHASE_PAUSE
	else:
		var np := _thief.global_position + step.normalized() * move
		np.y = SkyRoute.top_y(String(s.isle)) if s.has("isle") else _ground_y(String(s.region), np)
		_thief.global_position = np
		var body := _thief.get_node_or_null("Body") as Node3D
		if body:
			body.rotation.y = lerp_angle(body.rotation.y, atan2(step.x, step.z), 0.3)
	_thief_anim(true)
	_refresh_marker()
	return false

func _thief_anim(running: bool) -> void:
	var body := _thief.get_node_or_null("Body")
	var anim := body.get_node_or_null("AnimationPlayer") as AnimationPlayer if body else null
	if anim == null:
		return
	var want := "walk" if running else "idle"
	anim.speed_scale = 1.7 if running else 1.0
	if anim.has_animation(want) and anim.current_animation != want:
		anim.play(want)

func chase_state() -> Dictionary:
	return {"run": _chase_run, "i": _chase_i, "pos": _thief.global_position if _thief else Vector3.INF}

## sail — 사공에게 F 로 한 줄 뒤 배로 건넌다(화면은 알림 글자로만).
func _sail(s: Dictionary) -> void:
	if current_step() != s:
		return
	var to: Dictionary = s.to
	var p := _spot_pos(to)
	_player.global_position = p + Vector3.UP * 0.8
	(_player as CharacterBody3D).velocity = Vector3.ZERO
	Toast.show(self, String(s.get("arrive", "배가 닿았다")), 2.5)
	advance()

## defend 한 프레임 — 가까이 오면 첫 물결, 물결을 다 잡거나 DEFEND_WAVE_SEC 가 지나면 다음, 마지막까지 다 잡으면 끝(true = 단계가 바뀜).
func _defend_tick(s: Dictionary, delta: float) -> bool:
	if _altar == null:
		return false
	var waves: Array = s.waves
	if _wave < 0:
		if _defend_hold > 0.0:
			_defend_hold -= delta
			return false
		var ap := _altar.global_position
		if Vector2(_player.global_position.x - ap.x, _player.global_position.z - ap.z).length() <= Story.DEFEND_START:
			_spawn_wave(s, 0)
			Toast.show(self, String(s.get("start", "가면 무리가 몰려온다 — 제단을 지켜라")), 2.5)
		return false
	_wave_t += delta
	var alive := alive_quest_enemies()
	if _wave + 1 < waves.size():
		if alive.is_empty() or _wave_t >= Story.DEFEND_WAVE_SEC:
			_spawn_wave(s, _wave + 1)
	elif alive.is_empty():
		Toast.show(self, "무리가 모두 물러갔다 — 제단이 버텼다", 2.5)
		_quest_enemies.clear()
		advance()
		return true
	return false

## defend 물결 w — 제단 둘레 DEFEND_RING m 에 고르게(물결마다 조금씩 돌려), 곧장 제단으로.
## dirs(도, 북쪽 0·시계 방향 — 석등과 같게)가 있으면 그 방향들에서만 차례로(담이 막는 쪽에선 안 나오게, 106장 ㊺-3 산성 문루).
func _spawn_wave(s: Dictionary, w: int) -> void:
	_wave = w
	_wave_t = 0.0
	var center := _altar.global_position
	var kinds: Array = (s.waves as Array)[w]
	for i in kinds.size():
		var p: Vector3
		if s.has("dirs"):
			var a := deg_to_rad(float((s.dirs as Array)[(i + w) % (s.dirs as Array).size()]))
			p = center + Vector3(sin(a), 0.0, -cos(a)) * Story.DEFEND_RING
		else:
			var a := TAU * float(i) / float(kinds.size()) + 0.9 * w
			p = center + Vector3(cos(a), 0.0, sin(a)) * Story.DEFEND_RING
		p.y = (center.y if _floating(s) else TerrainBuilder.height_at(String(s.region), p)) + 0.3
		var e: CharacterBody3D = FieldEnemy.new()
		e.name = "StoryRaider_%d_%d" % [w, i]
		e.setup(String(kinds[i]), p, 20260824 + 1000 + w * 10 + i)
		e.respawns = false
		e.drops = false
		e.siege = _altar
		e.apply_world_level(Adventure.world_level())
		add_child(e)
		_quest_enemies.append(e)
	if w > 0:
		Toast.show(self, "물결 %d/%d — 무리가 또 온다" % [w + 1, (s.waves as Array).size()], 2.0)
	_refresh()

func _on_altar_hit(_amount: float) -> void:
	_refresh_defend_label()
	_refresh()
	if not _defend_warned and defend_hp() <= defend_max() * 0.5:
		_defend_warned = true
		Toast.show(self, "제단이 흔들린다 — 무리를 떼어 내라!", 2.0)
	if defend_hp() <= 0.0:
		call_deferred("_defend_failed")

## 제단이 무너지면 무리가 물러가고 그 단계 처음부터(나그네 말 그대로 다시).
func _defend_failed() -> void:
	if String(current_step().get("type", "")) != "defend":
		return
	Toast.show(self, "제단이 무너질 뻔했다 — 무리가 물러갔다. 다시 지켜 보자", 3.0)
	_enter_step()
	_defend_hold = DEFEND_REST

func defend_hp() -> float:
	return (_altar as SiegeAltar).hp if _altar is SiegeAltar else 0.0

func defend_max() -> float:
	return (_altar as SiegeAltar).max_hp if _altar is SiegeAltar else 0.0

func defend_wave() -> int:
	return _wave

func _refresh_defend_label() -> void:
	if _defend_label == null:
		return
	var r := defend_hp() / defend_max() if defend_max() > 0.0 else 0.0
	_defend_label.text = "%s %d%%" % [String(current_step().get("altar", "넷째 제단")), roundi(r * 100.0)]
	_defend_label.modulate = Color(0.55, 1.0, 0.6).lerp(Color(1.0, 0.35, 0.3), 1.0 - r)

## 보이는 창이 떠 있는가(숨겨 둔 선택지 창은 그룹에 남아 있다 — camera_rig._modal_open 과 같게). 자기 자신은 뺀다.
func _modal_open() -> bool:
	for n in get_tree().get_nodes_in_group("ui_modal"):
		if n != self and n.get("visible") != false:
			return true
	return false

func alive_quest_enemies() -> Array:
	return _quest_enemies.filter(func(e: Variant) -> bool: return is_instance_valid(e) and not e.call("is_dead"))

func quest_enemies() -> Array:
	return _quest_enemies

func near_npc() -> String:
	if _player == null:
		return ""
	var s := current_step()
	for id in _npc_pos:
		## 숨은 인물·지금 앞장서 걷는 인물에겐 말을 못 건다.
		if not npc_visible(id) or (String(s.get("type", "")) == "follow" and String(s.npc) == id):
			continue
		var d: Vector3 = _player.global_position - _npc_pos[id]
		d.y = 0.0
		if d.length() <= Story.TALK_M:
			return id
	return ""

# ---------------------------------------------------------------- 입력·대화

func _unhandled_input(event: InputEvent) -> void:
	if _dlg_open:
		var next := event.is_action_pressed("go_domain") or event.is_action_pressed("jump")
		if event is InputEventKey and (event as InputEventKey).pressed and not (event as InputEventKey).echo \
				and (event as InputEventKey).keycode in [KEY_ENTER, KEY_KP_ENTER]:
			next = true
		if next:
			next_line()
			get_viewport().set_input_as_handled()
		return
	if event.is_action_pressed("go_journal"):
		toggle_journal()
		get_viewport().set_input_as_handled()
	elif _journal_open and event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE:
		toggle_journal()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("go_domain"):
		if interact():
			get_viewport().set_input_as_handled()

## 가까운 임무 인물에게 말을 건다. 말을 걸었으면 true.
func interact() -> bool:
	var id := near_npc()
	if id == "" or _dlg_open or _modal_open():
		return false
	var s := current_step()
	if String(s.get("type", "")) == "talk" and String(s.npc) == id:
		open_dialogue(s.lines, advance, id)
	elif String(s.get("type", "")) == "sail" and String(s.npc) == id:
		open_dialogue([s.line], func() -> void: _sail(s), id)
	elif track() != "" and _story_talk_npc() == id:
		set_track("") # 세계 임무를 따라가는 중에도 이야기 인물과는 이야기가 이어진다
		open_dialogue(current_step().lines, advance, id)
	elif _wq_for_npc(id) != "":
		var q := _wq_for_npc(id)
		if not wq_started(q) or track() != q:
			_wq_begin(q) # 맡기 · 이 임무를 따라간다
		open_dialogue(current_step().lines, advance, id)
	else:
		var info: Dictionary = _npc_info(id)
		open_dialogue([[String(info.name), String(info.idle)]], Callable(), id)
	return true

func is_dialogue_open() -> bool:
	return _dlg_open

## npc_id 가 있으면 나를 그 인물 쪽으로 돌려 세우고, 줄마다 말하는 이를 카메라가 잡는다(106장 ㉗).
func open_dialogue(lines: Array, on_done: Callable, npc_id := "") -> void:
	_dlg_lines = lines
	_dlg_i = 0
	_dlg_done = on_done
	_dlg_npc = npc_id if _npc_pos.has(npc_id) else ""
	_dlg_open = true
	_dlg.visible = true
	add_to_group("ui_modal")
	_frozen_before = bool(_player.get("frozen"))
	_player.set("frozen", true)
	if _dlg_npc != "" and _player.has_method("face_toward"):
		_player.call("face_toward", _npc_pos[_dlg_npc])
	_show_line()

## 말하는 이 쪽으로 카메라 — 인물이 말하면 내 어깨 너머로 인물을, 내가 말하면 인물 어깨 너머로 나를.
func _frame_speaker(me: bool) -> void:
	if _dlg_npc == "":
		return
	var rig := _player.get_node_or_null("CameraRig")
	if rig == null or not rig.has_method("talk_shot"):
		return
	var npc: Vector3 = _npc_pos[_dlg_npc]
	var pp := _player.global_position
	if me:
		rig.call("talk_shot", pp, npc)
	else:
		rig.call("talk_shot", npc, pp)

## 지금 카메라가 잡은 말하는 이("me"·"npc"·"") — 점검용.
func speaker_side() -> String:
	if not _dlg_open or _dlg_npc == "":
		return ""
	var line: Array = _dlg_lines[_dlg_i]
	return "me" if String(line[0]) == "?" or _dlg_name.text == "나" else "npc"

## 다음 줄(고르는 줄이면 고르기 전엔 안 넘어간다). 글자가 흘러나오는 중이면 먼저 줄 전체를 한 번에 보인다(원신처럼 두 번 눌러 넘김).
func next_line() -> void:
	if not _dlg_open or _dlg_waiting_choice:
		return
	if _reveal >= 0.0:
		_finish_reveal()
		return
	_dlg_i += 1
	if _dlg_i >= _dlg_lines.size():
		_close_dialogue()
	else:
		_show_line()

## 고르는 줄에서 i 번째 대답.
func choose(i: int) -> void:
	if not _dlg_waiting_choice:
		return
	var opts: Array = _dlg_lines[_dlg_i][1]
	_dlg_waiting_choice = false
	for c in _dlg_choices.get_children():
		c.queue_free()
	_dlg_name.text = "나"
	_begin_reveal(String(opts[clampi(i, 0, opts.size() - 1)]), _player_face(), "")
	_frame_speaker(true)

func _show_line() -> void:
	var line: Array = _dlg_lines[_dlg_i]
	for c in _dlg_choices.get_children():
		c.queue_free()
	if String(line[0]) == "?":
		_dlg_waiting_choice = true
		_dlg_name.text = "나"
		_begin_reveal("", null, "")
		_dlg_text.text = "…"
		var opts: Array = line[1]
		for i in opts.size():
			var b := Button.new()
			b.text = "▸ " + String(opts[i])
			b.alignment = HORIZONTAL_ALIGNMENT_LEFT
			b.custom_minimum_size = Vector2(0, 40)
			var k: int = i
			b.pressed.connect(func() -> void: choose(k))
			_dlg_choices.add_child(b)
		_frame_speaker(true)
	else:
		_dlg_waiting_choice = false
		_dlg_name.text = String(line[0])
		var me := String(line[0]) == "나"
		_begin_reveal(String(line[1]), _player_face() if me else _faces.get(_dlg_npc), String(line[2]) if line.size() > 2 else "")
		_frame_speaker(me)

# ---------------------------------------------------------------- 대화 몸짓(106장 ㉙, world/talk_face.gd)

## 말하는 이의 몸짓을 켜고(다른 이는 끄고) 글자를 처음부터 흘린다. face 가 null 이면 몸짓 없이 글자만.
func _begin_reveal(text: String, face: Node, mood: String) -> void:
	for f in _all_faces():
		if f != face:
			f.call("set_talking", false)
			f.call("set_mood", "")
	_reveal_face = face
	_dlg_text.text = text
	if face:
		face.call("set_talking", true)
		face.call("set_mood", mood)
	if text.is_empty():
		_reveal = -1.0
		_dlg_text.visible_characters = -1
		return
	_reveal = 0.0
	_dlg_text.visible_characters = 0

## 줄 전체를 보이고 입을 닫는다(손짓은 다음 줄까지 남는다).
func _finish_reveal() -> void:
	_reveal = -1.0
	_dlg_text.visible_characters = -1
	if _reveal_face:
		_reveal_face.call("speak", "")

func is_revealing() -> bool:
	return _reveal >= 0.0

func _process(delta: float) -> void:
	if _reveal < 0.0 or not _dlg_open:
		return
	var text := _dlg_text.text
	var before := int(_reveal)
	_reveal += REVEAL_CPS * delta
	var now := mini(int(_reveal), text.length())
	if _reveal_face:
		for i in range(before, now):
			_reveal_face.call("speak", text[i])
	_dlg_text.visible_characters = now
	if now >= text.length():
		_finish_reveal()

## 그 인물(또는 "me")의 몸짓 노드 — 점검용.
func face_of(id: String) -> Node:
	return _player_face() if id == "me" else _faces.get(id)

func _player_face() -> Node:
	if _player_tf == null and _player:
		var vis := _player.get_node_or_null("Visual")
		if vis:
			_player_tf = TalkFace.attach(vis)
	return _player_tf

func _all_faces() -> Array:
	var out: Array = _faces.values()
	if _player_tf:
		out.append(_player_tf)
	return out

func _close_dialogue() -> void:
	for f in _all_faces():
		f.call("set_talking", false)
		f.call("set_mood", "")
	_reveal = -1.0
	_reveal_face = null
	_dlg_open = false
	_dlg.visible = false
	remove_from_group("ui_modal")
	_player.set("frozen", _frozen_before)
	var rig := _player.get_node_or_null("CameraRig")
	if _dlg_npc != "" and rig and rig.has_method("end_talk"):
		rig.call("end_talk")
	_dlg_npc = ""
	var cb := _dlg_done
	_dlg_done = Callable()
	if cb.is_valid():
		cb.call()

# ---------------------------------------------------------------- 표시

func _refresh() -> void:
	_refresh_quest_marks()
	var c := Story.chapter(ch())
	if track() != "":
		_tracker.text = "◇ %s\n   %s" % [WorldQuests.quest(track()).name, step_text()]
	elif c.is_empty():
		_tracker.text = ""
	elif locked():
		_tracker.text = "◆ %s\n   모험 등급 %d 에 열린다" % [c.name, int(c.ar)]
	else:
		_tracker.text = "◆ %s\n   %s" % [c.name, step_text()]
	_refresh_journal()
	_refresh_marker()

func _refresh_marker() -> void:
	var t := target_pos()
	_marker.visible = t != Vector3.INF
	if not _marker.visible:
		return
	_marker.global_position = t
	var d := 0
	if _player:
		d = roundi(Vector2(_player.global_position.x - t.x, _player.global_position.z - t.z).length())
	_marker_label.text = "◆ %dm" % d
	var c := Story.chapter(ch())
	if track() != "" or (not c.is_empty() and not locked()):
		var lines := _tracker.text.split("\n")
		if lines.size() >= 2:
			_tracker.text = "%s\n   %s  %dm" % [lines[0], step_text(), d]

func toggle_journal() -> void:
	if not _journal_open and _modal_open():
		return
	_journal_open = not _journal_open
	_journal.visible = _journal_open
	if _journal_open:
		add_to_group("ui_modal")
		_refresh_journal()
	else:
		remove_from_group("ui_modal")

func is_journal_open() -> bool:
	return _journal_open

func journal_text() -> String:
	return _journal_label.text

func _refresh_journal() -> void:
	if _journal_label == null:
		return
	var out: Array[String] = ["이야기 임무"]
	for i in Story.CHAPTERS.size():
		var c: Dictionary = Story.CHAPTERS[i]
		var mark := "✔" if i < ch() else ("▶" if i == ch() else "○")
		var tail := ""
		if i == ch() and locked():
			tail = "  (모험 등급 %d 에 열림)" % int(c.ar)
		out.append("\n%s %s%s" % [mark, c.name, tail])
		if i == ch() and not locked():
			var steps: Array = c.steps
			for j in steps.size():
				var sm := "✔" if j < st() else ("▶" if j == st() else "·")
				out.append("    %s %s" % [sm, steps[j].text])
	_journal_label.text = "\n".join(out)
	_refresh_wq_journal()

## 세계 임무 목록(오른쪽 칸) + 따라가기 단추(맡은 임무·이야기 임무).
func _refresh_wq_journal() -> void:
	if _wq_label == null:
		return
	var out: Array[String] = ["세계 임무"]
	for q in WorldQuests.ORDER:
		var d := WorldQuests.quest(q)
		var mark := "✔" if wq_done(q) else ("◇" if wq_started(q) else ("!" if wq_open(q) else "○"))
		var tail := ""
		if not wq_done(q) and not wq_started(q):
			tail = "  — %s %s" % [d.region_name, ("에서 맡을 수 있다" if wq_open(q) else "(모험 등급 %d)" % int(d.ar))]
		out.append("\n%s %s%s%s" % [mark, d.name, "  ← 따라가는 중" if track() == q else "", tail])
		if wq_started(q):
			out.append("    ▶ %s" % String(WorldQuests.step_of(q, wq_step(q)).text))
	_wq_label.text = "\n".join(out)
	for b in _track_box.get_children():
		_track_box.remove_child(b)
		b.queue_free()
	var ids: Array[String] = [""]
	for q in WorldQuests.ORDER:
		if wq_started(q):
			ids.append(q)
	if ids.size() < 2:
		return
	for q in ids:
		var b := Button.new()
		b.text = ("● " if track() == q else "") + ("이야기 임무 따라가기" if q == "" else "「%s」 따라가기" % String(WorldQuests.quest(q).name))
		b.custom_minimum_size = Vector2(260, 38)
		b.pressed.connect(func() -> void:
			set_track(q)
			_refresh_journal())
		_track_box.add_child(b)

## 세계 임무 인물 머리 위 푸른 "!"(말을 걸면 이어지는 임무가 있을 때).
func _refresh_quest_marks() -> void:
	for id in _npcs:
		var m := (_npcs[id] as Node3D).get_node_or_null("QuestMark") as Label3D
		if m:
			m.visible = _wq_for_npc(id) != ""

# ---------------------------------------------------------------- 모양

func _build_npc(id: String) -> void:
	var info: Dictionary = _npc_info(id)
	var p := _cell_pos(String(info.region), info.cell)
	var root := Node3D.new()
	root.name = "StoryNpc_" + id
	add_child(root)
	root.global_position = p
	var body: Node3D = _drone_body(info.cloth) if String(info.get("body", "")) == "drone" \
		else VroidBody.build("story_" + String(info.get("body", id)), int(info.rarity), info.cloth)
	body.name = "Body"
	root.add_child(body)
	var anim := body.get_node_or_null("AnimationPlayer") as AnimationPlayer
	if anim and anim.has_animation("idle"):
		anim.play("idle")
	if info.get("mask", false):
		VroidBody.add_mask(body, info.get("mask_color", Color(0.72, 0.12, 0.12)), info.get("mask_face", Color(0.94, 0.92, 0.86)), info.get("crack", false))
	if info.get("helmet", false):
		VroidBody.add_helmet(body)
	if info.get("visor", false):
		VroidBody.add_visor(body)
	if info.get("hat", false):
		VroidBody.add_hat(body)
	if info.get("halo", false):
		VroidBody.add_halo(body)
	if info.get("beads", false):
		VroidBody.add_beads(body)
	if info.get("goggles", false):
		VroidBody.add_goggles(body)
	if info.get("captain_hat", false): # 106장 ㊾-2 별배 선장 — 18장 잔상과 같은 남색·금띠 모자
		VroidBody.add_hat(body, Color(0.12, 0.16, 0.32), Color(0.9, 0.75, 0.3))
	var tf := TalkFace.attach(body)
	if tf:
		_faces[id] = tf
	var label := Label3D.new()
	label.text = String(info.name) + ("  · %s" % String(info.era) if info.has("era") else "")
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 34
	label.outline_size = 8
	label.pixel_size = 0.005
	label.modulate = Color(1.0, 0.95, 0.8)
	label.position = Vector3(0.0, 2.1, 0.0)
	root.add_child(label)
	if WorldQuests.NPCS.has(id):
		var mark := Label3D.new()
		mark.name = "QuestMark"
		mark.text = "!"
		mark.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		mark.font_size = 96
		mark.outline_size = 14
		mark.pixel_size = 0.005
		mark.modulate = WQ_BLUE
		mark.position = Vector3(0.0, 2.65, 0.0)
		mark.visible = false
		root.add_child(mark)
	_npcs[id] = root
	_npc_pos[id] = p

func has_mask(id: String) -> bool:
	var root: Node3D = _npcs.get(id)
	return root != null and not root.find_children("Mask", "Node3D", true, false).is_empty()

func _build_marker() -> void:
	_marker = Node3D.new()
	_marker.name = "StoryMarker"
	add_child(_marker)
	var beam := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.18
	cm.bottom_radius = 0.35
	cm.height = 40.0
	beam.mesh = cm
	var bm := StandardMaterial3D.new()
	bm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	bm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	bm.albedo_color = Color(GOLD.r, GOLD.g, GOLD.b, 0.28)
	bm.cull_mode = BaseMaterial3D.CULL_DISABLED
	beam.material_override = bm
	beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	beam.position = Vector3(0.0, 20.0, 0.0)
	_marker.add_child(beam)
	_marker_label = Label3D.new()
	_marker_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_marker_label.no_depth_test = true
	_marker_label.fixed_size = true
	_marker_label.pixel_size = 0.0022
	_marker_label.font_size = 30
	_marker_label.outline_size = 8
	_marker_label.modulate = GOLD
	_marker_label.position = Vector3(0.0, 3.2, 0.0)
	_marker.add_child(_marker_label)

## seal 석등 — 제단 둘레 SEAL_RING m 에 SEAL_LAYOUT 차례로(북쪽부터 시계 방향). 돌기둥·표지 빛깔 띠·글자, 켜지면 그 빛깔 불꽃.
func _build_seal(region: String, floating := false) -> void:
	var stone := StandardMaterial3D.new()
	stone.albedo_color = Color(0.5, 0.49, 0.46)
	var n := Story.SEAL_LAYOUT.size()
	for i in n:
		var mark := String(Story.SEAL_LAYOUT[i])
		var info: Dictionary = Story.SEAL_MARKS[mark]
		var a := TAU * float(i) / float(n)
		var world := _altar.global_position + Vector3(sin(a), 0.0, -cos(a)) * Story.SEAL_RING
		world.y = (_altar.global_position.y if floating else TerrainBuilder.height_at(region, world)) - 0.05
		var t := Node3D.new()
		t.name = "SealLamp_" + mark
		_altar.add_child(t)
		t.global_position = world
		var post := MeshInstance3D.new()
		var pm := CylinderMesh.new()
		pm.top_radius = 0.2
		pm.bottom_radius = 0.3
		pm.height = 1.2
		post.mesh = pm
		post.material_override = stone
		post.position = Vector3(0.0, 0.6, 0.0)
		t.add_child(post)
		var cap := MeshInstance3D.new()
		var cb := BoxMesh.new()
		cb.size = Vector3(0.66, 0.14, 0.66)
		cap.mesh = cb
		cap.material_override = stone
		cap.position = Vector3(0.0, 1.27, 0.0)
		t.add_child(cap)
		var band := MeshInstance3D.new()
		var bm := CylinderMesh.new()
		bm.top_radius = 0.23
		bm.bottom_radius = 0.23
		bm.height = 0.1
		band.mesh = bm
		var bmat := StandardMaterial3D.new()
		bmat.albedo_color = info.color
		band.material_override = bmat
		band.position = Vector3(0.0, 0.92, 0.0)
		t.add_child(band)
		var flame := MeshInstance3D.new()
		var fm := SphereMesh.new()
		fm.radius = 0.2
		fm.height = 0.48
		flame.mesh = fm
		var fmat := StandardMaterial3D.new()
		fmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		fmat.albedo_color = info.color
		flame.material_override = fmat
		flame.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		flame.position = Vector3(0.0, 1.56, 0.0)
		flame.visible = false
		t.add_child(flame)
		var label := Label3D.new()
		label.text = String(info.name)
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.modulate = info.color
		label.outline_size = 8
		label.font_size = 56
		label.pixel_size = 0.01
		label.position = Vector3(0.0, 2.1, 0.0)
		t.add_child(label)
		_seal.append({"node": t, "mark": mark, "flame": flame, "lit": false})

## chase 도둑 — 가면 쓴 사람 몸 + 이름표, path 첫 점에.
func _build_thief(s: Dictionary) -> void:
	_thief = Node3D.new()
	_thief.name = "StoryThief"
	add_child(_thief)
	_thief.global_position = _path_pos(s, (s.path as Array)[0])
	var drone := String(s.get("body", "")) == "drone"
	var horse := String(s.get("body", "")) == "horse" # 106장 ㊼-3 놀란 역마(코드 몸 말, 앞 = +Z)
	var captain := String(s.get("body", "")) == "captain" # 106장 ㊽-4 선장의 잔상(사람 몸 + 선장 모자, 가면 없음)
	var body: Node3D
	if drone:
		body = _drone_body(s.get("cloth", Color(0.55, 0.85, 0.95)))
	elif horse:
		body = CreatureBuilder.build("horse", s.get("colors", [Color(0.42, 0.28, 0.18), Color(0.16, 0.12, 0.1), Color(0.1, 0.08, 0.06)]))
	else:
		body = VroidBody.build("story_thief", 2, s.get("cloth", Color(0.35, 0.3, 0.28)))
	body.name = "Body"
	_thief.add_child(body)
	if captain:
		VroidBody.add_hat(body, Color(0.12, 0.16, 0.32), Color(0.9, 0.75, 0.3))
	elif not drone and not horse:
		VroidBody.add_mask(body)
	var label := Label3D.new()
	label.text = String(s.name)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 34
	label.outline_size = 8
	label.pixel_size = 0.005
	label.modulate = Color(1.0, 0.6, 0.45)
	label.position = Vector3(0.0, 2.1, 0.0)
	_thief.add_child(label)

## 106장 ㊴ 배달 기계(미래) — 코드로 그린 둥근 몸·눈 띠·프로펠러 고리 둘. 떠서 천천히 오르내린다.
func _drone_body(tint: Color) -> Node3D:
	var root := Node3D.new()
	var hull := StandardMaterial3D.new()
	hull.albedo_color = Color(0.92, 0.94, 0.97)
	hull.metallic = 0.4
	hull.roughness = 0.35
	var glow := StandardMaterial3D.new()
	glow.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	glow.albedo_color = tint
	var float_root := Node3D.new()
	float_root.position = Vector3(0.0, 1.3, 0.0)
	root.add_child(float_root)
	var body := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.38
	sm.height = 0.62
	body.mesh = sm
	body.material_override = hull
	float_root.add_child(body)
	var eye := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.42, 0.08, 0.06)
	eye.mesh = bm
	eye.material_override = glow
	eye.position = Vector3(0.0, 0.06, 0.34)
	float_root.add_child(eye)
	var box := MeshInstance3D.new()
	var bb := BoxMesh.new()
	bb.size = Vector3(0.34, 0.26, 0.3)
	box.mesh = bb
	box.material_override = glow
	box.position = Vector3(0.0, -0.36, 0.0)
	float_root.add_child(box)
	for x in [-0.5, 0.5]:
		var ring := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 0.16
		tm.outer_radius = 0.22
		ring.mesh = tm
		ring.material_override = hull
		ring.position = Vector3(x, 0.22, 0.0)
		float_root.add_child(ring)
	var tw := float_root.create_tween().set_loops()
	tw.tween_property(float_root, "position:y", 1.45, 0.9).set_trans(Tween.TRANS_SINE)
	tw.tween_property(float_root, "position:y", 1.3, 0.9).set_trans(Tween.TRANS_SINE)
	return root

## 옛 제단 — 돌 받침 + 붙으면 켜지는 불꽃. 붙기 전까지 element_receiver.
func _build_altar(p: Vector3, siege := false) -> void:
	_altar = SiegeAltar.new() if siege else Node3D.new()
	_altar.name = "StoryAltar"
	add_child(_altar)
	_altar.global_position = p
	var stone := StandardMaterial3D.new()
	stone.albedo_color = Color(0.52, 0.5, 0.47)
	for i in 2:
		var mi := MeshInstance3D.new()
		var c := CylinderMesh.new()
		c.top_radius = 0.7 - i * 0.25
		c.bottom_radius = 0.85 - i * 0.25
		c.height = 0.5
		mi.mesh = c
		mi.material_override = stone
		mi.position = Vector3(0.0, 0.25 + i * 0.5, 0.0)
		_altar.add_child(mi)
	_altar_flame = MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.3
	sm.height = 0.8
	(_altar_flame as MeshInstance3D).mesh = sm
	var fm := StandardMaterial3D.new()
	fm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	fm.albedo_color = Color(1.0, 0.7, 0.3)
	(_altar_flame as MeshInstance3D).material_override = fm
	_altar_flame.position = Vector3(0.0, 1.4, 0.0)
	_altar_flame.visible = false
	_altar.add_child(_altar_flame)
	if siege:
		_defend_label = Label3D.new()
		_defend_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		_defend_label.no_depth_test = true
		_defend_label.font_size = 48
		_defend_label.outline_size = 10
		_defend_label.pixel_size = 0.006
		_defend_label.position = Vector3(0.0, 2.3, 0.0)
		_altar.add_child(_defend_label)
	add_to_group("element_receiver")

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 5
	add_child(layer)
	## 추적 글자 — 미니맵·왼쪽 위 글자들 밑(world_map 이 옮긴 날씨 줄 아래).
	_tracker = Label.new()
	_tracker.offset_left = 40
	_tracker.offset_top = 455
	_tracker.add_theme_font_size_override("font_size", 17)
	_tracker.add_theme_color_override("font_color", GOLD)
	_tracker.add_theme_color_override("font_outline_color", Color(0, 0, 0))
	_tracker.add_theme_constant_override("outline_size", 6)
	_tracker.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(_tracker)
	_talk_btn = Button.new()
	_talk_btn.text = "대화 (F)"
	_talk_btn.anchor_left = 0.5
	_talk_btn.anchor_right = 0.5
	_talk_btn.anchor_top = 1.0
	_talk_btn.anchor_bottom = 1.0
	_talk_btn.offset_left = -70
	_talk_btn.offset_right = 70
	_talk_btn.offset_top = -170
	_talk_btn.offset_bottom = -124
	_talk_btn.visible = false
	_talk_btn.pressed.connect(func() -> void: interact())
	layer.add_child(_talk_btn)
	var jb := Button.new()
	jb.text = "임무 (O)"
	jb.position = Vector2(540, 20)
	jb.custom_minimum_size = Vector2(96, 40)
	jb.pressed.connect(toggle_journal)
	layer.add_child(jb)
	## 임무 목록.
	var jl := CanvasLayer.new()
	jl.layer = 6
	add_child(jl)
	_journal = Control.new()
	_journal.set_anchors_preset(Control.PRESET_FULL_RECT)
	_journal.visible = false
	jl.add_child(_journal)
	var dim := ColorRect.new()
	dim.color = Color(0.05, 0.05, 0.1, 0.82)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_journal.add_child(dim)
	_journal_label = Label.new()
	_journal_label.position = Vector2(120, 80)
	_journal_label.add_theme_font_size_override("font_size", 18)
	_journal.add_child(_journal_label)
	_wq_label = Label.new()
	_wq_label.position = Vector2(700, 80)
	_wq_label.add_theme_font_size_override("font_size", 18)
	_journal.add_child(_wq_label)
	_track_box = VBoxContainer.new()
	_track_box.position = Vector2(700, 420)
	_journal.add_child(_track_box)
	var close := Button.new()
	close.text = "닫기 (Esc)"
	close.position = Vector2(120, 30)
	close.custom_minimum_size = Vector2(120, 40)
	close.pressed.connect(toggle_journal)
	_journal.add_child(close)
	## 대화 창 — 아래 가운데. 창을 누르면 다음 줄.
	var dl := CanvasLayer.new()
	dl.layer = 7
	add_child(dl)
	_dlg = Control.new()
	_dlg.anchor_left = 0.5
	_dlg.anchor_right = 0.5
	_dlg.anchor_top = 1.0
	_dlg.anchor_bottom = 1.0
	_dlg.offset_left = -380
	_dlg.offset_right = 380
	_dlg.offset_top = -250
	_dlg.offset_bottom = -40
	_dlg.visible = false
	dl.add_child(_dlg)
	var bg := Button.new()
	bg.flat = false
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.modulate = Color(1, 1, 1, 0.92)
	bg.pressed.connect(next_line)
	_dlg.add_child(bg)
	_dlg_name = Label.new()
	_dlg_name.position = Vector2(24, 14)
	_dlg_name.add_theme_font_size_override("font_size", 20)
	_dlg_name.add_theme_color_override("font_color", GOLD)
	_dlg_name.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dlg.add_child(_dlg_name)
	_dlg_text = Label.new()
	_dlg_text.position = Vector2(24, 48)
	_dlg_text.size = Vector2(712, 70)
	_dlg_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_dlg_text.add_theme_font_size_override("font_size", 18)
	_dlg_text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dlg.add_child(_dlg_text)
	_dlg_choices = VBoxContainer.new()
	_dlg_choices.position = Vector2(420, 96)
	_dlg_choices.custom_minimum_size = Vector2(320, 0)
	_dlg.add_child(_dlg_choices)
	var hint := Label.new()
	hint.text = "F · Space · 누르기 ▶"
	hint.position = Vector2(24, 176)
	hint.add_theme_font_size_override("font_size", 13)
	hint.modulate = Color(1, 1, 1, 0.6)
	hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dlg.add_child(hint)
