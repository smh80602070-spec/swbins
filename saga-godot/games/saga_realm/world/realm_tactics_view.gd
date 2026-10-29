extends Node3D

## G-0183 — 사가천하 전술판 3D(파이어 엠블렘 풍화설월 3D, 웹 tactics-view3d.js 의 고돗 짝). 출진 상자에서 "♟ 전술판"을 고르면 열린다.
## 규칙은 games/saga_realm/data/realm_tactics.gd(G-0182) 하나 — 이 노드는 판을 그리고, 고른 칸을 그 함수에 넘기고, 바뀐 것을 연출할 뿐이다(판정 두 벌 금지).
## 적 차례·맡기기는 "규칙을 먼저 돌리고 → 전후 차이(자리·기록)를 한 동작씩 연출"한다 — 연출이 규칙을 앞서거나 바꾸지 않는다.
##
##   판      성 화면과 떨어진 자리(ORIGIN)에 칸 8×6(칸 2m) — 평지 모래빛·숲 짙은 초록+원뿔 나무·강 파랑(낮음)·성벽 회색(높음), 웹과 같은 색
##   카메라  판 남쪽 위 3/4(pitch 50°), 장수를 고르면 0.3초 당김 · 닫으면 성 화면 카메라로 돌아간다
##   유닛    장수 = 그 인물 몸(VroidBody) · 부대 = 무리 몸 0.7배 + 깃발 · 발밑 편 색 원판 · 머리 위 이름·hp
##   조작    칸 클릭/터치 · 키보드·패드 = 방향(ui_*)으로 커서, 결정(ui_accept)·취소(ui_cancel) · 단추 "턴 끝"·"맡기기"·"물러나기"
##   끝      결과 넷(대승·승·무승부·패)을 띄우고 1.4초 뒤 닫으며 done(apply 보정값)을 부른다. 물러나기(Esc)면 done({}) — 보정 없이 그냥 출진.

const RealmTactics := preload("res://games/saga_realm/data/realm_tactics.gd")
const CampaignCommand := preload("res://games/saga_realm/data/realm_commander.gd")
const CampaignUltimate := preload("res://games/saga_realm/data/realm_ultimate.gd")
const CampaignClass := preload("res://games/saga_realm/data/realm_class.gd")
const BattleEvent := preload("res://games/saga_realm/data/realm_battle_event.gd")
const SideGoal := preload("res://games/saga_realm/data/realm_side_goal.gd")
const LivePortrait := preload("res://saga_core/ui/live_portrait.gd")
const VroidBody := preload("res://saga_core/world/vroid_body.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")   # G-0347 ⑤-c 일기토·설전(옛 고르기 창 그대로)
const RealmWar := preload("res://games/saga_realm/data/realm_war.gd")
## G-0253 — 타격 VFX: 1만리·2나락·4종횡과 같은 공용 그림(베기 궤적·불꽃·바닥 충격파). 새 그림 없음, instant 면 하나도 안 만든다.
const CombatFx := preload("res://saga_core/combat_fx.gd")
const SLASH_AT := 0.15      # 휘두름 안 궤적 시점(SWING_SEC×0.6 안)
const HITSTOP := 0.06       # 맞음 멈칫
const DODGE := 0.25         # 빗나감 — 공격 반대쪽으로 피하는 거리(m)
const CAM_SHAKE := 0.05     # 컷 중 맞음 카메라 흔들림(m)
## G-0223 — 보드게임 시제품처럼 보이던 판(베이지 단색 칸·회색 상자 성벽·원뿔 나무)을 자체 PBR(K-0093)로: 칸 지형마다 결, 성벽 돌벽 + 여장,
## 판 틀 널판, 숲 나무 = 줄기 + 잎 덩이 셋, 강 = 매끈한 물빛. 빛깔은 웹과 같은 COL 그대로(결만 사진). SAGA_REALM_OLD=1 이면 예전 판.
const RealPbr := preload("res://saga_core/world/real_pbr.gd")
const REAL_SET := {"plain": "gravel", "forest": "grass", "wall": "stonewall", "gate": "planks"}   # hill 은 결 없이 흙빛(평지 자갈과 같으면 높이만 보여 언덕인 줄 모름 — 촬영 rk_tactics_wide)

const ORIGIN := Vector3(3000.0, 0.0, 0.0)   # 성 화면(원점 둘레)과 겹치지 않는 자리
const CELL := 2.0
const TOP := {"plain": 0.2, "forest": 0.2, "river": -0.05, "wall": 1.0, "hill": 0.75, "gate": 0.2}   # hill·gate — G-0347 ③ SRPG 판   # 칸 윗면 높이
const COL := {"plain": Color("c8b47a"), "forest": Color("5f8446"), "river": Color("4f86b3"), "wall": Color("857563"), "hill": Color("a8925c"), "gate": Color("8a5a2b")}
const HI_MOVE := Color(0.5, 0.82, 1.0, 0.42)
const HI_ATTACK := Color(1.0, 0.36, 0.3, 0.5)
const HI_SEL := Color(1.0, 0.88, 0.54, 0.85)
const HI_COMMAND := Color(1.0, 0.78, 0.24, 0.2)
const HI_CURSOR := Color(1.0, 1.0, 1.0, 0.5)
const HI_FIRE := Color(1.0, 0.55, 0.12, 0.6)   # G-0347 화계 놓을 칸
const SIDE_COL := {"me": Color(0.35, 0.62, 1.0), "foe": Color(0.95, 0.35, 0.3)}
const CAM_PITCH := 50.0
const CAM_DIST := 17.0
const CAM_NEAR := 12.0
const STEP_SEC := 0.25   # 칸 하나 걷기
const FootLock := preload("res://saga_core/player/foot_lock.gd")   # G-0264 걸음새(전술판은 IK 없이 빠르기만)
const LifePose := preload("res://saga_core/world/life_pose.gd")   # G-0266 장수 대기 몸짓·명 받음
const IDLE_CHECK := 0.5     # 대기 몸짓 고르기 간격(타이머 하나)
const IDLE_GAP := [4.0, 6.0]   # 장수마다 다음 둘러보기·체중까지
const SWING_SEC := 0.4
const END_SEC := 1.4

var board: Dictionary = {}
var _cam_dist := CAM_DIST   # G-0347 ⑥ 판 너비·화면 비율에 맞춘 거리(세로 폰에서 10×8~12×10 판이 잘리던 것 — 촬영 rk_tactics_wide 720×1280)
var enemy_id := ""
var instant := false   # 점검용 — 연출 기다림을 건너뛴다
var _done_cb: Callable
var _units := {}   # uid -> {node, label, ap}
var _hi := {}      # "x,y" -> MeshInstance3D(칸 위 얇은 판)
var _cam: Camera3D
var _prev_cam: Camera3D
var _hud_hidden: Array = []
var _paused_cams: Array = []   # 성 카메라(realm_camera.gd)는 매 프레임 current 를 다시 잡는다 — 판이 열린 동안 멈춘다
var _ui: CanvasLayer
var _title: Label
var _weather_status: Label
var _hint: Label
var _buttons: Array = []
var _sel := ""
var _cursor := Vector2i(1, 1)
var _busy := false
var _closed := false
var _foe_turn := false   # 제목 "적 차례" 표시용(규칙의 board.side 와 따로)
## G-0191 — 엑스컴식 엄폐 방패(웹 W-0168): 장수를 고르면 갈 칸·칠 칸 중 숲(엄폐 30) = 반 방패, 성벽(50) = 온 방패를 칸 위에 띄운다.
## 공격 컷: 칠 때 카메라가 공격자 뒤 어깨 위로 CUT_IN 초에 당겼다가 CUT_HOLD 초 뒤 제자리로. 맡기기(자동)·instant·cut_cam=false 면 안 함.
static var cut_cam := true
static var cur_cols := RealmTactics.COLS   # G-0347 ④ 지금 판 크기(open 이 판에서 받는다 — 옛 판 8×6)
static var cur_rows := RealmTactics.ROWS
const CUT_IN := 0.25
const CUT_HOLD := 1.1
const SHIELD_HALF := Color(1.0, 0.78, 0.32, 0.92)
const SHIELD_FULL := Color(0.55, 0.82, 1.0, 0.95)
var _shields: Array = []   # 지금 떠 있는 방패 노드
var _auto_mode := false
var cut_count := 0         # 점검용 — 컷을 몇 번 했나
var _idle_t := 0.0          # G-0266 대기 몸짓 타이머(하나)
var _idle_rng := RandomNumberGenerator.new()   # 규칙 난수와 따로(전술 결과 그대로)
var _fire_mode := false   # G-0347 책략 고르는 중(_plot 이 어떤 책략인지)
var _plot := ""   # "fire" | "confuse" | "heal" — 📜 단추를 누를 때마다 쓸 수 있는 것 사이를 돈다
const PLOT_ICON := {"fire": "🔥", "confuse": "🌀", "heal": "💚"}
const HI_HEAL := Color(0.4, 1.0, 0.55, 0.55)
var _fire_btn: Button = null
var _cmd := ""   # G-0347 ⑤-c "duel" | "debate" — 상대 장수를 고르는 중
var _ult_mode := false
var _ult_btn: Button
var _ult_gauge: ProgressBar
var _ult_seen := 0
var _duel_btn: Button = null
var _debate_btn: Button = null
var _event_panel: PanelContainer
var _event_portrait: Control
var _event_tag: Label
var _event_line: Label
var _event_seen := 0
var _event_queue: Array = []
var _event_elapsed := 0.0
var _event_current: Dictionary = {}
var _side_status: Label
var _side_marks: Dictionary = {}
const HI_DUEL := Color(1.0, 0.85, 0.2, 0.6)
var _flames := {}   # "x,y" → 불 표식 노드
var _swing_n := 0          # G-0253 — 뷰 안 연타 셈(궤적 기울기 차례)


