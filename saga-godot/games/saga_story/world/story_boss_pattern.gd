extends RefCounted

## G-0205 — 4종횡 사냥터 보스 패턴전 1차(웹 saga-web/saga-story/js/boss-pattern.js step·begin·resolve 의 공용 부분).
##   1단계(체력 100~66%) 내려찍기·낙석 · 2단계(66~33%) + 지진(땅에 붙어 있으면 맞음 — 점프·발판)·부하 둘 · 3단계(33% 밑) + 휩쓸기(초록 안전지대만 삶)
##   단계가 넘어가면 걸린 패턴을 거두고 포효(토스트·흔들림), 3단계는 광폭(보스 피해 ×1.25 · 패턴 간격 ×0.7).
## G-0206 2차 — 보스마다 고유 기술 하나(SIG — 등장 뒤 첫 기술, 이후 모든 단계 후보에 낌) · 그로기(피해 주는 패턴을 셋 잇달아 다 피하면
## 5초 멈춤·받는 피해 ×1.5) · 관문 대장(gate)은 단계·공용 없이 고유 기술만 4초 뒤·8초마다(step_sig). 달려들기는 story_enemy 가 한다.
## 웹 SIG 의 pull·chase 는 쓰는 보스가 고돗에 없어 안 옮김(표에도 없음).
## 바깥 일은 api 사전으로만 한다(웹 api 와 같은 결 — 점검이 가짜 api 로 단계·예고·판정을 굴린다):
##   hurt(양) · spawn(x) · toast(글) · shake(진폭, 초) · on_ground() · dmg · hp · hp_max · player_hp_max · name · width(맵 폭 m, 0 이면 자르지 않음)
## 거리는 4종횡 맵 배율(field_map SCALE 0.02 m/px, story_combat WARRIOR_RUSH_SCALE 과 같음). 쿨 흔들림은 보스마다 자체 RNG.

const CombatTell := preload("res://saga_core/combat_tell.gd")
const CombatFx := preload("res://saga_core/combat_fx.gd")

const S := 0.02
const PHASE_AT := [0.66, 0.33]
const CD := [6.5, 5.0, 3.8]
const FIRST_CD := 3.2
const ROAR_CD := 1.4
const SLAM_T := 1.0
const SLAM_R := 80.0 * S
const SLAM_MUL := 1.3
const ROCK_T := 1.1
const ROCK_R := 40.0 * S
const ROCK_MUL := 0.9
const ROCK_OFF := 130.0 * S
const ROCK_JIT := 50.0 * S
const QUAKE_T := 1.2
const QUAKE_MUL := 1.2
const QUAKE_Y := 8.0 * S
const SWEEP_T := 1.8
const SWEEP_W := 170.0 * S
const SWEEP_PCT := 0.55
const SWEEP_DIST := 150.0 * S
const SWEEP_DIST_JIT := 170.0 * S
const SUMMON_T := 0.4
const SUMMON_DX := 90.0 * S
const ENRAGE := 1.25
const NEAR_X := 420.0 * S # 웹 near: |dx| < (boss ? 420 : 260) && |dy| < 70
const NEAR_Y := 70.0 * S
## 고유 기술(웹 boss-pattern.js 49~55)
const RING_T := 1.3
const RING_R := 100.0 * S
const RING_MUL := 1.1
const VOLLEY_T := 1.2
const VOLLEY_R := 34.0 * S
const VOLLEY_MUL := 0.8
const VOLLEY_N := 5
const VOLLEY_GAP := 110.0 * S
const VOLLEY_JIT := 40.0 * S
const BEAM_T := 1.1
const BEAM_MUL := 1.1
const BEAM_Y := 95.0 * S
const PILLAR_T := 1.0
const PILLAR_T2 := 0.8
const PILLAR_W := 60.0 * S
const PILLAR_GAP := 120.0 * S
const PILLAR_N := 3
const PILLAR_MUL := 1.0
const GROGGY_N := 3
const GROGGY_T := 5.0
const GROGGY_MUL := 1.5
const GATE_SIG_CD := 8.0
const GATE_SIG_FIRST := 4.0
## 보스 이름 → [기술, 기술 이름] — 사냥터 보스 넷 + 관문 대장은 같은 넷의 강화판(이름이 같다)
const SIG := {
	"황건 두목": ["ring", "황천 부적진"],
	"오랑캐 족장": ["volley", "초원 화살비"],
	"위군 도독": ["beam", "쇠뇌 일제사"],
	"적국 대장군": ["pillar", "화계 불기둥"],
}
const TELL_H := 1.4 # 세운 띠의 높이(땅 위로 보이는 몫)
const COLORS := {"slam": Color(1.0, 0.35, 0.2), "rock": Color(0.85, 0.6, 0.35), "quake": Color(1.0, 0.55, 0.15), "sweep": Color(0.3, 0.95, 0.4),
	"ring": Color(0.31, 0.9, 0.47), "volley": Color(0.85, 0.6, 0.35), "beam": Color(1.0, 0.27, 0.2), "pillar": Color(1.0, 0.45, 0.1)}

