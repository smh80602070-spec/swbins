extends RefCounted
## G-0400 촬영 도우미 — 1만리 마을 들판에서 무리 습격을 바로 시작한다(다음 틱에 파도 1이 둘레에 선다). 저장 안 함.


static func open(tree: SceneTree) -> void:
	var rd := tree.current_scene.find_child("GoRaid", true, false)
	if rd == null:
		print("GO_RAID 없음")
		return
	rd.set("pending", true)
	print("GO_RAID 시작")
