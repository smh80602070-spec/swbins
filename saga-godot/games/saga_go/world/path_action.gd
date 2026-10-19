extends Node
## G-0240 길 행동(웹 W-0276, 옥토패스식) — npc_builder.gd 자식. 선두 동행(PartyState.party()[0])의 무력·지력·통솔 중
## 가장 높은 축(같으면 지력 → 무력 → 통솔)이 마을 사람에게 하는 한 가지를 정한다. 6 키·폰 "길" 단추(14m 안 주민이 있을 때만).
##   지력 → 조사: 가장 가까운 비경 입구(domains.gd _gates, 열린 것만)를 방위·m 로 알려 준다
##   무력 → 도발: 주민 자리에 도적 하나(체력 PartyState.atk × 14) — 쓰러뜨리면 경험 +30(금 없음), 60초 넘기거나 전멸이면 거절
##   통솔 → 이끌기: 나에게서 40m 넘는 가장 가까운 길목(waypoints.gd)으로 주민 몸이 땅을 따라 앞장서 걷고, 30초 뒤 집으로 돌아간다
## 주민마다 하루 한 번(PartyState.go_path = {day: Commissions.today(), used: {주민 id: 1 | -1}}). 조사·이끌기는 30% 로 거절,
## 도발은 지면 거절 — 거절한 주민은 그날 다시 말을 섞지 않는다(-1). 촌장 사명·상인 제안이 아직이면 그쪽 먼저(이 행동 안 됨).
## 비경 안·결투 중(duel_active)엔 안 된다.

const Characters := preload("res://saga_core/data/characters.gd")
const Commissions := preload("res://games/saga_go/data/commissions.gd")
const Domains := preload("res://games/saga_go/data/domains.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const PATH := {
	"wisdom": {"key": "probe", "name": "조사", "icon": "🔎"},
	"might": {"key": "provoke", "name": "도발", "icon": "⚔️"},
	"command": {"key": "lead", "name": "이끌기", "icon": "🧭"},
}
const FAIL := 0.3
const LEAD_MIN_M := 40.0
const LEAD_SEC := 30.0
const LEAD_SPEED := 4.5
const PROVOKE_SEC := 60.0
const PROVOKE_HP_MUL := 14.0
const PROVOKE_EXP := 30.0
const TALK_M := 14.0
const BUTTON_TICK := 0.25
const SHOW_SEC := 4.0

## 점검용 — 0 이상이면 randf() 대신 이 값으로 거절을 굴린다.
var test_roll := -1.0
## 지금 이끄는 주민 {id, root, home, to, t} · 지금 도발 결투 {id, name, enemy, t}
var leading := {}
var duel := {}
var last := {}
var _btn_t := 0.0

var _wired := false

func _ready() -> void:
	add_to_group("go_path_action")

## 들판 전투가 주민보다 늦게 설 수 있어 처음 틱에 잇는다.
func _wire() -> void:
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	if fc == null:
		return
	_wired = true
	fc.connect("party_wiped", func() -> void:
		if not duel.is_empty():
			_duel_lost("wipe"))

## 이 인물의 길 행동 — 없으면 {}.
static func path_of(h: Variant) -> Dictionary:
	if typeof(h) != TYPE_DICTIONARY or not (h as Dictionary).has("stats"):
		return {}
	var s: Dictionary = h.stats
	var k := "wisdom"
	if float(s.get("might", 0)) > float(s.get(k, 0)):
		k = "might"
	if float(s.get("command", 0)) > float(s.get(k, 0)):
		k = "command"
	return PATH[k]

static func lead_hero() -> Variant:
	var p := PartyState.party()
	return Characters.find(p[0]) if p.size() > 0 else null

func state() -> Dictionary:
	var s: Dictionary = PartyState.go_path
	if int(s.get("day", -1)) != Commissions.today() or typeof(s.get("used")) != TYPE_DICTIONARY:
		PartyState.go_path = {"day": Commissions.today(), "used": {}}
	return PartyState.go_path

## 0 아직 · 1 오늘 했다 · -1 거절(오늘 말을 안 섞는다)
func used(id: String) -> int:
	return int(state().used.get(id, 0))

## 촌장 사명 제안·상인 제안이 아직 남았으면 그쪽 먼저.
func _blocked_by_story(v: Dictionary) -> bool:
	if v.has("quest_id") and not QuestState.has_been_offered(v.quest_id):
		return true
	return v.has("offer_title") and not EventState.is_resolved("offer_" + v.id)

