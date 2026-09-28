extends RefCounted

## saga-godot 2026-09-28 — 새로 까는 풍경(나무·마을 집·소품)이 막으면 안 되는 자리 목록(데이터에서 읽는다, 지역별).
## 이야기 인물 칸·이야기/세계 임무 단계 칸·보물 상자·별조각·채집 무리·비경 입구·순간이동 지점.
## vegetation_builder.gd(나무)·village_dressing.gd(집·소품)가 같이 쓴다. 장면에만 있는 것(Area3D·인물 몸)은 쓰는 쪽이 따로 본다.
## 서로 preload 가 얽히지 않게 표 파일은 load() 로 읽는다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")

static var _cache: Dictionary = {}


static func of(region: String) -> Array[Vector3]:
	if _cache.has(region):
		return _cache[region]
	var cells: Array = []
	var story: GDScript = load("res://games/saga_go/data/story.gd")
	for id in story.NPCS:
		_cell_of(cells, region, story.NPCS[id])
	for ch in story.CHAPTERS:
		for key in ["steps", "appear", "stations"]:
			for s in ch.get(key, []):
				if s is Dictionary:
					_cell_of(cells, region, s)
	var wq: GDScript = load("res://games/saga_go/data/world_quests.gd")
	for q in wq.ORDER:
		for s in wq.QUESTS[q].get("steps", []):
			_cell_of(cells, region, s)
	for row in load("res://games/saga_go/data/cooking.gd").PATCHES:
		if String(row[2]) == region:
			cells.append(row[3])
	var domains: GDScript = load("res://games/saga_go/data/domains.gd")
	for id in domains.DOMAINS:
		var gate: Array = domains.DOMAINS[id].get("gate", [])
		if gate.size() == 2 and String(gate[0]) == region:
			cells.append(gate[1])
	for row in load("res://games/saga_go/world/treasure_spawner.gd").CHESTS:
		if String(row[1]) == region:
			cells.append(row[2])
	for row in load("res://games/saga_go/world/star_shards.gd").SHARDS:
		if String(row[1]) == region:
			cells.append(row[2])
	for row in load("res://games/saga_go/world/waypoints.gd").POINTS:
		if String(row[1]) == region:
			cells.append(row[2])
	var out: Array[Vector3] = []
	for c in cells:
		if c is Vector2:
			var p := TestMap.world_pos(c.x, c.y, region)
			p.y = TerrainBuilder.height_at(region, p)
			out.append(p)
	_cache[region] = out
	return out


static func _cell_of(cells: Array, region: String, d: Dictionary) -> void:
	if String(d.get("region", "")) == region and d.get("cell") is Vector2:
		cells.append(d.cell)


## p 가 목록의 어느 자리와 수평 거리 r 안이면 true.
static func near(region: String, p: Vector3, r: float) -> bool:
	for k in of(region):
		if Vector2(k.x - p.x, k.z - p.z).length() < r:
			return true
	return false
