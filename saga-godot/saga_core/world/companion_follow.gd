extends Node3D

## 101-3 G "동행 실루엣" — 부대에 등용한 인원 수만큼 플레이어 뒤를 따라
## 붙는 장식용 실루엣. 전투·충돌·AI 판단이 전혀 없는 순수 시각 표시라
## CollisionShape를 안 둔다(플레이어를 밀거나 막을 수 없다). GO
## test_village.gd·DUNGEON test_room.gd가 각자의 등용 신호(PartyState.
## power_changed·DungeonPartyState.party_changed)를 듣고 set_count()만
## 부른다 — "누가 등용됐는가"는 이 스크립트가 몰라도 된다.

const FOLLOW_DISTANCE := 1.4 # 한 칸 뒤 간격(m)
const FOLLOW_SPEED := 3.2 # m/s — 플레이어 이동속도보다 살짝 빠르게 해 안 벌어지게
const SIDE_SPREAD := 0.9
const CAPSULE_RADIUS := 0.35
const CAPSULE_HEIGHT := 1.5
const SILHOUETTE_COLOR := Color(0.05, 0.05, 0.09, 0.55)

var leader: Node3D
var _followers: Array[Node3D] = []

func _ready() -> void:
	add_to_group("companion_follow")
	set_process(false)

## G-0071 협공 — i 번째 실루엣의 가슴 자리(없으면 null). 사가만리 field_assist.gd 가 빛줄기 시작점으로 쓴다.
func follower_pos(i: int) -> Variant:
	if i < 0 or i >= _followers.size():
		return null
	return _followers[i].global_position + Vector3.UP * (CAPSULE_HEIGHT * 0.65)

func setup(p_leader: Node3D) -> void:
	leader = p_leader
	set_process(leader != null)

func set_count(n: int) -> void:
	while _followers.size() < n:
		_followers.append(_spawn_one())
	while _followers.size() > n:
		var f: Node3D = _followers.pop_back()
		f.queue_free()

func _spawn_one() -> Node3D:
	var body := Node3D.new()
	body.name = "Companion%d" % _followers.size()
	var mi := MeshInstance3D.new()
	var mesh := CapsuleMesh.new()
	mesh.radius = CAPSULE_RADIUS
	mesh.height = CAPSULE_HEIGHT
	mi.mesh = mesh
	mi.position = Vector3(0, CAPSULE_HEIGHT * 0.5, 0)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = SILHOUETTE_COLOR
	mi.material_override = mat
	body.add_child(mi)
	add_child(body)
	if leader != null:
		body.global_position = leader.global_position
	return body

func _process(delta: float) -> void:
	if leader == null:
		return
	var back := -leader.global_transform.basis.z
	var right := leader.global_transform.basis.x
	for i in range(_followers.size()):
		var rank := i + 1
		var side := 0.0
		if i % 2 == 0 and i > 0:
			side = -SIDE_SPREAD
		elif i % 2 == 1:
			side = SIDE_SPREAD
		var target := leader.global_position + back * (FOLLOW_DISTANCE * rank) + right * side
		var f := _followers[i]
		f.global_position = f.global_position.move_toward(target, FOLLOW_SPEED * delta)
