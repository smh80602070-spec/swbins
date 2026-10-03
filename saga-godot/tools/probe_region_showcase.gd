extends SceneTree
## G-0015 지역 다섯 자동 점검 — RegionShowcase 의 계수 진단(SAGA_REGION_PROBE)을 SceneTree 점검으로 감싼다(probe_all 이 자동으로 집는다).
##   godot --headless --path saga-godot --script res://tools/probe_region_showcase.gd   → "REGION_PROBE_DONE fails=N"
## 조각·나무·꽃·길 수 = 배치표, 풍경·물·지형 있음, 점광원 ≤ 예산, 뒤집힌 삼각형 0. 화면 판정은 tools/test_regions.sh.

func _init() -> void:
	OS.set_environment("SAGA_REGION_PROBE", "1")
	root.add_child((load("res://games/saga_go/world/RegionShowcase.tscn") as PackedScene).instantiate())
