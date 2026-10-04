extends Node
## R-3(gd.dg.cave-mood) 사가블로 굴혈 mood 3종(흙·석회·용암) + 문 아치 — scene_probe_host 로 돈다(오토로드 필요).
## ① mood 셋이 서로 다르고 방·문·복도 표가 셋 다 갖는다 ② 표의 GLB 가 전부 열린다 ③ 방 번호 → mood 가 순환(0,1,2,0,…)
## ④ 문 아치(ExitGate·EntranceGate)에 메시가 실제로 있고(09-23 빠뜨렸던 버그) 방 남북 끝에 놓인다

const TestRoom := preload("res://games/saga_dungeon/world/test_room.gd")

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func run() -> int:
	var room := TestRoom.new()  # 트리에 안 넣는다 — _ready(방 일곱 짓기)를 안 돌리고 함수만 쓴다
	var moods: Array = TestRoom.ROOM_MOODS
	if moods.size() != 3 or moods[0] == moods[1] or moods[1] == moods[2] or moods[0] == moods[2]:
		_fail("mood 가 셋이 아니거나 겹친다: %s" % [moods])
	var tables := {"방": TestRoom.MOOD_ROOM_GLB, "문": TestRoom.MOOD_GATE_GLB, "복도": TestRoom.MOOD_CORRIDOR_GLB}
	for label in tables:
		var table: Dictionary = tables[label]
		for mood in moods:
			if not table.has(mood):
				_fail("%s 표에 mood %s 없음" % [label, mood])
			elif load(String(table[mood])) == null:
				_fail("%s %s GLB 안 열림: %s" % [label, mood, table[mood]])
	for i in 7:
		if room._mood_for_room(i) != moods[i % 3]:
			_fail("방 %d 의 mood 가 순환이 아니다" % i)
	room._spawn_gate(0.0, true, 0)
	room._spawn_gate(0.0, false, 1)
	var exit_gate := room.get_node_or_null("ExitGate") as MeshInstance3D
	var entrance_gate := room.get_node_or_null("EntranceGate") as MeshInstance3D
	if exit_gate == null or exit_gate.mesh == null:
		_fail("ExitGate 메시 없음(문 아치가 빈 노드)")
	elif not is_equal_approx(exit_gate.position.z, -TestRoom.ROOM_HALF.z):
		_fail("ExitGate 가 방 북쪽 끝이 아님: %s" % exit_gate.position)
	if entrance_gate == null or entrance_gate.mesh == null:
		_fail("EntranceGate 메시 없음")
	elif not is_equal_approx(entrance_gate.position.z, TestRoom.ROOM_HALF.z):
		_fail("EntranceGate 가 방 남쪽 끝이 아님: %s" % entrance_gate.position)
	room.free()
	return fails
