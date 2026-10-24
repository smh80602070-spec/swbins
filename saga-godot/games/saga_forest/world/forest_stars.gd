extends Node

## G-0381 3마을 별똥별 소원(동물의숲 — 맑은 밤 하늘에 흐르는 별에 빌면 이튿날 별 조각). 웹은 칠석 행사만(장부 "부분").
##   언제   밤(forest_workshop.is_night — 시스템 시각) · 마을 밖(집 안 아님)일 때 GAP_MIN~GAP_MAX 초마다 하나
##   보임   카메라 앞 하늘에 빛줄기 하나가 STREAK_SEC 동안 긋는다(코드 메시 — 에셋 없음) + 「🌠 소원 빌기」 단추 WISH_SEC
##   소원   단추를 누르면 오늘 밤 소원 +1(하룻밤 MAX_WISH) — ForestSaveState.stars = {day, wishes}(순수 추가 칸)
##   답례   날이 바뀐 뒤 처음 마을에 서면 어젯밤 소원 수만큼 "별 조각"(상인 값 SELL_BASE_PRICE 500) — 토스트 한 줄
## forest_village 가 붙인다. SAGA_STARS=0 이면 안 붙음.

const Workshop := preload("res://games/saga_forest/data/forest_workshop.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const GAP_MIN := 25.0
const GAP_MAX := 60.0
const STREAK_SEC := 1.4
const WISH_SEC := 3.0
const MAX_WISH := 5
const ITEM := "별 조각"

var _t := 0.0
var _wish_left := 0.0
var _streak: MeshInstance3D = null
var _streak_t := 0.0
var _from := Vector3.ZERO
var _to := Vector3.ZERO
var _btn: Button = null
var _layer: CanvasLayer = null
var _rng := RandomNumberGenerator.new()
var shown := 0   # 점검용 — 흐른 별 수


static func enabled() -> bool:
	return OS.get_environment("SAGA_STARS") != "0"


static func attach(parent: Node) -> Node:
	if not enabled():
		return null
	var n := new()
	n.name = "ForestStars"
	parent.add_child(n)
	return n


## 오늘 소원 상태 — 다른 날 것이면 {} 로 본다(순수).
static func wishes_on(st: Dictionary, day: int) -> int:
	return int(st.get("wishes", 0)) if int(st.get("day", -1)) == day else 0


## 날이 바뀌었으면 어젯밤 소원 답례 — 준 조각 수(0 이면 없음). 상태는 비운다.
static func redeem(F: Node, today: int) -> int:
	var st: Dictionary = F.get("stars")
	if st.is_empty() or int(st.get("day", -1)) == today:
		return 0
	var n := mini(int(st.get("wishes", 0)), MAX_WISH)
	F.set("stars", {})
	if n > 0:
		F.call("add_item", ITEM, n)
	return n


## 소원 하나(하룻밤 MAX_WISH) — 오늘 밤 소원 수.
static func wish(F: Node, today: int) -> int:
	var st: Dictionary = F.get("stars")
	var n := mini(wishes_on(st, today) + 1, MAX_WISH)
	F.set("stars", {"day": today, "wishes": n})
	return n


func _ready() -> void:
	_rng.randomize()
	_t = _rng.randf_range(GAP_MIN, GAP_MAX) * 0.5
	_build_ui()
	_redeem_later.call_deferred()


func _redeem_later() -> void:
	var n := redeem(ForestSaveState, ForestDay.today_key())
	if n > 0:
		Toast.show(self, "🌠 어젯밤 별똥별에 빈 소원 — 별 조각 %d 개가 발밑에 떨어져 있었다" % n, 4.0)


func _build_ui() -> void:
	_layer = CanvasLayer.new()
	_layer.layer = 5
	add_child(_layer)
	_btn = Button.new()
	_btn.text = "🌠 소원 빌기"
	_btn.focus_mode = Control.FOCUS_NONE
	_btn.anchor_left = 0.5
	_btn.anchor_right = 0.5
	_btn.anchor_top = 0.18
	_btn.anchor_bottom = 0.18
	_btn.offset_left = -90.0
	_btn.offset_right = 90.0
	_btn.offset_bottom = 44.0
	_btn.visible = false
	_btn.pressed.connect(_on_wish)
	_layer.add_child(_btn)


func _indoors() -> bool:
	var h := get_tree().get_first_node_in_group("forest_house")
	return h != null and bool(h.call("is_player_indoors"))


func _process(delta: float) -> void:
	if _streak != null:
		_streak_t += delta
		var k := clampf(_streak_t / STREAK_SEC, 0.0, 1.0)
		_streak.global_position = _from.lerp(_to, k)
		_streak.transparency = k * k
		if k >= 1.0:
			_streak.queue_free()
			_streak = null
	if _wish_left > 0.0:
		_wish_left -= delta
		if _wish_left <= 0.0:
			_btn.visible = false
	if not Workshop.is_night() or _indoors() or get_tree().paused:
		return
	_t -= delta
	if _t <= 0.0:
		_t = _rng.randf_range(GAP_MIN, GAP_MAX)
		fall()


## 별 하나를 흘린다(점검도 부른다).
func fall() -> void:
	shown += 1
	var cam := get_viewport().get_camera_3d()
	if cam != null and _streak == null:
		var fwd := -cam.global_transform.basis.z
		var right := cam.global_transform.basis.x
		var up := Vector3.UP
		var c := cam.global_position + fwd * 40.0 + up * 22.0
		var side := 1.0 if _rng.randf() < 0.5 else -1.0
		_from = c + right * 14.0 * side + up * 4.0
		_to = c - right * 10.0 * side - up * 3.0
		_streak = MeshInstance3D.new()
		var m := CapsuleMesh.new()
		m.radius = 0.12
		m.height = 3.2
		_streak.mesh = m
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.albedo_color = Color(1.0, 0.95, 0.75)
		mat.emission_enabled = true
		mat.emission = Color(1.0, 0.92, 0.6)
		mat.emission_energy_multiplier = 4.0
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_streak.material_override = mat
		add_child(_streak)
		_streak.global_position = _from
		_streak.look_at_from_position(_from, _to, Vector3.UP)
		_streak.rotate_object_local(Vector3.RIGHT, PI * 0.5)
		_streak_t = 0.0
	_wish_left = WISH_SEC
	_btn.visible = true
	Toast.show(self, "🌠 별똥별이다!", 1.5)


func _on_wish() -> void:
	_btn.visible = false
	_wish_left = 0.0
	var n := wish(ForestSaveState, ForestDay.today_key())
	Toast.show(self, "🌠 소원을 빌었다 (오늘 밤 %d/%d) — 내일 아침 무언가 떨어져 있을지도" % [n, MAX_WISH], 3.0)