## 연다 — host 는 씬 안 아무 노드(토스트·트리 찾기용), tb = RealmSaveState.tactics_board() 결과, done(grid: Dictionary).
static func open(host: Node, p_enemy_id: String, tb: Dictionary, done: Callable, p_instant := false) -> Node3D:
	var v: Node3D = load("res://games/saga_realm/world/realm_tactics_view.gd").new()
	v.name = "TacticsView"
	v.board = tb.board
	cur_cols = int(tb.board.get("cols", RealmTactics.COLS))   # G-0347 ④ SRPG 판은 10×8~12×10
	cur_rows = int(tb.board.get("rows", RealmTactics.ROWS))
	v.enemy_id = p_enemy_id
	v._done_cb = done
	v.instant = p_instant
	v.set_meta("mine", tb.get("mine", []))
	var scene := host.get_tree().current_scene if host.get_tree().current_scene != null else host.get_tree().root
	scene.add_child(v)
	return v


## 화면 좌표 광선 → 칸 (x, y). 판 밖·위를 보는 광선이면 (-1, -1). 순수 함수(점검 대상)
static func ray_to_cell(ray_origin: Vector3, ray_dir: Vector3, center: Vector3, top_y: float = 0.2) -> Vector2i:
	if ray_dir.y >= -0.0001:
		return Vector2i(-1, -1)
	var t := (top_y - ray_origin.y) / ray_dir.y
	var p := ray_origin + ray_dir * t
	var x := int(floor((p.x - center.x) / CELL + cur_cols * 0.5))
	var y := int(floor((p.z - center.z) / CELL + cur_rows * 0.5))
	if x < 0 or y < 0 or x >= cur_cols or y >= cur_rows:
		return Vector2i(-1, -1)
	return Vector2i(x, y)


static func cell_center(x: int, y: int) -> Vector3:
	return ORIGIN + Vector3((float(x) - cur_cols * 0.5 + 0.5) * CELL, 0.0, (float(y) - cur_rows * 0.5 + 0.5) * CELL)


func _ready() -> void:
	add_to_group("ui_modal")   # 이야기 카드(scenario_runner)·다른 창이 판 위로 안 뜨게
	_idle_rng.seed = 20260824   # G-0266 대기 몸짓 차례(그림만)
	_build_ground()
	_build_cells()
	_build_side_markers()
	_build_units()
	_build_camera()
	_fit_labels()   # G-0348 카메라가 멀어지면 이름 글도 줄인다
	_build_ui()
	_hide_hud(true)
	_refresh()


# ── 짓기 ──────────────────────────────────────────

func _mat(c: Color, unshaded := false) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	if c.a < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.no_depth_test = false
	if unshaded:
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	return m


func _box(size: Vector3, pos: Vector3, c: Color, real_set := "", real_kind := 0) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	if real_set == "" or not _real() or not RealPbr.apply_box(mi, size, real_set, real_kind, c):
		mi.material_override = _mat(c)
	mi.position = pos
	add_child(mi)
	return mi


static func _real() -> bool:
	return RealPbr.available("stonewall") and OS.get_environment("SAGA_REALM_OLD") == ""


func _build_ground() -> void:
	var field := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(80, 80)
	field.mesh = pm
	field.material_override = _mat(Color("5d6b42"))
	if _real():
		field.material_override = RealPbr.material("grass", 0, Color("5d6b42"))
	field.position = ORIGIN + Vector3(0, -0.3, 0)
	add_child(field)
	_box(Vector3(cur_cols * CELL + 0.6, 0.5, cur_rows * CELL + 0.6), ORIGIN + Vector3(0, -0.2, 0), Color("3b3326"), "planks", 1)   # 판 테두리(웹 frame)


func _build_cells() -> void:
	var trunk := _mat(Color("5a4127"))
	var leaf := _mat(Color("2f5a2c"))
	for y in cur_rows:
		for x in cur_cols:
			var t := RealmTactics.cell_at(board, x, y)
			var top: float = TOP.get(t, 0.2)
			var c := cell_center(x, y)
			var h := top + 0.25
			var cell_box := _box(Vector3(CELL - 0.06, h, CELL - 0.06), c + Vector3(0, top - h * 0.5, 0), COL.get(t, COL.plain), String(REAL_SET.get(t, "")))
			if _real() and t == "river":   # 매끈한 물빛(결 없이 반사)
				var wm := _mat(COL.river)
				wm.roughness = 0.08
				wm.metallic = 0.15
				cell_box.material_override = wm
			if _real() and t == "wall":   # 여장 — 윗면 네 변에 낮은 돌 덩이
				for k in 4:
					var along := (-0.7 + 0.47 * k)
					for e in [Vector3(along, 0, -0.78), Vector3(along, 0, 0.78), Vector3(-0.78, 0, along), Vector3(0.78, 0, along)]:
						if k % 2 == 0:
							_box(Vector3(0.3, 0.3, 0.3), c + e + Vector3(0, top + 0.15, 0), COL.wall, "stonewall")
			if _real() and t == "forest":   # 나무 둘 = 줄기 + 크기 다른 잎 덩이 셋
				for k in 2:
					var off := Vector3(-0.45 + 0.9 * k, 0, -0.35 + 0.7 * ((x + y + k) % 2))
					_box(Vector3(0.16, 0.7, 0.16), c + off + Vector3(0, top + 0.35, 0), Color("5a4127"), "planks", 1)
					for b in 3:
						var leaf_ball := MeshInstance3D.new()
						var sm := SphereMesh.new()
						var r := 0.42 - 0.08 * b
						sm.radius = r
						sm.height = r * 1.8
						sm.radial_segments = 16
						sm.rings = 8
						leaf_ball.mesh = sm
						leaf_ball.material_override = RealPbr.material("grass", 0, Color("2f5a2c").lightened(0.06 * b), 1.4)
						leaf_ball.position = c + off + Vector3(0.12 * ((b + k) % 3 - 1), top + 0.85 + 0.32 * b, 0.1 * (b % 2))
						add_child(leaf_ball)
			elif t == "forest":   # 원뿔 나무 둘(코드 도형)
				for k in 2:
					var off := Vector3(-0.45 + 0.9 * k, 0, -0.35 + 0.7 * ((x + y + k) % 2))
					var tr := MeshInstance3D.new()
					var cy := CylinderMesh.new()
					cy.top_radius = 0.08
					cy.bottom_radius = 0.1
					cy.height = 0.5
					tr.mesh = cy
					tr.material_override = trunk
					tr.position = c + off + Vector3(0, top + 0.25, 0)
					add_child(tr)
					var cone := MeshInstance3D.new()
					var cm := CylinderMesh.new()
					cm.top_radius = 0.0
					cm.bottom_radius = 0.42
					cm.height = 1.3
					cone.mesh = cm
					cone.material_override = leaf
					cone.position = c + off + Vector3(0, top + 1.1, 0)
					add_child(cone)
			var hi := MeshInstance3D.new()
			var hp := PlaneMesh.new()
			hp.size = Vector2(CELL - 0.2, CELL - 0.2)
			hi.mesh = hp
			hi.position = c + Vector3(0, top + 0.03, 0)
			hi.visible = false
			add_child(hi)
			_hi["%d,%d" % [x, y]] = hi


func _build_side_markers() -> void:
	var cells := SideGoal.cells(board)
	for key: String in cells:
		var parts := key.split(",")
		var x := int(parts[0]); var y := int(parts[1])
		var kind := String(cells[key])
		var marker := Label3D.new()
		marker.name = "SideGoal_%s_%d_%d" % [kind, x, y]
		marker.text = String(SideGoal.ICON.get(kind, ""))
		marker.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		marker.no_depth_test = true
		marker.fixed_size = true
		marker.pixel_size = 0.0012
		marker.font_size = 48
		marker.outline_size = 8
		marker.position = cell_center(x, y) + Vector3(0, float(TOP.get(RealmTactics.cell_at(board, x, y), 0.2)) + 1.35, 0)
		add_child(marker)
		_side_marks[key] = marker


func _refresh_side_goals() -> void:
	var result := SideGoal.result(board)
	_side_status.visible = not result.is_empty()
	if not result.is_empty():
		var goals: Array[String] = []
		if int(result.get("chests", 0)) > 0: goals.append("📦 보물 %d/%d" % [int(result.loot), int(result.chests)])
		if int(result.get("total", 0)) > 0: goals.append("🏘️ 마을 %d/%d" % [int(result.kept), int(result.total)])
		_side_status.text = " · ".join(goals)
	var cells := SideGoal.cells(board)
	for key: String in _side_marks:
		if cells.has(key): (_side_marks[key] as Label3D).text = String(SideGoal.ICON.get(String(cells[key]), ""))


func _unit_name(u: Dictionary) -> String:
	if String(u.kind) == "troop":
		var arm := "부대" if String(u.get("arm", "")) == "" else "%s병" % String(RealmTactics.ARM_NAME[u.arm])
		if bool(u.get("merc", false)):
			var boss := CampaignCommand.commander(board, u)
			if not boss.is_empty(): return "%s 휘하 %s" % [_officer_name(String(boss.id)), arm]
		return arm
	if bool(u.get("leader", false)):
		var hl = Characters.find(String(u.id))
		return "👑 " + (String(hl.name) if hl != null else String(u.id))
	var h = Characters.find(String(u.id))
	return String(h.name) if h != null else String(u.id)


