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
##   ["static", <스크립트 경로>, <함수>, [인자…]]   정적 함수 — 인자 낱말 "@scene"(지금 씬)·"@near:dx:dz"(플레이어 자리 + 차이) (G-0048)
##   ["free_modal"]   떠 있는 선택 창(그룹 ui_modal 의 CanvasLayer)을 닫는다 — 예: 사가국지 시나리오 고르기
## near 의 노드 경로를 못 찾으면 그 이름의 첫 노드를 씬 전체에서 찾는다(지형 빌더가 만드는 LadderArea 등).
## SETTLE 프레임에 뷰포트를 <이름>_<가로>x<세로>.png 로. 끝에 "SHOT_SCENE_DONE shots=N".

const SETTLE := 120
const STEP_AT := 30
const FOREST := "res://games/saga_forest/world/TestVillageForest.tscn"
const DUNGEON := "res://games/saga_dungeon/world/TestRoom.tscn"
const STORY_CAVE := "res://games/saga_story/world/CaveHuntGround.tscn"
const REALM := "res://games/saga_realm/world/TestCity.tscn"
const LOOT := "res://games/saga_dungeon/world/loot_pickup.gd"
const GO := "res://games/saga_go/world/TestVillage.tscn"
const GFX := "res://saga_core/data/graphics_settings.gd"

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
	# G-0051 — 옷은 메모리에서만 바꾼다(저장은 저장 단추로만 — 세이브 파일 안 바뀜)
	# 들판 카메라(14m)로는 몸이 20화소라 팔 길이 3.5m 로 당겨 찍는다. _plain 은 기본 옷(비교용) — 자동 로드는 컷 사이에 남으니 옷을 늘 명시한다.
	["fs_wear", FOREST, [["set", "/root/ForestSaveState", "wear_on", {"coat": "leather", "head": "topknot", "dye": "crimson", "cape": "on"}], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 3.5]]],
	["fs_wear_plain", FOREST, [["set", "/root/ForestSaveState", "wear_on", {"coat": "leather", "head": "topknot", "dye": "none", "cape": "off"}], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 3.5]]],
	["fs_wear_menu", FOREST, [["set", "/root/ForestSaveState", "wear_on", {"coat": "leather", "head": "topknot", "dye": "crimson", "cape": "on"}], ["call", "Villager", "_open_wear_menu", [{}, "@box"]]]],
	["fs_fishing_near", FOREST, [["near", "Fishing", 0.0, 2.6]]],   # G-0046 — 못 가까이
	## G-0048 — 사가블로 노획물 여섯(보스 노획·전설 배율 40 — 등급색 외곽선·전설 잔광) · 사가스토리 동굴 사다리 · 사가국지 일기토 1합째
	# G-0049 — 출사표 창 먼저 닫고, 줍기 반경(1.4m)+몸 밖 3m 에 떨군다(1.6m 는 찍기 전에 주워졌다)
	# 화면 앞(+z)은 카메라 밑이라 안 보인다 — 전부 옆·뒤(-z)에. 앞 셋은 전설 배율 1000(전설 확정), 뒤 셋은 보통.
	["dg_loot", DUNGEON, [["free_modal"], ["static", LOOT, "spawn_at", ["@scene", "@near:3.2:0", 30, true, false, 1000.0]], ["static", LOOT, "spawn_at", ["@scene", "@near:-3.2:0", 30, true, false, 1000.0]],
		["static", LOOT, "spawn_at", ["@scene", "@near:0:-3.2", 30, true, false, 1000.0]], ["static", LOOT, "spawn_at", ["@scene", "@near:2.6:-5.2", 30, false, true, 1.0]],
		["static", LOOT, "spawn_at", ["@scene", "@near:-2.6:-5.2", 30, false, false, 1.0]], ["static", LOOT, "spawn_at", ["@scene", "@near:0:-6.6", 30, false, false, 1.0]]]],
	["st_ladder", STORY_CAVE, [["near", "LadderArea", -1.4, 0.0]]],
	# G-0050 — 시나리오를 시작해야 장수 명단이 생겨 등용 설전 문제가 뽑힌다
	["rk_debate", REALM, [["free_modal"], ["call", "/root/RealmSaveState", "start_scenario", ["194"]], ["call", "RealmHUD/OrderButton", "_start_order", ["hire", "등용", "@box"]]]],
	# G-0054 — 화질/성능. 사가고 둘은 설정 파일을 안 쓰고(save=false) 메모리에서만 바꾼다 — forward_plus 로 찍어야 SSAO 차이가 보인다.
	["rk_gfx_menu", REALM, [["free_modal"], ["call", "RealmHUD/GraphicsButton/GraphicsMenu", "open_screen", []]]],
	["go_gfx_quality", GO, [["static", GFX, "set_mode", ["quality", "@tree", false]]]],
	["go_gfx_perf", GO, [["static", GFX, "set_mode", ["performance", "@tree", false]]]],
	["go_dialogue", GO, [["call", "StoryQuest", "open_dialogue", [[["촌장", "먹구름이 몰려오기 전에 포구 사공을 찾아가게. 길은 강을 따라 남쪽일세."], ["나", "알겠습니다."]], "@noop"]]]],   # G-0055 건너뛰기 단추
	["go_dialogue_choice", GO, [["call", "StoryQuest", "open_dialogue", [[["?", ["바로 가겠습니다.", "먼저 장터에 들르겠습니다.", "사공이 누구인지 더 묻는다."]]], "@noop"]]]],   # G-0056 고르는 줄
	["go_photo", GO, [["call", "MobileHUD/PhotoModeButton", "_on_pressed", []], ["call", "MobileHUD/PhotoModeButton", "_on_capture_pressed", []]]],   # G-0057 — SAGA_PHOTO_DIR 에 사진이 하나 생긴다
	["rk_orders", REALM, [["free_modal"], ["call", "RealmHUD/OrderButton", "_on_pressed", []]]],   # G-0052 — 긴 글 열 줄 선택 창
	["rk_duel", REALM, [["free_modal"], ["call", "RealmHUD/AttackButton", "_duel_round", ["enemy", []]]]],
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
		if String(st[0]) == "free_modal":
			for m in get_nodes_in_group("ui_modal"):
				if m is CanvasLayer:
					m.queue_free()
			continue
		if String(st[0]) == "static":
			var args: Array = []
			for a in st[3]:
				args.append(_arg(a, sc, p))
			(load(String(st[1])) as Script).callv(String(st[2]), args)
			continue
		var n := sc.get_node_or_null(NodePath(String(st[1])))
		if n == null and String(st[0]) == "near":
			n = sc.find_child(String(st[1]), true, false)
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
				var cargs: Array = []
				for a in (st[3] if st.size() > 3 else []):
					cargs.append(_arg(a, sc, p))
				n.callv(String(st[2]), cargs)
			"set":
				n.set(String(st[2]), st[3])

## G-0048 — 정적 함수 인자 낱말: "@scene" → 지금 씬, "@near:dx:dz" → 플레이어 자리 + (dx, 0, dz). 그 밖은 그대로.
## G-0050 — "@box" → 선택 창 상자 {"layer": 빈 CanvasLayer}(앞 창을 닫고 시작하는 _start_order 류용). call 인자도 같이 푼다.
func _arg(a: Variant, sc: Node, p: Node3D) -> Variant:
	if a is String and a == "@box":
		return {"layer": CanvasLayer.new()}
	if a is String and a == "@tree": # G-0054
		return self
	if a is String and a == "@noop": # G-0055 — 끝 콜백 자리
		return func() -> void: pass
	if a is String and a == "@scene":
		return sc
	if a is String and String(a).begins_with("@near:"):
		var q := String(a).split(":")
		return (p.global_position if p else Vector3.ZERO) + Vector3(float(q[1]), 0.0, float(q[2]))
	return a
