extends RefCounted

## G-0195 — 1만리 사냥 의뢰 루프 규칙(웹 W-0101 · track.js 의 고돗 짝, 몬헌의 "추적 → 사냥 → 소재"만 — 이름·수치는 이 판 것).
## 길에 흔적 여섯 종이 칸 해시로 깔리고(세이브 없이 늘 같은 자리), 같은 날 셋을 읽으면 그 지역 들판 보스(data/field_bosses.gd)가
## "오늘의 큰 짐승"이 되어 미니맵·목표판에 뜬다. 쓰러뜨리면 부위(쓰러뜨림 1 + 2단계에 닿음 1 + 원소 방패를 깸 1, 최대 3) × 4 작은 광석 + 중간 광석 2
## — 무기 벼림 재료(weapons.gd ORES). 의뢰는 하루 하나(commissions.gd today() — 새벽 4시에 바뀜), 상태는 PartyState.trail 한 칸.
## 칸 좌표는 정수 = 칸 가운데(test_map.gd grid_at 약속). 흔적은 들판 보스가 있는 네 지역(마을·포구·폐허·서리봉)에만, 걸을 수 있는 칸의 SHARE 만큼. 순수 함수 — 화면은 world/trail.gd.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const FB := preload("res://games/saga_go/data/field_bosses.gd")

const SHARE := 0.42        # 웹 track.share 0.42 그대로(0.35 는 빈칸이 덜 줄었다)
const NEED := 3            # 같은 날 이만큼 읽으면 큰 짐승이 선다
const READ_M := 3.0        # 이 안에서 F
const JITTER_M := 14.0     # 칸 가운데에서 흩는 폭(48m 칸)
const KINDS := ["발자국", "긁힌 나무", "깃털", "뜯긴 풀", "물가 발자국", "부러진 가지"]
const KIND_COL := [Color(0.42, 0.3, 0.2), Color(0.55, 0.38, 0.2), Color(0.92, 0.9, 0.86), Color(0.45, 0.62, 0.3), Color(0.3, 0.42, 0.5), Color(0.5, 0.36, 0.22)]
## 지역마다 나오는 흔적 — 그 지역 수호자 꼴(수리왕 깃털·거북왕 물가 발자국·도깨비왕 부러진 가지·바위곰왕 발자국)
const REGION_KINDS := {
	"village": ["긁힌 나무", "깃털", "뜯긴 풀"],
	"coast": ["물가 발자국", "깃털"],
	"ruins": ["부러진 가지", "발자국"],
	"frost": ["발자국", "부러진 가지"],
}
const ORE_PER_PART := 4    # 부위 하나 = 작은 광석 4(웹 가루 ×4 자리)
const ORE_M_BONUS := 2     # 중간 광석 2(웹 광석 2 자리)


static func hash01(seed: String, salt: String) -> float:
	var h := 2166136261
	var s := seed + "|" + salt
	for i in s.length():
		h = h ^ s.unicode_at(i)
		h = (h * 16777619) & 0xFFFFFFFF
	h = h ^ (h >> 13)
	h = (h * 1274126177) & 0xFFFFFFFF
	h = h ^ (h >> 16)
	return float(h) / 4294967296.0


## 그 지역의 흔적 칸 — [{key, region, pos(땅 높이 포함), kind}]. 결정적(같은 지도 = 같은 자리)
static func cells(region: String) -> Array:
	var out: Array = []
	if not REGION_KINDS.has(region):
		return out
	var sz := TestMap.size(region)
	var kinds: Array = REGION_KINDS[region]
	for y in sz.y:
		for x in sz.x:
			var t := TestMap.tile_at(x, y, region)
			if not TerrainBuilder.LEGEND.has(t) or not bool(TerrainBuilder.LEGEND[t].walkable) or t == "H" or t == "B":
				continue
			var key := "%s:%d,%d" % [region, x, y]
			if hash01("trail", key) >= SHARE:
				continue
			var p := TestMap.world_pos(float(x), float(y), region)
			p += Vector3((hash01("jx", key) - 0.5) * 2.0 * JITTER_M, 0.0, (hash01("jz", key) - 0.5) * 2.0 * JITTER_M)
			var gp := TestMap.grid_at(region, p)
			if TestMap.tile_at(gp.x, gp.y, region) != t:   # 흩다가 이웃 칸(산·물)으로 넘어가면 칸 가운데로
				p = TestMap.world_pos(float(x), float(y), region)
			p.y = TerrainBuilder.height_at(region, p)
			out.append({"key": key, "region": region, "pos": p, "kind": String(kinds[int(floor(hash01("kind", key) * kinds.size())) % kinds.size()])})
	return out


static func all_cells() -> Array:
	var out: Array = []
	for r: String in REGION_KINDS.keys():
		out.append_array(cells(r))
	return out


## 그 지역 들판 보스 id(없으면 "")
static func boss_of_region(region: String) -> String:
	for id: String in FB.ORDER:
		if String(FB.BOSSES[id].region) == region:
			return id
	return ""


## 날이 바뀌면 새로 — st = PartyState.trail
static func ensure_day(st: Dictionary, day: int) -> void:
	if int(st.get("day", -1)) != day:
		st.clear()
		st["day"] = day
		st["read"] = []
		st["boss"] = ""
		st["done"] = false


## 흔적 하나를 읽는다 — 돌려줌 {ok, count, boss(새로 섰으면 그 id)}
static func read(st: Dictionary, day: int, key: String, region: String) -> Dictionary:
	ensure_day(st, day)
	var rd: Array = st.read
	if rd.has(key):
		return {"ok": false, "count": rd.size(), "boss": ""}
	rd.append(key)
	var newly := ""
	if rd.size() >= NEED and String(st.boss) == "" and not bool(st.done):
		newly = boss_of_region(region)
		st.boss = newly
	return {"ok": true, "count": rd.size(), "boss": newly}


## 오늘의 큰 짐승을 쓰러뜨렸다 — 상이면 넣을 것(PartyState.add_items 모양), 아니면 {}. 하루 한 번.
static func on_kill(st: Dictionary, day: int, boss_id: String, parts: int) -> Dictionary:
	ensure_day(st, day)
	if bool(st.done) or String(st.boss) == "" or String(st.boss) != boss_id:
		return {}
	st.done = true
	var p := clampi(parts, 1, 3)
	return {"ore_s": p * ORE_PER_PART, "ore_m": ORE_M_BONUS}


## 부위 수 — 쓰러뜨림 1 + 2단계에 닿음 1 + 원소 방패를 깸 1
static func parts_of(reached_phase2: bool, shield_broken: bool) -> int:
	return 1 + (1 if reached_phase2 else 0) + (1 if shield_broken else 0)