var phase := 0
var cd := FIRST_CD
var kind := ""
var t := 0.0
var marks: Array = [] # [[Vector3 자리, 반경]]
var safe_x := 0.0
var summoned := 0
var last := ""
var boss_name := ""
var sig := "" # 고유 기술(없으면 "")
var first := "" # 등장 뒤 첫 기술(= 고유 기술, 한 번 쓰면 비움)
var gate := false # 관문 대장 — step_sig 만
var sig_cd := -1.0
var dodge := 0 # 그로기 셈
var groggy := 0.0
var begun := false # 이번 걸음에 패턴을 걸었나(story_enemy 가 달려들기를 미룬다)
var cx := 0.0 # ring 가운데
var px := 0.0 # pillar 기준 x
var wave := 0
var hit_acc := 0
var _rng := RandomNumberGenerator.new()


func _init(seed_value: int = 20260824, boss := "", is_gate := false) -> void:
	_rng.seed = seed_value
	boss_name = boss
	gate = is_gate
	if SIG.has(boss):
		sig = String(SIG[boss][0])
		first = sig


func sig_name() -> String:
	return String(SIG[boss_name][1]) if SIG.has(boss_name) else ""


## 그로기 동안 받는 피해 배율(story_enemy.take_damage 가 곱한다).
func dmg_taken_mul() -> float:
	return GROGGY_MUL if groggy > 0.0 else 1.0


static func phase_of(hp: float, hp_max: float) -> int:
	var r := hp / hp_max if hp_max > 0.0 else 1.0
	return 0 if r > PHASE_AT[0] else (1 if r > PHASE_AT[1] else 2)


static func pool_of(ph: int, sig_kind := "") -> Array:
	var out: Array = ["slam", "rock"] if ph == 0 else (["slam", "rock", "quake", "summon"] if ph == 1 else ["slam", "rock", "quake", "sweep"])
	if sig_kind != "":
		out.append(sig_kind)
	return out


## 광폭이면 보스 피해 배율(붙어 치기·패턴 둘 다).
func dmg_mul() -> float:
	return ENRAGE if phase == 2 else 1.0


func busy() -> bool:
	return kind != "" or groggy > 0.0


static func is_near(me: Node3D, player: Node3D) -> bool:
	return absf(player.global_position.x - me.global_position.x) < NEAR_X and absf(player.global_position.y - me.global_position.y) < NEAR_Y


## 한 걸음. 돌려주는 것 {phase, changed(단계가 넘어감), hit(이번에 맞은 수)}.
func step(me: Node3D, player: Node3D, delta: float, near: bool, api: Dictionary) -> Dictionary:
	var out := {"phase": phase, "changed": false, "hit": 0}
	begun = false
	var ph := phase_of(float(api.hp), float(api.hp_max))
	if ph > phase:
		phase = ph
		out.phase = ph
		out.changed = true
		kind = ""
		marks = []
		t = 0.0
		cd = ROAR_CD
		api.toast.call("⚠️ %s 2단계 — 땅이 흔들린다(점프로 피하라)!" % api.name if ph == 1 else "🔥 %s 광폭 — 휩쓸기가 온다!" % api.name)
		api.shake.call(0.2, 0.6)
		return out
	if _tick_busy(me, player, delta, api, out):
		return out
	cd -= delta * (1.0 / 0.7 if phase == 2 else 1.0)
	if cd <= 0.0 and near and not bool(api.get("charging", false)):
		var pool := pool_of(phase, sig)
		## 같은 것을 두 번 잇지 않는다 · 부르기는 단계마다 한 번(웹 그대로)
		var cand := pool.filter(func(k): return k != last and not (k == "summon" and summoned >= phase))
		if cand.is_empty():
			cand = pool
		var k := String(cand[_rng.randi() % cand.size()])
		if first != "":
			k = first # 등장 뒤 첫 기술은 고유 기술
			first = ""
		begin(me, player, k, api)
		cd = CD[phase]
	return out


## 관문 대장 — 고유 기술만(단계·공용·광폭 없음). 첫 번째는 GATE_SIG_FIRST 뒤, 이후 GATE_SIG_CD 마다.
func step_sig(me: Node3D, player: Node3D, delta: float, near: bool, api: Dictionary) -> Dictionary:
	var out := {"phase": 0, "changed": false, "hit": 0}
	begun = false
	if sig == "":
		return out
	if sig_cd < 0.0:
		sig_cd = GATE_SIG_FIRST
		first = ""
	if _tick_busy(me, player, delta, api, out):
		return out
	sig_cd -= delta
	if sig_cd <= 0.0 and near and not bool(api.get("charging", false)):
		begin(me, player, sig, api)
		sig_cd = GATE_SIG_CD
	return out