func _officer_name(id: String) -> String:
	var h = Characters.find(id)
	return String(h.get("name", id)) if h is Dictionary else id


func _build_units() -> void:
	for u: Dictionary in board.units:
		if _units.has(String(u.uid)):
			continue
		var root := Node3D.new()
		root.name = String(u.uid).replace(":", "_")
		add_child(root)
		var body: Node3D
		if String(u.kind) == "officer":
			body = VroidBody.build(String(u.id), 3)
		else:
			body = VroidBody.build_pool(VroidBody.BANDIT_POOL, String(u.uid), 2)
			body.scale *= 0.7
			var pole := _box(Vector3(0.05, 1.6, 0.05), Vector3.ZERO, Color(0.35, 0.25, 0.15))
			remove_child(pole)
			root.add_child(pole)
			pole.position = Vector3(-0.45, 0.8, 0)
			var flag := _box(Vector3(0.02, 0.4, 0.55), Vector3.ZERO, SIDE_COL[u.side])
			remove_child(flag)
			root.add_child(flag)
			flag.position = Vector3(-0.45, 1.4, 0.28)
		root.add_child(body)
		var disc := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.7
		cm.bottom_radius = 0.7
		cm.height = 0.04
		disc.mesh = cm
		disc.material_override = _mat(Color(SIDE_COL[u.side], 0.55), true)
		disc.position = Vector3(0, 0.03, 0)
		root.add_child(disc)
		var label := Label3D.new()
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.no_depth_test = true
		label.fixed_size = true
		label.pixel_size = 0.00075
		label.font_size = 18
		label.outline_size = 7
		label.modulate = SIDE_COL[u.side].lightened(0.35)
		var label_stagger := float((int(u.x) + int(u.y)) % 3) * 0.6
		label.position = Vector3(0, (2.15 if String(u.kind) == "officer" else 1.75) + label_stagger, 0)
		root.add_child(label)
		var aps := body.find_children("*", "AnimationPlayer", true, false)
		_units[String(u.uid)] = {"node": root, "label": label, "ap": aps[0] if not aps.is_empty() else null, "hp": float(u.hp),
			"life": LifePose.attach_npc(body, hash(String(u.uid)), false), "idle_at": _idle_rng.randf_range(IDLE_GAP[0], IDLE_GAP[1])}   # G-0266
		_place(String(u.uid), int(u.x), int(u.y))
		_face(String(u.uid), Vector3(1, 0, 0) if u.side == "me" else Vector3(-1, 0, 0))
		_set_label(String(u.uid))


func _sync_units() -> void:
	_build_units()
	_fit_labels()


func _build_camera() -> void:
	_prev_cam = get_viewport().get_camera_3d()
	var scene := get_tree().current_scene
	if scene != null:
		for c in scene.find_children("*", "Camera3D", true, false):
			if c.is_processing():
				c.set_process(false)
				_paused_cams.append(c)
	_cam = Camera3D.new()
	_cam.fov = 50.0
	add_child(_cam)
	_cam_dist = fit_dist(cur_cols, cur_rows, get_viewport().get_visible_rect().size)
	_aim_camera(ORIGIN, _cam_dist)
	_cam.current = true


## G-0348 이름 글은 화면 크기 고정(fixed_size)이라 카메라가 물러나도(세로 화면·큰 판) 그대로 커서 칸끼리 겹쳤다 — 물러난 만큼(CAM_DIST/거리, 0.55 까지) 줄인다
static func label_scale(dist: float) -> float:
	return clampf(CAM_DIST / maxf(dist, 0.01), 0.55, 1.0)


func _fit_labels() -> void:
	var k := label_scale(_cam_dist)
	for uid in _units:
		var l: Label3D = _units[uid].get("label")
		if l != null:
			l.pixel_size = 0.00075 * k


## 판 전체가 들어오는 거리 — 가로 시야(fov 50 세로 기준)로 판 너비(+여유), 세로로 깊이. 옛 8×6 가로 화면은 CAM_DIST 그대로(그보다 가깝게 안 함)
static func fit_dist(cols: int, rows: int, view: Vector2) -> float:
	var aspect := view.x / maxf(view.y, 1.0)
	var vh := deg_to_rad(50.0) * 0.5
	var hh := atan(tan(vh) * aspect)
	var w := float(cols) * CELL * 0.5 + 1.2
	var d := float(rows) * CELL * 0.5 + 1.2
	return maxf(CAM_DIST, maxf(w / tan(hh), d / tan(vh) * 1.15))


func _aim_camera(focus: Vector3, dist: float) -> void:
	var p := deg_to_rad(CAM_PITCH)
	_cam.position = focus + Vector3(0, sin(p) * dist, cos(p) * dist)
	_cam.look_at(focus, Vector3.UP)


func _build_ui() -> void:
	_ui = CanvasLayer.new()
	_ui.layer = 20
	add_child(_ui)
	var top := PanelContainer.new()
	top.anchor_left = 0.0
	top.anchor_right = 1.0
	top.offset_left = 16
	top.offset_right = -16
	top.offset_top = 12
	_ui.add_child(top)
	var col := VBoxContainer.new()
	top.add_child(col)
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 26)
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(_title)
	_weather_status = Label.new()
	_weather_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_weather_status.add_theme_font_size_override("font_size", 16)
	_weather_status.add_theme_color_override("font_color", Color("a9d8ff"))
	_weather_status.visible = false
	col.add_child(_weather_status)
	_hint = Label.new()
	_hint.add_theme_font_size_override("font_size", 20)
	_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(_hint)
	_side_status = Label.new()
	_side_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_side_status.add_theme_font_size_override("font_size", 16)
	_side_status.add_theme_color_override("font_color", Color("ffe29a"))
	_side_status.visible = false
	col.add_child(_side_status)
	_ult_gauge = ProgressBar.new()
	_ult_gauge.custom_minimum_size = Vector2(280, 14)
	_ult_gauge.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_ult_gauge.show_percentage = true
	_ult_gauge.visible = false
	var gauge_bg := StyleBoxFlat.new()
	gauge_bg.bg_color = Color("20242b")
	gauge_bg.set_corner_radius_all(5)
	var gauge_fill := StyleBoxFlat.new()
	gauge_fill.bg_color = Color("f2a93b")
	gauge_fill.set_corner_radius_all(5)
	_ult_gauge.add_theme_stylebox_override("background", gauge_bg)
	_ult_gauge.add_theme_stylebox_override("fill", gauge_fill)
	col.add_child(_ult_gauge)
	var row := HBoxContainer.new()
	row.anchor_left = 0.0
	row.anchor_right = 1.0
	row.anchor_top = 1.0
	row.anchor_bottom = 1.0
	row.offset_top = -84
	row.offset_bottom = -16
	row.offset_left = 16
	row.offset_right = -16
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 16)
	_ui.add_child(row)
	for spec: Array in [["⏭ 턴 끝", _on_end_turn], ["🤖 맡기기", _on_auto], ["↩ 물러나기", _on_cancel]]:
		var b := Button.new()
		b.text = spec[0]
		b.custom_minimum_size = Vector2(190, 64)
		b.add_theme_font_size_override("font_size", 24)
		b.pressed.connect(spec[1])
		row.add_child(b)
		_buttons.append(b)
	_fire_btn = Button.new()   # G-0347 지력 높은 장수를 골랐을 때만 보인다
	_fire_btn.text = "📜 책략"
	_fire_btn.custom_minimum_size = Vector2(190, 64)
	_fire_btn.add_theme_font_size_override("font_size", 24)
	_fire_btn.visible = false
	_fire_btn.pressed.connect(_on_fire_toggle)
	row.add_child(_fire_btn)
	_ult_btn = Button.new()
	_ult_btn.text = "💥 필살"
	_ult_btn.custom_minimum_size = Vector2(170, 64)
	_ult_btn.add_theme_font_size_override("font_size", 22)
	_ult_btn.visible = false
	_ult_btn.pressed.connect(_on_ultimate)
	row.add_child(_ult_btn)
	for spec: Array in [["duel", "⚔️ 일기토"], ["debate", "🗣️ 설전"]]:   # G-0347 ⑤-c 이웃 적 장수에게 거는 명령 — 걸 수 있을 때만 보인다
		var cb := Button.new()
		cb.text = spec[1]
		cb.custom_minimum_size = Vector2(170, 64)
		cb.add_theme_font_size_override("font_size", 24)
		cb.visible = false
		cb.pressed.connect(_on_cmd_toggle.bind(String(spec[0])))
		row.add_child(cb)
		if spec[0] == "duel":
			_duel_btn = cb
		else:
			_debate_btn = cb
	_event_panel = PanelContainer.new()
	_event_panel.anchor_left = 0.5
	_event_panel.anchor_right = 0.5
	_event_panel.anchor_top = 1.0
	_event_panel.anchor_bottom = 1.0
	_event_panel.offset_left = -310
	_event_panel.offset_right = 310
	_event_panel.offset_top = -190
	_event_panel.offset_bottom = -96
	_event_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_event_panel.visible = false
	var event_style := StyleBoxFlat.new()
	event_style.bg_color = Color("17130df2")
	event_style.border_color = Color("c9a35a")
	event_style.set_border_width_all(2)
	event_style.set_corner_radius_all(12)
	event_style.content_margin_left = 12
	event_style.content_margin_right = 16
	event_style.content_margin_top = 8
	event_style.content_margin_bottom = 8
	_event_panel.add_theme_stylebox_override("panel", event_style)
	_ui.add_child(_event_panel)
	var event_row := HBoxContainer.new()
	event_row.add_theme_constant_override("separation", 12)
	_event_panel.add_child(event_row)
	_event_portrait = LivePortrait.new()
	_event_portrait.custom_minimum_size = Vector2(64, 64)
	event_row.add_child(_event_portrait)
	var event_copy := VBoxContainer.new()
	event_copy.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	event_row.add_child(event_copy)
	_event_tag = Label.new()
	_event_tag.add_theme_font_size_override("font_size", 16)
	_event_tag.add_theme_color_override("font_color", Color("ffe27a"))
	event_copy.add_child(_event_tag)
	_event_line = Label.new()
	_event_line.add_theme_font_size_override("font_size", 18)
	_event_line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	event_copy.add_child(_event_line)


