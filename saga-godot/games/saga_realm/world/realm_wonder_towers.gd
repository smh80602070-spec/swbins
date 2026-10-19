extends Node3D

## G-0243 5천하 지도 불가사의 탑 — 완공한 불가사의마다 그 성 마커 옆에 도형 탑 하나(웹엔 없는 고돗 덤: 3D 지도 위 누가 지었는지).
## realm_worldmap.gd 의 자식 — 지도를 볼 때만 보이고, 0.5초마다 완공 목록을 재 바뀌었을 때만 새로 짓는다.
## 그림·에셋 없이 CylinderMesh(몸) + PrismMesh(지붕) + 무광 색 재질뿐. 우리 것 = 금빛, 남의 것 = 잿빛.

const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")
const Wonder := preload("res://games/saga_realm/data/realm_wonder.gd")

const MINE := Color(0.95, 0.78, 0.3)
const THEIRS := Color(0.62, 0.6, 0.58)
const ROOF := Color(0.55, 0.2, 0.16)
const BODY_H := 4.0
const SIDE := 1.8      # 성 기둥(반경 0.7)·몬스터 실루엣과 안 겹치게 옆으로
const STEP := 1.4      # 한 성에 둘 이상이면 이만큼씩 더 옆으로
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


## 완공 목록을 다시 보고, 바뀌었으면 탑을 새로 짓는다. 탑 개수를 돌려준다(점검용).
func refresh() -> int:
	var built: Dictionary = Wonder.state(RealmSaveState).built
	var ids := built.keys()
	ids.sort()
	var sig := JSON.stringify([ids, built])
	if sig == _sig:
		return get_child_count()
	_sig = sig
	for ch in get_children():
		remove_child(ch)
		ch.queue_free()
	var per_city := {}
	for id in ids:
		var b: Dictionary = built[id]
		var cid := String(b.get("city", ""))
		if cid == "":
			continue
		var k := int(per_city.get(cid, 0))
		per_city[cid] = k + 1
		_tower(_pos(cid) + Vector3(SIDE + STEP * k, 0, 0), String(b.get("by", "")) == Wonder.ME, String(id))
	return get_child_count()


func _pos(id: String) -> Vector3:
	var c := RealmCities.any_by_id(id)
	var center := RealmCities.map_center()
	return Vector3((float(c.get("x", center.x)) - center.x) * RealmCities.WORLD_SCALE, 0.0,
		(float(c.get("y", center.y)) - center.y) * RealmCities.WORLD_SCALE)


func _tower(at: Vector3, mine: bool, id: String) -> void:
	var t := Node3D.new()
	t.name = "Wonder_" + id
	t.position = at
	var body := MeshInstance3D.new()
	var bm := CylinderMesh.new()
	bm.top_radius = 0.35
	bm.bottom_radius = 0.6
	bm.height = BODY_H
	bm.radial_segments = 8
	body.mesh = bm
	body.material_override = _mat(MINE if mine else THEIRS)
	body.position = Vector3(0, BODY_H * 0.5, 0)
	t.add_child(body)
	var roof := MeshInstance3D.new()
	var rm := PrismMesh.new()
	rm.size = Vector3(1.1, 0.9, 1.1)
	roof.mesh = rm
	roof.material_override = _mat(ROOF)
	roof.position = Vector3(0, BODY_H + 0.45, 0)
	t.add_child(roof)
	add_child(t)


func _mat(col: Color) -> StandardMaterial3D:
	var key := col.to_html()
	if not _mats.has(key):
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.albedo_color = col
		_mats[key] = m
	return _mats[key]