## 그로기·걸린 패턴을 한 걸음 — 이번 걸음을 여기서 끝냈으면 true(웹 tickBusy).
func _tick_busy(me: Node3D, player: Node3D, delta: float, api: Dictionary, out: Dictionary) -> bool:
	if groggy > 0.0:
		groggy -= delta
		out.groggy = true
		if groggy <= 0.0:
			groggy = 0.0
			cd = minf(cd, 1.0)
		return true
	if kind != "":
		t -= delta
		if t <= 0.0:
			if kind == "summon":
				kind = ""
			else:
				var rh := _resolve(me, player, api)
				if rh >= 0:
					out.hit = rh
					kind = ""
		return true
	return false


func begin(me: Node3D, player: Node3D, k: String, api: Dictionary) -> void:
	kind = k
	last = k
	marks = []
	begun = true
	var f := player.global_position
	var col: Color = COLORS.get(k, COLORS.slam)
	var w := float(api.get("width", 0.0))
	match k:
		"slam":
			t = SLAM_T
			marks = [[f, SLAM_R]]
			_upright(CombatTell.ring(me, f, SLAM_R, SLAM_T, col))
		"rock":
			t = ROCK_T
			for off in [0.0, -(ROCK_OFF + _rng.randf() * ROCK_JIT), ROCK_OFF + _rng.randf() * ROCK_JIT]:
				var mx: float = f.x + off
				if w > 0.0:
					mx = clampf(mx, 0.6, w - 0.6)
				var at := Vector3(mx, f.y, f.z)
				marks.append([at, ROCK_R])
				_upright(CombatTell.ring(me, at, ROCK_R, ROCK_T, col))
		"quake":
			t = QUAKE_T
			var cx := w * 0.5 if w > 0.0 else f.x
			_upright(CombatTell.band(me, Vector3(cx, me.global_position.y, 0.0), (w * 0.5 if w > 0.0 else 12.0), TELL_H, QUAKE_T, col))
		"sweep":
			t = SWEEP_T
			var side := -1.0 if _rng.randf() < 0.5 else 1.0
			var dist := SWEEP_DIST + _rng.randf() * SWEEP_DIST_JIT
			var sx := f.x + side * dist
			if w > 0.0:
				if sx < SWEEP_W * 0.5 + 0.2 or sx > w - SWEEP_W * 0.5 - 0.2:
					sx = f.x - side * dist
				sx = clampf(sx, SWEEP_W * 0.5 + 0.2, w - SWEEP_W * 0.5 - 0.2)
			safe_x = sx
			_upright(CombatTell.band(me, Vector3(sx, me.global_position.y, 0.0), SWEEP_W * 0.5, TELL_H, SWEEP_T, col))
			api.toast.call("⚠️ %s의 휩쓸기 — 초록 안전지대로!" % api.name)
		"summon":
			t = SUMMON_T
			summoned += 1
			api.spawn.call(me.global_position.x - SUMMON_DX)
			api.spawn.call(me.global_position.x + SUMMON_DX)
			api.toast.call("👥 %s(이)가 부하를 불렀다!" % api.name)
		"ring":
			## 보스 곁 원만 산다(붙어라) — 초록 원
			t = RING_T
			cx = me.global_position.x
			_upright(CombatTell.ring(me, Vector3(cx, me.global_position.y, 0.0), RING_R, RING_T, col))
		"volley":
			t = VOLLEY_T
			var j0 := (_rng.randf() - 0.5) * VOLLEY_JIT
			for i in VOLLEY_N:
				var vx := f.x + (i - 2) * VOLLEY_GAP + j0
				if w > 0.0:
					vx = clampf(vx, 0.4, w - 0.4)
				var at := Vector3(vx, f.y, f.z)
				marks.append([at, VOLLEY_R])
				_upright(CombatTell.ring(me, at, VOLLEY_R, VOLLEY_T, col))
		"beam":
			## 머리 높이 붉은 띠 — 뛰거나 발판 위면 맞는다(땅에 붙어라)
			t = BEAM_T
			var bx := w * 0.5 if w > 0.0 else f.x
			_upright(CombatTell.band(me, Vector3(bx, me.global_position.y + BEAM_Y, 0.0), (w * 0.5 if w > 0.0 else 12.0), 0.35, BEAM_T, col))
		"pillar":
			t = PILLAR_T
			wave = 1
			hit_acc = 0
			px = f.x
			_pillar_marks(me, w, col)
	if sig != "" and k == sig:
		api.toast.call("%s — %s" % [api.name, sig_name()])


