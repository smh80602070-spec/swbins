extends Node3D

## G-0239 5천하 지도 보급 선 — 진(RealmSaveState.camps)마다 출진 성에서 진까지 보급 길 마디를 땅 위 얇은 띠로 깐다
## (웹 W-0278 supplyline.js segs3d·realm3d buildCamp 의 길 띠). 초록 = 이어짐 · 빨강 = 끊김(길이 막혔거나 계략 ✂️).
## realm_worldmap.gd 의 자식 — 지도를 볼 때만 보이고, 0.5초마다 길을 다시 재 바뀌었을 때만 띠를 새로 짓는다.
## 그림·에셋 없이 BoxMesh + 무광 색 재질뿐.

const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")
const RealmSupply := preload("res://games/saga_realm/data/realm_supply.gd")

const GREEN := Color(0.435, 0.863, 0.478)   # 웹 #6fdc7a
const RED := Color(1.0, 0.353, 0.29)        # 웹 #ff5a4a
const GOLD := Color(1.0, 0.82, 0.3)         # G-0310 교역로 — 웹 금빛 점선 자리
const RealmTrade := preload("res://games/saga_realm/data/realm_trade.gd")
const WIDTH := 0.6
const THICK := 0.08
const LIFT := 0.12
const POLL_SEC := 0.5

var _sig := ""
var _wait := 0.0
var _mats := {}


func _process(delta: float) -> void:
	if not is_visible_in_tree():
		return
	_wait -= delta
	if _wait > 0.0:
		return
	_wait = POLL_SEC
	refresh()


## 길을 다시 재고, 바뀌었으면 띠를 새로 짓는다. 띠 개수를 돌려준다(점검용).
func refresh() -> int:
	var lines: Array = []
	for cp: Dictionary in RealmSaveState.camps:
		var s := RealmSupply.segs(RealmSaveState, cp)
		for seg: Array in s.segs:
			lines.append([String(seg[0]), String(seg[1]), "g" if bool(s.good) else "r"])
	for r: Dictionary in RealmTrade.routes(RealmSaveState):   # G-0310 상단 길 — 금빛
		var p := RealmTrade.path(RealmSaveState, String(r.from), String(r.to))
		for i in range(p.size() - 1):
			lines.append([String(p[i]), String(p[i + 1]), "t"])
	var sig := JSON.stringify(lines)
	if sig == _sig:
		return get_child_count()
	_sig = sig
	for ch in get_children():
		remove_child(ch)
		ch.queue_free()
	for l: Array in lines:
		var a := _pos(String(l[0]))
		var b := _pos(String(l[1]))
		if a.distance_to(b) < 0.01:
			continue
		var k := String(l[2])
		_ribbon(a + (Vector3(0, 0.02, 0) if k == "t" else Vector3.ZERO), b + (Vector3(0, 0.02, 0) if k == "t" else Vector3.ZERO), GOLD if k == "t" else (GREEN if k == "g" else RED))
	return get_child_count()


func _pos(id: String) -> Vector3:
	var c := RealmCities.any_by_id(id)
	var center := RealmCities.map_center()
	return Vector3((float(c.get("x", center.x)) - center.x) * RealmCities.WORLD_SCALE, LIFT,
		(float(c.get("y", center.y)) - center.y) * RealmCities.WORLD_SCALE)


func _ribbon(a: Vector3, b: Vector3, col: Color) -> void:
	var mi := MeshInstance3D.new()
	var m := BoxMesh.new()
	m.size = Vector3(WIDTH, THICK, a.distance_to(b))
	mi.mesh = m
	mi.material_override = _mat(col)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.transform = Transform3D(Basis.looking_at(b - a, Vector3.UP), (a + b) * 0.5)
	add_child(mi)


func _mat(col: Color) -> StandardMaterial3D:
	var key := col.to_html()
	if not _mats.has(key):
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.albedo_color = col
		_mats[key] = m
	return _mats[key]