func _hide_hud(hide: bool) -> void:
	if hide:
		var scene := get_tree().current_scene
		if scene != null:
			for c in scene.get_children():
				if c is CanvasLayer and c != _ui and (c as CanvasLayer).visible:
					(c as CanvasLayer).visible = false
					_hud_hidden.append(c)
	else:
		for c in _hud_hidden:
			if is_instance_valid(c):
				(c as CanvasLayer).visible = true
		_hud_hidden.clear()


# ── 그리기 갱신 ──────────────────────────────────────

func _place(uid: String, x: int, y: int) -> void:
	var t := RealmTactics.cell_at(board, x, y)
	(_units[uid].node as Node3D).position = cell_center(x, y) + Vector3(0, TOP.get(t, 0.2), 0)


func _face(uid: String, dir: Vector3) -> void:
	if dir.length() < 0.001:
		return
	(_units[uid].node as Node3D).rotation.y = atan2(dir.x, dir.z)


func _set_label(uid: String) -> void:
	var u := RealmTactics.unit(board, uid)
	var shown: float = _units[uid].hp
	var short_name := _unit_name(u)
	if bool(u.get("merc", false)):
		short_name = "%s병" % String(RealmTactics.ARM_NAME.get(String(u.get("arm", "")), "용병"))
	(_units[uid].label as Label3D).text = "%s%s %d/%d" % ["🌀" if bool(u.get("confused", false)) else "", short_name, int(ceil(shown)), int(u.max)]
	(_units[uid].label as Label3D).visible = shown > 0.0


func _play(uid: String, clip: String) -> void:
	_hold(uid, clip != "idle")   # G-0266 — 걷기·공격·쓰러짐 동안 대기 몸짓 0
	var ap: AnimationPlayer = _units[uid].ap
	if ap != null and ap.has_animation(clip):
		ap.speed_scale = 1.0
		ap.play(clip)


## G-0264 — 칸 이동 빠르기(m/s)에 맞춘 걸음 클립·빠르기(디딘 발이 덜 미끄러지게). 몸 배율 = 동작 재생기의 몸 뿌리.
func _play_gait(uid: String, speed: float) -> void:
	var ap: AnimationPlayer = _units[uid].ap
	if ap == null:
		return
	var body := ap.get_parent() as Node3D
	var g: Array = FootLock.gait(speed, body.scale.y if body != null else 1.0, false)
	_play(uid, String(g[0]) if ap.has_animation(String(g[0])) else "walk")
	ap.speed_scale = float(g[1])


func _wait(sec: float) -> void:
	if instant or sec <= 0.0:
		return
	await get_tree().create_timer(sec).timeout


func _clear_hi() -> void:
	for k in _hi:
		(_hi[k] as MeshInstance3D).visible = false
	for n in _shields:
		if is_instance_valid(n):
			(n as Node).queue_free()
	_shields.clear()


## G-0191 — 엄폐 값 → 방패 종류(순수 함수): 0 없음 · 30 반 · 50 온(웹 W-0168 과 같은 문턱)
static func shield_kind(cover: int) -> String:
	if cover >= 50:
		return "full"
	if cover >= 30:
		return "half"
	return ""


func _add_shield(x: int, y: int) -> void:
	var cover := RealmTactics.cover_at(board, x, y)
	var kind := shield_kind(cover)
	if kind == "":
		return
	var root := Node3D.new()
	root.name = "Shield_%d_%d" % [x, y]
	root.set_meta("kind", kind)
	root.position = cell_center(x, y) + Vector3(0, float(TOP.get(RealmTactics.cell_at(board, x, y), 0.2)) + 0.95, 0)
	var q := QuadMesh.new()
	q.size = Vector2(0.5, 0.6 if kind == "full" else 0.32)
	var mi := MeshInstance3D.new()
	mi.mesh = q
	var m := _mat(SHIELD_FULL if kind == "full" else SHIELD_HALF, true)
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.no_depth_test = true
	mi.material_override = m
	mi.position.y = 0.0 if kind == "full" else -0.14
	root.add_child(mi)
	var l := Label3D.new()
	l.text = "−%d" % cover
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.fixed_size = true
	l.pixel_size = 0.001
	l.font_size = 22
	l.outline_size = 6
	l.position.y = -0.45
	root.add_child(l)
	add_child(root)
	_shields.append(root)


func _show_hi(x: int, y: int, c: Color) -> void:
	var mi: MeshInstance3D = _hi.get("%d,%d" % [x, y])
	if mi == null:
		return
	mi.material_override = _mat(c, true)
	mi.visible = true


func _tick_battle_events(delta: float) -> void:
	var log: Array = board.get("evLog", [])
	while _event_seen < log.size():
		_event_queue.append((log[_event_seen] as Dictionary).duplicate(true))
		_event_seen += 1
	if _event_current.is_empty() or _event_elapsed >= BattleEvent.SHOW_SECONDS:
		_event_current = _event_queue.pop_front() if not _event_queue.is_empty() else {}
		_event_elapsed = 0.0
		if _event_current.is_empty():
			_event_panel.visible = false
			return
		var tags := {"start":"⚔ 전투 개시", "story":"📖 장면 대사", "talk":"📖 전장 대화", "loot":"📦 보물 상자", "burn":"🔥 마을 습격", "reinforce":"⚠ 적 증원!", "ally":"🚩 원군 도착!", "low":"⚠ 적 대장 위기", "leaderDown":"👑 적 대장 격파", "foeDown":"적 장수 쓰러짐", "myDown":"아군 장수 쓰러짐"}
		_event_tag.text = "%s · %s" % [String(tags.get(String(_event_current.get("kind", "")), "전투 소식")), String(_event_current.get("speaker", ""))]
		var text := String(_event_current.get("text", ""))
		var colon := text.find(": ")
		_event_line.text = text.substr(colon + 2) if colon >= 0 else text
		var actor := RealmTactics.unit(board, String(_event_current.get("who", "")))
		_event_portrait.visible = not actor.is_empty() and String(actor.get("id", "")) != ""
		if _event_portrait.visible:
			_event_portrait.visible = bool(_event_portrait.call("setup", String(actor.id)))
		_event_panel.visible = true
	else:
		_event_elapsed += delta


func _targets_of(uid: String) -> Array:
	var u := RealmTactics.unit(board, uid)
	var out: Array = []
	if u.is_empty() or bool(u.acted):
		return out
	for t: Dictionary in RealmTactics.alive(board, "foe"):
		if RealmTactics.in_range(u, t):
			out.append(t)
	return out