func _busy() -> bool:
	return get_tree().get_nodes_in_group("duel_active").size() > 0 or get_tree().get_nodes_in_group("go_domain_active").size() > 0 \
		or not duel.is_empty()

## 14m 안 가장 가까운 주민(VILLAGERS 줄) — 없으면 {}.
func nearest_villager() -> Dictionary:
	var p := get_tree().get_first_node_in_group("player") as Node3D
	if p == null:
		return {}
	var best := {}
	var bd := TALK_M
	for v in get_parent().VILLAGERS:
		var r: Node3D = (get_parent().roots as Dictionary).get(v.id, null)
		if r == null:
			continue
		var d := p.global_position.distance_to(r.global_position)
		if d <= bd:
			bd = d
			best = v
	return best

## 6 키·폰 단추 — 가까운 주민에게.
func act_nearest() -> Dictionary:
	var v := nearest_villager()
	if v.is_empty():
		return {"ok": false, "why": "no_one"}
	return act(v)

## 길 행동 하나 — 점검도 그대로 부른다.
func act(v: Dictionary) -> Dictionary:
	var a := path_of(lead_hero())
	if a.is_empty():
		Toast.show(self, "길 행동 — 함께 다니는 동료가 없습니다", 2.0)
		return {"ok": false, "why": "no_lead"}
	if _blocked_by_story(v) or _busy():
		return {"ok": false, "why": "busy"}
	var st := state()
	if int(st.used.get(v.id, 0)) != 0:
		Toast.show(self, "%s — 오늘은 이미 말을 섞었습니다" % v.name, 2.0)
		return {"ok": false, "why": "used", "act": a.key}
	var roll := test_roll if test_roll >= 0.0 else randf()
	if a.key != "provoke" and roll < FAIL:
		_refuse(v.id, v.name)
		last = {"ok": false, "why": "refused", "act": a.key}
		return last
	st.used[v.id] = 1
	var out := {"ok": true, "act": a.key}
	var me := (get_tree().get_first_node_in_group("player") as Node3D).global_position
	if a.key == "probe":
		var g := nearest_gate(me)
		if g.is_empty():
			Toast.show(self, "🔎 %s: 이 근처엔 비경이 없다고 합니다" % v.name, SHOW_SEC)
		else:
			out.target = g
			Toast.show(self, "🔎 %s: \"%s\" — %s쪽 %dm 에 있다더군요" % [v.name, g.name, compass(g.pos - me), roundi(_flat(g.pos - me))], SHOW_SEC)
	elif a.key == "lead":
		var w := nearest_waypoint(me)
		if w.is_empty():
			Toast.show(self, "🧭 %s: 가 볼 만한 곳이 가까이엔 없습니다" % v.name, SHOW_SEC)
		else:
			out.target = w
			var root: Node3D = (get_parent().roots as Dictionary)[v.id]
			_end_lead()
			leading = {"id": v.id, "root": root, "home": root.global_position, "to": w.pos, "t": 0.0, "region": TestMap.region_at(root.global_position)}
			Toast.show(self, "🧭 %s: \"%s\"까지 앞장서지요 · %dm" % [v.name, w.name, roundi(_flat(w.pos - me))], SHOW_SEC)
	else:
		out.foe_hp = _provoke(v)
	last = out
	return out

func _refuse(id: String, who: String) -> void:
	state().used[id] = -1
	Toast.show(self, "🙅 %s이(가) 고개를 돌립니다 — 오늘은 말을 섞지 않겠답니다" % who, SHOW_SEC)

## 열린 비경 입구 중 가장 가까운 것 {id, name, pos}.
func nearest_gate(from: Vector3) -> Dictionary:
	var dm := get_tree().get_first_node_in_group("go_domains")
	if dm == null:
		return {}
	var gates: Dictionary = dm.get("_gates")
	var best := {}
	var bd := INF
	for id in gates:
		if not Domains.domain_open(id):
			continue
		var d := _flat(gates[id] - from)
		if d < bd:
			bd = d
			best = {"id": id, "name": Domains.DOMAINS[id].name, "pos": gates[id]}
	return best

## from 에서 40m 넘는 가장 가까운 길목 {id, name, pos}.
func nearest_waypoint(from: Vector3) -> Dictionary:
	var wp := get_tree().get_first_node_in_group("go_waypoints")
	if wp == null:
		return {}
	var nodes: Dictionary = wp.get("_nodes")
	var best := {}
	var bd := INF
	for id in nodes:
		var d := _flat(nodes[id].pos - from)
		if d > LEAD_MIN_M and d < bd:
			bd = d
			best = {"id": id, "name": nodes[id].name, "pos": nodes[id].pos}
	return best

