extends RefCounted
## G-0084 촬영 도우미 — shot_scene.gd 의 static 단계가 부른다. 플레이어 앞(카메라가 보는 -z 쪽)에 신수 열하나를 한 줄로
## 세운다(카메라 쪽을 본 채 서기 애니). 기본은 신수 GLB 몸(PetBody), SAGA_CODE_CREATURES=1 이면 코드 신수.

const Pets := preload("res://saga_core/data/pets.gd")
const PetBody := preload("res://saga_core/world/pet_body.gd")

static func line_up(tree: SceneTree) -> void:
	var p := tree.get_first_node_in_group("player") as Node3D
	if p == null:
		return
	var n := Pets.PETS.size()
	var i := 0
	for pet: Dictionary in Pets.PETS:
		var b := PetBody.build(String(pet.id), 1.2)
		var glb := String(b.name) == "PetBody"   # add_child 가 겹치는 이름을 바꾸기 전에
		tree.current_scene.add_child(b)
		b.global_position = p.global_position + Vector3((float(i) - (n - 1) * 0.5) * 1.55, 0.0, -6.0)
		print("SHOT_PET %s %s" % [pet.id, PetBody.path_for(String(pet.id)) if glb else "code"])
		i += 1