func _refresh() -> void:
	_sync_units()
	_refresh_side_goals()
	for uid: String in _units:
		_set_label(uid)
	_clear_hi()
	var turn := mini(int(board.turn), RealmTactics.TURNS)
	_title.text = "♟ 전술판 — %d/%d턴 · %s" % [turn, RealmTactics.TURNS, "적 차례" if _foe_turn else "내 차례"]
	if bool(board.get("srpg", false)):   # G-0347 ④ 턴 상한 없음 — 목표가 제목
		_title.text = "♟ 전장 — 목표: %s · %d턴 · %s" % [RealmTactics.goal_text(board), int(board.turn), "적 차례" if _foe_turn else "내 차례"]
	_weather_status.text = RealmTactics.weather_text(board)
	_weather_status.visible = _weather_status.text != ""
	_ult_gauge.visible = false
	if _sel != "":
		var u := RealmTactics.unit(board, _sel)
		if bool(board.get("command", false)):
			for cell_key: String in CampaignCommand.range(board, _sel):
				var parts := cell_key.split(",")
				_show_hi(int(parts[0]), int(parts[1]), HI_COMMAND)
		_show_hi(int(u.x), int(u.y), HI_SEL)
		if not bool(u.moved):
			for c: Dictionary in RealmTactics.moves(board, _sel):
				if int(c.x) != int(u.x) or int(c.y) != int(u.y):
					_show_hi(int(c.x), int(c.y), HI_MOVE)
					_add_shield(int(c.x), int(c.y))
		var tips: Array = []
		for t: Dictionary in _targets_of(_sel):
			_show_hi(int(t.x), int(t.y), HI_ATTACK)
			var cv := RealmTactics.cover_at(board, int(t.x), int(t.y))
			_add_shield(int(t.x), int(t.y))
			var mods := ""
			for m: Array in RealmTactics.hit_mods(board, u, t):   # G-0347 ③ 높이·상성·뒤
				mods += " %s%+d" % [m[0], m[1]]
			tips.append("%s %d%%%s%s" % [_unit_name(t), RealmTactics.hit_chance_b(board, u, t), (" 엄폐 −%d" % cv) if cv > 0 else "", mods])
		var command_hint := ""
		if String(u.get("kind", "")) == "officer" and u.has("cmdR"):
			command_hint = " · 금빛 칸 = 지휘 %d칸, 용병 명중 ±%d%%p" % [int(u.cmdR), int(u.cmdA)]
		elif bool(u.get("merc", false)):
			var boss := CampaignCommand.commander(board, u)
			if not boss.is_empty(): command_hint = " · 지휘권 %s, 명중 ±%d%%p" % ["안" if CampaignCommand.in_command(board, u) else "밖", int(boss.cmdA)]
		if bool(board.get("campaign", false)) and String(u.get("kind", "")) == "officer":
			var class_key := String(u.get("cls", ""))
			if class_key != "": command_hint += " · " + CampaignClass.line(class_key)
			var gauge := CampaignUltimate.gauge(u)
			_ult_gauge.visible = true
			_ult_gauge.value = gauge
			var kind := CampaignUltimate.kind_of(u)
			command_hint += " · %s %d%%" % [String(CampaignUltimate.KIND_NAME[kind]), gauge]
			if gauge >= CampaignUltimate.FULL and not bool(u.get("acted", false)):
				command_hint += " — 💥 필살 단추 사용 가능"
			if _ult_mode:
				for cell: Vector2i in CampaignUltimate.cells(board, _sel): _show_hi(cell.x, cell.y, HI_FIRE)
				_hint.text = "%s — %s 필살: 주황 칸을 고르세요" % [_unit_name(u), String(CampaignUltimate.KIND_NAME[kind])]
			else:
				_hint.text = "%s — 파란 칸으로 옮기고 붉은 칸을 친다%s%s" % [_unit_name(u), command_hint, ("  (명중 " + " · ".join(tips) + ")") if not tips.is_empty() else ""]
		if _fire_mode:
			_clear_hi()
			_show_hi(int(u.x), int(u.y), HI_SEL)
			var left := int(board.get("plots", RealmTactics.PLOTS))
			match _plot:
				"fire":
					for c: Dictionary in RealmTactics.fire_cells(board, _sel):
						_show_hi(int(c.x), int(c.y), HI_FIRE)
					_hint.text = "%s — 🔥 화계: 주황 숲 칸에 불(성공 %d%% · 이웃 숲으로 번짐 · 적·아군 가리지 않고 두 턴 탐) · 책략 %d번 남음" % [_unit_name(u), RealmTactics.fire_chance(u), left]
				"confuse":
					var tips2: Array = []
					for tid: String in RealmTactics.plot_targets(board, _sel, "confuse"):
						var t2 := RealmTactics.unit(board, tid)
						_show_hi(int(t2.x), int(t2.y), HI_FIRE)
						tips2.append("%s %d%%" % [_unit_name(t2), RealmTactics.confuse_chance(u, t2)])
					_hint.text = "%s — 🌀 혼란: 걸린 적은 다음 차례를 쉰다(%s) · 책략 %d번 남음" % [_unit_name(u), " · ".join(tips2), left]
				"heal":
					for tid: String in RealmTactics.plot_targets(board, _sel, "heal"):
						var t3 := RealmTactics.unit(board, tid)
						_show_hi(int(t3.x), int(t3.y), HI_HEAL)
					_hint.text = "%s — 💚 회복: 초록 칸 아군 체력 +%d · 책략 %d번 남음" % [_unit_name(u), RealmTactics.heal_amount(u), left]
	else:
		_ult_gauge.visible = false
		_hint.text = "내 장수를 고르세요 · 숲은 명중 −30% · 성벽은 −50% · 3턴 안에 적을 무너뜨리면 대승"
		if bool(board.get("srpg", false)):
			_hint.text = "내 장수를 고르세요 · 숲 −30% · 성벽 −50% · 언덕 위 +10% · 창>기>궁>창 ±20% · 뒤 +20% · 👑 대장"
	var cur := _hi.get("%d,%d" % [_cursor.x, _cursor.y]) as MeshInstance3D
	if cur != null and not cur.visible:
		_show_hi(_cursor.x, _cursor.y, HI_CURSOR)
	for b: Button in _buttons:
		b.disabled = _busy
	if _duel_btn != null:
		_duel_btn.visible = _sel != "" and not RealmTactics.duel_targets(board, _sel).is_empty()
		_debate_btn.visible = _sel != "" and not RealmTactics.debate_targets(board, _sel).is_empty()
		_duel_btn.disabled = _busy
		_debate_btn.disabled = _busy
		_duel_btn.text = "✋ 일기토 그만" if _cmd == "duel" else "⚔️ 일기토"
		_debate_btn.text = "✋ 설전 그만" if _cmd == "debate" else "🗣️ 설전"
		if _sel != "" and _cmd != "":
			_clear_hi()
			var su := RealmTactics.unit(board, _sel)
			_show_hi(int(su.x), int(su.y), HI_SEL)
			for tid: String in (RealmTactics.duel_targets(board, _sel) if _cmd == "duel" else RealmTactics.debate_targets(board, _sel)):
				var tt := RealmTactics.unit(board, tid)
				_show_hi(int(tt.x), int(tt.y), HI_DUEL)
			_hint.text = "%s — 노란 칸 적 장수에게 %s" % [_unit_name(su), "⚔️ 일기토 3합(베기>막기>찌르기>베기 — 이기면 그 장수 −40%·한 차례 쉼, 지면 내가 −40%)" if _cmd == "duel" else "🗣️ 설전 3문(정답 2 이상이면 그 장수 기세 꺾임 — 공격 ×0.8·한 차례 쉼)"]
	if _fire_btn != null:
		_fire_btn.visible = _sel != "" and RealmTactics.can_fire(board, _sel)
		_fire_btn.disabled = _busy
		_fire_btn.text = ("%s %s ▸" % [PLOT_ICON[_plot], RealmTactics.PLOT_NAME[_plot]]) if _fire_mode else "📜 책략"
	if _ult_btn != null:
		var selected := RealmTactics.unit(board, _sel) if _sel != "" else {}
		var can_ult := not selected.is_empty() and CampaignUltimate.ready(board, _sel)
		_ult_btn.visible = can_ult or _ult_mode
		_ult_btn.disabled = _busy
		_ult_btn.text = "✋ 필살 취소" if _ult_mode else ("💥 %s" % String(CampaignUltimate.KIND_NAME[CampaignUltimate.kind_of(selected)]) if can_ult else "💥 필살")
	_sync_flames()


# ── 입력 ────────────────────────────────────────────

func _unhandled_input(event: InputEvent) -> void:
	if _closed or _busy:
		return
	var press_pos := Vector2(-1, -1)
	if event is InputEventMouseButton and (event as InputEventMouseButton).pressed and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
		press_pos = (event as InputEventMouseButton).position
	elif event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed:
		press_pos = (event as InputEventScreenTouch).position
	if press_pos.x >= 0.0:
		var cell := ray_to_cell(_cam.project_ray_origin(press_pos), _cam.project_ray_normal(press_pos), ORIGIN)
		if cell.x >= 0:
			_cursor = cell
			get_viewport().set_input_as_handled()
			pick_cell(cell.x, cell.y)
		return
	var d := Vector2i.ZERO
	if event.is_action_pressed("ui_left"):
		d = Vector2i(-1, 0)
	elif event.is_action_pressed("ui_right"):
		d = Vector2i(1, 0)
	elif event.is_action_pressed("ui_up"):
		d = Vector2i(0, -1)
	elif event.is_action_pressed("ui_down"):
		d = Vector2i(0, 1)
	if d != Vector2i.ZERO:
		_cursor = Vector2i(clampi(_cursor.x + d.x, 0, cur_cols - 1), clampi(_cursor.y + d.y, 0, cur_rows - 1))
		get_viewport().set_input_as_handled()
		_refresh()
	elif event.is_action_pressed("ui_accept"):
		get_viewport().set_input_as_handled()
		pick_cell(_cursor.x, _cursor.y)
	elif event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		if _sel != "":
			_ult_mode = false
			_sel = ""
			_refresh()
		else:
			_on_cancel()


func _unit_at(x: int, y: int) -> Dictionary:
	for u: Dictionary in board.units:
		if float(u.hp) > 0.0 and int(u.x) == x and int(u.y) == y:
			return u
	return {}