## 화면 앞(-Z)이 북.
static func compass(d: Vector3) -> String:
	var a := rad_to_deg(atan2(d.x, -d.z))
	if a < 0.0:
		a += 360.0
	return ["북", "북동", "동", "남동", "남", "남서", "서", "북서"][roundi(a / 45.0) % 8]

static func _flat(d: Vector3) -> float:
	return Vector2(d.x, d.z).length()

func _provoke(v: Dictionary) -> float:
	var root: Node3D = (get_parent().roots as Dictionary)[v.id]
	var me := (get_tree().get_first_node_in_group("player") as Node3D).global_position
	var dir := Vector3(me.x - root.global_position.x, 0.0, me.z - root.global_position.z)
	dir = dir.normalized() if dir.length() > 0.1 else Vector3(0, 0, 1)
	var home := root.global_position + dir * 2.0 + Vector3(0, 0.6, 0)
	var e := FieldEnemy.new()
	e.setup("bandit", home, 20260824 + v.id.length())
	var want := maxf(1.0, PartyState.atk * PROVOKE_HP_MUL)
	e.scale_stats(want / maxf(1.0, e.max_hp), 1.0)
	e.respawns = false
	e.drops = false
	e.name = "PathProvoke_%s" % v.id
	get_tree().current_scene.add_child(e)
	e.connect("died", _on_duel_died)
	duel = {"id": v.id, "name": v.name, "enemy": e, "t": 0.0}
	Toast.show(self, "⚔️ 도발 — %s이(가) 칼을 뽑습니다 (%d초)" % [v.name, int(PROVOKE_SEC)], SHOW_SEC)
	return want

func _on_duel_died(_e: Node) -> void:
	if duel.is_empty():
		return
	var who: String = duel.name
	duel = {}
	PartyState.add_exp(PROVOKE_EXP)
	last = {"ok": true, "act": "provoke", "won": true}
	Toast.show(self, "⚔️ %s을(를) 꺾었습니다 · 경험 +%d" % [who, int(PROVOKE_EXP)], SHOW_SEC)

func _duel_lost(why: String) -> void:
	var e: Node = duel.enemy
	var id: String = duel.id
	var who: String = duel.name
	duel = {}
	if is_instance_valid(e):
		e.queue_free()
	_refuse(id, who)
	last = {"ok": false, "act": "provoke", "won": false, "why": why}

func _end_lead() -> void:
	if leading.is_empty():
		return
	var r: Node3D = leading.root
	if is_instance_valid(r):
		r.global_position = leading.home
	leading = {}

func _process(delta: float) -> void:
	if not _wired:
		_wire()
	if not duel.is_empty():
		duel.t += delta
		if float(duel.t) > PROVOKE_SEC:
			_duel_lost("time")
	if not leading.is_empty():
		_walk(delta)
	_btn_t -= delta
	if _btn_t <= 0.0:
		_btn_t = BUTTON_TICK
		_refresh_button()

## 이끌기 — LEAD_SEC 동안 길목 쪽으로(닿으면 섬), 그 뒤 집으로 걸어 돌아간다. 땅 높이를 따른다.
func _walk(delta: float) -> void:
	var r: Node3D = leading.root
	if not is_instance_valid(r):
		leading = {}
		return
	leading.t += delta
	var back: bool = float(leading.t) > LEAD_SEC
	var goal: Vector3 = leading.home if back else leading.to
	var d := Vector3(goal.x - r.global_position.x, 0.0, goal.z - r.global_position.z)
	var step := LEAD_SPEED * delta
	if d.length() <= step:
		if back:
			_end_lead()
			return
		step = d.length()
	if d.length() > 0.01:
		var p := r.global_position + d.normalized() * step
		var reg: String = TestMap.region_at(p)
		p.y = TerrainBuilder.height_at(reg if reg != "" else String(leading.region), p)
		r.global_position = p
		r.look_at(Vector3(goal.x, p.y, goal.z), Vector3.UP, true)

## 폰 "길" — 14m 안 주민이 있을 때만 보이고, 오늘 이미 했으면 흐림.
func _refresh_button() -> void:
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	if fc == null:
		return
	var b: Control = (fc.get("_touch_buttons") as Dictionary).get("go_path", null)
	if b == null:
		return
	var v := nearest_villager()
	b.visible = not v.is_empty()
	if b.visible:
		b.modulate.a = 0.35 if used(v.id) != 0 or _blocked_by_story(v) else 1.0