## 불기둥 한 박자 — 내 발 둘레 120 칸, 첫 박자는 홀수 칸(내 칸은 비었다), 둘째는 짝수 칸(한 칸 옮겨 딛어야 산다).
func _pillar_marks(me: Node3D, w: float, col: Color) -> void:
	marks = []
	for k in range(-PILLAR_N, PILLAR_N + 1):
		if absi(k) % 2 != (1 if wave == 1 else 0):
			continue
		var mx := px + k * PILLAR_GAP
		if w > 0.0 and (mx < 0.0 or mx > w):
			continue
		marks.append([Vector3(mx, me.global_position.y, 0.0), PILLAR_W])
		_upright(CombatTell.band(me, Vector3(mx, me.global_position.y, 0.0), PILLAR_W, TELL_H, PILLAR_T if wave == 1 else PILLAR_T2, col))


## 가로 판은 카메라가 낮아 바닥에 누운 예고가 얇은 줄로만 보였다(10-11 촬영) — 웹처럼 화면 쪽으로 세운다.
## 땅 밑 절반은 땅에 가려 반원·벽처럼 보인다(내 발 둘레 = 반원, 띠 = 땅에서 솟은 벽).
static func _upright(mi: MeshInstance3D) -> void:
	if mi != null:
		mi.rotation.x = PI * 0.5


## 판정 — 맞으면 api.hurt(피해). 돌려주는 것은 맞은 수.
func _resolve(me: Node3D, player: Node3D, api: Dictionary) -> int:
	var f := player.global_position
	var hit := 0
	var col: Color = COLORS.get(kind, COLORS.slam)
	match kind:
		"slam", "rock":
			for m in marks:
				var at: Vector3 = m[0]
				var r: float = m[1]
				if absf(f.x - at.x) < r and absf(f.y - at.y) < r * 0.9:
					hit += 1
				CombatFx.element_burst(me, at, r, col, 0.4, "rock", false)
			if hit > 0:
				api.hurt.call(roundf(float(api.dmg) * (SLAM_MUL if kind == "slam" else ROCK_MUL)))
			api.shake.call(0.12 if kind == "slam" else 0.08, 0.3)
		"quake":
			## 바닥에 발을 붙인 채면 맞는다 — 뛰었거나 발판 위(보스 발보다 높이)면 산다
			if bool(api.on_ground.call()) and absf(f.y - me.global_position.y) < QUAKE_Y + 0.05:
				hit = 1
				api.hurt.call(roundf(float(api.dmg) * QUAKE_MUL))
			api.shake.call(0.22, 0.5)
		"sweep":
			if absf(f.x - safe_x) > SWEEP_W * 0.5:
				hit = 1
				api.hurt.call(roundf(float(api.player_hp_max) * SWEEP_PCT))
			api.shake.call(0.3, 0.6)
		"ring":
			if absf(f.x - cx) > RING_R:
				hit = 1
				api.hurt.call(roundf(float(api.dmg) * RING_MUL))
			api.shake.call(0.16, 0.4)
		"volley":
			for m in marks:
				var at: Vector3 = m[0]
				var r: float = m[1]
				if absf(f.x - at.x) < r and absf(f.y - at.y) < r * 1.6:
					hit += 1
				CombatFx.spark(me, at + Vector3.UP * 0.3, col)
			if hit > 0:
				api.hurt.call(roundf(float(api.dmg) * VOLLEY_MUL))
			api.shake.call(0.1, 0.3)
		"beam":
			if not bool(api.on_ground.call()) or f.y > me.global_position.y + QUAKE_Y + 0.05:
				hit = 1
				api.hurt.call(roundf(float(api.dmg) * BEAM_MUL))
			api.shake.call(0.12, 0.3)
		"pillar":
			for m in marks:
				var at: Vector3 = m[0]
				if absf(f.x - at.x) < PILLAR_W:
					hit = 1
				CombatFx.element_burst(me, at, PILLAR_W, col, 0.4, "fire", false)
			if hit > 0:
				api.hurt.call(roundf(float(api.dmg) * PILLAR_MUL))
			api.shake.call(0.12, 0.3)
			if wave == 1:
				hit_acc = hit
				wave = 2
				t = PILLAR_T2
				_pillar_marks(me, float(api.get("width", 0.0)), col)
				return -1 # 둘째 박자가 남았다
			hit = maxi(hit, hit_acc)
			wave = 0
	## 그로기 셈 — 피해를 주는 패턴만(부르기는 여기 안 온다). 셋 잇달아 다 피하면 GROGGY_T 동안 멈춘다
	if hit > 0:
		dodge = 0
	else:
		dodge += 1
		if dodge >= GROGGY_N:
			dodge = 0
			groggy = GROGGY_T
			api.toast.call("💫 %s 그로기 — %d초 동안 받는 피해 ×%.1f!" % [api.name, int(GROGGY_T), GROGGY_MUL])
	return hit