## 칸 하나를 골랐다 — 내 장수 고르기 / 고른 장수 옮기기 / 적 치기 / 풀기. 점검·촬영도 이걸 부른다.
func pick_cell(x: int, y: int) -> void:
	if _busy or _closed or board.side != "me" or String(board.done) != "":
		return
	var there := _unit_at(x, y)
	if _sel == "":
		if not there.is_empty() and there.side == "me" and not bool(there.acted):
			_select(String(there.uid))
		return
	var u := RealmTactics.unit(board, _sel)
	if _ult_mode:
		_ult_mode = false
		if CampaignUltimate.cells(board, _sel).has(Vector2i(x, y)):
			await _perform_ultimate(Vector2i(x, y))
		else:
			_refresh()
		return
	if _cmd != "":   # G-0347 ⑤-c 일기토·설전 — 노란 칸 적 장수면 건다, 아니면 그만
		var cmd := _cmd
		_cmd = ""
		var list: Array = RealmTactics.duel_targets(board, _sel) if cmd == "duel" else RealmTactics.debate_targets(board, _sel)
		if not there.is_empty() and list.has(String(there.uid)):
			if cmd == "duel":
				_duel_round(_sel, String(there.uid), RealmTactics.duel_foe_moves(board), [])
			else:
				var h = Characters.find(String(u.id))
				_debate_round(_sel, String(there.uid), RealmSaveState.debate_draw(String(u.id)) if h != null else [], [])
			return
		_refresh()
		return
	if _fire_mode:   # G-0347 책략 — 그 책략 칸이면 건다, 아니면 책략만 그만
		_fire_mode = false
		if _plot == "fire" and RealmTactics.fire_cells(board, _sel).has({"x": x, "y": y}):
			await _do_fire(_sel, x, y)
			_sel = ""
		elif _plot != "fire" and not there.is_empty() and RealmTactics.plot_targets(board, _sel, _plot).has(String(there.uid)):
			await _do_plot(_sel, _plot, String(there.uid))
			_sel = ""
		_refresh()
		_after_action()
		return
	if not there.is_empty() and there.side == "foe" and _targets_of(_sel).has(there):
		await _do_attack(_sel, String(there.uid))
		_sel = ""
	elif not there.is_empty() and there.side == "me":
		if String(there.uid) == _sel:
			_sel = ""
		elif not bool(there.acted):
			_select(String(there.uid))
			return
	elif there.is_empty() and not bool(u.moved):
		var from := Vector2i(int(u.x), int(u.y))
		if RealmTactics.move(board, _sel, x, y):
			await _anim_move(_sel, from, Vector2i(x, y))
			if _targets_of(_sel).is_empty():
				_sel = ""
	else:
		_sel = ""
	_refresh()
	_after_action()


func _select(uid: String) -> void:
	_sel = uid
	var lp: Node = _units[uid].get("life")
	if lp != null:   # G-0266 — 명 받음(끄덕임·손짓 0.8초)
		lp.call("talk_for", 0.8)
	var n: Node3D = _units[uid].node
	if not instant:
		var tw := create_tween()
		tw.tween_method(func(k: float) -> void: _aim_camera(ORIGIN.lerp(n.position, 0.35 * k), lerpf(_cam_dist, minf(CAM_NEAR, _cam_dist), k)), 0.0, 1.0, 0.3)
	_refresh()


func _on_ultimate() -> void:
	if _busy or _sel == "": return
	if _ult_mode:
		_ult_mode = false
		_refresh()
		return
	var u := RealmTactics.unit(board, _sel)
	if not CampaignUltimate.ready(board, _sel): return
	_fire_mode = false
	_cmd = ""
	if CampaignUltimate.kind_of(u) == "chonggong":
		await _perform_ultimate(Vector2i(int(u.x), int(u.y)))
	else:
		_ult_mode = true
		_refresh()


func _perform_ultimate(cell: Vector2i) -> void:
	if _busy or _sel == "": return
	_busy = true
	var log0 := (board.log as Array).size()
	var result := CampaignUltimate.use(board, _sel, cell)
	if bool(result.get("ok", false)):
		RealmTactics.check(board)
		var history: Array = board.get("ultLog", [])
		if not history.is_empty():
			_show_ultimate_cut(history[-1])
			_ult_seen = history.size()
		for i in range(log0, (board.log as Array).size()):
			await _anim_hit((board.log as Array)[i])
		for unit: Dictionary in board.units:
			if _units.has(String(unit.uid)):
				_units[String(unit.uid)].hp = float(unit.hp)
		_sel = ""
	_busy = false
	_refresh()
	_after_action()


# ── 대기 몸짓(G-0266) ──────────────────────────────────

func _hold(uid: String, on: bool) -> void:
	var lp: Node = _units[uid].get("life") if _units.has(uid) else null
	if lp != null and is_instance_valid(lp):
		lp.call("set_hold", on)


## 타이머 하나 — 0.5초에 한 번 판 위 장수(보이는 전원)를 훑어, 차례가 된 쉬는 장수에게 둘러보기·체중(4~6초마다).
func _process(delta: float) -> void:
	if _closed:
		return
	_tick_battle_events(delta)
	if instant:
		return
	_idle_t += delta
	if _idle_t < IDLE_CHECK:
		return
	idle_tick(_idle_t)
	_idle_t = 0.0


func idle_tick(dt: float) -> void:
	for uid in _units:
		var u: Dictionary = _units[uid]
		var lp: Node = u.get("life")
		if lp == null or not is_instance_valid(lp) or not (u.node as Node3D).visible or float(u.hp) <= 0.0:
			continue
		u.idle_at = float(u.idle_at) - dt
		if float(u.idle_at) > 0.0 or bool(lp.call("is_held")) or String(lp.call("current")) != "":
			continue
		lp.call("play", "look" if _idle_rng.randf() < 0.5 else "shift")
		u.idle_at = _idle_rng.randf_range(IDLE_GAP[0], IDLE_GAP[1]) + 3.0


# ── 연출 ────────────────────────────────────────────

func _anim_move(uid: String, from: Vector2i, to: Vector2i) -> void:
	if from == to:
		return
	var n: Node3D = _units[uid].node
	var dest := cell_center(to.x, to.y) + Vector3(0, TOP.get(RealmTactics.cell_at(board, to.x, to.y), 0.2), 0)
	_face(uid, dest - n.position)
	if instant:
		n.position = dest
		return
	_play_gait(uid, CELL / STEP_SEC)
	var steps := absi(to.x - from.x) + absi(to.y - from.y)
	var tw := create_tween()
	tw.tween_property(n, "position", dest, STEP_SEC * float(steps))
	await tw.finished
	_play(uid, "idle")


func _float_text(at: Vector3, text: String, c: Color) -> void:
	if instant:
		return
	var l := Label3D.new()
	l.text = text
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.fixed_size = true
	l.pixel_size = 0.0022
	l.font_size = 34
	l.outline_size = 10
	l.modulate = c
	l.position = at + Vector3(0, 2.6, 0)
	add_child(l)
	var tw := create_tween()
	tw.tween_property(l, "position:y", l.position.y + 0.9, 0.8)
	tw.parallel().tween_property(l, "modulate:a", 0.0, 0.8)
	tw.tween_callback(l.queue_free)


func _show_ultimate_cut(record: Dictionary) -> void:
	var actor := RealmTactics.unit(board, String(record.get("a", "")))
	var kind := String(record.get("kind", ""))
	if actor.is_empty() or not CampaignUltimate.KIND_NAME.has(kind): return
	var previous := _ui.get_node_or_null("UltimateCutin")
	if previous != null: previous.free()
	var overlay := Control.new()
	overlay.name = "UltimateCutin"
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ui.add_child(overlay)
	var shade := ColorRect.new()
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.color = Color(0.0, 0.0, 0.0, 0.52)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay.add_child(shade)
	var band := PanelContainer.new()
	band.anchor_left = 0.07
	band.anchor_right = 0.93
	band.anchor_top = 0.29
	band.anchor_bottom = 0.71
	var style := StyleBoxFlat.new()
	style.bg_color = Color("182a50") if String(actor.side) == "foe" else Color("6e2015")
	style.border_color = Color("f3d27a")
	style.set_border_width_all(4)
	band.add_theme_stylebox_override("panel", style)
	overlay.add_child(band)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 28)
	band.add_child(row)
	var portrait := LivePortrait.new()
	portrait.custom_minimum_size = Vector2(180, 220)
	portrait.size_flags_vertical = Control.SIZE_EXPAND_FILL
	row.add_child(portrait)
	if not portrait.setup(String(actor.get("id", ""))): portrait.visible = false
	var column := VBoxContainer.new()
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_child(column)
	var title := Label.new()
	title.text = "%s %s!" % [String(CampaignUltimate.KIND_ICON[kind]), String(CampaignUltimate.KIND_NAME[kind])]
	title.add_theme_font_size_override("font_size", 48)
	title.add_theme_color_override("font_color", Color("ffe9a0"))
	column.add_child(title)
	var detail := Label.new()
	var hit_count := (record.get("hits", []) as Array).filter(func(h: Dictionary) -> bool: return int(h.get("dmg", 0)) > 0).size()
	detail.text = "%s  ·  %s" % [_officer_name(String(actor.get("id", ""))), ("용병 %d · 회복 %d · 명중 +25%%p" % [(record.get("hits", []) as Array).size(), int(record.get("heal", 0))]) if kind == "chonggong" else "타격 %d" % hit_count]
	detail.add_theme_font_size_override("font_size", 24)
	detail.add_theme_color_override("font_color", Color.WHITE)
	column.add_child(detail)
	var tw := create_tween()
	tw.tween_interval(1.35)
	tw.tween_property(overlay, "modulate:a", 0.0, 0.25)
	tw.tween_callback(overlay.queue_free)


