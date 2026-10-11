extends SceneTree

## G-0045 — 네 판(사가나락·사가마을·사가종횡·사가천하) 화면 촬영. tools/probe_shots.gd 는 사가만리 마을 씬에 붙는 노드라 다른 판을 못 찍는다.
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
##   ["free_modal"]   떠 있는 선택 창(그룹 ui_modal 의 CanvasLayer)을 닫는다 — 예: 사가천하 시나리오 고르기
## near 의 노드 경로를 못 찾으면 그 이름의 첫 노드를 씬 전체에서 찾는다(지형 빌더가 만드는 LadderArea 등).
## SETTLE 프레임(SHOT_SETTLE 로 늘릴 수 있음 — 비경 시작 대기처럼 몇 초 걸리는 컷, G-0112)에 뷰포트를 <이름>_<가로>x<세로>.png 로. 끝에 "SHOT_SCENE_DONE shots=N".

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
	["fs_room2", FOREST, [["set", "/root/ForestSaveState", "wall_key", "hanji"], ["set", "/root/ForestSaveState", "floor_key", "wood"], ["touch", "House", "_on_enter_house"],   # G-0062 서안·문갑·도자기·등잔
		["call", "House", "_spawn_furniture_visual", [{"key": "seoan", "x": -1.0, "z": 1.6}]], ["call", "House", "_spawn_furniture_visual", [{"key": "mungab", "x": 1.2, "z": 1.4}]],
		["call", "House", "_spawn_furniture_visual", [{"key": "dokja", "x": -2.0, "z": 0.6}]], ["call", "House", "_spawn_furniture_visual", [{"key": "deungjan", "x": 0.2, "z": 2.2}]]]],
	["fs_finish_menu", FOREST, [["touch", "House", "_on_enter_house"], ["call", "House", "_open_finish_menu"]]],
	["fs_place_menu", FOREST, [["touch", "House", "_on_enter_house"], ["call", "House", "_open_place_menu"]]],
	["fs_bench", FOREST, [["static", "res://tools/shot_forest.gd", "open_bench", ["@tree"]]]],   # G-0196 제작대 화면(레시피 12 — 만들 수 있는 것 ✓)
	["fs_plant_grid", FOREST, [["static", "res://tools/shot_forest_grid.gd", "stage", ["@tree"]]]],   # G-0186 꽃 든 채 발밑 심을 칸·심은 꽃 셋 둘레 격자(메모리에서만)
	["fs_fishing", FOREST, [["near", "Fishing", 0.0, 5.0]]],
	## G-0047 — 집 안: 벽지 한지·장판 마루로 놓고 가구 여섯(컷 동안만, 세이브 안 건드림)
	["fs_room", FOREST, [["set", "/root/ForestSaveState", "wall_key", "hanji"], ["set", "/root/ForestSaveState", "floor_key", "wood"], ["touch", "House", "_on_enter_house"],
		["call", "House", "_spawn_furniture_visual", [{"key": "bangseok", "x": -1.2, "z": 1.8}]], ["call", "House", "_spawn_furniture_visual", [{"key": "soban", "x": 0.0, "z": 1.2}]],
		["call", "House", "_spawn_furniture_visual", [{"key": "deungjan", "x": 1.4, "z": 1.6}]], ["call", "House", "_spawn_furniture_visual", [{"key": "mulhang", "x": -2.2, "z": 0.2}]],
		["call", "House", "_spawn_furniture_visual", [{"key": "mungab", "x": 2.2, "z": 0.4}]], ["call", "House", "_spawn_furniture_visual", [{"key": "byeongpung", "x": 0.0, "z": 2.6}]]]],
	# G-0051 — 옷은 메모리에서만 바꾼다(저장은 저장 단추로만 — 세이브 파일 안 바뀜)
	# 들판 카메라(14m)로는 몸이 20화소라 팔 길이 3.5m 로 당겨 찍는다. _plain 은 기본 옷(비교용) — 자동 로드는 컷 사이에 남으니 옷을 늘 명시한다.
	["fs_hearts", FOREST, [["static", "res://tools/shot_forest.gd", "open_keeper_menu", ["@tree"]]]],   # G-0064 관계 하트 줄
	["fs_wear", FOREST, [["set", "/root/ForestSaveState", "wear_on", {"coat": "leather", "head": "topknot", "dye": "crimson", "cape": "on"}], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 3.5]]],
	["fs_wear_gat", FOREST, [["set", "/root/ForestSaveState", "wear_on", {"coat": "plate", "head": "gat", "dye": "crimson", "cape": "on"}], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 3.5]]],   # G-0063 갓·덧옷·갑옷
	["fs_wear_plain", FOREST, [["set", "/root/ForestSaveState", "wear_on", {"coat": "leather", "head": "topknot", "dye": "none", "cape": "off"}], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 3.5]]],
	["fs_wear_menu", FOREST, [["set", "/root/ForestSaveState", "wear_on", {"coat": "leather", "head": "topknot", "dye": "crimson", "cape": "on"}], ["call", "Villager", "_open_wear_menu", [{}, "@box"]]]],
	["fs_fishing_near", FOREST, [["near", "Fishing", 0.0, 2.6]]],   # G-0046 — 못 가까이
	## G-0048 — 사가나락 노획물 여섯(보스 노획·전설 배율 40 — 등급색 외곽선·전설 잔광) · 사가종횡 동굴 사다리 · 사가천하 일기토 1합째
	# G-0049 — 출사표 창 먼저 닫고, 줍기 반경(1.4m)+몸 밖 3m 에 떨군다(1.6m 는 찍기 전에 주워졌다)
	# 화면 앞(+z)은 카메라 밑이라 안 보인다 — 전부 옆·뒤(-z)에. 앞 셋은 전설 배율 1000(전설 확정), 뒤 셋은 보통.
	["dg_loot", DUNGEON, [["free_modal"], ["static", LOOT, "spawn_at", ["@scene", "@near:3.2:0", 30, true, false, 1000.0]], ["static", LOOT, "spawn_at", ["@scene", "@near:-3.2:0", 30, true, false, 1000.0]],
		["static", LOOT, "spawn_at", ["@scene", "@near:0:-3.2", 30, true, false, 1000.0]], ["static", LOOT, "spawn_at", ["@scene", "@near:2.6:-5.2", 30, false, true, 1.0]],
		["static", LOOT, "spawn_at", ["@scene", "@near:-2.6:-5.2", 30, false, false, 1.0]], ["static", LOOT, "spawn_at", ["@scene", "@near:0:-6.6", 30, false, false, 1.0]]]],
	["st_offer", "res://games/saga_story/world/TestField.tscn", [["free_modal"], ["static", "res://tools/shot_story_offer.gd", "stage", ["@tree"]]]],   # G-0197 레벨업 무예 3택 창
	["st_field_front", "res://games/saga_story/world/TestField.tscn", [["free_modal"]]],   # G-0187 사냥터 — 앞 층 풀·바위·큰 인물(화면 높이 약 1/7)
	["st_forest_front", "res://games/saga_story/world/ForestHuntGround.tscn", [["free_modal"]]],   # 숲 사냥터도
	["st_ladder", STORY_CAVE, [["near", "LadderArea", -1.4, 0.0]]],
	# G-0050 — 시나리오를 시작해야 장수 명단이 생겨 등용 설전 문제가 뽑힌다
	["rk_debate", REALM, [["free_modal"], ["call", "/root/RealmSaveState", "start_scenario", ["194"]], ["call", "RealmHUD/OrderButton", "_start_order", ["hire", "등용", "@box"]]]],
	# G-0054 — 화질/성능. 사가만리 둘은 설정 파일을 안 쓰고(save=false) 메모리에서만 바꾼다 — forward_plus 로 찍어야 SSAO 차이가 보인다.
	["rk_errlog", REALM, [["free_modal"], ["call", "RealmHUD/GraphicsButton/GraphicsMenu", "_open_errors", ["@box"]]]],   # G-0068 오류 기록 창
	["rk_autosave_flash", REALM, [["free_modal"], ["call", "AutosaveTimer", "flash", [30.0]]]],   # G-0069 자동 저장 표시
	["rk_slots", REALM, [["free_modal"], ["call", "SaveTransfer", "open_screen", []]]],   # G-0070 슬롯 줄
	["rk_gfx_menu", REALM, [["free_modal"], ["call", "RealmHUD/GraphicsButton/GraphicsMenu", "open_screen", []]]],
	["go_trail", GO, [["static", "res://tools/shot_trail.gd", "stage", ["@tree"]], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 6.0]]],   # G-0195 흔적 표식·읽기 단추·미니맵 큰 짐승(메모리에서만)
	["go_gfx_quality", GO, [["static", GFX, "set_mode", ["quality", "@tree", false]]]],
	["go_gfx_perf", GO, [["static", GFX, "set_mode", ["performance", "@tree", false]]]],
	["go_dialogue", GO, [["call", "StoryQuest", "open_dialogue", [[["촌장", "먹구름이 몰려오기 전에 포구 사공을 찾아가게. 길은 강을 따라 남쪽일세."], ["나", "알겠습니다."]], "@noop"]]]],   # G-0055 건너뛰기 단추
	["go_dialogue_choice", GO, [["call", "StoryQuest", "open_dialogue", [[["?", ["바로 가겠습니다.", "먼저 장터에 들르겠습니다.", "사공이 누구인지 더 묻는다."]]], "@noop"]]]],   # G-0056 고르는 줄
	["go_photo", GO, [["call", "MobileHUD/PhotoModeButton", "_on_pressed", []], ["call", "MobileHUD/PhotoModeButton", "_on_capture_pressed", []]]],   # G-0057 — SAGA_PHOTO_DIR 에 사진이 하나 생긴다
	# G-0060 — 성유물 없음 / ★5 Lv20 다섯(메모리에서만, tools/shot_armor.gd), 팔 3.2m 근접
	["go_armor_none", GO, [["static", "res://tools/shot_armor.gd", "dress", ["@tree", false]], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 3.2]]],
	["go_armor_full", GO, [["static", "res://tools/shot_armor.gd", "dress", ["@tree", true]], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 3.2]]],
	["go_assist", GO, [["static", "res://tools/shot_assist.gd", "stage", ["@tree"]]]],   # G-0071 협공 — 찍기 직전 대기 동료가 끼어든다(명단은 메모리에서만)
	["go_monsters", GO, [["static", "res://tools/shot_monsters.gd", "line_up", ["@tree"]], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 6.0]]],   # G-0059 들판 여덟 종(G-0082 기본 GLB 몸, SAGA_CODE_CREATURES=1 이면 코드 짐승)
	["rk_tactics", REALM, [["free_modal"], ["static", "res://tools/shot_realm_tactics.gd", "stage", ["@tree", true, false, true]]]],   # G-0183 전술판 3D — 앞장 장수를 골라 이동 칸·명중률(메모리에서만)
	["rk_tactics_cut", REALM, [["free_modal"], ["static", "res://tools/shot_realm_tactics.gd", "stage", ["@tree", false, true]]]],   # G-0191 공격 컷 구도(어깨 너머)
	["rk_news", REALM, [["free_modal"], ["static", "res://tools/shot_realm_tactics.gd", "news", ["@tree"]]]],   # G-0194 영내 소식 카드(태수 한 줄·세 갈래)
	["rk_tactics_wide", REALM, [["free_modal"], ["static", "res://tools/shot_realm_tactics.gd", "stage", ["@tree", false]]]],   # G-0183 판 전체(고르기 전)
	["rk_story", REALM, [["free_modal"], ["call", "/root/RealmSaveState", "start_scenario", ["194"]], ["set", "/root/RealmSaveState", "scenario_ready", true]]],   # G-0088 사가천하 이야기 첫 카드(새 판 194)
	["rk_act7", REALM, [["free_modal"], ["call", "/root/RealmSaveState", "start_scenario", ["194"]], ["set", "/root/RealmSaveState", "story", {"next": 16, "done": ["r1_start", "r1_rift_sign", "r1_first_ally", "r2_fallen", "r2_plains", "r2_debate", "r3_navigator", "r3_river", "r3_duel", "r4_rift", "r4_plague", "r4_tomb", "r5_silk", "r5_west", "r5_south", "r6_end"], "picks": {"r1_start": "def", "r1_rift_sign": "def", "r1_first_ally": "def", "r2_fallen": "def", "r2_plains": "def", "r2_debate": "def", "r3_navigator": "def", "r3_river": "def", "r3_duel": "def", "r4_rift": "def", "r4_plague": "def", "r4_tomb": "def", "r5_silk": "def", "r5_west": "def", "r5_south": "def", "r6_end": "def"}}], ["set", "/root/RealmSaveState", "result", "win"], ["set", "/root/RealmSaveState", "roster", ["sg_zhugeliang", "tm_gangseo", "tm_gongseok", "tm_geumdam", "tm_myeongbyeon", "tm_doha", "tm_seongyeon", "tm_gwedo", "tm_eunha", "tm_yeongjeom"]], ["set", "/root/RealmSaveState", "scenario_ready", true]]],   # G-0152 7막 첫 카드(6막까지 끝·승리·시간 틈 아홉 모임 — 메모리에서만)
	["st_story", "res://games/saga_story/world/SinyaField.tscn", []],   # G-0087 사가종횡 이야기 첫 대화(새 판 신야성)
	["fs_story", FOREST, []],   # G-0086 사가마을 이야기 첫 대화(새 판)
	["dg_belt_room", DUNGEON, [["free_modal"], ["static", "res://tools/shot_dungeon_belt.gd", "stage", ["@tree", 1.0]]]],   # G-0185 벨트 카메라 — 첫 방 가운데(SAGA_DG_CAM=diablo 로 같이 돌리면 옛 시점)
	["dg_belt_corridor", DUNGEON, [["free_modal"], ["static", "res://tools/shot_dungeon_belt.gd", "stage", ["@tree", -10.0]]]],   # 첫 통로 — 다음 방이 오른쪽
	["dg_death_card", DUNGEON, [["free_modal"], ["static", "res://tools/shot_dungeon_belt.gd", "die", ["@tree"]]]],   # G-0193 사망 카드 세 줄 + 첫 방 은총 자리에서 다시 섬
	["dg_story", DUNGEON, [["free_modal"]]],
	["dg_room_wide", DUNGEON, [["free_modal"], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 14.0], ["set", "Player/CameraRig", "rotation_degrees", Vector3(-40.0, 0.0, 0.0)]]],   # G-0112 첫 방 전체(어두움 판정)   # G-0085 사가나락 이야기 첫 대화(새 판 — 출사표 창을 닫으면 뜬다)
	["go_cave_dirt", GO, [["call", "CaveInterior", "enter"], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 5.0], ["set", "Player/CameraRig", "rotation_degrees", Vector3(-25.0, 180.0, 0.0)]]],   # G-0098 굴 안 흙 복도
	["go_cave_lava", GO, [["call", "CaveInterior", "enter"], ["call", "CaveInterior", "goto_room", [2]], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 6.0], ["set", "Player/CameraRig", "rotation_degrees", Vector3(-30.0, 270.0, 0.0)]]],   # 용암 방(적 셋)
	["go_cave_end", GO, [["call", "CaveInterior", "enter"], ["call", "CaveInterior", "goto_room", [3]], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 9.0], ["set", "Player/CameraRig", "rotation_degrees", Vector3(-35.0, 0.0, 0.0)]]],   # 끝 그릇 굴·보물
	["go_house_hanok", GO, [["call", "HouseInteriors", "scan_doors"], ["call", "HouseInteriors", "enter", ["house_4"]], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 6.0], ["set", "Player/CameraRig", "rotation_degrees", Vector3(-48.0, 0.0, 0.0)]]],   # G-0061 집 안 — 기와집(천장 뺀 인형의 집 시점)
	["go_house_inn", GO, [["call", "HouseInteriors", "scan_doors"], ["call", "HouseInteriors", "enter", ["waystation"]], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 6.0], ["set", "Player/CameraRig", "rotation_degrees", Vector3(-48.0, 0.0, 0.0)]]],   # 역참 객사
	["go_house_barn", GO, [["call", "HouseInteriors", "scan_doors"], ["call", "HouseInteriors", "enter", ["vhouse_4"]], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 6.0], ["set", "Player/CameraRig", "rotation_degrees", Vector3(-48.0, 0.0, 0.0)]]],   # 헛간(다락)
	["go_pets", GO, [["static", "res://tools/shot_pets.gd", "line_up", ["@tree"]], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 7.0], ["set", "Player/CameraRig", "rotation_degrees", Vector3(-18.0, 0.0, 0.0)]]],   # G-0084 신수 열하나
	["go_bosses0", GO, [["static", "res://tools/shot_monsters.gd", "line_up_bosses", ["@tree", 0]], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 9.0], ["set", "Player/CameraRig", "rotation_degrees", Vector3(-12.0, 0.0, 0.0)]]],   # G-0082 보스 열여섯(넷씩)
	["go_bosses1", GO, [["static", "res://tools/shot_monsters.gd", "line_up_bosses", ["@tree", 1]], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 9.0], ["set", "Player/CameraRig", "rotation_degrees", Vector3(-12.0, 0.0, 0.0)]]],
	["go_bosses2", GO, [["static", "res://tools/shot_monsters.gd", "line_up_bosses", ["@tree", 2]], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 9.0], ["set", "Player/CameraRig", "rotation_degrees", Vector3(-12.0, 0.0, 0.0)]]],
	["go_bosses3", GO, [["static", "res://tools/shot_monsters.gd", "line_up_bosses", ["@tree", 3]], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 9.0], ["set", "Player/CameraRig", "rotation_degrees", Vector3(-12.0, 0.0, 0.0)]]],
	["go_glide", GO, [["static", "res://tools/shot_glide.gd", "lift", ["@tree"]], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 5.0]]],   # G-0072 활공 날개(glider_01.glb)
	["go_rematch_gate", GO, [["static", GFX, "set_mode", ["performance", "@tree", false]], ["static", "res://tools/shot_rematch.gd", "gate", ["@tree"]], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 7.0], ["set", "Player/CameraRig", "rotation_degrees", Vector3(-22.0, 0.0, 0.0)]]],   # G-0112 13부 뒤 재대결 비경 입구(메모리에서만)
	["go_rematch_in", GO, [["static", GFX, "set_mode", ["performance", "@tree", false]], ["static", "res://tools/shot_rematch.gd", "inside", ["@tree"]], ["set", "Player/CameraRig/SpringArm3D", "spring_length", 7.0], ["set", "Player/CameraRig", "rotation_degrees", Vector3(-22.0, 0.0, 0.0)]]],   # G-0112 그 비경 안 보스
	["go_story13", GO, [["static", "res://tools/shot_story13.gd", "duel", ["@tree"]]]],   # G-0074 13부 43장 그날의 검은 가면(회차·이야기는 메모리에서만)
	["go_story17", GO, [["static", "res://tools/shot_story13.gd", "duel17", ["@tree"]]]],   # G-0080 17부 56장 놓지 못한 선장의 잔상(메모리에서만)
	["go_story16", GO, [["static", "res://tools/shot_story13.gd", "duel16", ["@tree"]]]],   # G-0079 16부 53장 선로를 감은 번개 이무기(메모리에서만)
	["go_story15", GO, [["static", "res://tools/shot_story13.gd", "duel15", ["@tree"]]]],   # G-0078 15부 50장 멈춘 진수대의 쇠 거신(메모리에서만)
	["go_story14", GO, [["static", "res://tools/shot_story13.gd", "duel14", ["@tree"]]]],   # G-0077 14부 47장 그 밤의 서리 구미호(메모리에서만)
	["rk_orders", REALM, [["free_modal"], ["call", "RealmHUD/OrderButton", "_on_pressed", []]]],   # G-0052 — 긴 글 열 줄 선택 창
	["rk_duel", REALM, [["free_modal"], ["call", "RealmHUD/AttackButton", "_duel_round", ["enemy", []]]]],
]

var _done := 0


func _initialize() -> void:
	var dir := OS.get_environment("SHOT_DIR")
	var only := OS.get_environment("SHOT_ONLY").split(",", false)
	var settle := maxi(int(OS.get_environment("SHOT_SETTLE")), SETTLE)
	var perf := OS.get_environment("SHOT_PERF") != ""   # G-0112 — 화면 밖 창 + 화질 모드의 SDFGI 조각을 피해 성능 모드로(저장 안 함)
	for cut: Array in CUTS:
		if not only.is_empty() and not only.has(String(cut[0])):
			continue
		change_scene_to_file(String(cut[1]))
		for f in settle:
			await process_frame
			if f == STEP_AT:
				if perf:
					(load(GFX) as GDScript).call("set_mode", "performance", self, false)
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
		if n == null:   # 경로로 못 찾으면 그 이름의 첫 노드(지형 빌더·attach 가 만드는 노드 — G-0069 에서 near 밖으로 넓힘)
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
