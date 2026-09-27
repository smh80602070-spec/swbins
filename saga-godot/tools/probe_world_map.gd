extends Node
## GO 원신식 지도(106장 ⑨) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_MAP_PROBE 가 있을 때만 단다.
##
##   SAGA_MAP_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 지도 그림(세 지역을 덮는 크기·물과 숲 색이 다름) ② 순간이동 지점 7(신상 3)·처음엔 꺼짐
## ③ 가까이 가면 활성화 → EventState wp_<id> · 탐험도 오름 ④ 신상 전엔 구름, 신상 켜면 그 지역이 밝아짐
## ⑤ 안 켠 지점으론 순간이동 못 함 ⑥ 지도 열기(ui_modal·frozen) → 고르기 → 순간이동 → 닫힘·자리
## ⑦ 신상 곁에 서 있으면 쓰러진 인물까지 모두 가득 ⑧ 지역을 넘으면 지역 이름 ⑨ 미니맵이 인물 자리를 따라감.
## 저장은 안 한다(EventState 는 메모리에서만 바뀐다).

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const Waypoints := preload("res://games/saga_go/world/waypoints.gd")
const WorldMap := preload("res://games/saga_go/ui/world_map.gd")

var _p: CharacterBody3D
var _wps: Node
var _map: Node
var _fc: Node
var _frame := 0
var _step := 0
var _fails := 0
var _lum0 := 0.0

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _map == null:
		_map = get_tree().get_first_node_in_group("go_world_map")
		_wps = get_tree().get_first_node_in_group("go_waypoints")
		_fc = get_tree().get_first_node_in_group("go_field_combat")
		return
	match _step:
		0: # ① 지도 그림
			var img: Image = _map.get("_base") # 구름 덮기 전 바탕
			var b: Rect2 = _map.get("bounds")
			var water := img.get_pixelv(_map.call("world_to_px", TestMap.world_pos(1, 7)))   # 마을 강
			var forest := img.get_pixelv(_map.call("world_to_px", TestMap.world_pos(0, 4)))  # 마을 서숲
			var covers := b.has_point(Vector2(TestMap.origin_of("coast").x, 0)) and b.has_point(Vector2(0, TestMap.origin_of("ruins").z))
			_check("map_image", img.get_width() > 200 and covers and water.b > forest.b + 0.05,
				"size=%dx%d covers=%s water=%s forest=%s" % [img.get_width(), img.get_height(), covers, water, forest])
			_next()
		1: # ② 지점 수·처음엔 꺼짐
			var ids := Waypoints.point_ids()
			var statues := 0
			var any_on := false
			for row in Waypoints.POINTS:
				if row[3]:
					statues += 1
				any_on = any_on or Waypoints.is_active(row[0])
			_check("points", ids.size() == 23 and statues == 8 and not any_on, "n=%d statues=%d any_on=%s" % [ids.size(), statues, any_on])
			_next()
		2: # ③ 역참 앞으로 걸어가면(가까이 세우면) 활성화
			if _frame == 1:
				_lum0 = WorldMap.exploration("village")
				_stand_near("v_station", 2.0)
			if _frame == 10:
				var on := Waypoints.is_active("v_station") and EventState.is_resolved("wp_v_station")
				var ex := WorldMap.exploration("village")
				_check("activate_near", on and ex > _lum0, "on=%s explore %.2f→%.2f" % [on, _lum0, ex])
				_next()
		3: # ④ 신상 켜기 전엔 구름 → 켜면 밝아짐
			if _frame == 1:
				_check("fog_before", not _map.call("revealed", "village"), "")
				_lum0 = _lum_at(TestMap.world_pos(5, 4))
				_stand_near("v_statue", 2.0)
			if _frame == 10:
				var lum := _lum_at(TestMap.world_pos(5, 4))
				_check("reveal_statue", _map.call("revealed", "village") and lum > _lum0 + 0.05, "lum %.3f→%.3f" % [_lum0, lum])
				_next()
		4: # ⑤ 안 켠 곳(포구 신상)으로는 못 간다
			var ok: bool = _wps.call("teleport", "c_dock")
			_check("teleport_locked", not ok, "")
			_next()
		5: # ⑥ 지도 열고 골라서 순간이동
			if _frame == 1:
				_wps.call("activate", "c_dock")
				_map.call("open_map")
				var modal: bool = _map.is_in_group("ui_modal") and bool(_p.get("frozen"))
				_map.call("select", "c_dock")
				var warped: bool = _map.call("warp_selected")
				var at: Vector3 = _wps.call("world_pos_of", "c_dock")
				var near := _p.global_position.distance_to(at) < 4.0
				var closed: bool = not _map.get("is_open") and not _map.is_in_group("ui_modal") and not bool(_p.get("frozen"))
				_check("map_warp", modal and warped and near and closed, "modal=%s warped=%s near=%s closed=%s" % [modal, warped, near, closed])
			if _frame == 20:
				_next()
		6: # ⑧ 지역 이름 — 포구로 순간이동하면 current_region 이 바뀌고 이름이 뜬다
			var banner: Label = _map.get("_banner")
			_check("region_banner", _map.get("current_region") == "coast" and banner.text.contains(WorldMap.REGION_NAMES["coast"]),
				"region=%s text=%s" % [_map.get("current_region"), banner.text])
			_next()
		7: # ⑦ 신상 곁 — 쓰러진 인물까지 모두 가득
			if _frame == 1:
				_fc.set("hp", 10.0)
				var hp_dict: Dictionary = _fc.get("_hp")
				hp_dict["ghost_probe"] = 0.0
				_stand_near("c_dock", 2.0)
			if _frame == 90:
				var hp: float = _fc.get("hp")
				_check("statue_heal", is_equal_approx(hp, float(_fc.get("max_hp"))), "hp=%.1f max=%.1f" % [hp, float(_fc.get("max_hp"))])
				_next()
		8: # ⑨ 미니맵이 인물 자리를 따라간다
			var mini: ColorRect = _map.get("_mini")
			var cuv: Vector2 = (mini.material as ShaderMaterial).get_shader_parameter("center_uv")
			var tex: Texture2D = _map.get("map_texture")
			var want: Vector2 = _map.call("world_to_px", _p.global_position) / tex.get_size()
			_check("minimap_follow", cuv.distance_to(want) < 0.01, "uv=%s want=%s" % [cuv, want])
			_next()
		9:
			print("MAP_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _stand_near(id: String, d: float) -> void:
	var at: Vector3 = _wps.call("world_pos_of", id)
	_p.global_position = at + Vector3(0.0, 0.4, d)
	_p.velocity = Vector3.ZERO

func _lum_at(world: Vector3) -> float:
	var img: Image = _map.get("shown_image")
	var c := img.get_pixelv(_map.call("world_to_px", world))
	return c.get_luminance()

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("MAP_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