func _anim_hit(entry: Dictionary) -> void:
	var a := String(entry.a)
	var t := String(entry.to)
	var an: Node3D = _units[a].node
	var tn: Node3D = _units[t].node
	if entry.has("ult"):
		_float_text(tn.position, "%s %d" % [String(CampaignUltimate.KIND_NAME.get(String(entry.ult), "필살")), int(entry.get("dmg", 0))], Color(1.0, 0.84, 0.3))
	var shown_skills: Array = entry.get("skills", [])
	if bool(entry.get("counter", false)):
		_float_text(an.position, "↩ 반격", Color(1.0, 0.7, 0.35))
	if shown_skills.is_empty() and String(entry.get("skill", "")) != "": shown_skills.append(String(entry.skill))
	if not shown_skills.is_empty(): _float_text(an.position, "✦ " + " · ".join(shown_skills), Color(1.0, 0.78, 0.3))
	_hold(t, true)   # G-0266 — 맞는 동안 몸짓 0
	_face(a, tn.position - an.position)
	var cut := cut_cam and not instant and not _auto_mode
	var saved := _cam.global_transform
	if cut:
		cut_count += 1
		await _cut_to(_cut_transform(an.position, tn.position), CUT_IN)
	_play(a, "attack")
	var fwd := tn.global_position - an.global_position
	var big := false
	if bool(entry.hit):
		var tu := RealmTactics.unit(board, t)
		big = not tu.is_empty() and float(entry.dmg) >= float(tu.get("max", 1e9)) * 0.3
	await _wait(SLASH_AT)
	if not instant:
		CombatFx.slash(an, fwd, CELL * 0.9, CombatFx.PHYSICAL, _swing_n % 5, big)
	_swing_n += 1
	await _wait(SWING_SEC * 0.6 - SLASH_AT)
	if bool(entry.hit):
		_units[t].hp = maxf(0.0, float(_units[t].hp) - float(entry.dmg))
		_float_text(tn.position, "-%d" % int(entry.dmg), Color(1, 0.85, 0.4))
		if not instant:
			CombatFx.spark(self, tn.global_position + Vector3(0, 1.0, 0), CombatFx.PHYSICAL, big)
			if cut:
				_shake_cam()
		await _wait(HITSTOP)
		if not instant:
			var base := tn.position
			var tw := create_tween()
			for k in 3:
				tw.tween_property(tn, "position", base + Vector3(0.12 * (1 - 2 * (k % 2)), 0, 0), 0.04)
			tw.tween_property(tn, "position", base, 0.04)
	else:
		_float_text(tn.position, "빗나감", Color(0.8, 0.85, 0.9))
		if not instant:
			var d := Vector3(fwd.x, 0, fwd.z)
			var base2 := tn.position
			var tw3 := create_tween()
			tw3.tween_property(tn, "position", base2 + (d.normalized() if d.length() > 0.01 else Vector3.RIGHT) * DODGE, 0.08).set_ease(Tween.EASE_OUT)
			tw3.tween_property(tn, "position", base2, 0.1)
	_set_label(t)
	await _wait(SWING_SEC * 0.4)
	_play(a, "idle")
	if cut:
		await _wait(maxf(0.0, CUT_HOLD - SWING_SEC))
		await _cut_to(saved, CUT_IN)
	if float(_units[t].hp) > 0.0:
		_hold(t, false)
	if float(_units[t].hp) <= 0.0:
		_play(t, "death")
		var ap: AnimationPlayer = _units[t].ap
		if not instant and (ap == null or not ap.has_animation("death")):
			tn.rotation.x = -PI * 0.5   # 쓰러짐 클립이 없으면 눕힌다
		await _wait(0.5)
		if not instant:
			CombatFx.element_burst(self, tn.global_position, 0.9, CombatFx.PHYSICAL, 0.4, "", false)
			var tw2 := create_tween()
			tw2.tween_property(tn, "scale", Vector3.ONE * 0.01, 0.35)
			await tw2.finished
		tn.visible = false


## G-0191 — 공격자 뒤 어깨 위(뒤 1.8m·위 2.3m·옆 0.7m)에서 대상을 보는 자리
static func _cut_transform(a: Vector3, t: Vector3) -> Transform3D:
	var back := Vector3(a.x - t.x, 0, a.z - t.z)
	back = back.normalized() if back.length() > 0.01 else Vector3(0, 0, 1)
	var side := Vector3(-back.z, 0, back.x)
	var pos := a + back * 1.8 + Vector3(0, 2.3, 0) + side * 0.7
	return Transform3D(Basis.IDENTITY, pos).looking_at(t + Vector3(0, 1.0, 0), Vector3.UP)


## G-0253 — 컷 중 맞으면 카메라 0.05m 두 번(0.04초씩 — 되돌림 tween 훨씬 앞에서 끝남)
func _shake_cam() -> void:
	var p0 := _cam.position
	var tw := create_tween()
	for k in 2:
		tw.tween_property(_cam, "position", p0 + Vector3(0, CAM_SHAKE * (1 - 2 * k), 0), 0.04)
		tw.tween_property(_cam, "position", p0, 0.04)


func _cut_to(to: Transform3D, sec: float) -> void:
	var from := _cam.global_transform
	var tw := create_tween()
	tw.tween_method(func(k: float) -> void: _cam.global_transform = from.interpolate_with(to, k), 0.0, 1.0, sec).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await tw.finished


func _do_attack(uid: String, tuid: String) -> void:
	_busy = true
	_refresh()
	var n0 := (board.log as Array).size()
	var r: Dictionary = RealmTactics.attack(board, uid, tuid)
	if bool(r.get("ok", false)):
		for i in range(n0, (board.log as Array).size()):
			await _anim_hit(board.log[i])
	_busy = false


## 규칙을 이미 돌린 뒤 — 전 상태(snap)와 지금 판의 차이를 차례대로 연출(유닛마다 옮김 → 그 유닛의 공격)
func _play_diff(snap: Dictionary, log0: int) -> void:
	var ult_history: Array = board.get("ultLog", [])
	for i in range(_ult_seen, ult_history.size()):
		_show_ultimate_cut(ult_history[i])
	_ult_seen = ult_history.size()
	var moved := {}
	var logs: Array = (board.log as Array).slice(log0)
	for e: Dictionary in logs:
		if bool(e.get("fled", false)):
			var fled_uid := String(e.get("to", ""))
			if _units.has(fled_uid):
				var root: Node3D = _units[fled_uid].node
				_float_text(root.position, "궤주", Color(1.0, 0.75, 0.35))
				_units[fled_uid].hp = 0.0
				_set_label(fled_uid)
				root.visible = false
			continue
		var a := String(e.a)
		if not moved.has(a):
			moved[a] = true
			var u := RealmTactics.unit(board, a)
			await _anim_move(a, snap[a], Vector2i(int(u.x), int(u.y)))
		await _anim_hit(e)
	for u: Dictionary in board.units:
		var uid := String(u.uid)
		if not moved.has(uid) and snap.has(uid) and snap[uid] != Vector2i(int(u.x), int(u.y)):
			await _anim_move(uid, snap[uid], Vector2i(int(u.x), int(u.y)))


func _snap() -> Dictionary:
	var s := {}
	for u: Dictionary in board.units:
		s[String(u.uid)] = Vector2i(int(u.x), int(u.y))
	return s


func _on_end_turn() -> void:
	if _busy or _closed or String(board.done) != "":
		return
	_busy = true
	_sel = ""
	_foe_turn = true
	_refresh()
	var snap := _snap()
	var log0 := (board.log as Array).size()
	RealmTactics.ai_turn(board)
	await _play_diff(snap, log0)
	await _apply_burn(board.get("burn_last", []))   # G-0347 불 칸 위가 탐
	board.burn_last = []
	_foe_turn = false
	_busy = false
	_refresh()
	_after_action()


func _on_auto() -> void:
	if _busy or _closed or String(board.done) != "":
		return
	_busy = true
	_sel = ""
	_refresh()
	_auto_mode = true   # 맡기기 — 공격 컷 안 함(웹 W-0168 "자동 모드면 안 함")
	var snap := _snap()
	var log0 := (board.log as Array).size()
	RealmTactics.auto_side(board, "me")
	RealmTactics.check(board)
	await _play_diff(snap, log0)
	_busy = false
	if String(board.done) == "":
		await _on_end_turn()
	else:
		_after_action()
	_auto_mode = false



## G-0347 화계 ────────────────────────────────────────

## 📜 — 누를 때마다 쓸 수 있는 책략(화계 → 혼란 → 회복) 다음 것, 끝이면 그만
func _on_fire_toggle() -> void:
	if _busy or _sel == "" or not RealmTactics.can_fire(board, _sel):
		return
	var avail: Array = []
	if not RealmTactics.fire_cells(board, _sel).is_empty():
		avail.append("fire")
	for p in ["confuse", "heal"]:
		if not RealmTactics.plot_targets(board, _sel, p).is_empty():
			avail.append(p)
	var i := avail.find(_plot) if _fire_mode else -1
	if i + 1 >= avail.size():
		_fire_mode = false
		_plot = ""
	else:
		_fire_mode = true
		_plot = avail[i + 1]
	_refresh()


func _do_plot(uid: String, plot_key: String, tuid: String) -> void:
	_busy = true
	_refresh()
	var r: Dictionary = RealmTactics.plot(board, uid, plot_key, tuid)
	if bool(r.get("ok", false)):
		_play(uid, "attack")
		var tn: Node3D = _units[tuid].node
		if plot_key == "heal":
			_units[tuid].hp = float(RealmTactics.unit(board, tuid).hp)
			_float_text(tn.position, "💚 +%d" % int(r.amount), Color(0.45, 1.0, 0.55))
			_set_label(tuid)
			if not instant:
				CombatFx.element_burst(self, tn.global_position + Vector3(0, 0.8, 0), 0.9, Color(0.4, 1.0, 0.55), 0.4, "", false)
		else:
			_float_text(tn.position, "🌀 혼란!" if bool(r.hit) else "혼란 실패", Color(0.75, 0.6, 1.0) if bool(r.hit) else Color(0.8, 0.85, 0.9))
			if bool(r.hit):
				_set_label(tuid)
		await _wait(0.6)
		_play(uid, "idle")
	_busy = false


