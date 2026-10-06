extends SceneTree

## G-0045 — 네 판(사가블로·사가의숲·사가스토리·사가국지) 화면 촬영. tools/probe_shots.gd 는 사가고 마을 씬에 붙는 노드라 다른 판을 못 찍는다.
## 컷마다 씬을 새로 띄워 노드 경로로 플레이어를 옮기고 함수를 불러 찍는다. 저장은 안 한다(각 판 자동 저장은 60초라 컷 안에 안 돈다).
## 헤드리스에선 그림이 비니 창 모드로(화면 밖):
##
##   SHOT_DIR=<절대 경로> [SHOT_ONLY=이름,이름] "$GODOT_CONSOLE" --path saga-godot --rendering-method mobile \
##       --position -4000,0 --resolution 1280x720 --script res://tools/shot_scene.gd
##
## CUTS 한 줄 = [이름, 씬, 단계들]. 단계(30프레임째 차례로):
##   ["near", <노드 경로>, dx, dz]   그 노드 자리 + (dx, 0, dz) 에 플레이어를 세운다(영역에 들어가면 그 신호가 그대로 돈다)
##   ["touch", <노드 경로>, <함수>]  플레이어를 넘겨 부른다(영역 들어감 흉내 — 예: 집 문)
##   ["call", <노드 경로>, <함수>, [인자…]]   부른다(인자 배열은 없어도 됨, 예: 메뉴 열기)
##   ["set", <노드 경로>, <속성>, 값]   속성을 바꾼다(autoload 는 "/root/이름" — 메모리만, 저장 안 함)
## SETTLE 프레임에 뷰포트를 <이름>_<가로>x<세로>.png 로. 끝에 "SHOT_SCENE_DONE shots=N".

const SETTLE := 120
const STEP_AT := 30
const FOREST := "res://games/saga_forest/world/TestVillageForest.tscn"

const CUTS := [
	["fs_villager", FOREST, [["near", "Villager/Villager_npc_keeper", 0.0, 3.0]]],
	["fs_house_in", FOREST, [["touch", "House", "_on_enter_house"]]],
	["fs_finish_menu", FOREST, [["touch", "House", "_on_enter_house"], ["call", "House", "_open_finish_menu"]]],
	["fs_place_menu", FOREST, [["touch", "House", "_on_enter_house"], ["call", "House", "_open_place_menu"]]],
	["fs_fishing", FOREST, [["near", "Fishing", 0.0, 5.0]]],
	## G-0047 — 집 안: 벽지 한지·장판 마루로 놓고 가구 여섯(컷 동안만, 세이브 안 건드림)
	["fs_room", FOREST, [["set", "/root/ForestSaveState", "wall_key", "hanji"], ["set", "/root/ForestSaveState", "floor_key", "wood"], ["touch", "House", "_on_enter_house"],
		["call", "House", "_spawn_furniture_visual", [{"key": "bangseok", "x": -1.2, "z": 1.8}]], ["call", "House", "_spawn_furniture_visual", [{"key": "soban", "x": 0.0, "z": 1.2}]],
		["call", "House", "_spawn_furniture_visual", [{"key": "deungjan", "x": 1.4, "z": 1.6}]], ["call", "House", "_spawn_furniture_visual", [{"key": "mulhang", "x": -2.2, "z": 0.2}]],
		["call", "House", "_spawn_furniture_visual", [{"key": "mungab", "x": 2.2, "z": 0.4}]], ["call", "House", "_spawn_furniture_visual", [{"key": "byeongpung", "x": 0.0, "z": 2.6}]]]],
	["fs_fishing_near", FOREST, [["near", "Fishing", 0.0, 2.6]]],   # G-0046 — 못 가까이
]

var _done := 0


func _initialize() -> void:
	var dir := OS.get_environment("SHOT_DIR")
	var only := OS.get_environment("SHOT_ONLY").split(",", false)
	for cut: Array in CUTS:
		if not only.is_empty() and not only.has(String(cut[0])):
			continue
		change_scene_to_file(String(cut[1]))
		for f in SETTLE:
			await process_frame
			if f == STEP_AT:
				_steps(cut[2])
		var img := root.get_viewport().get_texture().get_image()
		var path := "%s/%s_%dx%d.png" % [dir, cut[0], img.get_width(), img.get_height()]
		print("SHOT %s err=%d" % [cut[0], img.save_png(path)])
		_done += 1
	print("SHOT_SCENE_DONE shots=%d" % _done)
	quit()


func _steps(steps: Array) -> void:
	var sc := current_scene
	var p := get_first_node_in_group("player") as Node3D
	for st: Array in steps:
		var n := sc.get_node_or_null(NodePath(String(st[1])))
		if n == null:
			print("SHOT_STEP 노드 없음 %s" % st[1])
			continue
		match String(st[0]):
			"near":
				if p:
					p.global_position = (n as Node3D).global_position + Vector3(float(st[2]), 0.1, float(st[3]))
					if p is CharacterBody3D:
						(p as CharacterBody3D).velocity = Vector3.ZERO
			"touch":
				n.call(String(st[2]), p)
			"call":
				n.callv(String(st[2]), st[3] if st.size() > 3 else [])
			"set":
				n.set(String(st[2]), st[3])
