extends Node3D

## PLAN 106장 ③ — 들판 적 무리를 지역마다 몇 곳에 둔다(원신 들판의 몹 캠프).
## 자리는 글자 지도 칸 + 씨앗 흔들기로 결정적이다. 사건(도적 습격·인물 조우)
## 자리와 겹치지 않게 칸을 골랐다(bandit_encounter 기본 칸 (7,5) 등에서 2칸+).

const Adventure := preload("res://games/saga_go/data/adventure.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")

## [지역, 칸, [종류...]]
const CAMPS := [
	["village", Vector2i(1, 4), ["wolf", "wolf", "wolf"]],
	["village", Vector2i(9, 5), ["bandit", "bandit"]],
	["village", Vector2i(8, 9), ["wolf", "wolf", "bandit"]],
	["coast", Vector2i(2, 6), ["wolf", "wolf"]],
	["ruins", Vector2i(2, 2), ["bandit", "bandit", "bandit"]],
	## PLAN 106장 ⑦ — 원소 쓰는 적. 상자 무리 잠금(반경 12m)과 칸이 겹치지 않는 자리.
	["coast", Vector2i(6, 5), ["water_turtle", "water_turtle", "fire_imp"]],
	["ruins", Vector2i(4, 3), ["thunder_cat", "thunder_cat"]],
	["ruins", Vector2i(5, 5), ["fire_imp", "fire_imp", "thunder_cat"]],
	## PLAN 106장 ⑮ — 새 원소 넷. 상자 무리 잠금·순간이동 지점·별조각과 1.4칸(67m)+ 떨어진 자리.
	["coast", Vector2i(4, 6), ["wind_hawk", "wind_hawk", "grass_snake"]],
	["coast", Vector2i(6, 7), ["ice_fox", "ice_fox", "grass_snake"]],
	["ruins", Vector2i(1, 4), ["rock_bear", "rock_bear"]],
	## PLAN 106장 ㊺ 서리봉 고원 — 순간이동 지점·별조각·발견 지점과 1.4칸+ 떨어진 자리.
	["frost", Vector2i(2, 3), ["ice_fox", "ice_fox", "ice_fox"]],
	["frost", Vector2i(6, 3), ["wind_hawk", "wind_hawk", "ice_fox"]],
	["frost", Vector2i(2, 6), ["rock_bear", "rock_bear"]],
	["frost", Vector2i(5, 6), ["thunder_cat", "thunder_cat", "ice_fox"]],
	## PLAN 106장 ㊽ 은하 나루 — 순간이동 지점·명소와 1칸+ 떨어진 자리.
	["skyport", Vector2i(2, 2), ["thunder_cat", "thunder_cat", "wind_hawk"]],
	["skyport", Vector2i(6, 5), ["rock_bear", "fire_imp"]],
	["skyport", Vector2i(2, 6), ["grass_snake", "grass_snake", "ice_fox"]],
	## PLAN 106장 ㊾ 틈새 갈림길 — 순간이동 지점·명소와 1칸+ 떨어진 자리.
	["crossing", Vector2i(2, 2), ["ice_fox", "ice_fox", "wind_hawk"]],
	["crossing", Vector2i(6, 4), ["rock_bear", "thunder_cat"]],
	["crossing", Vector2i(1, 6), ["fire_imp", "fire_imp", "grass_snake"]],
	## PLAN 106장 ㊿ 잠긴 도읍 — 모래밭에만(바다 칸은 물 밑이라 안 둔다).
	["sunken", Vector2i(2, 2), ["water_turtle", "water_turtle", "wind_hawk"]],
	["sunken", Vector2i(5, 1), ["thunder_cat", "thunder_cat"]],
	["sunken", Vector2i(7, 2), ["water_turtle", "grass_snake", "wind_hawk"]],
	## PLAN 106장 53 굳은 거리 — 굳은 자리에서 새어 나온 결정 짐승(있는 kind).
	["amber", Vector2i(1, 6), ["rock_bear", "thunder_cat"]],
	["amber", Vector2i(6, 7), ["fire_imp", "fire_imp", "wind_hawk"]],
	["amber", Vector2i(7, 5), ["rock_bear", "ice_fox", "thunder_cat"]],
	## PLAN 106장 54 갈무리 벌 — 벌판·야적장에 모여든 짐승(있는 kind).
	["vault", Vector2i(1, 2), ["wind_hawk", "thunder_cat"]],
	["vault", Vector2i(7, 2), ["ice_fox", "wind_hawk", "rock_bear"]],
	["vault", Vector2i(6, 6), ["grass_snake", "fire_imp", "thunder_cat"]],
	## PLAN 106장 55 세갈래 고을 — 멈춘 순간 틈으로 들어온 짐승(있는 kind).
	["fork", Vector2i(2, 2), ["fire_imp", "rock_bear"]],
	["fork", Vector2i(6, 5), ["thunder_cat", "wind_hawk"]],
	["fork", Vector2i(6, 7), ["ice_fox", "grass_snake", "fire_imp"]],
]
const SPREAD := 5.0

func _ready() -> void:
	var n := 0
	for camp in CAMPS:
		var region: String = camp[0]
		var grid: Vector2i = camp[1]
		var kinds: Array = camp[2]
		var center := TestMap.world_pos(grid.x, grid.y, region)
		for i in kinds.size():
			var a := TAU * float(i) / float(kinds.size())
			var p := center + Vector3(cos(a), 0, sin(a)) * SPREAD
			p.y = TerrainBuilder.height_at(region, p) + 0.3
			var e := FieldEnemy.new()
			e.name = "FieldEnemy_%s_%d" % [region, n]
			e.setup(kinds[i], p, 20260824 + n)
			e.apply_world_level(Adventure.world_level())
			add_child(e)
			n += 1
	PartyState.world_changed.connect(reapply_world_level)

## 106장 ㉒ — 세계 등급이 바뀌면(모험 등급이 오르거나 낮추면) 들판 적 전부에 다시 앉힌다.
func reapply_world_level() -> void:
	var wl := Adventure.world_level()
	for e in get_children():
		if e.has_method("apply_world_level"):
			e.call("apply_world_level", wl)