func _do_fire(uid: String, x: int, y: int) -> void:
	_busy = true
	_refresh()
	var r: Dictionary = RealmTactics.fire(board, uid, x, y)
	if bool(r.get("ok", false)):
		_play(uid, "attack")
		var at := cell_center(x, y) + Vector3(0, 1.2, 0)
		_float_text(at, "🔥 화계!" if bool(r.lit) else "화계 실패", Color(1.0, 0.6, 0.2) if bool(r.lit) else Color(0.8, 0.85, 0.9))
		_sync_flames()
		if bool(r.lit) and not instant:
			CombatFx.element_burst(self, at, 1.4, Color(1.0, 0.5, 0.1), 0.5, "", false)
		await _wait(0.5)
		await _apply_burn(r.hits)
		_play(uid, "idle")
	_busy = false


## 탄 유닛 — 숫자·체력 글·쓰러짐(공격과 같은 쓰러짐 연출)
func _apply_burn(hits: Array) -> void:
	for h: Dictionary in hits:
		var uid := String(h.uid)
		if not _units.has(uid):
			continue
		var tn: Node3D = _units[uid].node
		_units[uid].hp = float(RealmTactics.unit(board, uid).hp)
		_float_text(tn.position, "🔥-%d" % int(h.dmg), Color(1.0, 0.55, 0.2))
		_set_label(uid)
		if bool(h.killed):
			_play(uid, "death")
			var ap: AnimationPlayer = _units[uid].ap
			if not instant and (ap == null or not ap.has_animation("death")):
				tn.rotation.x = -PI * 0.5
			await _wait(0.4)
			tn.visible = false
	_sync_flames()


## 불 칸 표식 — 판의 불(board.fire)과 맞춘다(주황 빛 기둥 + 남은 턴)
func _sync_flames() -> void:
	var fire: Dictionary = board.get("fire", {})
	for k in _flames.keys():
		if not fire.has(k):
			(_flames[k] as Node).queue_free()
			_flames.erase(k)
	for k: String in fire:
		var xy := k.split(",")
		if not _flames.has(k):
			var root := Node3D.new()
			root.name = "Flame_%s" % k.replace(",", "_")
			var mi := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = 0.15
			cm.bottom_radius = CELL * 0.38
			cm.height = 1.3
			mi.mesh = cm
			var m := _mat(Color(1.0, 0.45, 0.08, 0.7), true)
			m.emission_enabled = true
			m.emission = Color(1.0, 0.45, 0.08)
			mi.material_override = m
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			mi.position.y = 0.65
			root.add_child(mi)
			var l := Label3D.new()
			l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			l.no_depth_test = true
			l.font_size = 40
			l.outline_size = 8
			l.pixel_size = 0.008
			l.position.y = 1.6
			l.name = "Left"
			root.add_child(l)
			add_child(root)
			root.position = cell_center(int(xy[0]), int(xy[1])) + Vector3(0, float(TOP.forest), 0)
			_flames[k] = root
		((_flames[k] as Node).get_node("Left") as Label3D).text = "🔥%d" % int(fire[k].left)



## G-0347 ⑤-c 일기토·설전 ─────────────────────────────

func _on_cmd_toggle(cmd: String) -> void:
	if _busy or _sel == "":
		return
	_fire_mode = false
	_cmd = "" if _cmd == cmd else cmd
	_refresh()


func _prompt(title: String, choices: Array) -> CanvasLayer:
	var layer := ChoicePrompt.build(self, title, choices)
	layer.layer = 25   # 전술판 글·단추(20) 위
	return layer


## 일기토 한 합 — 적 수는 판 굴림으로 미리(foe_moves), 내 수는 고르기
func _duel_round(uid: String, tuid: String, foe_moves: Array, mine: Array) -> void:
	_busy = true
	var box := {}
	var choices: Array = []
	for mv: String in RealmWar.DUEL_MOVES:
		choices.append({"label": String(RealmWar.DUEL_MOVE_NAME[mv]), "cb": func() -> void:
			(box["layer"] as CanvasLayer).queue_free()
			var next: Array = mine.duplicate()
			next.append(mv)
			if next.size() < RealmWar.DUEL_ROUNDS:
				_duel_round(uid, tuid, foe_moves, next)
			else:
				_duel_done(uid, tuid, foe_moves, next)})
	box["layer"] = _prompt("⚔️ 일기토 — %s 대 %s · %d합째" % [_unit_name(RealmTactics.unit(board, uid)), _unit_name(RealmTactics.unit(board, tuid)), mine.size() + 1], choices)


func _duel_done(uid: String, tuid: String, foe_moves: Array, mine: Array) -> void:
	var net := 0
	var log_txt: Array = []
	for i in mine.size():
		var res := RealmWar.duel_round_result(String(mine[i]), String(foe_moves[i]))
		net += 1 if res == "win" else (-1 if res == "lose" else 0)
		log_txt.append("%s/%s %s" % [RealmWar.DUEL_MOVE_NAME[mine[i]], RealmWar.DUEL_MOVE_NAME[foe_moves[i]], "○" if res == "win" else ("×" if res == "lose" else "△")])
	var r: Dictionary = RealmTactics.duel(board, uid, tuid, net)
	Toast.show(self, "⚔️ 일기토 %s — %s" % [" · ".join(log_txt), "이겼다!" if net > 0 else ("졌다…" if net < 0 else "비겼다")], 3.0)
	var hits: Array = []
	if int(r.get("dmg_foe", 0)) > 0:
		hits.append({"uid": tuid, "dmg": int(r.dmg_foe), "killed": float(RealmTactics.unit(board, tuid).hp) <= 0.0})
	if int(r.get("dmg_me", 0)) > 0:
		hits.append({"uid": uid, "dmg": int(r.dmg_me), "killed": float(RealmTactics.unit(board, uid).hp) <= 0.0})
	_play(uid, "attack")
	await _apply_burn(hits)
	_set_label(tuid)
	_play(uid, "idle")
	_busy = false
	_sel = ""
	_refresh()
	_after_action()


## 설전 한 문
func _debate_round(uid: String, tuid: String, questions: Array, answers: Array) -> void:
	_busy = true
	if questions.is_empty():
		_debate_done(uid, tuid, 0)
		return
	var box := {}
	var q: Dictionary = questions[answers.size()]
	var choices: Array = []
	var opts: Array = q.choices
	for i in opts.size():
		choices.append({"label": String(opts[i]), "cb": func() -> void:
			(box["layer"] as CanvasLayer).queue_free()
			var next: Array = answers.duplicate()
			next.append(i)
			if next.size() < questions.size():
				_debate_round(uid, tuid, questions, next)
			else:
				_debate_done(uid, tuid, int(RealmSaveState.debate_result(questions, next).correct))})
	box["layer"] = _prompt("🗣️ 설전(%d/%d) — %s" % [answers.size() + 1, questions.size(), String(q.q)], choices)


func _debate_done(uid: String, tuid: String, correct: int) -> void:
	var r: Dictionary = RealmTactics.debate(board, uid, tuid, correct)
	var tn: Node3D = _units[tuid].node
	_float_text(tn.position, "기세 꺾임!" if bool(r.get("won", false)) else "헛말…", Color(1.0, 0.85, 0.3) if bool(r.get("won", false)) else Color(0.8, 0.85, 0.9))
	Toast.show(self, "🗣️ 설전 %d/3 정답 — %s" % [correct, "적 장수의 기세가 꺾였다(공격 ×0.8·한 차례 쉼)" if bool(r.get("won", false)) else "말이 먹히지 않았다"], 3.0)
	_set_label(tuid)
	await _wait(0.5)
	_busy = false
	_sel = ""
	_refresh()
	_after_action()


func _on_cancel() -> void:
	if _closed:
		return
	_finish({})


func _after_action() -> void:
	var out := RealmTactics.outcome(board)
	if out.is_empty():
		return
	_busy = true
	_title.text = "♟ 전술판 — %s" % String(out.name)
	var lines: Array = ["공 위력 %s%d%%" % ["+" if int(out.winPct) >= 0 else "", int(out.winPct)]]
	if float(out.lossMul) != 1.0:
		lines.append("받는 피해 ×%.1f" % float(out.lossMul))
	for id: String in out.fallen:
		lines.append("⚰ %s 쓰러짐" % _unit_name({"kind": "officer", "id": id}))
	for id: String in out.wounded:
		lines.append("🩹 %s 중상" % _unit_name({"kind": "officer", "id": id}))
	lines.append_array(preload("res://games/saga_realm/data/realm_support.gd").preview(RealmSaveState, out.get("supPairs", [])))   # G-0390 함께 싸운 쌍
	_hint.text = " · ".join(lines)
	_refresh_buttons_off()
	await _wait(END_SEC)
	var grid := RealmTactics.apply(out, enemy_id)
	grid["mine"] = get_meta("mine", [])
	_finish(grid)


func _refresh_buttons_off() -> void:
	for b: Button in _buttons:
		b.disabled = true


func _finish(grid: Dictionary) -> void:
	if _closed:
		return
	_closed = true
	_hide_hud(false)
	for c in _paused_cams:
		if is_instance_valid(c):
			c.set_process(true)
	if _prev_cam != null and is_instance_valid(_prev_cam):
		_prev_cam.current = true
	var cb := _done_cb
	queue_free()
	if cb.is_valid():
		cb.call(grid)
