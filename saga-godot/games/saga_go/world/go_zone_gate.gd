extends Node

## G-0385 1만리 지역 나눔(웹 W-0414 ② 짝 — 폰 발열) — 주인공이 선 지역 + 변을 맞댄 지역만 켜고 나머지는 숨긴다.
##   대상: 제 노드 아래 통째로 짓는 일곱(Region4Frost~Region10Fork). 마을·포구·폐허 셋은 공용 Terrain·Vegetation 에 섞여 늘 켬.
##   끄기 = visible false 만(그리기·그림자 후보에서 빠짐). 스크립트·충돌은 그대로 둔다 — process_mode DISABLED 는 충돌체를
##   물리에서 빼서 그 땅 위 들판 적이 떨어지고, _process 만 꺼도 점검이 옆 지역으로 옮긴 직후(0.25초 틱 전) 지역 문이 안 열렸다
##   (probe crossing gate_open_walk). 지역 스크립트 _process 는 가벼워 끄는 이득도 재어 보니 없었다(G-0385 메모).
##   0.25초마다 region_at 한 번(매 틱 셈 금지). 지역이 바뀌면 넘김 막(saga_core/ui/zone_cut.gd) 덮고 켜고 끔 → 저절로 걷힘.
##   순간이동(waypoints.teleport)은 옮기기 전에 sync_to(도착 자리) — 도착 지역부터 켠다.
##   SAGA_ZONE_SPLIT=0 이면 늘 다 켬(옛 방식).

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const ZoneCut := preload("res://saga_core/ui/zone_cut.gd")

const GATED := {
	"frost": "Region4Frost", "skyport": "Region5Skyport", "crossing": "Region6Crossing", "sunken": "Region7Sunken",
	"amber": "Region8Amber", "vault": "Region9Vault", "fork": "Region10Fork",
}
const TICK_SEC := 0.25
const EDGE_GAP_M := 24.0      # 이만큼 떨어져도 변을 맞댄 것으로(지역 격자 사이 틈)
const EDGE_SHARE_M := 120.0   # 맞댄 변이 이만큼은 겹쳐야 이웃 — 마을(528m)이 넓어 대각선 지역과도 48m 겹친다(그건 이웃 아님)

var _nodes := {}          # 지역 id → Node3D
var _cur := ""
var _t := 0.0
var _player: Node3D


static func on() -> bool:
	return OS.get_environment("SAGA_ZONE_SPLIT") != "0"


static func rect_of(id: String) -> Rect2:
	var o: Vector3 = TestMap.origin_of(id)
	var s: Vector2i = TestMap.size(id)
	var ts: float = TestMap.tile_size_of(id)
	var w := Vector2(s.x * ts, s.y * ts)
	return Rect2(Vector2(o.x, o.z) - w * 0.5, w)


static func neighbors(id: String) -> Array:
	var out: Array = []
	var a := rect_of(id)
	for other in TestMap.REGIONS:
		if other == id:
			continue
		var b := rect_of(other)
		var gx := maxf(b.position.x - a.end.x, a.position.x - b.end.x)   # 음수 = 겹침
		var gy := maxf(b.position.y - a.end.y, a.position.y - b.end.y)
		var ox := minf(a.end.x, b.end.x) - maxf(a.position.x, b.position.x)
		var oy := minf(a.end.y, b.end.y) - maxf(a.position.y, b.position.y)
		if (gx <= EDGE_GAP_M and oy >= EDGE_SHARE_M) or (gy <= EDGE_GAP_M and ox >= EDGE_SHARE_M):
			out.append(other)
	return out


## 이 지역에 서면 켜 둘 지역들(자기 + 이웃).
static func live_set(id: String) -> Array:
	return [id] + neighbors(id)


func _ready() -> void:
	name = "ZoneGate"
	add_to_group("go_zone_gate")
	var host := get_parent()
	for id in GATED:
		var n := host.get_node_or_null(String(GATED[id])) as Node3D
		if n:
			_nodes[id] = n


func current() -> String:
	return _cur


func live_count() -> int:
	var c := 0
	for id in _nodes:
		c += 1 if (_nodes[id] as Node3D).visible else 0
	return c


func is_live(id: String) -> bool:
	return _nodes.has(id) and (_nodes[id] as Node3D).visible


func _process(delta: float) -> void:
	if not on():
		if _cur != "*":
			_apply_all(true)
			_cur = "*"
		return
	_t -= delta
	if _t > 0.0:
		return
	_t = TICK_SEC
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
		if _player == null:
			return
	sync_to(_player.global_position)


## 이 자리 지역으로 맞춘다(바뀌었으면 막 덮고). 지역 밖(경계 틈)이면 그대로.
func sync_to(pos: Vector3) -> void:
	if not on():
		return
	var r: String = TestMap.region_at(pos)
	if r == "" or r == _cur:
		return
	if _cur != "" and _cur != "*":
		ZoneCut.begin(get_tree())   # 첫 맞춤(불러온 직후)은 막 없이
	_cur = r
	var live := live_set(r)
	for id in _nodes:
		_set_live(_nodes[id], live.has(id))


func _apply_all(v: bool) -> void:
	for id in _nodes:
		_set_live(_nodes[id], v)


func _set_live(n: Node3D, v: bool) -> void:
	if n.visible == v:
		return
	n.visible = v
